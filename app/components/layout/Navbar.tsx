"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useWallet,
  type ConnectStep,
} from "@/app/components/wallet/WalletContext";
import { shortenAddress, cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useEffect, useRef, useState } from "react";
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

type NavLink = { href: string; label: string };

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
    voteEligibility,
    isAdmin,
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
  const { totalUnread: chatUnread } = useChatUnread(isAuthenticated);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const notifsWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showNotifs) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!notifsWrapperRef.current?.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifs(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showNotifs]);

  const primaryLinks: NavLink[] = [
    { href: "/jobs", label: "Browse Jobs" },
    { href: "/jobs/new", label: "Post a Job" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  const moreLinks: NavLink[] = [
    ...(voteEligibility?.eligible
      ? [{ href: "/disputes/vote", label: "Vote on Disputes" }]
      : []),
    ...(isAdmin ? [{ href: "/admin/needs-review", label: "Admin" }] : []),
  ];

  // Full set used in the mobile drawer where vertical space isn't constrained.
  const allLinks: NavLink[] = [...primaryLinks, ...moreLinks];

  const moreActive = moreLinks.some((l) => pathname === l.href);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
    setShowMore(false);
    setShowWallet(false);
    setShowNotifs(false);
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
      <header className="sticky top-0 z-[100] border-b border-[var(--color-border-subtle)] bg-surface/70 backdrop-blur-xl animate-slide-down">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            aria-label="Prester home"
            className="group flex items-center gap-2 animate-scale-in shrink-0"
          >
            <Image
              src="/logo-icon.png"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              priority
              className="h-7 w-7 rounded-lg transition-transform group-hover:scale-105"
            />
            <span className="text-[15px] font-medium tracking-tight text-fg">
              Prester
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {primaryLinks.map((link, index) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                active={pathname === link.href}
                index={index}
              />
            ))}
            {moreLinks.length > 0 && (
              <MoreMenu
                links={moreLinks}
                pathname={pathname}
                active={moreActive}
                open={showMore}
                onToggle={() => setShowMore((v) => !v)}
                onClose={() => setShowMore(false)}
                index={primaryLinks.length}
              />
            )}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            {/* Fund wallet (Interwoven Bridge) — only on Minitia */}
            {isConnected && (
              <div className="hidden lg:block">
                <FundWalletButton variant="ghost" />
              </div>
            )}

            {/* Theme toggle — always visible */}
            <ThemeToggle />

            {/* Messages — visible on all breakpoints when authenticated */}
            {isConnected && isAuthenticated && (
              <Link
                href="/messages"
                aria-label={
                  chatUnread > 0
                    ? `Messages (${chatUnread} unread)`
                    : "Messages"
                }
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-full border bg-surface text-fg transition-all hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2",
                  pathname.startsWith("/messages")
                    ? "border-[var(--color-foreground)]"
                    : "border-default",
                )}
              >
                <ChatIcon />
                {chatUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-foreground)] px-1 text-[10px] font-bold text-[var(--color-background)]">
                    {chatUnread > 9 ? "9+" : chatUnread}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications bell — visible on all breakpoints when authenticated */}
            {isConnected && isAuthenticated && (
              <div ref={notifsWrapperRef} className="relative">
                <button
                  onClick={() => {
                    setShowNotifs((v) => !v);
                    setMobileOpen(false);
                    if (unread > 0) markAllRead();
                  }}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-default bg-surface text-fg transition-all hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
                  aria-label="Notifications"
                >
                  <BellIcon />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-foreground)] text-[var(--color-background)] text-[10px] font-bold">
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

            {/* Divider between icon group and wallet pill */}
            {isConnected && (
              <span className="hidden md:block h-5 w-px bg-[var(--color-border-subtle)]" />
            )}

            {/* Wallet pill (consolidated) — desktop */}
            <div className="hidden md:block">
              {isConnected && address ? (
                <WalletPill
                  address={address}
                  isAuthenticated={isAuthenticated}
                  isMiniPay={isMiniPay}
                  activeChainMeta={activeChainMeta}
                  open={showWallet}
                  onToggle={() => setShowWallet((v) => !v)}
                  onClose={() => setShowWallet(false)}
                  onCopy={copyAddress}
                  onDisconnect={disconnect}
                />
              ) : isMiniPay ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-default bg-surface px-3 h-9 text-xs font-medium uppercase tracking-wide text-fg">
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
                  aria-busy={isConnecting}
                  className="group inline-flex items-center gap-2 rounded-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-4 h-9 text-xs font-medium uppercase tracking-wide transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
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
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-default bg-surface text-fg hover:border-[var(--color-foreground)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
            >
              {mobileOpen ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[110] animate-fade-in">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-14 bottom-0 w-full max-w-sm bg-surface border-l border-[var(--color-border-subtle)] p-6 flex flex-col gap-6 overflow-y-auto animate-slide-down"
            style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
          >
            <nav className="flex flex-col gap-1">
              {[{ href: "/messages", label: "Messages" }, ...allLinks].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 text-base font-medium rounded-full transition-all",
                    pathname === link.href
                      ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                      : "text-fg hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {link.label}
                    {link.href === "/messages" && chatUnread > 0 && (
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-foreground)] px-1 text-[10px] font-bold text-[var(--color-background)]">
                        {chatUnread > 9 ? "9+" : chatUnread}
                      </span>
                    )}
                  </span>
                  <svg
                    className="h-4 w-4 opacity-60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </nav>

            <div className="border-t border-[var(--color-border-subtle)] pt-6 flex flex-col gap-3">
              {isConnected && address ? (
                <>
                  <button
                    type="button"
                    onClick={copyAddress}
                    title="Copy address"
                    aria-label={`Copy wallet address ${address}`}
                    className="flex w-full items-center justify-between gap-2 border border-default bg-muted px-4 py-3 rounded-full cursor-pointer text-left"
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
                  </button>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                      Network
                    </p>
                    <ChainSwitcher />
                  </div>

                  {isMiniPay && (
                    <div className="flex items-center justify-center gap-2 border border-[#FCFF52] bg-[#FCFF52] text-black px-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-full">
                      Connected via MiniPay
                    </div>
                  )}

                  {!isMiniPay && (
                    <button
                      onClick={disconnect}
                      className="w-full rounded-full border border-default bg-surface px-4 py-3 text-sm font-medium text-fg transition-all hover:border-[var(--color-foreground)]"
                    >
                      Disconnect
                    </button>
                  )}
                </>
              ) : isMiniPay ? (
                <div className="w-full flex items-center justify-center gap-2 border border-default bg-surface px-4 py-3 text-sm font-medium uppercase tracking-wide text-fg rounded-full">
                  <Spinner /> Connecting MiniPay…
                </div>
              ) : (
                <button
                  onClick={() => {
                    clearAuthError();
                    connect();
                  }}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-4 py-3 text-sm font-medium uppercase tracking-wide disabled:opacity-50"
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

            <div className="mt-auto border-t border-[var(--color-border-subtle)] pt-6 flex items-center justify-between text-xs text-muted">
              <span className="uppercase tracking-widest">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Wrong network banner */}
      {address && isWrongNetwork && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-[var(--color-foreground)] text-[var(--color-background)] text-xs font-medium uppercase tracking-wider px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4"
        >
          <span>Unsupported network — please switch to a supported chain</span>
          <button
            onClick={switchNetwork}
            className="rounded-full border border-[var(--color-background)] px-3 py-1 text-xs uppercase tracking-wide transition hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Auth/wallet error toast-ish (passive) */}
      {activeError && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-muted border-b border-[var(--color-border-subtle)] text-fg text-xs px-4 py-2 text-center"
        >
          {activeError}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sub-components
 * ───────────────────────────────────────────────────────────── */

function NavItem({
  href,
  label,
  active,
  index,
}: {
  href: string;
  label: string;
  active: boolean;
  index: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors animate-slide-up",
        active
          ? "bg-muted text-fg"
          : "text-muted hover:text-fg hover:bg-muted/60",
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {label}
    </Link>
  );
}

function MoreMenu({
  links,
  pathname,
  active,
  open,
  onToggle,
  onClose,
  index,
}: {
  links: NavLink[];
  pathname: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  index: number;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors animate-slide-up",
          active || open
            ? "bg-muted text-fg"
            : "text-muted hover:text-fg hover:bg-muted/60",
        )}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        More
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
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
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-[var(--color-border-subtle)] bg-surface/95 backdrop-blur-xl shadow-xl z-50 p-1 animate-fade-in"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "block rounded-full px-3 py-2 text-[13px] transition-colors",
                pathname === link.href
                  ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                  : "text-fg hover:bg-muted",
              )}
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function WalletPill({
  address,
  isAuthenticated,
  isMiniPay,
  activeChainMeta,
  open,
  onToggle,
  onClose,
  onCopy,
  onDisconnect,
}: {
  address: string;
  isAuthenticated: boolean;
  isMiniPay: boolean;
  activeChainMeta: ReturnType<typeof getChainMeta>;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCopy: () => void;
  onDisconnect: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const dotColor = isAuthenticated
    ? "bg-[var(--color-foreground)]"
    : "bg-[var(--color-muted-foreground)]";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-default bg-surface/80 backdrop-blur pl-2 pr-3 h-9 text-xs font-medium transition-all",
          "hover:border-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2",
        )}
        title={isAuthenticated ? "Wallet — Signed in" : "Wallet"}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            dotColor,
            isAuthenticated && "animate-pulse",
          )}
        />
        {activeChainMeta ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: activeChainMeta.accentColor }}
            />
            <span className="font-mono text-[11px] tracking-wide text-muted">
              {activeChainMeta.shortName}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[11px] tracking-wide text-red-500">
            UNSUPPORTED
          </span>
        )}
        <span className="h-3 w-px bg-[var(--color-border-subtle)]" />
        <span className="font-mono text-xs text-fg">
          {shortenAddress(address)}
        </span>
        <svg
          className={cn(
            "h-3 w-3 text-muted transition-transform",
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
        <div
          role="menu"
          /* `fixed` puts the dropdown in the viewport root stacking context so
             no page element can paint above it. Anchored flush to the right
             edge (right-0) and immediately under the navbar (top-14) for an
             unfloated, screen-anchored feel. */
          className="fixed top-14 right-0 w-72 max-w-[calc(100vw-1rem)] rounded-2xl rounded-tr-none border border-[var(--color-border-subtle)] bg-surface/95 backdrop-blur-xl shadow-2xl z-[120] p-3 animate-dropdown-in flex flex-col gap-3"
        >
          {/* Address row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Address
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="font-mono text-xs text-fg hover:text-muted transition-colors"
              title="Copy address"
              aria-label={`Copy wallet address ${address}`}
            >
              {shortenAddress(address)}
            </button>
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Status
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                isAuthenticated
                  ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                  : "bg-muted text-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isAuthenticated
                    ? "bg-[var(--color-background)]"
                    : "bg-[var(--color-muted-foreground)]",
                )}
              />
              {isAuthenticated ? "Signed in" : "Not signed in"}
            </span>
          </div>

          {/* Network section */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Network
            </span>
            <ChainSwitcher variant="inline" />
          </div>

          {isMiniPay ? (
            <div className="flex items-center justify-center gap-2 border border-[#FCFF52] bg-[#FCFF52] text-black px-3 py-2 text-xs font-semibold uppercase tracking-wide rounded-full">
              Connected via MiniPay
            </div>
          ) : (
            <button
              onClick={() => {
                onClose();
                onDisconnect();
              }}
              className="w-full rounded-full border border-default bg-surface px-4 py-2 text-xs font-medium uppercase tracking-wide text-fg transition-all hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]"
            >
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatRelativeTime(iso: string): string {
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60)
    return relativeTimeFormatter.format(Math.round(diffSec), "second");
  if (abs < 3600)
    return relativeTimeFormatter.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400)
    return relativeTimeFormatter.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800)
    return relativeTimeFormatter.format(Math.round(diffSec / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
    <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
      {notifications.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs font-medium text-fg">No notifications yet.</p>
          <p className="mt-1 text-xs text-muted">
            We'll let you know when something happens on your jobs.
          </p>
        </div>
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
                  message_received: "💬",
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
                  {formatRelativeTime(n.created_at)}
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
    <div className="fixed top-14 right-0 w-80 max-w-[calc(100vw-1rem)] rounded-2xl rounded-tr-none border border-[var(--color-border-subtle)] bg-surface/95 backdrop-blur-xl shadow-2xl z-[120] overflow-hidden animate-dropdown-in">
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3 flex items-center justify-between bg-muted/40">
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

function ChatIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.96 9.96 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <>
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        role="status"
        aria-hidden="true"
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
      <span className="sr-only">Loading</span>
    </>
  );
}
