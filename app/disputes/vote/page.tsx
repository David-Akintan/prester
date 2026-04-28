"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  communityPollsApi,
  type CommunityPollSummary,
  type EligibilityVerdict,
} from "@/lib/api";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { formatEth, shortenAddress } from "@/lib/utils";
import { getNativeSymbol } from "@/lib/chains";
import { StatusBadge } from "@/app/components/ui/StatusBadge";

const ELIGIBILITY_COPY: Record<
  NonNullable<EligibilityVerdict["reason"]>,
  string
> = {
  no_account:
    "We don't have a Prester profile for this wallet yet. Connect, sign in, and engage with the platform first.",
  too_new:
    "Your account is brand new. Voting opens 7 days after sign-up to keep voting authentic.",
  no_completed_jobs:
    "You need at least one completed job (as client or freelancer) before you can vote.",
};

export default function CommunityVotePage() {
  const { isAuthenticated, connect } = useWallet();
  const [eligibility, setEligibility] = useState<EligibilityVerdict | null>(
    null,
  );
  const [polls, setPolls] = useState<CommunityPollSummary[]>([]);
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
      const [eligibilityResult, openResult] = await Promise.all([
        communityPollsApi.eligibility(),
        communityPollsApi.listOpen(),
      ]);
      setEligibility(eligibilityResult);
      setPolls(openResult.polls);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load community polls. Try again in a moment.",
      );
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
          Vote on community-review disputes
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-6">
          When AI judges can&rsquo;t reach a verdict, eligible Prester users
          help decide. Sign in with your wallet to see what&rsquo;s open.
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
        Loading polls…
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

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 animate-fade-in-up">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-fg">
          You aren&rsquo;t eligible to vote yet
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-6">
          {(eligibility.reason && ELIGIBILITY_COPY[eligibility.reason]) ||
            "Your wallet doesn't meet the voting eligibility criteria yet."}
        </p>
        <Link
          href="/jobs"
          className="text-xs font-medium uppercase tracking-widest underline text-muted hover:text-fg"
        >
          Browse jobs →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 animate-fade-in-up">
      <header className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-muted">
          Community review
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-fg">
          Vote on disputes
        </h1>
        <p className="mt-3 text-sm text-muted leading-relaxed max-w-2xl">
          These disputes escalated to <StatusBadge status="needs_review" />{" "}
          because the AI judges couldn&rsquo;t reach a verdict. Your vote
          informs the platform owner&rsquo;s final on-chain decision. NDA
          jobs aren&rsquo;t shown here.
        </p>
      </header>

      {polls.length === 0 ? (
        <div className="rounded-xl border border-default bg-surface p-8 text-center text-sm text-muted">
          No open polls right now. Come back later — they appear here as soon
          as a dispute is escalated.
        </div>
      ) : (
        <ul className="space-y-4">
          {polls.map((poll) => (
            <li key={poll.poll_id}>
              <PollCard poll={poll} onVoted={refresh} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PollCard({
  poll,
  onVoted,
}: {
  poll: CommunityPollSummary;
  onVoted: () => Promise<void>;
}) {
  const [vote, setVote] = useState<"client" | "freelancer" | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const totalVotes = poll.client_votes + poll.freelancer_votes;
  const closesAt = useMemo(
    () => new Date(poll.closes_at),
    [poll.closes_at],
  );
  const timeRemaining = useTimeRemaining(closesAt);
  const native = poll.chain_id ? getNativeSymbol(poll.chain_id) : "ETH";
  const milestoneAmount = poll.amount_wei
    ? `${formatEth(BigInt(poll.amount_wei))} ${native}`
    : null;

  async function submit() {
    if (!vote) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await communityPollsApi.vote(poll.poll_id, vote, reason || undefined);
      setSubmitted(true);
      setFeedback("Vote recorded. Thanks!");
      await onVoted();
    } catch (err) {
      setFeedback(
        err instanceof ApiError
          ? err.message
          : "Couldn't submit your vote. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="rounded-xl border border-default bg-surface p-5 sm:p-6 shadow-sm transition-all hover:shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Link
            href={`/jobs/${poll.job_id}`}
            className="text-base font-semibold text-fg hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {poll.job_title}
          </Link>
          <p className="mt-1 text-xs text-muted uppercase tracking-wider font-mono">
            Milestone {poll.milestone_index + 1}
            {milestoneAmount ? ` · ${milestoneAmount}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status="vote_open" />
          <span className="text-xs font-mono text-muted">
            {timeRemaining}
          </span>
        </div>
      </div>

      {poll.milestone_description && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-widest text-muted font-mono mb-1">
            Milestone
          </p>
          <p className="text-sm text-fg leading-relaxed">
            {poll.milestone_description}
          </p>
        </div>
      )}

      {poll.dispute_reason && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-widest text-muted font-mono mb-1">
            Dispute
          </p>
          <p className="text-sm text-fg leading-relaxed">
            {poll.dispute_reason}
          </p>
        </div>
      )}

      {poll.deliverable_uri && poll.visibility !== "nda" && (
        <a
          href={poll.deliverable_uri.replace(
            "ipfs://",
            "https://ipfs.io/ipfs/",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg underline"
        >
          View deliverable ↗
        </a>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <VoteCount
          label={`Client (${shortenAddress(poll.client_address)})`}
          count={poll.client_votes}
          total={totalVotes}
        />
        <VoteCount
          label={
            poll.freelancer_address
              ? `Freelancer (${shortenAddress(poll.freelancer_address)})`
              : "Freelancer"
          }
          count={poll.freelancer_votes}
          total={totalVotes}
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        {totalVotes} vote{totalVotes === 1 ? "" : "s"} so far · quorum{" "}
        {poll.quorum}
      </p>

      {!submitted && (
        <fieldset className="mt-5 border-t border-subtle pt-4">
          <legend className="sr-only">Cast your vote</legend>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
              <input
                type="radio"
                name={`vote-${poll.poll_id}`}
                value="client"
                checked={vote === "client"}
                onChange={() => setVote("client")}
                disabled={submitting}
                className="h-4 w-4"
              />
              Client wins
            </label>
            <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
              <input
                type="radio"
                name={`vote-${poll.poll_id}`}
                value="freelancer"
                checked={vote === "freelancer"}
                onChange={() => setVote("freelancer")}
                disabled={submitting}
                className="h-4 w-4"
              />
              Freelancer wins
            </label>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            placeholder="Optional: a sentence explaining your vote"
            maxLength={500}
            className="mt-3 w-full rounded-lg border border-default bg-surface p-3 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)]"
            rows={2}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!vote || submitting}
            className="mt-3 inline-flex items-center gap-2 border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-lg transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
          >
            {submitting ? "Submitting…" : "Submit vote"}
          </button>
        </fieldset>
      )}

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

function VoteCount({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="rounded-lg border border-default bg-muted p-3">
      <p className="text-xs uppercase tracking-widest text-muted font-mono mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-fg tabular-nums">
        {count} <span className="text-xs text-muted">({pct}%)</span>
      </p>
    </div>
  );
}

function useTimeRemaining(closesAt: Date): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = closesAt.getTime() - now;
  if (ms <= 0) return "closing now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `closes in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `closes in ${hours}h`;
  return `closes in ${Math.floor(hours / 24)}d`;
}
