import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Copy, Eye, EyeOff, Flame, ShieldAlert, Key } from 'lucide-react';
import {
    generateEphemeralWallet,
    getEphemeralPrivateKey,
    clearEphemeralWallet,
    loadEphemeralWallet,
    getWalletAddress
} from '@/lib/wallet';
import { toast } from 'sonner';

interface EphemeralWalletModalProps {
    open: boolean;
    onClose: () => void;
    onWalletCreated: (address: string) => void;
    onWalletDestroyed: () => void;
}

export function EphemeralWalletModal({
    open,
    onClose,
    onWalletCreated,
    onWalletDestroyed
}: EphemeralWalletModalProps) {
    const [step, setStep] = useState<'create' | 'manage'>('create');
    const [privateKey, setPrivateKey] = useState<string | null>(null);
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [address, setAddress] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            checkExistingWallet();
        }
    }, [open]);

    const checkExistingWallet = async () => {
        const existingAddress = loadEphemeralWallet();
        if (existingAddress) {
            setAddress(existingAddress);
            setStep('manage');
            setPrivateKey(getEphemeralPrivateKey());
        } else {
            setStep('create');
            setPrivateKey(null);
            setAddress(null);
        }
    };

    const handleCreate = () => {
        const wallet = generateEphemeralWallet();
        setAddress(wallet.address);
        setPrivateKey(wallet.privateKey);
        setStep('manage');
        onWalletCreated(wallet.address);
        toast.success('Burner wallet created!');
    };

    const handleDestroy = () => {
        if (window.confirm('Are you sure? This will delete the key forever. Funds will be lost if not exported.')) {
            clearEphemeralWallet();
            setAddress(null);
            setPrivateKey(null);
            setStep('create');
            onWalletDestroyed();
            onClose();
            toast.success('Wallet destroyed');
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-surface border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        Ephemeral "Burner" Wallet
                    </DialogTitle>
                    <DialogDescription>
                        A temporary wallet stored only in your browser. Perfect for one-time privacy.
                    </DialogDescription>
                </DialogHeader>

                {step === 'create' ? (
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm text-orange-200">
                            <div className="flex items-start gap-2">
                                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold mb-1">Warning</p>
                                    <p>
                                        This wallet lives in your browser's session. If you clear your cache or close this tab without exporting,
                                        <strong> any funds will be lost forever.</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="hero"
                            className="w-full gap-2"
                            onClick={handleCreate}
                        >
                            <Flame className="w-4 h-4" />
                            Create Burner Wallet
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {/* Address Display */}
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Wallet Address</label>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-border">
                                <code className="text-xs font-mono flex-1 break-all text-foreground">
                                    {address}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => address && copyToClipboard(address, 'Address')}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Private Key Display */}
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground flex items-center justify-between">
                                <span>Private Key</span>
                                <span className="text-xs text-danger uppercase font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Highly Sensitive
                                </span>
                            </label>
                            <div className="relative">
                                <div className={`p-3 rounded-lg bg-surface-elevated border border-border ${!showPrivateKey ? 'blur-sm select-none' : ''}`}>
                                    <code className="text-xs font-mono break-all text-foreground block min-h-[40px]">
                                        {showPrivateKey ? privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                                    </code>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                                        className="text-xs"
                                    >
                                        {showPrivateKey ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                        {showPrivateKey ? 'Hide' : 'Reveal'}
                                    </Button>
                                    {showPrivateKey && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => privateKey && copyToClipboard(privateKey, 'Private Key')}
                                            className="text-xs"
                                        >
                                            <Copy className="w-3 h-3 mr-1" />
                                            Copy
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                            <Button
                                variant="destructive"
                                onClick={handleDestroy}
                                className="w-full sm:w-auto gap-2"
                            >
                                <Flame className="w-4 h-4" />
                                Burn Wallet
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={onClose}
                                className="w-full sm:w-auto"
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
