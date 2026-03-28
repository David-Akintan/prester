"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useWallet,
  type ConnectStep,
} from "@/app/components/wallet/WalletContext";
import { shortenAddress, cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { useNotifications } from "@/hooks/useNotifications";
import { useState } from "react";

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
      <header className="sticky top-0 z-50 border-b border-black bg-white animate-slideDown">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-3 animate-scaleIn"
          >
            <div className="flex h-10 w-10 items-center justify-center border border-black bg-black transition-all group-hover:bg-white group-hover:text-black ">
              <span className="text-sm font-bold text-white group-hover:text-black font-mono">
                P
              </span>
            </div>
            <span className="text-lg font-bold tracking-tight text-black group-hover:text-neutral-700 transition-colors">
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
                  "relative px-4 py-2 text-sm font-medium uppercase tracking-wide transition-all duration-200 animate-slideUp",
                  pathname === link.href
                    ? "text-black"
                    : "text-neutral-400 hover:text-black",
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {link.label}
                {pathname === link.href && (
                  <div className="absolute inset-x-0 -bottom-px h-px bg-black animate-slideIn" />
                )}
              </Link>
            ))}
          </nav>

          {/* Wallet */}
          <div
            className="flex items-center gap-4 animate-slideUp"
            style={{ animationDelay: "300ms" }}
          >
            {isConnected && address ? (
              <div className="flex items-center gap-3">
                {/* Auth status indicator */}
                <span
                  className={cn(
                    "hidden border px-3 py-1.5 text-xs font-medium uppercase tracking-wide sm:inline-flex items-center gap-2 transition-all animate-scaleIn",
                    isAuthenticated
                      ? "border-black bg-black text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full animate-pulse",
                      isAuthenticated ? "bg-white" : "bg-neutral-400",
                    )}
                  />
                  {isAuthenticated ? "Signed in" : "Not Signed in"}
                </span>

                {/* Address pill */}
                <div className="flex items-center gap-2 border border-black bg-white px-4 py-2 text-sm animate-slideIn">
                  <span className="font-mono text-black">
                    {shortenAddress(address)}
                  </span>
                </div>

                {isAuthenticated && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowNotifs((v) => !v);
                        if (unread > 0) markAllRead();
                      }}
                      className="relative border border-black bg-white px-3 py-2 text-xs transition hover:bg-black hover:text-white"
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
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center bg-black text-white text-xs font-bold rounded-full">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>

                    {showNotifs && (
                      <div className="absolute right-0 top-full mt-2 w-80 border border-black bg-white shadow-xl z-50">
                        <div className="border-b border-black px-4 py-3 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-widest">
                            Notifications
                          </span>
                          <button
                            onClick={() => setShowNotifs(false)}
                            className="text-neutral-400 hover:text-black text-xs"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
                          {notifications.length === 0 ? (
                            <p className="px-4 py-6 text-xs text-neutral-400 text-center">
                              No notifications yet.
                            </p>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                className={`px-4 py-3 ${!n.read ? "bg-neutral-50" : "bg-white"}`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 text-sm">
                                    {n.type === "funds_received" ? "💸" : "✅"}
                                  </span>
                                  <div>
                                    <p className="text-xs font-semibold text-black">
                                      {n.title}
                                    </p>
                                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                                      {n.message}
                                    </p>
                                    <p className="text-xs text-neutral-300 mt-1">
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
                  className="border border-black bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-black transition-all hover:bg-black hover:text-white animate-scaleIn"
                  style={{ animationDelay: "200ms" }}
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
                  "group flex items-center gap-2 border border-black bg-black px-6 py-3 text-xs font-medium uppercase tracking-wide text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed animate-scaleIn",
                  connectStep === "error"
                    ? "border-black bg-white text-black hover:bg-black hover:text-white"
                    : "border-black bg-black text-white hover:bg-white hover:text-black",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
                style={{ animationDelay: "200ms" }}
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
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Connecting…
                  </>
                ) : (
                  <>
                    Connect Wallet
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5 "
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
        <div className="bg-black text-white text-xs font-medium uppercase tracking-widest px-4 py-2.5 flex items-center justify-center gap-4">
          <span>Wrong network -- please switch to {config.chain.name}</span>
          <button
            onClick={switchNetwork}
            className="border border-white px-3 py-1 text-xs uppercase tracking-wide transition hover:bg-white hover:text-black"
          >
            Switch Network
          </button>
        </div>
      )}
    </>
  );
}
