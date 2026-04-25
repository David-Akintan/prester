"use client";

/**
 * useMiniPay — the one-hook MiniPay integration.
 *
 * MiniPay (Celo's stablecoin wallet) injects `window.ethereum` and sets
 * `window.ethereum.isMiniPay = true`. Per Celo's MiniPay quickstart, a Mini
 * App should:
 *   1. Detect MiniPay on mount.
 *   2. Auto-connect via the injected connector (wallet connection is implicit
 *      inside MiniPay — no Connect button should be shown).
 *   3. Treat MiniPay as a known-good wallet and skip any wallet-picker UI.
 *
 * Returns `{ isMiniPay, isReady }` so consumers can branch UI without
 * reaching for `window` themselves (SSR-safe).
 */

import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function useMiniPay(): { isMiniPay: boolean; isReady: boolean } {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { isConnected } = useAccount();
  const { connect } = useConnect();

  useEffect(() => {
    const detected = !!window.ethereum?.isMiniPay;
    setIsMiniPay(detected);
    setIsReady(true);

    if (detected && !isConnected) {
      // Mirror the Celo MiniPay docs sample: target metaMask so the injected
      // connector picks the EIP-1193 provider MiniPay exposes.
      connect({ connector: injected({ target: "metaMask" }) });
    }
  }, [connect, isConnected]);

  return { isMiniPay, isReady };
}
