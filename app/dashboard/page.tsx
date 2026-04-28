"use client";

import Link from "next/link";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { useJob } from "@/hooks/useMyJobs";
import { useFreelancerDashboard } from "@/hooks/useFreelancerDashboard";
import { JobCard } from "@/app/jobs/JobCard";
import { shortenAddress, formatEth } from "@/lib/utils";
import { getNativeSymbol } from "@/lib/chains";
import { useState } from "react";
import React from "react";
import type {
  JobRecord,
  FreelancerBidRow,
  FreelancerEarningsByChain,
} from "@/lib/api";

type Tab = "posted" | "bids" | "freelancer";

// Coerce a FreelancerBidRow into a JobCard-compatible JobRecord. The
// bids[] array is synthesized from the user's own bid so the existing
// badge logic continues to work without refactoring the card component.
function bidRowToJob(row: FreelancerBidRow, address: string): JobRecord {
  return {
    id: row.id,
    chain_id: row.chain_id,
    chain_job_id: row.chain_job_id,
    client_address: row.client_address,
    client_username: row.client_username,
    client_avatar: row.client_avatar,
    title: row.title,
    description: row.description,
    category: null,
    tags: [],
    required_skills: [],
    estimated_duration: null,
    metadata_uri: null,
    total_amount_wei: row.total_amount_wei,
    status: row.status,
    visibility: "public",
    created_at: row.created_at,
    updated_at: row.updated_at,
    milestones: [],
    bids: [
      {
        id: row.bid_id,
        job_id: row.id,
        freelancer_address: address,
        username: null,
        avatar_url: null,
        cover_letter: row.cover_letter,
        proposed_timeline: row.proposed_timeline,
        has_been_edited: false,
        status: row.bid_status,
        created_at: row.bid_created_at,
      },
    ],
    disputes: [],
  };
}

export default function DashboardPage() {
  const {
    address,
    isConnected,
    isAuthenticated,
    connect,
    isConnecting,
    isAdmin,
  } = useWallet();
  const { postedJobs, activeBids, loading, error } = useJob(address);
  const {
    dashboard: freelancerData,
    loading: freelancerLoading,
    error: freelancerError,
  } = useFreelancerDashboard();

  const [tab, setTab] = useState<Tab>("posted");

  // Determine if user is primarily a freelancer (has accepted bids)
  const hasAcceptedBids = activeBids.some((b) => b.bid_status === "accepted");

  // Auto-select appropriate tab
  React.useEffect(() => {
    if (hasAcceptedBids && tab === "posted") {
      setTab("freelancer");
    } else if (
      !hasAcceptedBids &&
      postedJobs.length > 0 &&
      tab === "freelancer"
    ) {
      setTab("posted");
    }
  }, [hasAcceptedBids, postedJobs.length, tab]);

  // ── Not connected ─────────────────────────────────────────
  if (!isConnected || !isAuthenticated) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="mb-4 text-5xl">👤</div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          Your Dashboard
        </h2>
        <p className="mb-8 max-w-sm text-sm text-gray-500">
          Connect your wallet to see your posted jobs, active bids, and
          earnings.
        </p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="rounded-3xl border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-6 py-2.5 text-sm font-semibold text-[var(--color-background)] shadow-sm transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-60"
        >
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </button>
      </div>
    );
  }

  // ── Summary stats ─────────────────────────────────────────
  const openJobs = postedJobs.filter((j) => j.status === "open").length;
  const activeJobs = postedJobs.filter(
    (j) => j.status === "in_progress",
  ).length;
  const completedJobs = postedJobs.filter(
    (j) => j.status === "completed",
  ).length;

  // Per-chain escrow totals — aggregating across chains would need an FX
  // oracle. Each entry gets its own line with the native symbol.
  const lockedByChain = postedJobs
    .filter((j) => j.status === "open" || j.status === "in_progress")
    .reduce<Map<number, bigint>>((map, j) => {
      const key = j.chain_id ?? 0;
      map.set(key, (map.get(key) ?? 0n) + BigInt(j.total_amount_wei));
      return map;
    }, new Map());
  const lockedEntries = Array.from(lockedByChain.entries()).sort((a, b) =>
    b[1] > a[1] ? 1 : -1,
  );

  const pendingBids = activeBids.filter(
    (b) => b.bid_status === "pending",
  ).length;
  const acceptedBids = activeBids.filter(
    (b) => b.bid_status === "accepted",
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 font-mono text-sm text-gray-400">
            {shortenAddress(address!)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Admin shortcut — surfaces only when the connected wallet is on
              the backend ADMIN_ADDRESSES allowlist. Same gate as the navbar
              link; rendered here too so admins land on /admin/needs-review
              without leaving the dashboard. */}
          {isAdmin && (
            <Link
              href="/admin/needs-review"
              className="rounded-lg border border-default bg-surface px-4 py-2 text-sm font-medium text-fg shadow-sm transition-all hover:border-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-foreground)] focus-visible:ring-offset-2"
            >
              Review Disputes →
            </Link>
          )}
          <Link
            href="/jobs/new"
            className="rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-4 py-2 text-sm font-semibold text-[var(--color-background)] shadow-sm transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
          >
            + Post a Job
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="mb-5 flex gap-1 border-b border-gray-200">
          {(
            [
              ...(hasAcceptedBids
                ? [{ key: "freelancer", label: "My Work & Earnings" }]
                : []),
              { key: "posted", label: `Posted Jobs (${postedJobs.length})` },
              {
                key: "bids",
                label: `My Bids (${activeBids.length})`,
              },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? "border-initia-600 text-initia-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Freelancer tab */}
        {tab === "freelancer" && (
          <>
            {freelancerLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-xl bg-gray-100"
                    />
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-48 animate-pulse rounded-xl bg-gray-100"
                    />
                  ))}
                </div>
              </div>
            ) : freelancerError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {freelancerError}
              </div>
            ) : freelancerData ? (
              <div className="space-y-6">
                {/* Freelancer stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: "Active Jobs",
                      value: freelancerData.activeJobs,
                      color: "text-blue-600",
                    },
                    {
                      label: "Completed",
                      value: freelancerData.completedJobs,
                      color: "text-green-600",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <p className={`mt-1 text-xl font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                    </div>
                  ))}

                  <EarningsCard
                    label="Total Earnings"
                    color="text-initia-600"
                    rows={freelancerData.earningsByChain}
                    mode="total"
                  />
                  <EarningsCard
                    label="Avg per Job"
                    color="text-purple-600"
                    rows={freelancerData.earningsByChain}
                    mode="average"
                  />
                </div>

                {/* Recent completed jobs */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    Recent Completed Work
                  </h3>
                  {freelancerData.recentCompletedJobs.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center">
                      <div className="mb-3 text-4xl">🎯</div>
                      <h3 className="mb-1 font-semibold text-gray-700">
                        No completed work yet
                      </h3>
                      <p className="mb-5 text-sm text-gray-400">
                        Complete some milestones to see your earnings here.
                      </p>
                      <Link
                        href="/jobs"
                        className="rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-5 py-2 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
                      >
                        Browse Jobs
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {freelancerData.recentCompletedJobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {job.title}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Completed{" "}
                                {new Date(job.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                {job.totalEarningsETH}{" "}
                                {getNativeSymbol(job.chain_id)}
                              </p>
                              <p className="text-xs text-gray-400">Earned</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Posted jobs tab */}
        {tab === "posted" && (
          <>
            {/* Client stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Open Jobs", value: openJobs, color: "text-blue-600" },
                {
                  label: "In Progress",
                  value: activeJobs,
                  color: "text-amber-600",
                },
                {
                  label: "Completed",
                  value: completedJobs,
                  color: "text-green-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className={`mt-1 text-xl font-bold ${stat.color}`}>
                    {loading ? (
                      <span className="inline-block h-6 w-12 animate-pulse rounded bg-gray-100" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
              ))}

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-400">Locked in Escrow</p>
                {loading ? (
                  <p className="mt-1 text-xl font-bold">
                    <span className="inline-block h-6 w-12 animate-pulse rounded bg-gray-100" />
                  </p>
                ) : lockedEntries.length === 0 ? (
                  <p className="mt-1 text-xl font-bold text-initia-600">
                    {`0 ${getNativeSymbol(null)}`}
                  </p>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {lockedEntries.map(([chainId, wei]) => (
                      <p
                        key={chainId}
                        className="text-base font-bold text-initia-600 leading-tight"
                      >
                        {formatEth(wei)}{" "}
                        <span className="text-xs font-semibold text-gray-500">
                          {getNativeSymbol(chainId || null)}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Posted jobs list */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : postedJobs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-3 text-4xl">📋</div>
                <h3 className="mb-1 font-semibold text-gray-700">
                  {hasAcceptedBids
                    ? "You haven't posted any jobs"
                    : "No jobs posted yet"}
                </h3>
                <p className="mb-5 text-sm text-gray-400">
                  {hasAcceptedBids
                    ? "As a freelancer, you can also post jobs to hire others."
                    : "Post your first job and find great freelancers."}
                </p>
                <Link
                  href="/jobs/new"
                  className="rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-5 py-2 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
                >
                  {hasAcceptedBids ? "Post a Job as Client" : "Post a Job"}
                </Link>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {postedJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </>
        )}

        {/* My bids tab */}
        {tab === "bids" && (
          <>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : activeBids.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-3 text-4xl">🙋</div>
                <h3 className="mb-1 font-semibold text-gray-700">
                  No active bids
                </h3>
                <p className="mb-5 text-sm text-gray-400">
                  Browse open jobs and submit your first proposal.
                </p>
                <Link
                  href="/jobs"
                  className="rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-5 py-2 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
                >
                  Browse Jobs
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary strip */}
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>
                    <strong className="text-amber-600">{pendingBids}</strong>{" "}
                    pending
                  </span>
                  <span>
                    <strong className="text-green-600">{acceptedBids}</strong>{" "}
                    accepted
                  </span>
                </div>

                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {activeBids.map((row) => {
                    const job = bidRowToJob(row, address!);
                    return (
                      <div key={row.bid_id} className="relative">
                        <JobCard job={job} />
                        <div className="absolute top-3 right-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.bid_status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : row.bid_status === "rejected"
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {row.bid_status === "accepted"
                              ? "✓ Accepted"
                              : row.bid_status === "rejected"
                                ? "Rejected"
                                : "Pending"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EarningsCard({
  label,
  color,
  rows,
  mode,
}: {
  label: string;
  color: string;
  rows: FreelancerEarningsByChain[];
  mode: "total" | "average";
}) {
  const displayRows =
    mode === "total"
      ? rows.map((r) => ({
          chainId: r.chain_id,
          value: r.total_eth,
        }))
      : rows.map((r) => ({
          chainId: r.chain_id,
          value:
            r.completed_count > 0
              ? (parseFloat(r.total_eth) / r.completed_count).toFixed(4)
              : "0",
        }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      {displayRows.length === 0 ? (
        <p className={`mt-1 text-xl font-bold ${color}`}>0</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {displayRows.map((row) => (
            <p
              key={row.chainId ?? "unknown"}
              className={`text-base font-bold leading-tight ${color}`}
            >
              {row.value}{" "}
              <span className="text-xs font-semibold text-gray-500">
                {getNativeSymbol(row.chainId)}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
