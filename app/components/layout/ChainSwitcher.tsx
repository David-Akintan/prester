"use client";

import { useState, useRef, useEffect } from "react";
import { useChainId, useSwitchChain, useAccount } from "wagmi";
import { CHAIN_REGISTRY, getChainMeta } from "@/lib/chains";
import { cn } from "@/lib/utils";

/**
 * Header dropdown for switching between every chain in CHAIN_REGISTRY.
 * Delegates the actual wallet-side switch to wagmi's `useSwitchChain`,
 * which routes through InterwovenKit because the connector is mounted.
 *
 * `variant="inline"` renders only the chain list (no trigger button), used
 * when embedding inside another popover (e.g. the wallet pill).
 */
export default function ChainSwitcher({
  variant = "button",
}: {
  variant?: "button" | "inline";
} = {}) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (variant === "inline") return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [variant]);

  const activeMeta = getChainMeta(chainId);
  const entries = Object.entries(CHAIN_REGISTRY);

  async function handleSelect(targetId: number) {
    setOpen(false);
    if (targetId === chainId) return;
    try {
      await switchChainAsync({ chainId: targetId });
    } catch (err) {
      console.error("[ChainSwitcher] switch failed:", err);
    }
  }

  if (variant === "inline") {
    return (
      <ul
        role="listbox"
        className="flex flex-col gap-0.5"
      >
        {entries.map(([id, meta]) => {
          const numId = Number(id);
          const active = numId === chainId;
          return (
            <li
              key={id}
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => handleSelect(numId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(numId);
                }
              }}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 text-xs cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:bg-muted",
                active
                  ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                  : "hover:bg-muted text-fg",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.accentColor }}
                />
                <span className="font-medium">{meta.name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {meta.isTestnet && (
                  <span className="text-[10px] uppercase tracking-wider opacity-70">
                    testnet
                  </span>
                )}
                {active && (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 border border-default bg-surface px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
          "hover:border-[var(--color-foreground)] disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2",
          !activeMeta && "border-red-500",
        )}
        title={activeMeta ? `Active: ${activeMeta.name}` : "Unsupported network"}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: activeMeta?.accentColor ?? "#ef4444" }}
        />
        <span className="font-mono">
          {activeMeta?.shortName ?? "UNSUPPORTED"}
        </span>
        <svg
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-1rem)] border border-default bg-surface shadow-2xl z-50 rounded-lg overflow-hidden animate-fade-in"
        >
          {entries.map(([id, meta]) => {
            const numId = Number(id);
            const active = numId === chainId;
            return (
              <li
                key={id}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onClick={() => handleSelect(numId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(numId);
                  }
                }}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2.5 text-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-foreground)]",
                  active
                    ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                    : "hover:bg-muted text-fg",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.accentColor }}
                  />
                  <span className="font-medium">{meta.name}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {meta.isTestnet && (
                    <span className="text-[10px] uppercase tracking-wider opacity-70">
                      testnet
                    </span>
                  )}
                  {active && (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {isConnected && !activeMeta && (
        <p className="absolute right-0 top-full mt-2 w-64 text-xs bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-2 rounded-lg">
          Your wallet is on an unsupported network. Switch to continue.
        </p>
      )}
    </div>
  );
}
