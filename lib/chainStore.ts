"use client";

/**
 * Thin hook centralizing per-chain contract lookup so components don't
 * each re-derive `getContractAddresses(useChainId())`. Also exposes the
 * chain metadata and a `isSupported` flag for guard banners.
 */

import { useChainId } from "wagmi";
import { CHAIN_REGISTRY, DEFAULT_CHAIN_ID, getChainMeta } from "./chains";
import { CONTRACT_ADDRESSES_BY_CHAIN } from "./addresses";

export function useChainContracts() {
  const wagmiChainId = useChainId();
  const chainId =
    wagmiChainId in CHAIN_REGISTRY ? wagmiChainId : DEFAULT_CHAIN_ID;
  const isSupported = wagmiChainId in CHAIN_REGISTRY;
  const isDeployed = chainId in CONTRACT_ADDRESSES_BY_CHAIN;

  const contracts = isDeployed
    ? CONTRACT_ADDRESSES_BY_CHAIN[chainId]
    : null;
  const chainMeta = getChainMeta(chainId);

  return {
    chainId,
    walletChainId: wagmiChainId,
    isSupported,
    isDeployed,
    contracts,
    chainMeta,
  };
}
