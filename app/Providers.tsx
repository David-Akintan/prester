"use client";

import { PropsWithChildren, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  InterwovenKitProvider,
  injectStyles,
  TESTNET,
} from "@initia/interwovenkit-react";
import interwovenKitStyles from "@initia/interwovenkit-react/styles.js";
import { wagmiConfig, queryClient } from "@/lib/initia";

export default function Providers({ children }: PropsWithChildren) {
  useEffect(() => {
    injectStyles(interwovenKitStyles);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <InterwovenKitProvider {...TESTNET} defaultChainId="evm-1">
          {children}
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
