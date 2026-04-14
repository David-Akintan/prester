"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/app/components/wallet/WalletContext";

export function OnboardingBanner() {
  const { isConnected, isAuthenticated, connect } = useWallet();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (isConnected && isAuthenticated)) return null;

  return (
    <div className="border-b border-black bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-widest">
              How Prester works
            </p>
            <p className="text-xs text-neutral-400 max-w-xl">
              Post a job → lock payment in escrow → freelancer delivers
              milestone by milestone → AI judge resolves any disputes. No
              middlemen. Funds release automatically on approval.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isAuthenticated && (
              <button
                onClick={connect}
                className="border border-white px-4 py-2 text-xs font-medium uppercase tracking-widest transition hover:bg-white hover:text-black"
              >
                Connect Wallet
              </button>
            )}
            <Link
              href="/jobs"
              className="border border-neutral-600 px-4 py-2 text-xs font-medium uppercase tracking-widest text-neutral-400 transition hover:border-white hover:text-white"
            >
              Browse Jobs
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="text-neutral-600 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
