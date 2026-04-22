/**
 * Wagmi configuration.
 *
 * Chain list is derived from CHAIN_REGISTRY — adding a new chain in
 * `chains.ts` automatically lights it up in wagmi, the switcher, and
 * every contract hook.
 *
 * InterwovenKit is deferred until the Minitia rollup is live; we use
 * wagmi's injected/MetaMask connectors in the interim.
 */

import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { QueryClient } from "@tanstack/react-query";
import { CHAIN_REGISTRY } from "./chains";
import type { Chain } from "viem";

const registryEntries = Object.values(CHAIN_REGISTRY);
const chains = registryEntries.map((c) => c.viemChain) as [Chain, ...Chain[]];
const transports = Object.fromEntries(
  registryEntries.map((c) => [c.viemChain.id, http()]),
);

export const wagmiConfig = createConfig({
  connectors: [injected(), metaMask()],
  chains,
  transports,
});

export const queryClient = new QueryClient();
