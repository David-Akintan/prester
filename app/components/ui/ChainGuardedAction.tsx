"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { getChainMeta } from "@/lib/chains";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ChainGuardedActionProps {
  jobChainId: number | null | undefined;
  label: string;
  children: ReactNode;
  containerClassName?: string;
}

export function ChainGuardedAction({
  jobChainId,
  label,
  children,
  containerClassName,
}: ChainGuardedActionProps) {
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  if (jobChainId == null || walletChainId === jobChainId) {
    return <>{children}</>;
  }

  const jobChainMeta = getChainMeta(jobChainId);

  return (
    <div className={cn("space-y-2", containerClassName)}>
      <button
        type="button"
        disabled
        aria-disabled
        title={`Switch your wallet to ${jobChainMeta?.name ?? "the job's network"} to ${label.toLowerCase()}.`}
        className="w-full rounded-lg border border-default bg-muted py-2.5 text-sm font-semibold text-muted cursor-not-allowed"
      >
        {label}
      </button>
      <p className="text-center text-xs text-muted leading-relaxed">
        This job is on{" "}
        <span className="font-medium text-fg">
          {jobChainMeta?.name ?? `chain ${jobChainId}`}
        </span>
        . Switch networks to continue.
      </p>
      {jobChainMeta && (
        <button
          type="button"
          disabled={isSwitching}
          onClick={async () => {
            try {
              await switchChainAsync({ chainId: jobChainId });
            } catch (err) {
              console.error("[ChainGuardedAction] switch failed:", err);
            }
          }}
          className="w-full rounded-lg border border-[var(--color-foreground)] py-2.5 text-xs font-medium uppercase tracking-widest text-fg transition hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] disabled:opacity-50"
        >
          {isSwitching ? "Switching…" : `Switch to ${jobChainMeta.name}`}
        </button>
      )}
    </div>
  );
}
