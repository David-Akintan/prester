"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { jobsApi, type JobRecord } from "@/lib/api";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { BidList } from "@/app/jobs/BidList";
import { BidModal } from "@/app/jobs/BidModal";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { formatEth, shortenAddress } from "@/lib/utils";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address, signer, isAuthenticated } = useWallet();

  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      setError(null);
      const data = await jobsApi.get(id);
      setJob(data);
    } catch {
      setError("Failed to load job. It may not exist.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <div className="h-8 w-2/3 animate-pulse bg-neutral-100" />
        <div className="h-4 w-1/3 animate-pulse bg-neutral-100" />
        <div className="h-40 animate-pulse bg-neutral-100" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-sm text-neutral-500 mb-4">
          {error ?? "Job not found."}
        </p>
        <button
          onClick={() => router.push("/jobs")}
          className="border border-black px-4 py-2 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          ← Back to Jobs
        </button>
      </div>
    );
  }

  const isClient =
    !!address && job.client_address.toLowerCase() === address.toLowerCase();

  const isOpen = job.status === "open";
  const canBid = isAuthenticated && isOpen && !isClient && !!address;

  const totalEth = formatEth(BigInt(job.total_amount_wei));
  const postedAt = new Date(job.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Back */}
      <button
        onClick={() => router.push("/jobs")}
        className="text-xs text-neutral-400 uppercase tracking-widest hover:text-black transition-colors"
      >
        ← Back to Jobs
      </button>

      {/* Header */}
      <div className="border border-black p-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-black">
            {job.title}
          </h1>
          <StatusBadge status={job.status} />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500 mb-6">
          <span>
            Posted by{" "}
            <span className="font-mono text-black">
              {job.client_username ?? shortenAddress(job.client_address)}
            </span>
          </span>
          <span>{postedAt}</span>
          {job.category && <span>{job.category}</span>}
          {job.estimated_duration && <span>Est. {job.estimated_duration}</span>}
        </div>

        {/* Description */}
        <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mb-6">
          {job.description}
        </p>

        {/* Skills */}
        {job.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {job.required_skills.map((skill) => (
              <span
                key={skill}
                className="bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Tags */}
        {job.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {job.tags.map((tag) => (
              <span
                key={tag}
                className="border border-neutral-200 px-2.5 py-1 text-xs text-neutral-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">
              Total Escrow
            </p>
            <p className="text-2xl font-bold font-mono text-black">
              {totalEth}{" "}
              <span className="text-sm font-normal text-neutral-400">ETH</span>
            </p>
          </div>

          {canBid && (
            <button
              onClick={() => setShowBidModal(true)}
              className="bg-black text-white px-6 py-3 text-xs font-semibold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              Submit a Bid
            </button>
          )}
          {!isAuthenticated && isOpen && !isClient && (
            <p className="text-xs text-neutral-400">
              Connect your wallet to submit a bid.
            </p>
          )}
          {isClient && isOpen && (
            <p className="text-xs text-neutral-400">You posted this job.</p>
          )}
        </div>
      </div>

      {/* Milestones */}
      {job.milestones && job.milestones.length > 0 && (
        <div className="border border-black p-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-black mb-6">
            Milestones
          </h2>
          <div className="space-y-3">
            {job.milestones.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center justify-between border border-neutral-200 px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-neutral-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm text-black">{m.description}</p>
                    <StatusBadge status={m.status} className="mt-1" />
                  </div>
                </div>
                <span className="text-sm font-semibold font-mono text-black">
                  {formatEth(BigInt(m.amount_wei))} ETH
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bids */}
      <div className="border border-black p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-black">
            Bids{" "}
            <span className="text-neutral-400 font-normal">
              ({job.bids?.length ?? 0})
            </span>
          </h2>
        </div>

        <BidList
          jobId={job.id}
          chainJobId={job.chain_job_id}
          bids={job.bids ?? []}
          isClient={isClient}
          jobStatus={job.status}
          signer={signer}
          onRefresh={fetchJob}
        />
      </div>

      {/* Bid modal */}
      {showBidModal && (
        <BidModal
          jobId={job.id}
          onSuccess={() => {
            setShowBidModal(false);
            fetchJob();
          }}
          onClose={() => setShowBidModal(false)}
        />
      )}
    </div>
  );
}
