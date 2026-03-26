"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useJob } from "@/hooks/useMyJobs";
import { useWallet } from "@/app/components/wallet/WalletContext";
// import { MilestoneList } from "@/app/jobs/MilestoneList";
import { BidList } from "@/app/jobs/BidList";
import { JobDetailSidebar } from "@/app/Jobdetailsidebar";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { JobRecord } from "@/lib/api";
import { jobsApi } from "@/lib/api";

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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/jobs" className="hover:text-gray-600">
          Jobs
        </Link>
        <span>/</span>
        <span className="text-gray-600 line-clamp-1">{job.title}</span>
      </nav>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* ── Main content (2/3) ───────────────────────────── */}
        <div className="space-y-8 lg:col-span-2">
          {/* Header */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {job.category && (
                <span className="rounded-full bg-initia-50 px-2.5 py-0.5 text-xs font-medium text-initia-600">
                  {job.category}
                </span>
              )}
              <StatusBadge status={job.status} />
              <span className="text-xs text-gray-400">Posted {postedAt}</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          </div>

          {/* Description */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {job.description}
            </p>
          </section>

          {/* Skills */}
          {job.required_skills?.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {job.tags?.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Milestones */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Milestones
              <span className="ml-2 font-normal text-gray-300">
                {job.milestones?.length ?? 0}
              </span>
            </h2>

            {/* {job.milestones?.length > 0 ? (
              <MilestoneList
                milestones={job.milestones}
                chainJobId={job.chain_job_id}
                role={role}
                signer={signer}
                onRefresh={refresh}
              />
            ) : (
              <p className="text-sm text-gray-400">No milestones defined.</p>
            )} */}
          </section>

          {/* Bids — shown to client and when job is open */}
          {(role === "client" || job.status === "open") && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Bids
                <span className="ml-2 font-normal text-gray-300">
                  {job.bids?.length ?? 0}
                </span>
              </h2>

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
