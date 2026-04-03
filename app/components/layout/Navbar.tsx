"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useWallet,
  type ConnectStep,
} from "@/app/components/wallet/WalletContext1.0";
import { shortenAddress, cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { useNotifications } from "@/hooks/useNotifications";
import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";

// Human-readable label for each step in the connect flow
const STEP_LABEL: Record<ConnectStep, string> = {
  idle: "Connect Wallet",
  requesting_accounts: "Opening Wallet...",
  switching_network: "Switching to Sepolia...",
  awaiting_signature: "Sign Message...",
  verifying: "Verifying...",
  done: "Connected",
  error: "Try Again",
};

export default function Navbar() {
  const pathname = usePathname();
  const {
    address,
    isConnected,
    isConnecting,
    isAuthenticated,
    isWrongNetwork,
    connectStep,
    walletError,
    authError,
    clearAuthError,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();

  const { username, openWallet } = useInterwovenKit();

  const { notifications, unread, markAllRead } =
    useNotifications(isAuthenticated);
  const [showNotifs, setShowNotifs] = useState(false);

  const navLinks = [
    { href: "/jobs", label: "Browse Jobs" },
    { href: "/jobs/new", label: "Post a Job" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  // Show whichever error exists — wallet errors take priority
  const activeError = walletError ?? authError;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-300 bg-white/95 backdrop-blur-md animate-slide-down">
        <div className="container mx-auto flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-3 animate-scale-in"
          >
            <div className="flex h-8 w-8 items-center justify-center border border-black bg-black transition-all group-hover:bg-white group-hover:text-black rounded-lg">
              <span className="text-sm font-bold text-white group-hover:text-black font-mono">
                P
              </span>
            </div>
            <span className="text-lg font-bold tracking-tight text-black group-hover:text-gray-700 transition-colors">
              Prester
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-all duration-200 animate-slide-up",
                  pathname === link.href
                    ? "text-black font-semibold"
                    : "text-gray-600 hover:text-black",
                )}
                style={{ animationDelay: `${index * 75}ms` }}
              >
                {link.label}
                {pathname === link.href && (
                  <div className="absolute inset-x-0 -bottom-px h-0.5 bg-black animate-slide-in" />
                )}
              </Link>
            ))}
          </nav>

          {/* Wallet */}
          <div
            className="flex items-center gap-3 animate-slide-up"
            style={{ animationDelay: "225ms" }}
          >
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                {/* Auth status indicator */}
                <span
                  className={cn(
                    "hidden border px-2 py-1 text-xs font-medium sm:inline-flex items-center gap-2 transition-all animate-scale-in rounded-full",
                    isAuthenticated
                      ? "border-black bg-black text-white"
                      : "border-gray-300 bg-gray-100 text-gray-600",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full animate-pulse",
                      isAuthenticated ? "bg-white" : "bg-gray-400",
                    )}
                  />
                  {isAuthenticated ? "Signed in" : "Not Signed in"}
                </span>

                {/* Address pill */}
                <div
                  onClick={openWallet}
                  className="flex items-center gap-2 border border-gray-300 bg-white px-3 py-1.5 text-sm cursor-pointer hover:border-black hover:bg-black hover:text-white transition-all animate-slide-in rounded-lg"
                >
                  <span className="font-mono text-sm">
                    {username ? `${username}.init` : shortenAddress(address)}
                  </span>
                </div>

                {isAuthenticated && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowNotifs((v) => !v);
                        if (unread > 0) markAllRead();
                      }}
                      className="relative border border-gray-300 bg-white p-2 text-sm transition hover:border-black hover:bg-black hover:text-white rounded-lg"
                      aria-label="Notifications"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-black text-white text-xs font-bold rounded-full">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>

                    {showNotifs && (
                      <div className="absolute right-0 top-full mt-2 w-80 border border-gray-300 bg-white shadow-2xl z-50 rounded-lg overflow-hidden">
                        <div className="border-b border-gray-300 px-4 py-3 flex items-center justify-between bg-gray-50">
                          <span className="text-xs font-semibold uppercase tracking-wider text-black">
                            Notifications
                          </span>
                          <button
                            onClick={() => setShowNotifs(false)}
                            className="text-gray-400 hover:text-black text-xs transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                          {notifications.length === 0 ? (
                            <p className="px-4 py-6 text-xs text-gray-500 text-center">
                              No notifications yet.
                            </p>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className={cn(
                                  "px-4 py-3 transition-colors",
                                  !n.read ? "bg-gray-50" : "bg-white",
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="mt-0.5 text-sm flex-shrink-0">
                                    {{
                                      bid_accepted: "🎉",
                                      milestone_submitted: "👀",
                                      milestone_approved: "✅",
                                      funds_received: "💸",
                                      funds_released: "✅",
                                      dispute_raised: "⚖️",
                                      verdict_executed: "🏆",
                                      job_cancelled: "❌",
                                      job_completed: "🎉",
                                    }[n.type] ?? "🔔"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-black truncate">
                                      {n.title}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                                      {n.message}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {new Date(
                                        n.created_at,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={disconnect}
                  className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-black transition-all hover:border-black hover:bg-black hover:text-white animate-scale-in rounded-lg"
                  style={{ animationDelay: "150ms" }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  clearAuthError();
                  connect();
                }}
                disabled={isConnecting}
                className={cn(
                  "group flex items-center gap-2 border border-black bg-black px-4 py-2 text-xs font-medium uppercase tracking-wide text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed animate-scale-in rounded-lg",
                  connectStep === "error"
                    ? "border-black bg-white text-black hover:bg-black hover:text-white"
                    : "border-black bg-black text-white hover:bg-white hover:text-black",
                )}
                style={{ animationDelay: "150ms" }}
              >
                {isConnecting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth={4}
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    {STEP_LABEL[connectStep] || "Connecting…"}
                  </>
                ) : (
                  <>
                    Connect Wallet
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wrong network banner */}
      {address && isWrongNetwork && (
        <div className="bg-black text-white text-xs font-medium uppercase tracking-wider px-4 py-2.5 flex items-center justify-center gap-4">
          <span>Wrong network -- please switch to {config.chain.name}</span>
          <button
            onClick={switchNetwork}
            className="border border-white px-3 py-1 text-xs uppercase tracking-wide transition hover:bg-white hover:text-black rounded"
          >
            Switch Network
          </button>
        </div>
      )}
    </>
  );
}
