/**
 * Wagmi + InterwovenKit configuration.
 *
 * Phase 1: Sepolia testnet (contracts already deployed there).
 * Phase 3: Will switch to own Minitia EVM rollup with IBC integration.
 *
 * The chain definition is driven by NEXT_PUBLIC_CHAIN_ID env var
 * so we can flip networks without code changes.
 */

import { createConfig, http } from "wagmi";
import { initiaPrivyWalletConnector } from "@initia/interwovenkit-react";
import { QueryClient } from "@tanstack/react-query";
import { defineChain } from "viem";
import { sepolia } from "viem/chains";

// ── Chain configuration ──────────────────────────────────────

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

// Initia Minitia EVM — used in Phase 3 when rollup is live
const minitiaEvm = defineChain({
  id: 2594729740794688,
  name: "Prester Minitia (EVM)",
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
      url: "https://scan.testnet.initia.xyz/evm-1",
    },
  },
});

// Pick chain based on env
const activeChain = (chainId === minitiaEvm.id ? minitiaEvm : sepolia) as
  | typeof sepolia
  | typeof minitiaEvm;

export const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [sepolia, minitiaEvm],
  transports: {
    [sepolia.id]: http(),
    [minitiaEvm.id]: http(),
  },
});

export const queryClient = new QueryClient();

// Re-export for components that need chain metadata
export { activeChain };
