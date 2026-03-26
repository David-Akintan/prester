"use client";

import Link from "next/link";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { useJob } from "@/hooks/useMyJobs";
import { JobCard } from "@/app/jobs/JobCard";
import { shortenAddress, formatEth } from "@/lib/utils";
import { useState } from "react";

type Tab = "posted" | "bids";

export default function DashboardPage() {
  const { address, isConnected, isAuthenticated, connect, isConnecting } =
    useWallet();
  const { postedJobs, activeBids, loading, error } = useJob(address);
  const [tab, setTab] = useState<Tab>("posted");

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
          className="rounded-lg bg-initia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-initia-700 disabled:opacity-60"
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
  const totalLocked = postedJobs
    .filter((j) => j.status === "open" || j.status === "in_progress")
    .reduce((sum, j) => sum + BigInt(j.total_amount_wei), 0n);

  const pendingBids = activeBids.filter((j) =>
    j.bids?.some(
      (b) =>
        b.freelancer_address.toLowerCase() === address?.toLowerCase() &&
        b.status === "pending",
    ),
  ).length;

  const acceptedBids = activeBids.filter((j) =>
    j.bids?.some(
      (b) =>
        b.freelancer_address.toLowerCase() === address?.toLowerCase() &&
        b.status === "accepted",
    ),
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
        <Link
          href="/jobs/new"
          className="self-start rounded-lg bg-initia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-initia-700 sm:self-auto"
        >
          + Post a Job
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Open Jobs", value: openJobs, color: "text-blue-600" },
          { label: "In Progress", value: activeJobs, color: "text-amber-600" },
          { label: "Completed", value: completedJobs, color: "text-green-600" },
          {
            label: "Locked in Escrow",
            value: `${formatEth(totalLocked)} ETH`,
            color: "text-initia-600",
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
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="mb-5 flex gap-1 border-b border-gray-200">
          {(
            [
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

        {/* Posted jobs tab */}
        {tab === "posted" && (
          <>
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
                  No jobs posted yet
                </h3>
                <p className="mb-5 text-sm text-gray-400">
                  Post your first job and find great freelancers.
                </p>
                <Link
                  href="/jobs/new"
                  className="rounded-lg bg-initia-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-initia-700"
                >
                  Post a Job
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="rounded-lg bg-initia-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-initia-700"
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

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeBids.map((job) => {
                    const myBid = job.bids?.find(
                      (b) =>
                        b.freelancer_address.toLowerCase() ===
                        address?.toLowerCase(),
                    );
                    return (
                      <div key={job.id} className="relative">
                        <JobCard job={job} />
                        {myBid && (
                          <div className="absolute top-3 right-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                myBid.status === "accepted"
                                  ? "bg-green-100 text-green-700"
                                  : myBid.status === "rejected"
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {myBid.status === "accepted"
                                ? "✓ Accepted"
                                : myBid.status === "rejected"
                                  ? "Rejected"
                                  : "Pending"}
                            </span>
                          </div>
                        )}
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
