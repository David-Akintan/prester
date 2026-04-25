/**
 * Central configuration for the Prester frontend.
 *
 * Chain-agnostic: contract addresses and chain metadata are looked up
 * per `chainId`. Components should prefer `useChainContracts()` from
 * `@/lib/chainStore` over the deprecated `config.contracts` alias.
 */

import {
  CONTRACT_ADDRESSES_BY_CHAIN,
  getContractAddresses,
  CONTRACT_ADDRESSES,
} from "./addresses";
import { CHAIN_REGISTRY, getChainMeta, DEFAULT_CHAIN_ID } from "./chains";

// Rebuild the old `SUPPORTED_CHAINS` shape from the new registry so any
// call-sites that still use it keep working during migration.
export const SUPPORTED_CHAINS: Record<string, { name: string; rpcUrl: string }> =
  Object.fromEntries(
    Object.entries(CHAIN_REGISTRY).map(([id, meta]) => [
      id,
      {
        name: meta.name,
        rpcUrl: meta.viemChain.rpcUrls.default.http[0] ?? "",
      },
    ]),
  );

/**
 * Returns the contract addresses for a given chain.
 * Throws if the chain is not in the registry / not deployed to.
 */
export function getContracts(chainId: number) {
  return getContractAddresses(chainId);
}

/**
 * Chain metadata (name, explorer, native currency, …) for a given chain.
 * Returns null for unsupported chains so callers can render a fallback UI.
 */
export function getChain(chainId: number) {
  return getChainMeta(chainId);
}

export const ipfsGateway =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";

/** Convert an IPFS URI (ipfs://…) to an HTTP URL via the gateway */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", ipfsGateway);
  }
  return uri;
}

// ─────────────────────────────────────────────────────────────
// Deprecated `config` export — kept so existing imports compile.
// New code should use getContracts(chainId) + getChain(chainId).
// ─────────────────────────────────────────────────────────────

const defaultMeta = getChainMeta(DEFAULT_CHAIN_ID);

export const config = {
  contracts: {
    escrowAddress: CONTRACT_ADDRESSES.FreelanceEscrow,
    reputationAddress: CONTRACT_ADDRESSES.Reputation,
    judgeRegistryAddress: CONTRACT_ADDRESSES.JudgeRegistry,
  },

  chain: {
    chainId: String(DEFAULT_CHAIN_ID),
    chainIdHex: `0x${DEFAULT_CHAIN_ID.toString(16)}`,
    name: defaultMeta?.name ?? "Unknown",
    rpcUrl: defaultMeta?.viemChain.rpcUrls.default.http[0] ?? "",
  },

  ipfs: {
    gateway: ipfsGateway,
  },
} as const;

export function isContractDeployed(chainId?: number): boolean {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  return id in CONTRACT_ADDRESSES_BY_CHAIN;
}

// ─────────────────────────────────────────────────────────────
// Request timeouts and cache settings
// ─────────────────────────────────────────────────────────────

/** Default API request timeout in milliseconds */
export const API_REQUEST_TIMEOUT_MS = 30000;

/** Cache duration for user profile data in milliseconds */
export const PROFILE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** Slow request threshold for performance monitoring in milliseconds */
export const SLOW_REQUEST_THRESHOLD_MS = 3000;
