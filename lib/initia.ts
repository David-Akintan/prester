// filepath: frontend/my-app/lib/initia.ts

import { createConfig, http } from "wagmi";
import { initiaPrivyWalletConnector } from "@initia/interwovenkit-react";
import { QueryClient } from "@tanstack/react-query";
import { defineChain } from "viem";

export const initiaEvm = defineChain({
  id: 31337,
  name: "MiniEVM",
  nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz"],
      webSocket: ["wss://jsonrpc-ws-evm-1.anvil.asia-southeast.initia.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Initia Scan",
      url: "https://scan.testnet.initia.xyz/evm-1",
    },
  },
});

export const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [initiaEvm],
  transports: { [initiaEvm.id]: http() },
});

export const queryClient = new QueryClient();
