"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useJob } from "@/hooks/useMyJobs";
import { useWallet } from "@/app/components/wallet/WalletContext1.0";
// import { MilestoneList } from "@/app/jobs/MilestoneList";
import { BidList } from "@/app/jobs/BidList";
import { JobDetailSidebar } from "@/app/Jobdetailsidebar";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { JobRecord } from "@/lib/api";
import { jobsApi } from "@/lib/api";
import { formatEth } from "@/lib/utils";
import {
  submitMilestone,
  approveMilestone,
  raiseDispute,
} from "@/lib/contracts";
import { parseContractError } from "@/lib/utils";
import type { MilestoneRecord } from "@/lib/api";
import { JsonRpcSigner } from "ethers";

function SubmitDeliverableButton({
  jobId,
  chainJobId,
  milestone,
  signer,
  onRefresh,
}: {
  jobId: string;
  chainJobId: number | null;
  milestone: MilestoneRecord;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}) {
  const [uri, setUri] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ── Already submitted — show read-only confirmation ──────
  if (milestone.status === "submitted") {
    return (
      <div className="rounded-lg border border-green-500 bg-green-50 px-4 py-3 text-sm text-green-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">
              Deliverable submitted — awaiting client review
            </span>
          </div>
          {milestone.deliverable_uri && (
            <a
              href={milestone.deliverable_uri.replace(
                "ipfs://",
                "https://ipfs.io/ipfs/",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 underline font-medium text-xs transition-colors"
            >
              View submission ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Disputed — freelancer can only wait ──────────────────
  if (milestone.status === "disputed") {
    return (
      <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
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
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            />
          </svg>
          <span className="font-medium">
            Dispute raised — AI judge is reviewing this milestone
          </span>
        </div>
      </div>
    );
  }

  // ── Resolved / approved — nothing to do ─────────────────
  if (milestone.status === "approved" || milestone.status === "resolved") {
    return null;
  }

  async function handleSubmit() {
    if (!signer || !chainJobId || !uri.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await submitMilestone(
        signer,
        BigInt(chainJobId),
        milestone.milestone_index,
        uri.trim(),
      );
      await onRefresh();
    } catch (e) {
      setErr(parseContractError(e));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Pending — freelancer can submit ─────────────────────
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="Enter deliverable URI (IPFS, URL, etc.)"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-black placeholder-gray-500 focus:border-black focus:outline-none transition-colors"
          disabled={submitting}
        />
        <button
          onClick={handleSubmit}
          disabled={!uri.trim() || submitting}
          className="rounded-lg border border-black bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
              Submitting…
            </div>
          ) : (
            "Submit Deliverable"
          )}
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{err}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientMilestoneActions({
  chainJobId,
  milestone,
  signer,
  onRefresh,
}: {
  jobId: string;
  chainJobId: number | null;
  milestone: MilestoneRecord;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}) {
  const [loading, setLoading] = useState<"approve" | "dispute" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── Pending — freelancer hasn't submitted yet ────────────
  if (milestone.status === "pending") {
    return (
      <div className="border border-neutral-200 px-4 py-3 text-xs text-neutral-400 uppercase tracking-widest">
        Awaiting freelancer submission
      </div>
    );
  }

  // ── Disputed — client can only wait ─────────────────────
  if (milestone.status === "disputed") {
    return (
      <div className="border border-neutral-300 px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest">
        ⚖ Dispute raised — AI judge is reviewing this milestone
      </div>
    );
  }

  // ── Resolved / approved — nothing to do ─────────────────
  if (milestone.status === "approved" || milestone.status === "resolved") {
    return null;
  }

  async function handle(action: "approve" | "dispute") {
    if (!signer || !chainJobId) return;
    setLoading(action);
    setErr(null);
    try {
      if (action === "approve") {
        await approveMilestone(
          signer,
          BigInt(chainJobId),
          milestone.milestone_index,
        );
      } else {
        await raiseDispute(
          signer,
          BigInt(chainJobId),
          milestone.milestone_index,
        );
      }
      await onRefresh();
    } catch (e) {
      setErr(parseContractError(e));
    } finally {
      setLoading(null);
    }
  }

  // ── Submitted — client can approve or dispute ────────────
  return (
    <div className="space-y-2">
      {milestone.deliverable_uri && (
        <a
          href={milestone.deliverable_uri.replace(
            "ipfs://",
            "https://ipfs.io/ipfs/",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black underline"
        >
          View Deliverable ↗
        </a>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => handle("approve")}
          disabled={!!loading}
          className="border border-black bg-black px-4 py-2 text-xs font-medium uppercase tracking-widest text-white transition hover:bg-white hover:text-black disabled:opacity-40"
        >
          {loading === "approve" ? "Approving…" : "Approve & Release"}
        </button>
        <button
          onClick={() => handle("dispute")}
          disabled={!!loading}
          className="border border-black px-4 py-2 text-xs font-medium uppercase tracking-widest text-black transition hover:bg-black hover:text-white disabled:opacity-40"
        >
          {loading === "dispute" ? "Raising…" : "Raise Dispute"}
        </button>
      </div>
    </div>
  );
}
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { address, signer, isAuthenticated, connect } = useWallet();

  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const jobData = await jobsApi.get(id);
      setJob(jobData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const silentRefresh = useCallback(async () => {
    try {
      const jobData = await jobsApi.get(id);
      setJob(jobData);
    } catch {
      // Silently fail on background polls — don't surface errors to the user
    }
  }, [id]);

  // Poll for updates every 15s when job is in_progress
  // so client sees milestone submission without manual reload
  useEffect(() => {
    if (!job || job.status !== "in_progress") return;
    const interval = setInterval(silentRefresh, 15_000);
    return () => clearInterval(interval);
  }, [job?.status, silentRefresh]);

  // ── Determine viewer role ─────────────────────────────────
  const role: "client" | "freelancer" | "visitor" = (() => {
    if (!address || !job) return "visitor";
    if (address.toLowerCase() === job.client_address.toLowerCase())
      return "client";
    const acceptedBid = job.bids?.find((b) => b.status === "accepted");
    if (
      acceptedBid &&
      address.toLowerCase() === acceptedBid.freelancer_address.toLowerCase()
    )
      return "freelancer";
    return "visitor";
  })();

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-8 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (error || !job) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="mb-3 text-5xl">😕</div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          {error ?? "Job not found"}
        </h2>
        <Link href="/jobs" className="text-sm text-initia-600 hover:underline">
          ← Back to jobs
        </Link>
      </div>
    );
  }

  const postedAt = new Date(job.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 animate-slide-down">
        <Link
          href="/jobs"
          className="hover:text-black transition-colors font-medium"
        >
          Jobs
        </Link>
        <svg
          className="h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-gray-700 font-medium truncate max-w-xs">
          {job.title}
        </span>
      </nav>

      {/* Two-column layout */}
      <div className="grid gap-12 lg:grid-cols-3">
        {/* ── Main content (2/3) ───────────────────────────── */}
        <div className="space-y-12 lg:col-span-2">
          {/* Header */}
          <header className="animate-slide-up">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {job.category && (
                <span className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                  {job.category}
                </span>
              )}
              <StatusBadge status={job.status} />
              <span className="text-xs text-gray-500">Posted {postedAt}</span>
            </div>

            <h1 className="text-3xl font-bold text-black leading-tight mb-4">
              {job.title}
            </h1>

            {/* Quick stats */}
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{formatEth(BigInt(job.total_amount_wei))} ETH</span>
              </div>
              <div className="flex items-center gap-2">
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                <span>{job.milestones?.length || 0} milestones</span>
              </div>
              <div className="flex items-center gap-2">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>{job.bids?.length || 0} bids</span>
              </div>
            </div>
          </header>

          {/* Description */}
          <section className="animate-fade-in-up animation-delay-100">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
              Description
            </h2>
            <div className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {job.description}
              </p>
            </div>
          </section>

          {/* Skills */}
          {job.required_skills?.length > 0 && (
            <section className="animate-fade-in-up animation-delay-200">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill, index) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:shadow-md transition-all animate-scale-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {job.tags?.length > 0 && (
            <section className="animate-fade-in-up animation-delay-300">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag, index) => (
                  <span
                    key={tag}
                    className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:border-black hover:bg-black hover:text-white transition-all animate-scale-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Bids — shown to client and when job is open */}
          {(role === "client" || job.status === "open") && (
            <section className="animate-fade-in-up animation-delay-400">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Bids
                </h2>
                <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                  {job.bids?.length ?? 0}
                </span>
              </div>

              <BidList
                jobId={job.id}
                chainJobId={job.chain_job_id}
                bids={job.bids ?? []}
                isClient={role === "client"}
                jobStatus={job.status}
                signer={signer}
                onRefresh={refresh}
              />
            </section>
          )}

          {/* Milestones */}
          <section className="animate-fade-in-up animation-delay-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Milestones
              </h2>
              <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                {job.milestones?.length ?? 0}
              </span>
            </div>
            {job.milestones?.length > 0 ? (
              <div className="space-y-4">
                {job.milestones.map((m, index) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm hover:shadow-md transition-all animate-fade-in-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-50">
                            <span className="text-sm font-bold text-gray-700">
                              {m.milestone_index + 1}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-black">
                            Milestone {m.milestone_index + 1}
                          </h3>
                        </div>
                        <p className="text-gray-600 leading-relaxed">
                          {m.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-black">
                            {formatEth(BigInt(m.amount_wei))} ETH
                          </div>
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                    </div>

                    {/* Freelancer: submit deliverable */}
                    {role === "freelancer" && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <SubmitDeliverableButton
                          jobId={job.id}
                          chainJobId={job.chain_job_id}
                          milestone={m}
                          signer={signer}
                          onRefresh={refresh}
                        />
                      </div>
                    )}

                    {/* Client: waiting for submission */}
                    {role === "client" && m.status === "pending" && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
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
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>
                            Waiting for freelancer to submit deliverable…
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Client: approve or dispute */}
                    {role === "client" && (
                      <ClientMilestoneActions
                        jobId={job.id}
                        chainJobId={job.chain_job_id}
                        milestone={m}
                        signer={signer}
                        onRefresh={refresh}
                      />
                    )}

                    {/* Deliverable link */}
                    {m.deliverable_uri && (
                      <a
                        href={m.deliverable_uri.replace(
                          "ipfs://",
                          "https://ipfs.io/ipfs/",
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black underline"
                      >
                        View Deliverable ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No milestones defined.</p>
            )}
          </section>

          {/* AI Verdicts - shown for completed jobs with resolved disputes */}
          {/* AI Verdicts - shown for all completed jobs */}
          {job.status === "completed" && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Job Completion Summary
              </h2>

              {job.disputes && job.disputes.length > 0 ? (
                <>
                  <div className="mb-4 text-sm text-gray-600">
                    This job had {job.disputes.length} dispute(s) that were
                    resolved by the AI agent:
                  </div>
                  <div className="space-y-4">
                    {job.disputes.map((dispute) => (
                      <div
                        key={dispute.id}
                        className="border border-neutral-200 p-5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-black">
                              Milestone {dispute.milestone_index + 1} Dispute
                              Resolution
                            </p>
                            {dispute.milestone_description && (
                              <p className="mt-1 text-sm text-neutral-600">
                                {dispute.milestone_description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                dispute.verdict === "freelancer"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {dispute.verdict === "freelancer"
                                ? "Freelancer"
                                : "Client"}{" "}
                              Wins
                            </span>
                            {dispute.confidence && (
                              <span className="text-xs text-neutral-500">
                                {dispute.confidence}% confidence
                              </span>
                            )}
                          </div>
                        </div>

                        {dispute.verdict_reason && (
                          <div className="bg-neutral-50 p-3 rounded-lg">
                            <p className="text-xs font-medium text-neutral-700 mb-1">
                              AI Reasoning:
                            </p>
                            <p className="text-sm text-neutral-600">
                              {dispute.verdict_reason}
                            </p>
                          </div>
                        )}

                        {dispute.verdict_uri && (
                          <a
                            href={dispute.verdict_uri.replace(
                              "ipfs://",
                              "https://ipfs.io/ipfs/",
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-black underline"
                          >
                            View Full Verdict Report ↗
                          </a>
                        )}

                        <div className="text-xs text-neutral-400">
                          Resolved on{" "}
                          {new Date(dispute.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-neutral-200 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                      <span className="text-green-700">✓</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        Successfully Completed
                      </h3>
                      <p className="text-xs text-gray-500">
                        All milestones were approved without disputes
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-neutral-700 mb-1">
                      Job Summary:
                    </p>
                    <p className="text-sm text-neutral-600">
                      This job was completed successfully with all milestones
                      approved by the client. No disputes were raised during the
                      project, indicating smooth collaboration between client
                      and freelancer.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Sidebar (1/3) ────────────────────────────────── */}
        <div>
          <JobDetailSidebar
            job={job}
            role={role}
            signer={signer}
            isAuthenticated={isAuthenticated}
            currentAddress={address}
            onConnect={connect}
            onRefresh={refresh}
          />
        </div>
      </div>
    </div>
  );
}
