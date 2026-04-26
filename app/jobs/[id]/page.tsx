"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { BidList } from "@/app/jobs/BidList";
import { JobDetailSidebar } from "@/app/JobDetailSidebar";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { JobRecord, jobsApi, ndaKeysApi } from "@/lib/api";
import { formatEth } from "@/lib/utils";
import { getNativeSymbol } from "@/lib/chains";
import { encodePubKey, getOrDeriveMyKeypair } from "@/lib/nda";
import { SubmitDeliverableButton } from "./_components/SubmitDeliverableButton";
import { ClientMilestoneActions } from "./_components/ClientMilestoneActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { address, signer, isAuthenticated, connect } = useWallet();

  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirror the latest job in a ref so the polling effect can inspect
  // current state without re-subscribing on every field change. Prior
  // shape (two effects, deps on job.milestones/job.disputes.length) tore
  // down and rebuilt the interval on every silentRefresh — the interval
  // count could stack if React re-ran the effect while a tick was in flight.
  const jobRef = useRef<JobRecord | null>(null);
  useEffect(() => {
    jobRef.current = job;
  }, [job]);

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

  // Single consolidated poll. Runs continuously while the page is mounted
  // and decides per-tick what to do based on jobRef.current.status. No
  // dependencies on job fields → the interval is created exactly once
  // per [id], and the cleanup on unmount / navigation guarantees a clean
  // teardown even if a tick is mid-flight.
  //
  // Cadence: 10s. We also skip ticks while the tab is hidden so a
  // backgrounded tab doesn't silently chew through the backend rate
  // budget — relevant updates will catch up the moment the user
  // returns and the tab becomes visible again.
  useEffect(() => {
    let ticks = 0;
    const VERDICT_WAIT_MAX = 3; // ~30s at 10s cadence

    const interval = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;

      const current = jobRef.current;
      if (!current) return;

      const needsInProgressPoll = current.status === "in_progress";
      const hasResolvedMilestone = current.milestones?.some(
        (m) => m.status === "resolved",
      );
      const needsVerdictWait =
        current.status === "completed" &&
        hasResolvedMilestone &&
        (current.disputes?.length ?? 0) === 0 &&
        ticks < VERDICT_WAIT_MAX;

      if (!needsInProgressPoll && !needsVerdictWait) return;

      ticks += 1;
      try {
        const jobData = await jobsApi.get(id);
        setJob(jobData);
      } catch {
        // Silent — don't surface poll errors
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [id]);

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

  // ── Confidential-access banner state (NDA jobs) ──────────────
  // Show a one-click "Enable" prompt to a client or assigned freelancer
  // that hasn't registered their confidential key for this job yet. Doing
  // this BEFORE the freelancer submits ensures the encrypted envelope
  // includes both parties from the start — no re-key dance needed.
  const [needsConfidentialEnable, setNeedsConfidentialEnable] = useState(false);
  const [confidentialEnableBusy, setConfidentialEnableBusy] = useState(false);
  const [confidentialEnableError, setConfidentialEnableError] =
    useState<string | null>(null);

  useEffect(() => {
    if (
      !job ||
      job.visibility !== "nda" ||
      !isAuthenticated ||
      !address ||
      (role !== "client" && role !== "freelancer")
    ) {
      setNeedsConfidentialEnable(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { keys } = await ndaKeysApi.list(job.id);
        const has = keys.some(
          (k) => k.address.toLowerCase() === address.toLowerCase(),
        );
        if (!cancelled) setNeedsConfidentialEnable(!has);
      } catch {
        // GET is gated to parties only — a 403 here means we shouldn't see
        // the banner anyway, so default to false.
        if (!cancelled) setNeedsConfidentialEnable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, isAuthenticated, address, role]);

  async function enableConfidentialAccess() {
    if (!signer || !job || job.chain_id == null) return;
    setConfidentialEnableBusy(true);
    setConfidentialEnableError(null);
    try {
      const kp = await getOrDeriveMyKeypair(signer, job.id, job.chain_id);
      await ndaKeysApi.register(job.id, encodePubKey(kp));
      setNeedsConfidentialEnable(false);
    } catch (err) {
      setConfidentialEnableError(
        err instanceof Error
          ? err.message
          : "Couldn't finish enabling confidential access. Please try again.",
      );
    } finally {
      setConfidentialEnableBusy(false);
    }
  }

  // ── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="h-12 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────
  if (error || !job) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <div className="mb-3 text-5xl">😕</div>
        <h2 className="mb-2 text-xl font-semibold text-fg">
          {error ?? "Job not found"}
        </h2>
        <Link href="/jobs" className="text-sm text-muted hover:text-fg underline">
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
      <nav className="flex items-center gap-2 text-sm text-muted animate-slide-down">
        <Link href="/jobs" className="hover:text-fg transition-colors font-medium">
          Jobs
        </Link>
        <ChevronRight />
        <span className="text-fg font-medium truncate max-w-[60vw] sm:max-w-xs">
          {job.title}
        </span>
      </nav>

      <div className="grid gap-10 xl:grid-cols-[1fr_360px]">
        {/* ── Main column ────────────────────────────────── */}
        <div className="min-w-0 space-y-10">
          {/* Hero */}
          <header className="animate-slide-up">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {job.category && (
                <span className="rounded-full border border-default bg-muted px-3 py-1 text-xs font-medium text-muted">
                  {job.category}
                </span>
              )}
              <StatusBadge status={job.status} />
              <span className="text-xs text-muted">Posted {postedAt}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-fg leading-[1.05] mb-6">
              {job.title}
            </h1>

            {/* Stat strip */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-6 rounded-xl border border-default bg-surface p-4">
              <Stat
                icon={<CoinIcon />}
                label="Payment"
                value={`${formatEth(BigInt(job.total_amount_wei))} ${getNativeSymbol(job.chain_id)}`}
              />
              <div className="hidden sm:block h-8 w-px bg-[var(--color-border-subtle)]" />
              <Stat
                icon={<ListIcon />}
                label="Milestones"
                value={String(job.milestones?.length || 0)}
              />
              <div className="hidden sm:block h-8 w-px bg-[var(--color-border-subtle)]" />
              <Stat
                icon={<UsersIcon />}
                label="Bids"
                value={String(job.bids?.length || 0)}
              />
            </div>
          </header>

          {/* Description */}
          <section className="animate-fade-in-up animation-delay-100">
            <SectionHeading>Description</SectionHeading>
            <div className="rounded-xl border border-default bg-surface p-5 sm:p-6 shadow-sm">
              <p className="whitespace-pre-wrap text-fg/90 leading-relaxed">
                {job.description}
              </p>
            </div>
          </section>

          {/* Skills */}
          {job.required_skills?.length > 0 && (
            <section className="animate-fade-in-up animation-delay-200">
              <SectionHeading>Required Skills</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill, index) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-default bg-surface px-4 py-2 text-sm font-medium text-fg hover:border-[var(--color-foreground)] transition-all animate-scale-in"
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
              <SectionHeading>Tags</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag, index) => (
                  <span
                    key={tag}
                    className="rounded-full border border-default bg-muted px-3 py-1 text-xs font-medium text-muted hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] transition-all animate-scale-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Bids */}
          {(role === "client" || job.status === "open") && (
            <section className="animate-fade-in-up animation-delay-400">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading className="mb-0">Bids</SectionHeading>
                <span className="rounded-full border border-default bg-muted px-2 py-0.5 text-xs font-medium text-muted">
                  {job.bids?.length ?? 0}
                </span>
              </div>

              <BidList
                jobId={job.id}
                chainJobId={job.chain_job_id}
                jobChainId={job.chain_id}
                jobVisibility={job.visibility}
                bids={job.bids ?? []}
                isClient={role === "client"}
                jobStatus={job.status}
                signer={signer}
                onRefresh={refresh}
              />
            </section>
          )}

          {/* Confidential-access enable prompt — NDA jobs, current
              user is the client or assigned freelancer and hasn't
              registered a key yet. One signature, no fee. */}
          {needsConfidentialEnable && (
            <div className="rounded-xl border border-default bg-muted px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in-up">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">
                  🔒 Enable confidential deliveries for this job
                </p>
                <p className="text-xs text-muted mt-0.5">
                  One signature so {role === "client"
                    ? "the freelancer can share work privately with you"
                    : "you can share work privately with the client"}. Free — no transaction.
                </p>
                {confidentialEnableError && (
                  <p className="text-xs text-red-600 mt-1">
                    {confidentialEnableError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={enableConfidentialAccess}
                disabled={confidentialEnableBusy || !signer}
                className="shrink-0 rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-4 py-2 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confidentialEnableBusy ? "Enabling…" : "Enable"}
              </button>
            </div>
          )}

          {/* Milestones */}
          <section className="animate-fade-in-up animation-delay-500">
            <div className="flex items-center justify-between mb-6">
              <SectionHeading className="mb-0">Milestones</SectionHeading>
              <span className="rounded-full border border-default bg-muted px-2 py-0.5 text-xs font-medium text-muted">
                {job.milestones?.length ?? 0}
              </span>
            </div>

            {job.milestones?.length > 0 ? (
              <ol className="space-y-4">
                {job.milestones.map((m, index) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-default bg-surface p-5 sm:p-6 shadow-sm transition-all hover:shadow-xl animate-fade-in-up"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-default bg-muted text-sm font-bold text-fg">
                            {m.milestone_index + 1}
                          </div>
                          <h3 className="text-base font-semibold text-fg">
                            Milestone {m.milestone_index + 1}
                          </h3>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">
                          {m.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="font-mono text-sm font-bold text-fg">
                          {formatEth(BigInt(m.amount_wei))}{" "}
                          {getNativeSymbol(job.chain_id)}
                        </div>
                        <StatusBadge status={m.status} />
                      </div>
                    </div>

                    {/* Freelancer submit */}
                    {role === "freelancer" && (
                      <div className="mt-4 pt-4 border-t border-subtle">
                        <SubmitDeliverableButton
                          jobId={job.id}
                          chainJobId={job.chain_job_id}
                          jobChainId={job.chain_id}
                          jobVisibility={job.visibility}
                          milestone={m}
                          signer={signer}
                          onRefresh={refresh}
                        />
                      </div>
                    )}

                    {/* Client waiting for submission */}
                    {role === "client" && m.status === "pending" && (
                      <div className="mt-4 pt-4 border-t border-subtle">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <ClockIcon />
                          <span>
                            Waiting for freelancer to submit deliverable…
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Client action area (submitted / disputed banners inline) */}
                    {role === "client" && m.status !== "pending" && (
                      <div className="mt-4 pt-4 border-t border-subtle">
                        <ClientMilestoneActions
                          jobId={job.id}
                          chainJobId={job.chain_job_id}
                          jobChainId={job.chain_id}
                          jobVisibility={job.visibility}
                          milestone={m}
                          signer={signer}
                          onRefresh={refresh}
                        />
                      </div>
                    )}

                    {/* Visitor banner for submitted milestones */}
                    {role === "visitor" && m.status === "submitted" && (
                      <div className="mt-4 pt-4 border-t border-subtle">
                        <div className="rounded-lg border-l-4 border-l-[var(--color-foreground)] border border-default bg-muted px-4 py-3 text-sm text-fg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="font-medium">
                            Deliverable submitted — awaiting client review
                          </span>
                          {m.deliverable_uri &&
                            (job.visibility === "nda" ? (
                              <span
                                title="Only the client and the assigned freelancer can view this deliverable"
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted"
                              >
                                🔒 Confidential
                              </span>
                            ) : (
                              <a
                                href={m.deliverable_uri.replace(
                                  "ipfs://",
                                  "https://ipfs.io/ipfs/",
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-fg hover:underline font-medium text-xs"
                              >
                                View deliverable ↗
                              </a>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Final deliverable link for approved/resolved.
                        For NDA jobs, only the client and assigned freelancer
                        can see the link — visitors see a confidential
                        indicator so the IPFS CID is never exposed. */}
                    {m.deliverable_uri && m.status !== "submitted" && (
                      <div className="mt-3">
                        {job.visibility === "nda" && role === "visitor" ? (
                          <span
                            title="Only the client and the assigned freelancer can view this deliverable"
                            className="inline-flex items-center gap-1.5 text-xs text-muted"
                          >
                            🔒 Confidential deliverable
                          </span>
                        ) : (
                          <a
                            href={m.deliverable_uri.replace(
                              "ipfs://",
                              "https://ipfs.io/ipfs/",
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg underline"
                          >
                            View Deliverable ↗
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No milestones defined.</p>
            )}
          </section>

          {/* Completion summary + disputes */}
          {job.status === "completed" && (
            <section className="animate-fade-in-up">
              <SectionHeading>Job Completion Summary</SectionHeading>
              {job.disputes && job.disputes.length > 0 ? (
                <>
                  <div className="mb-4 text-sm text-muted">
                    This job had {job.disputes.length} dispute(s) resolved by
                    the AI judges:
                  </div>
                  <div className="space-y-4">
                    {job.disputes.map((dispute) => (
                      <div
                        key={dispute.id}
                        className="rounded-xl border border-default bg-surface p-5 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-fg">
                              Milestone {dispute.milestone_index + 1} — Dispute Resolution
                            </p>
                            {dispute.milestone_description && (
                              <p className="mt-1 text-sm text-muted">
                                {dispute.milestone_description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-3 py-1 text-xs font-medium rounded-full border border-[var(--color-foreground)] text-fg uppercase tracking-wide">
                              {dispute.verdict === "freelancer"
                                ? "Freelancer wins"
                                : "Client wins"}
                            </span>
                            {dispute.confidence && (
                              <span className="text-xs text-muted">
                                {dispute.confidence}% conf
                              </span>
                            )}
                          </div>
                        </div>

                        {dispute.verdict_reason && (
                          <div className="bg-muted p-3 rounded-lg border border-subtle">
                            <p className="text-xs font-medium text-fg mb-1">
                              AI Reasoning:
                            </p>
                            <p className="text-sm text-muted">
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
                            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg underline"
                          >
                            View Full Verdict Report ↗
                          </a>
                        )}

                        <div className="text-xs text-muted opacity-75">
                          Resolved on{" "}
                          {new Date(dispute.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-default bg-surface p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]">
                      ✓
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-fg">
                        Successfully Completed
                      </h5>
                      <p className="text-xs text-muted">
                        All milestones approved without disputes
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg border border-subtle">
                    <p className="text-xs font-medium text-fg mb-1">
                      Job Summary:
                    </p>
                    <p className="text-sm text-muted">
                      This job was completed with all milestones approved by
                      the client. No disputes were raised, indicating smooth
                      collaboration.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────── */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <JobDetailSidebar
            job={job}
            role={role}
            signer={signer}
            isAuthenticated={isAuthenticated}
            currentAddress={address}
            onConnect={connect}
            onRefresh={refresh}
          />
        </aside>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────── */

function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`mb-4 text-xs font-semibold uppercase tracking-widest text-muted ${className ?? ""}`}
    >
      {children}
    </h3>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 min-w-0">
      <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-default bg-muted text-fg">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted">
          {label}
        </div>
        <div className="text-sm sm:text-base font-semibold text-fg truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
