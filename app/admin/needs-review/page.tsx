"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { ApiError, adminApi, type NeedsReviewRow } from "@/lib/api";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { shortenAddress } from "@/lib/utils";
import {
  emergencyResolveDispute,
  getEscrowOwner,
} from "@/lib/contracts";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { ChainBadge } from "@/app/components/ui/ChainBadge";

export default function AdminNeedsReviewPage() {
  const { address, isAuthenticated, signer, connect } = useWallet();
  const wagmiChainId = useChainId();
  const [rows, setRows] = useState<NeedsReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.needsReview();
      setRows(result.disputes);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 403
            ? "Your wallet isn't on the admin allowlist."
            : err.message,
        );
      } else {
        setError("Failed to load needs-review disputes.");
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 animate-fade-in-up">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-fg">
          Admin · Needs Review
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-6">
          Connect a wallet on the admin allowlist to manage stuck disputes.
        </p>
        <button
          type="button"
          onClick={connect}
          className="border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-5 py-2.5 text-sm font-medium uppercase tracking-wide rounded-lg transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
          {error}
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-4 text-xs underline text-muted hover:text-fg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 animate-fade-in-up">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted">
            Admin
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-fg">
            Needs Review
          </h1>
          <p className="mt-3 text-sm text-muted leading-relaxed max-w-2xl">
            Disputes the AI judges couldn&rsquo;t auto-resolve. Use the
            community recommendation (if a poll concluded) and call{" "}
            <code className="font-mono text-xs">emergencyResolveDispute</code>{" "}
            from the contract owner wallet to release escrowed funds.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-xs uppercase tracking-widest border border-default bg-surface px-3 py-2 rounded-lg hover:border-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
        >
          Refresh
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-default bg-surface p-8 text-center text-sm text-muted">
          Nothing to do — no disputes are stuck in review.
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id}>
              <NeedsReviewCard
                row={row}
                connectedAddress={address}
                connectedChainId={wagmiChainId}
                signer={signer}
                onResolved={refresh}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NeedsReviewCard({
  row,
  connectedAddress,
  connectedChainId,
  signer,
  onResolved,
}: {
  row: NeedsReviewRow;
  connectedAddress: string | null;
  connectedChainId: number | null;
  signer: ReturnType<typeof useWallet>["signer"];
  onResolved: () => Promise<void>;
}) {
  const [winnerInput, setWinnerInput] = useState(
    row.recommended_address ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const partyOptions = useMemo(
    () => [
      { label: `Client (${shortenAddress(row.client_address)})`, value: row.client_address },
      ...(row.freelancer_address
        ? [
            {
              label: `Freelancer (${shortenAddress(row.freelancer_address)})`,
              value: row.freelancer_address,
            },
          ]
        : []),
    ],
    [row.client_address, row.freelancer_address],
  );

  // Resolve owner for this row's chain so we can flag mismatch.
  useEffect(() => {
    let cancelled = false;
    if (row.chain_id == null) {
      setOwnerAddress(null);
      return;
    }
    getEscrowOwner(row.chain_id)
      .then((owner) => {
        if (!cancelled) setOwnerAddress(owner);
      })
      .catch(() => {
        if (!cancelled) setOwnerAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [row.chain_id]);

  const isOwner =
    !!ownerAddress &&
    !!connectedAddress &&
    ownerAddress.toLowerCase() === connectedAddress.toLowerCase();
  const wrongNetwork =
    row.chain_id != null && connectedChainId !== row.chain_id;

  async function handleResolve() {
    if (!signer || !row.chain_job_id || row.chain_id == null) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await emergencyResolveDispute(
        signer,
        BigInt(row.chain_job_id),
        BigInt(row.milestone_index),
        winnerInput.trim(),
        row.chain_id,
      );
      setFeedback(
        "Resolved on-chain. Listener will update the DB shortly — refreshing.",
      );
      // Give the chain listener a beat to write before we refetch.
      setTimeout(onResolved, 4_000);
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Failed to send the resolve transaction.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    setFeedback(null);
    try {
      const result = await adminApi.retry(row.id);
      setFeedback(result.message || "Retry queued.");
      setTimeout(onResolved, 4_000);
    } catch (err) {
      setFeedback(
        err instanceof ApiError
          ? err.message
          : "Retry failed. Try again later.",
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <article className="rounded-xl border border-default bg-surface p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Link
            href={`/jobs/${row.job_id}`}
            className="text-base font-semibold text-fg hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {row.job_title}
          </Link>
          <p className="mt-1 text-xs text-muted uppercase tracking-wider font-mono">
            Job #{row.chain_job_id ?? "?"} · Milestone {row.milestone_index + 1}
            {row.visibility === "nda" ? " · NDA" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {row.chain_id != null && <ChainBadge chainId={row.chain_id} />}
          <StatusBadge status="needs_review" />
          {row.poll_status === "recommended" && (
            <StatusBadge status="recommendation_ready" />
          )}
        </div>
      </div>

      {row.escalation_reason && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-widest text-muted font-mono mb-1">
            Escalation reason
          </p>
          <p className="text-sm text-fg leading-relaxed">
            {row.escalation_reason}
          </p>
        </div>
      )}

      {row.poll_id && (
        <div className="mb-4 rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
          <p className="text-xs uppercase tracking-widest font-mono text-muted mb-1">
            Community poll
          </p>
          <p>
            Status: <code>{row.poll_status}</code> · client {row.poll_client_votes ?? 0} /
            freelancer {row.poll_freelancer_votes ?? 0}
            {row.recommended_winner && (
              <>
                {" "}
                · recommends <strong>{row.recommended_winner}</strong>
                {row.recommended_address && (
                  <> ({shortenAddress(row.recommended_address)})</>
                )}
              </>
            )}
          </p>
          {row.ballot_uri && (
            <a
              href={row.ballot_uri.replace(
                "ipfs://",
                "https://ipfs.io/ipfs/",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs underline text-muted hover:text-fg"
            >
              View ballot ↗
            </a>
          )}
        </div>
      )}

      <fieldset className="mt-4 border-t border-subtle pt-4">
        <legend className="sr-only">Resolve dispute</legend>
        <p className="text-xs uppercase tracking-widest font-mono text-muted mb-2">
          Pick a winner address
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {partyOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm text-fg cursor-pointer"
            >
              <input
                type="radio"
                name={`winner-${row.id}`}
                value={opt.value}
                checked={
                  winnerInput.toLowerCase() === opt.value.toLowerCase()
                }
                onChange={() => setWinnerInput(opt.value)}
                className="h-4 w-4"
              />
              {opt.label}
              {row.recommended_address?.toLowerCase() ===
                opt.value.toLowerCase() && (
                <span className="text-[10px] uppercase tracking-widest font-mono text-muted">
                  recommended
                </span>
              )}
            </label>
          ))}
        </div>

        {!isOwner && ownerAddress && (
          <p className="mb-3 text-xs text-muted">
            Only the contract owner ({shortenAddress(ownerAddress)}) can call
            emergencyResolveDispute. Switch wallets.
          </p>
        )}
        {wrongNetwork && row.chain_id != null && (
          <p className="mb-3 text-xs text-muted">
            Switch your wallet to the dispute&rsquo;s network to send the tx.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleResolve}
            disabled={
              submitting ||
              !signer ||
              !winnerInput ||
              !isOwner ||
              wrongNetwork ||
              row.chain_job_id == null
            }
            className="inline-flex items-center gap-2 border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-lg transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
          >
            {submitting ? "Sending tx…" : "Resolve on-chain"}
          </button>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 border border-default bg-surface text-fg px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-lg transition-all hover:border-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
          >
            {retrying ? "Retrying…" : "Retry AI pipeline"}
          </button>
        </div>
      </fieldset>

      {feedback && (
        <p
          className="mt-3 text-xs text-fg"
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      )}
    </article>
  );
}
