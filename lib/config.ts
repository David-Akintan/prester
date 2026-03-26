/**
 * Central configuration for the Prester frontend.
 * Uses deployed contract addresses directly to avoid environment variable timing issues.
 */

import { CONTRACT_ADDRESSES } from "./addresses";

// Supported networks — swap NEXT_PUBLIC_CHAIN to switch
// "1"        = Ethereum Mainnet
// "11155111" = Sepolia Testnet  ← default for development
export const SUPPORTED_CHAINS: Record<
  string,
  { name: string; rpcUrl: string }
> = {
  "1": {
    name: "Ethereum Mainnet",
    rpcUrl:
      process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://eth.llamarpc.com",
  },
  "11155111": {
    name: "Sepolia Testnet",
    rpcUrl:
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
  },
};

const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111";

export const config = {
  contracts: {
    escrowAddress: CONTRACT_ADDRESSES.FreelanceEscrow,
    reputationAddress: CONTRACT_ADDRESSES.Reputation,
  },

  chain: {
    chainId,
    chainIdHex: `0x${parseInt(chainId).toString(16)}`,
    name: SUPPORTED_CHAINS[chainId]?.name ?? "Sepolia Testnet",
    rpcUrl: SUPPORTED_CHAINS[chainId]?.rpcUrl ?? "https://rpc.sepolia.org",
  },

  ipfs: {
    gateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/",
  },
} as const;

export function isContractDeployed(): boolean {
  // Using hardcoded deployed addresses, so always return true
  return true;
}

/** Convert an IPFS URI (ipfs://...) to an HTTP URL via the gateway */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", config.ipfs.gateway);
  }
  return uri;
}
