import { ExternalLink, Send, CheckCircle2 } from 'lucide-react';
import { getExplorerUrl, type NetworkType } from '@/lib/wallet';
import { formatAddress } from '@/lib/wallet';

interface PaymentMessageProps {
    type: 'payment_request' | 'payment_sent';
    amount: string;
    token: 'MATIC' | 'ETH' | 'USDC';
    txHash?: string;
    recipientAddress?: string;
    isSender: boolean;
}

export function PaymentMessage({
    type,
    amount,
    token,
    txHash,
    recipientAddress,
    isSender
}: PaymentMessageProps) {
    const network: NetworkType = token === 'MATIC' ? 'polygon' : 'base';
    const explorerUrl = txHash ? getExplorerUrl(txHash, network) : null;

    if (type === 'payment_sent') {
        return (
            <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 ${isSender
                        ? 'bg-primary/20 border border-primary/30'
                        : 'bg-surface-elevated border border-border/50'
                    }`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSender ? 'bg-primary/20' : 'bg-primary/10'
                            }`}>
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-foreground">
                                    {isSender ? 'Payment Sent' : 'Payment Received'}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/30">
                                    {token}
                                </span>
                            </div>
                            <div className="font-mono text-2xl font-bold text-foreground mb-2">
                                {amount} {token}
                            </div>
                            {recipientAddress && (
                                <div className="text-xs text-muted-foreground mb-2">
                                    To: {formatAddress(recipientAddress)}
                                </div>
                            )}
                            {txHash && explorerUrl && (
                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                    <span className="font-mono">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // payment_request type
    return (
        <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${isSender
                    ? 'bg-surface-elevated border border-border/50'
                    : 'bg-danger/10 border border-danger/30'
                }`}>
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-danger/20">
                        <Send className="w-5 h-5 text-danger" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">
                                Payment Request
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs bg-danger/20 text-danger border border-danger/30">
                                {token}
                            </span>
                        </div>
                        <div className="font-mono text-xl font-bold text-foreground">
                            {amount} {token}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
