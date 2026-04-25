/**
 * Single source of truth for every chain Prester supports.
 *
 * Adding a new chain (Arbitrum, Base, Ethereum mainnet…) is a single-entry
 * change: add the entry to CHAIN_REGISTRY, deploy contracts via
 * `scripts/deploy.ts`, fill in the address slot in `CONTRACT_ADDRESSES_BY_CHAIN`.
 * The wagmi config, ChainSwitcher, backend listener spawner, and everything
 * else derive from this registry.
 */

import {
  sepolia,
  celoAlfajores,
  baseSepolia,
  celo,
  base,
} from "viem/chains";
import { defineChain, type Chain } from "viem";

// Celo Sepolia — the testnet MiniPay's developer mode targets.
// The installed viem (2.23.x) doesn't yet ship `celoSepolia`, so define it
// inline. Once viem is bumped, this can be replaced with the upstream import.
export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: {
      name: "Celo Sepolia Blockscout",
      url: "https://celo-sepolia.blockscout.com",
    },
  },
  testnet: true,
});

// Prester's Minitia EVM rollup. Chain ID + RPC come from env so the rollup
// can be launched without a code change.
export const minitiaEvm = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_MINITIA_CHAIN_ID ?? "2594729740794688"),
  name: process.env.NEXT_PUBLIC_MINITIA_NAME ?? "Prester L2",
  nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_MINITIA_RPC_URL ??
          "https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz",
      ],
      webSocket: [
        process.env.NEXT_PUBLIC_MINITIA_WS_URL ??
          "wss://jsonrpc-ws-evm-1.anvil.asia-southeast.initia.xyz",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Initia Scan",
      url:
        process.env.NEXT_PUBLIC_MINITIA_EXPLORER_URL ??
        "https://scan.testnet.initia.xyz/evm-1",
    },
  },
});

export interface ChainMeta {
  name: string;
  shortName: string;
  viemChain: Chain;
  isTestnet: boolean;
  // Used for per-chain UI accents — keep neutral so adding new chains
  // is a one-line job.
  accentColor: string;
  // Block explorer URL template; {{tx}} is replaced with the hash.
  explorerUrl: string;
}

export const CHAIN_REGISTRY: Record<number, ChainMeta> = {
  [sepolia.id]: {
    name: "Sepolia",
    shortName: "SEP",
    viemChain: sepolia,
    isTestnet: true,
    accentColor: "#627EEA",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  [minitiaEvm.id]: {
    name: minitiaEvm.name,
    shortName: "L2",
    viemChain: minitiaEvm,
    isTestnet: true,
    accentColor: "#000000",
    explorerUrl: minitiaEvm.blockExplorers.default.url,
  },
  [celoAlfajores.id]: {
    name: "Celo Alfajores",
    shortName: "CELO",
    viemChain: celoAlfajores,
    isTestnet: true,
    accentColor: "#FCFF52",
    explorerUrl: "https://alfajores.celoscan.io",
  },
  [celoSepolia.id]: {
    name: "Celo Sepolia",
    shortName: "CELO",
    viemChain: celoSepolia,
    isTestnet: true,
    accentColor: "#FCFF52",
    explorerUrl: "https://celo-sepolia.blockscout.com",
  },
  [baseSepolia.id]: {
    name: "Base Sepolia",
    shortName: "BASE",
    viemChain: baseSepolia,
    isTestnet: true,
    accentColor: "#0052FF",
    explorerUrl: "https://sepolia.basescan.org",
  },
  [celo.id]: {
    name: "Celo",
    shortName: "CELO",
    viemChain: celo,
    isTestnet: false,
    accentColor: "#FCFF52",
    explorerUrl: "https://celoscan.io",
  },
  [base.id]: {
    name: "Base",
    shortName: "BASE",
    viemChain: base,
    isTestnet: false,
    accentColor: "#0052FF",
    explorerUrl: "https://basescan.org",
  },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_REGISTRY).map(Number);

export function getChainMeta(chainId: number | undefined): ChainMeta | null {
  if (chainId == null) return null;
  return CHAIN_REGISTRY[chainId] ?? null;
}

export function isSupportedChain(chainId: number | undefined): boolean {
  return chainId != null && chainId in CHAIN_REGISTRY;
}

// Native token symbol for a given chain (ETH, CELO, GAS…). Pulled from
// viem's chain metadata. Falls back to "ETH" when the chain is unknown —
// safer than crashing, and every UI callsite treats the symbol as a plain
// label. Pair with `ethToWei` / `formatEth`, which operate on 18-decimal
// native units and work for every EVM chain we support today.
export function getNativeSymbol(chainId: number | null | undefined): string {
  const meta = getChainMeta(chainId ?? undefined);
  return meta?.viemChain.nativeCurrency.symbol ?? "ETH";
}

// Default chain for pre-wallet / SSR reads. Base mainnet is the production
// default — cheapest L2 gas, widest wallet support. Clients should pass
// `chainId` from wagmi (`useChainId()`) wherever possible rather than
// relying on this.
export const DEFAULT_CHAIN_ID: number = base.id;
