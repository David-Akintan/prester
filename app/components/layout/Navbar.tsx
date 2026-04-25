"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useWallet,
  type ConnectStep,
} from "@/app/components/wallet/WalletContext";
import { shortenAddress, cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import ChainSwitcher from "@/app/components/layout/ChainSwitcher";
import FundWalletButton from "@/app/components/wallet/FundWalletButton";
import { getChainMeta } from "@/lib/chains";

const STEP_LABEL: Record<ConnectStep, string> = {
  idle: "Connect Wallet",
  requesting_accounts: "Opening Wallet...",
  awaiting_wallet_state: "Connecting...",
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
    chainId,
    connectStep,
    walletError,
    authError,
    isMiniPay,
    clearAuthError,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();

  const activeChainMeta = getChainMeta(chainId ? Number(chainId) : undefined);

  const copyAddress = () => {
    if (address) navigator.clipboard?.writeText(address).catch(() => {});
  };

  const { notifications, unread, markAllRead } =
    useNotifications(isAuthenticated);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/jobs", label: "Browse Jobs" },
    { href: "/jobs/new", label: "Post a Job" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const activeError = walletError ?? authError;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-default bg-surface/90 backdrop-blur-md animate-slide-down">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 animate-scale-in shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] transition-all group-hover:bg-[var(--color-background)] group-hover:text-[var(--color-foreground)] rounded-lg">
              <span className="text-sm font-bold font-mono">P</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-fg">
              Prester
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-all duration-200 animate-slide-up",
                  pathname === link.href
                    ? "text-fg font-semibold"
                    : "text-muted hover:text-fg",
                )}
                style={{ animationDelay: `${index * 75}ms` }}
              >
                {link.label}
                {pathname === link.href && (
                  <div className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--color-foreground)] animate-slide-in" />
                )}
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
            {/* Fund wallet (Interwoven Bridge) — only on Minitia */}
            {isConnected && (
              <div className="hidden lg:block">
                <FundWalletButton variant="ghost" />
              </div>
            )}

            {/* Chain switcher — always visible when connected */}
            {isConnected && (
              <div className="hidden sm:block">
                <ChainSwitcher />
              </div>
            )}

            {/* Theme toggle — always visible */}
            <ThemeToggle />

            {/* Wallet / notifications — desktop */}
            <div className="hidden md:flex items-center gap-2">
              {isConnected && address ? (
                <>
                  <span
                    className={cn(
                      "hidden border px-2 py-1 text-xs font-medium lg:inline-flex items-center gap-2 transition-all rounded-full",
                      isAuthenticated
                        ? "border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]"
                        : "border-default bg-muted text-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full animate-pulse",
                        isAuthenticated
                          ? "bg-[var(--color-background)]"
                          : "bg-[var(--color-muted-foreground)]",
                      )}
                    />
                    {isAuthenticated ? "Signed in" : "Not signed in"}
                  </span>

                  <div
                    onClick={copyAddress}
                    title="Copy address"
                    className="flex items-center gap-2 border border-default bg-surface px-3 py-2 sm:py-1.5 text-sm cursor-pointer hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] transition-all rounded-lg max-w-[140px] sm:max-w-[160px]"
                  >
                    <span className="font-mono text-sm truncate">
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
                        className="relative border border-default bg-surface p-2.5 sm:p-2 text-sm transition hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] rounded-lg"
                        aria-label="Notifications"
                      >
                        <BellIcon />
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-[var(--color-foreground)] text-[var(--color-background)] text-xs font-bold rounded-full">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </button>

                      {showNotifs && (
                        <NotificationsDropdown
                          notifications={notifications}
                          onClose={() => setShowNotifs(false)}
                        />
                      )}
                    </div>
                  )}

                  {isMiniPay && (
                    <span
                      className="hidden lg:inline-flex items-center gap-1 border border-[#FCFF52] bg-[#FCFF52] text-black px-2 py-1 text-xs font-semibold uppercase tracking-wide rounded-full"
                      title="Connected via MiniPay"
                    >
                      MiniPay
                    </span>
                  )}

                  {!isMiniPay && (
                    <button
                      onClick={disconnect}
                      className="border border-default bg-surface px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-fg transition-all hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] rounded-lg"
                    >
                      Disconnect
                    </button>
                  )}
                </>
              ) : isMiniPay ? (
                // MiniPay handles wallet connection implicitly — show a
                // status pill instead of the Connect button while the
                // injected auto-connect resolves.
                <span className="inline-flex items-center gap-2 border border-default bg-surface px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg rounded-lg">
                  <Spinner />
                  Connecting MiniPay…
                </span>
              ) : (
                <button
                  onClick={() => {
                    clearAuthError();
                    connect();
                  }}
                  disabled={isConnecting}
                  className="group flex items-center gap-2 border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-4 py-2 text-xs font-medium uppercase tracking-wide transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                >
                  {isConnecting ? (
                    <>
                      <Spinner />
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

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation-drawer"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-default bg-surface text-fg hover:border-[var(--color-foreground)] transition-all"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-navigation-drawer"
            role="dialog"
            className="absolute right-0 top-16 bottom-0 w-full max-w-sm bg-surface border-l border-default p-6 flex flex-col gap-6 overflow-y-auto animate-slide-down"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={cn(
                    "flex items-center px-4 py-3 text-base font-medium rounded-lg transition-all",
                    pathname === link.href
                      ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                      : "text-fg hover:bg-muted",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-default pt-6 flex flex-col gap-3">
              {isConnected && address ? (
                <>
                  <div
                    onClick={copyAddress}
                    title="Copy address"
                    className="flex items-center justify-between gap-2 border border-default bg-muted px-4 py-3 rounded-lg cursor-pointer"
                  >
                    <span className="font-mono text-sm truncate text-fg">
                      {shortenAddress(address)}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        isAuthenticated
                          ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                          : "bg-surface text-muted border border-default",
                      )}
                    >
                      {isAuthenticated ? "Signed in" : "Unauth"}
                    </span>
                  </div>

                  {/* Chain switcher — mirrors desktop access on mobile */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                      Network
                    </p>
                    <ChainSwitcher />
                  </div>

                  {/* Notifications — mirrors desktop bell on mobile */}
                  {isAuthenticated && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                          Notifications
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-foreground)] px-1.5 text-xs font-bold text-[var(--color-background)]">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                      <div className="overflow-hidden rounded-lg border border-default bg-surface">
                        <NotificationsList
                          notifications={notifications}
                          onMarkRead={() => {
                            if (unread > 0) markAllRead();
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {isMiniPay && (
                    <div className="flex items-center justify-center gap-2 border border-[#FCFF52] bg-[#FCFF52] text-black px-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-lg">
                      Connected via MiniPay
                    </div>
                  )}

                  {!isMiniPay && (
                    <button
                      onClick={disconnect}
                      className="w-full border border-default bg-surface px-4 py-3 text-sm font-medium text-fg transition-all hover:border-[var(--color-foreground)] rounded-lg"
                    >
                      Disconnect
                    </button>
                  )}
                </>
              ) : isMiniPay ? (
                <div className="w-full flex items-center justify-center gap-2 border border-default bg-surface px-4 py-3 text-sm font-medium uppercase tracking-wide text-fg rounded-lg">
                  <Spinner /> Connecting MiniPay…
                </div>
              ) : (
                <button
                  onClick={() => {
                    clearAuthError();
                    connect();
                  }}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2 border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-4 py-3 text-sm font-medium uppercase tracking-wide rounded-lg disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Spinner /> {STEP_LABEL[connectStep] || "Connecting…"}
                    </>
                  ) : (
                    "Connect Wallet"
                  )}
                </button>
              )}
            </div>

            <div className="mt-auto border-t border-default pt-6 flex items-center justify-between text-xs text-muted">
              <span className="uppercase tracking-widest">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Wrong network banner */}
      {address && isWrongNetwork && (
        <div className="bg-[var(--color-foreground)] text-[var(--color-background)] text-xs font-medium uppercase tracking-wider px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>
            Unsupported network{activeChainMeta ? "" : ""} — please switch to a
            supported chain
          </span>
          <button
            onClick={switchNetwork}
            className="border border-[var(--color-background)] px-3 py-1 text-xs uppercase tracking-wide transition hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] rounded"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Auth/wallet error toast-ish (passive) */}
      {activeError && (
        <div className="bg-muted border-b border-default text-fg text-xs px-4 py-2 text-center">
          {activeError}
        </div>
      )}
    </>
  );
}

function NotificationsList({
  notifications,
  onMarkRead,
}: {
  notifications: ReturnType<typeof useNotifications>["notifications"];
  onMarkRead?: () => void;
}) {
  useEffect(() => {
    onMarkRead?.();
    // Only fire once on mount — intentional, mark-as-read shouldn't
    // depend on notifications array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
      {notifications.length === 0 ? (
        <p className="px-4 py-6 text-xs text-muted text-center">
          No notifications yet.
        </p>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            className={cn(
              "px-4 py-3 transition-colors",
              !n.read ? "bg-muted" : "bg-surface",
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
                  rekey_needed: "🔓",
                }[n.type] ?? "🔔"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-fg truncate">
                  {n.title}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {n.message}
                </p>
                <p className="text-xs text-muted mt-1 opacity-75">
                  {new Date(n.created_at).toLocaleDateString("en-US", {
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
  );
}

function NotificationsDropdown({
  notifications,
  onClose,
}: {
  notifications: ReturnType<typeof useNotifications>["notifications"];
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] border border-default bg-surface shadow-2xl z-50 rounded-lg overflow-hidden">
      <div className="border-b border-default px-4 py-3 flex items-center justify-between bg-muted">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg">
          Notifications
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-fg text-xs transition-colors"
          aria-label="Close notifications"
        >
          ✕
        </button>
      </div>
      <NotificationsList notifications={notifications} />
    </div>
  );
}

function BellIcon() {
  return (
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
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
  );
}
