import { BrowserProvider, JsonRpcSigner, Wallet, HDNodeWallet, formatEther, parseEther, JsonRpcProvider } from 'ethers';
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react';

// Mainnet network configurations
export const NETWORKS = {
    polygon: {
        chainId: 137,
        name: 'Polygon Mainnet',
        currency: 'MATIC',
        explorerUrl: 'https://polygonscan.com',
        rpcUrl: 'https://polygon-rpc.com'
    },
    base: {
        chainId: 8453,
        name: 'Base Mainnet',
        currency: 'ETH',
        explorerUrl: 'https://basescan.org',
        rpcUrl: 'https://mainnet.base.org'
    }
} as const;

export type NetworkType = keyof typeof NETWORKS;

// Web3Modal configuration for WalletConnect
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const metadata = {
    name: 'Ghost Chat',
    description: 'Privacy-first ephemeral chat with crypto payments',
    url: 'https://ghostchat.app',
    icons: ['https://ghostchat.app/icon.png']
};

const ethersConfig = defaultConfig({
    metadata,
    enableEIP6963: true,
    enableInjected: true,
    enableCoinbase: true,
    rpcUrl: NETWORKS.polygon.rpcUrl,
    defaultChainId: NETWORKS.polygon.chainId
});

// Initialize Web3Modal
export const web3Modal = createWeb3Modal({
    ethersConfig,
    chains: [
        {
            chainId: NETWORKS.polygon.chainId,
            name: NETWORKS.polygon.name,
            currency: NETWORKS.polygon.currency,
            explorerUrl: NETWORKS.polygon.explorerUrl,
            rpcUrl: NETWORKS.polygon.rpcUrl
        },
        {
            chainId: NETWORKS.base.chainId,
            name: NETWORKS.base.name,
            currency: NETWORKS.base.currency,
            explorerUrl: NETWORKS.base.explorerUrl,
            rpcUrl: NETWORKS.base.rpcUrl
        }
    ],
    projectId,
    enableAnalytics: false,
    enableOnramp: false
});

// Wallet state management
let currentProvider: BrowserProvider | null = null;
let currentSigner: JsonRpcSigner | null = null;
let ephemeralWallet: Wallet | HDNodeWallet | null = null;

/**
 * Connect to user's wallet via WalletConnect/MetaMask
 */
export async function connectWallet(): Promise<string> {
    try {
        await web3Modal.open();

        // Wait for wallet connection
        const walletProvider = web3Modal.getWalletProvider() as any; // Cast to any to bypass Eip1193Provider type mismatch
        if (!walletProvider) {
            throw new Error('No wallet provider found');
        }

        currentProvider = new BrowserProvider(walletProvider);
        currentSigner = await currentProvider.getSigner();
        const address = await currentSigner.getAddress();

        return address;
    } catch (error) {
        console.error('Wallet connection failed:', error);
        throw error;
    }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
    await web3Modal.close();
    currentProvider = null;
    currentSigner = null;
    ephemeralWallet = null;
}

/**
 * Get current connected wallet address
 */
export async function getWalletAddress(): Promise<string | null> {
    if (currentSigner) {
        return await currentSigner.getAddress();
    }
    if (ephemeralWallet) {
        return ephemeralWallet.address;
    }
    return null;
}

/**
 * Get wallet balance
 */
export async function getBalance(address?: string): Promise<string> {
    if (!currentProvider) {
        throw new Error('No wallet connected');
    }

    const addr = address || await getWalletAddress();
    if (!addr) {
        throw new Error('No address provided');
    }

    // specific provider for ephemeral wallet if no browser provider
    const provider = currentProvider || new JsonRpcProvider(NETWORKS.polygon.rpcUrl);

    const balance = await provider.getBalance(addr);
    return formatEther(balance);
}

/**
 * Send native token (MATIC/ETH) transaction
 */
export async function sendTransaction(
    to: string,
    amount: string
): Promise<string> {
    let signer: JsonRpcSigner | Wallet | HDNodeWallet | null = currentSigner;

    if (ephemeralWallet) {
        // Ephemeral wallet needs a provider to send transactions
        if (!ephemeralWallet.provider) {
            const provider = new JsonRpcProvider(NETWORKS.polygon.rpcUrl);
            ephemeralWallet = ephemeralWallet.connect(provider);
        }
        signer = ephemeralWallet;
    }

    if (!signer) {
        throw new Error('No wallet connected');
    }

    const tx = await signer.sendTransaction({
        to,
        value: parseEther(amount)
    });

    await tx.wait();
    return tx.hash;
}

const EPHEMERAL_WALLET_KEY = 'ghost_ephemeral_pk';

/**
 * Generate ephemeral wallet (privacy mode)
 */
export function generateEphemeralWallet(): { address: string; privateKey: string } {
    const wallet = Wallet.createRandom();
    ephemeralWallet = wallet;

    // Auto-save to session storage
    sessionStorage.setItem(EPHEMERAL_WALLET_KEY, ephemeralWallet.privateKey);

    return {
        address: ephemeralWallet.address,
        privateKey: ephemeralWallet.privateKey
    };
}

/**
 * Load persisted ephemeral wallet
 */
export function loadEphemeralWallet(): string | null {
    const pk = sessionStorage.getItem(EPHEMERAL_WALLET_KEY);
    if (pk) {
        ephemeralWallet = new Wallet(pk);
        return ephemeralWallet.address;
    }
    return null;
}

/**
 * Import ephemeral wallet from private key
 */
export function importEphemeralWallet(privateKey: string): string {
    ephemeralWallet = new Wallet(privateKey);
    return ephemeralWallet.address;
}

/**
 * Clear ephemeral wallet (called on room expiry or user action)
 */
export function clearEphemeralWallet(): void {
    ephemeralWallet = null;
    sessionStorage.removeItem(EPHEMERAL_WALLET_KEY);
}

/**
 * Export private key (for backup)
 */
export function getEphemeralPrivateKey(): string | null {
    if (!ephemeralWallet) return null;
    return ephemeralWallet.privateKey;
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected(): boolean {
    return currentSigner !== null || ephemeralWallet !== null;
}

/**
 * Get current network
 */
export async function getCurrentNetwork(): Promise<NetworkType | null> {
    if (!currentProvider) return null;

    const network = await currentProvider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId === NETWORKS.polygon.chainId) return 'polygon';
    if (chainId === NETWORKS.base.chainId) return 'base';

    return null;
}

/**
 * Switch network
 */
export async function switchNetwork(network: NetworkType): Promise<void> {
    if (!currentProvider) {
        throw new Error('No wallet connected');
    }

    const targetChainId = NETWORKS[network].chainId;

    try {
        await currentProvider.send('wallet_switchEthereumChain', [
            { chainId: `0x${targetChainId.toString(16)}` }
        ]);
    } catch (error: any) {
        // Chain not added, try to add it
        if (error.code === 4902) {
            await currentProvider.send('wallet_addEthereumChain', [
                {
                    chainId: `0x${targetChainId.toString(16)}`,
                    chainName: NETWORKS[network].name,
                    nativeCurrency: {
                        name: NETWORKS[network].currency,
                        symbol: NETWORKS[network].currency,
                        decimals: 18
                    },
                    rpcUrls: [NETWORKS[network].rpcUrl],
                    blockExplorerUrls: [NETWORKS[network].explorerUrl]
                }
            ]);
        } else {
            throw error;
        }
    }
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get block explorer URL for transaction
 */
export function getExplorerUrl(txHash: string, network: NetworkType): string {
    return `${NETWORKS[network].explorerUrl}/tx/${txHash}`;
}
