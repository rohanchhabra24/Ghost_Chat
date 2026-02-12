import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import {
    connectWallet,
    disconnectWallet,
    getWalletAddress,
    formatAddress,
    isWalletConnected,
    getCurrentNetwork,
    type NetworkType
} from '@/lib/wallet';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Flame, ChevronDown } from 'lucide-react';
import { EphemeralWalletModal } from './EphemeralWalletModal';
import { loadEphemeralWallet } from '@/lib/wallet';

interface WalletButtonProps {
    onConnect?: (address: string) => void;
    onDisconnect?: () => void;
}

export function WalletButton({ onConnect, onDisconnect }: WalletButtonProps) {
    const [address, setAddress] = useState<string | null>(null);
    const [network, setNetwork] = useState<NetworkType | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showEphemeralModal, setShowEphemeralModal] = useState(false);
    const [isEphemeral, setIsEphemeral] = useState(false);

    // Check for existing connection on mount
    useEffect(() => {
        const checkConnection = async () => {
            // Check for ephemeral wallet first
            const ephemeralAddr = loadEphemeralWallet();
            if (ephemeralAddr) {
                setAddress(ephemeralAddr);
                setIsEphemeral(true);
                // Ephemeral wallets are effectively on Polygon by default/convention for now, or just generic
                setNetwork('polygon');
            } else if (isWalletConnected()) {
                const addr = await getWalletAddress();
                const net = await getCurrentNetwork();
                setAddress(addr);
                setNetwork(net);
                setIsEphemeral(false);
            }
            setIsLoading(false);
        };

        checkConnection();
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const addr = await connectWallet();
            const net = await getCurrentNetwork();

            setAddress(addr);
            setNetwork(net);

            toast.success(`Wallet connected: ${formatAddress(addr)}`);
            onConnect?.(addr);
        } catch (error: any) {
            console.error('Wallet connection error:', error);
            toast.error(error.message || 'Failed to connect wallet');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnectWallet();
            // Also need to handle clearing state if it was ephemeral (handled by wallet lib but local state needs reset)
            setAddress(null);
            setNetwork(null);
            setIsEphemeral(false);
            toast.success('Wallet disconnected');
            onDisconnect?.();
        } catch (error: any) {
            console.error('Wallet disconnection error:', error);
            toast.error('Failed to disconnect wallet');
        }
    };

    const handleEphemeralCreated = (addr: string) => {
        setAddress(addr);
        setNetwork('polygon'); // Defaulting to Polygon for display
        setIsEphemeral(true);
        onConnect?.(addr);
    };

    const handleEphemeralDestroyed = () => {
        setAddress(null);
        setNetwork(null);
        setIsEphemeral(false);
        onDisconnect?.();
    };

    if (isLoading) {
        return (
            <Button variant="ghost" size="sm" disabled>
                <Loader2 className="w-4 h-4 animate-spin" />
            </Button>
        );
    }

    if (address) {
        return (
            <div className="flex items-center gap-2">
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isEphemeral
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : 'bg-surface-elevated border-border/50'
                        }`}
                >
                    {isEphemeral ? (
                        <Flame className="w-4 h-4 text-orange-500" />
                    ) : (
                        <Wallet className="w-4 h-4 text-primary" />
                    )}
                    <span className="text-sm font-mono text-foreground">
                        {formatAddress(address)}
                    </span>
                    {network && !isEphemeral && (
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-surface border border-border/30">
                            {network === 'polygon' ? 'Polygon' : 'Base'}
                        </span>
                    )}
                    {isEphemeral && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 px-1 text-xs text-orange-500 hover:text-orange-400 hover:bg-transparent"
                            onClick={() => setShowEphemeralModal(true)}
                        >
                            Manage
                        </Button>
                    )}
                </div>
                {!isEphemeral && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDisconnect}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <LogOut className="w-4 h-4" />
                    </Button>
                )}

                <EphemeralWalletModal
                    open={showEphemeralModal}
                    onClose={() => setShowEphemeralModal(false)}
                    onWalletCreated={handleEphemeralCreated}
                    onWalletDestroyed={handleEphemeralDestroyed}
                />
            </div>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="glass"
                        size="sm"
                        disabled={isConnecting}
                        className="gap-2"
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Wallet className="w-4 h-4" />
                                Connect
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-surface border-border">
                    <DropdownMenuItem onClick={handleConnect} className="cursor-pointer gap-2">
                        <Wallet className="w-4 h-4" />
                        External Wallet
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowEphemeralModal(true)} className="cursor-pointer gap-2 text-orange-500 focus:text-orange-500 focus:bg-orange-500/10">
                        <Flame className="w-4 h-4" />
                        Burner Wallet
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <EphemeralWalletModal
                open={showEphemeralModal}
                onClose={() => setShowEphemeralModal(false)}
                onWalletCreated={handleEphemeralCreated}
                onWalletDestroyed={handleEphemeralDestroyed}
            />
        </>
    );
}
