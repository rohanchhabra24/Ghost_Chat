import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import {
    sendTransaction,
    getBalance,
    getCurrentNetwork,
    getExplorerUrl,
    type NetworkType
} from '@/lib/wallet';
import { toast } from 'sonner';

interface SendCryptoModalProps {
    open: boolean;
    onClose: () => void;
    recipientAddress?: string;
    onSuccess: (txHash: string, amount: string, token: string) => void;
}

export function SendCryptoModal({
    open,
    onClose,
    recipientAddress,
    onSuccess
}: SendCryptoModalProps) {
    const [amount, setAmount] = useState('');
    const [balance, setBalance] = useState<string>('0');
    const [network, setNetwork] = useState<NetworkType | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [recipientAddr, setRecipientAddr] = useState(recipientAddress || '');

    useEffect(() => {
        if (open) {
            loadWalletInfo();
            if (recipientAddress) {
                setRecipientAddr(recipientAddress);
            }
        }
    }, [open, recipientAddress]);

    const loadWalletInfo = async () => {
        try {
            const bal = await getBalance();
            const net = await getCurrentNetwork();
            setBalance(bal);
            setNetwork(net);
        } catch (error) {
            console.error('Failed to load wallet info:', error);
        }
    };

    const handleSend = async () => {
        if (!recipientAddr) {
            toast.error('Recipient address is required');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (parseFloat(amount) > parseFloat(balance)) {
            toast.error('Insufficient balance');
            return;
        }

        setIsSending(true);
        try {
            const txHash = await sendTransaction(recipientAddr, amount);

            const token = network === 'polygon' ? 'MATIC' : 'ETH';
            toast.success(`Transaction sent! Hash: ${txHash.slice(0, 10)}...`);

            onSuccess(txHash, amount, token);
            onClose();

            // Reset form
            setAmount('');
        } catch (error: any) {
            console.error('Transaction failed:', error);
            toast.error(error.message || 'Transaction failed');
        } finally {
            setIsSending(false);
        }
    };

    const handleMaxClick = () => {
        // Leave a small amount for gas
        const maxAmount = Math.max(0, parseFloat(balance) - 0.01);
        setAmount(maxAmount.toFixed(6));
    };

    const token = network === 'polygon' ? 'MATIC' : 'ETH';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-surface border-border">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Send Crypto</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Balance Display */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border/50">
                        <span className="text-sm text-muted-foreground">Available Balance</span>
                        <span className="font-mono text-foreground">
                            {parseFloat(balance).toFixed(4)} {token}
                        </span>
                    </div>

                    {/* Network Badge */}
                    {network && (
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-1 rounded bg-primary/10 border border-primary/30">
                                <span className="text-xs text-primary font-medium">
                                    {network === 'polygon' ? 'Polygon Mainnet' : 'Base Mainnet'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Recipient Address */}
                    <div className="space-y-2">
                        <Label htmlFor="recipient" className="text-foreground">
                            Recipient Address
                        </Label>
                        <Input
                            id="recipient"
                            value={recipientAddr}
                            onChange={(e) => setRecipientAddr(e.target.value)}
                            placeholder="0x..."
                            className="font-mono text-sm bg-surface-elevated border-border"
                            disabled={!!recipientAddress}
                        />
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="amount" className="text-foreground">
                                Amount ({token})
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleMaxClick}
                                className="h-auto py-0 px-2 text-xs text-primary hover:text-primary"
                            >
                                MAX
                            </Button>
                        </div>
                        <Input
                            id="amount"
                            type="number"
                            step="0.000001"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            className="font-mono text-lg bg-surface-elevated border-border"
                        />
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30">
                        <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-danger">
                            <p className="font-medium mb-1">Blockchain transactions are permanent</p>
                            <p className="text-danger/80">
                                Double-check the recipient address. Transactions cannot be reversed.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isSending}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="hero"
                            onClick={handleSend}
                            disabled={isSending || !amount || !recipientAddr}
                            className="flex-1 gap-2"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send {token}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
