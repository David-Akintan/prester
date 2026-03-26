"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { formatEth, shortenAddress, cn } from "@/lib/utils";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { BidModal } from "@/app/jobs/BidModal";
import { jobsApi, ApiError, type BidRecord } from "@/lib/api";
import { cancelJob } from "@/lib/contracts";
import { parseContractError } from "@/lib/utils";
import type { JobRecord } from "@/lib/api";
import type { JsonRpcSigner } from "ethers";

interface JobDetailSidebarProps {
  job: JobRecord;
  role: "client" | "freelancer" | "visitor";
  signer: JsonRpcSigner | null;
  isAuthenticated: boolean;
  currentAddress: string | null;
  onConnect: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function JobDetailSidebar({
  job,
  role,
  signer,
  isAuthenticated,
  currentAddress,
  onConnect,
  onRefresh,
}: JobDetailSidebarProps) {
  const router = useRouter();
  const [showBidModal, setShowBidModal] = useState(false);
  const [editingBid, setEditingBid] = useState<BidRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const totalEth = formatEth(BigInt(job.total_amount_wei));
  const milestoneCount = job.milestones?.length ?? 0;

  // Count progress
  const approvedCount =
    job.milestones?.filter(
      (m) => m.status === "approved" || m.status === "resolved",
    ).length ?? 0;

  // The current visitor's own bid (if any)
  const myBid = currentAddress
    ? job.bids?.find(
        (b) =>
          b.freelancer_address.toLowerCase() === currentAddress.toLowerCase() &&
          (b.status === "pending" || b.status === "accepted"),
      )
    : null;

  const canEditBid =
    !!myBid &&
    myBid.status === "pending" &&
    !myBid.has_been_edited &&
    job.status === "open";

  // Cancellation fee amount in ETH (read from contract field if available)
  const cancellationFeeBps = 500; // 5% — matches contract deployment
  const cancellationFeeEth = formatEth(
    (BigInt(job.total_amount_wei) * BigInt(cancellationFeeBps)) / 10_000n,
  );
  const refundAfterFeeEth = formatEth(
    BigInt(job.total_amount_wei) -
      (BigInt(job.total_amount_wei) * BigInt(cancellationFeeBps)) / 10_000n,
  );

  async function handleDelete() {
    const label =
      job.status === "draft"
        ? "Delete this draft job?"
        : "Cancel this job and refund your ETH? This cannot be undone.";

    if (!confirm(label)) return;

    setCancelling(true);
    setActionError(null);

    try {
      // Step 1: if open and on-chain, cancel the escrow contract first
      // so the ETH is refunded before we touch the DB
      if (job.status === "open" && job.chain_job_id && signer) {
        await cancelJob(signer, BigInt(job.chain_job_id));
      }

      // Step 2: mark deleted / cancelled in the backend
      await jobsApi.delete(job.id);

      setActionSuccess(
        `Job cancelled. ${refundAfterFeeEth} ETH refunded to your wallet.`,
      );

      // Step 3: redirect away — the job no longer exists in the UI
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : parseContractError(err);
      setActionError(message);
      setCancelling(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this job? It will be hidden from your dashboard."))
      return;
    setCancelling(true);
    setActionError(null);
    try {
      await jobsApi.delete(job.id);
      router.push("/dashboard");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Failed to archive job.",
      );
      setCancelling(false);
    }
  }

  return (
    <>
      <aside className="space-y-4">
        {/* Payment card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">
              Total Payment
            </span>
            <StatusBadge status={job.status} />
          </div>

          <p className="mb-1 text-3xl font-bold text-gray-900">
            {totalEth}
            <span className="ml-1.5 text-base font-medium text-gray-400">
              ETH
            </span>
          </p>

          {/* Milestone progress bar */}
          {milestoneCount > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-gray-400">
                <span>Milestones</span>
                <span>
                  {approvedCount}/{milestoneCount} complete
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-initia-500 transition-all"
                  style={{
                    width: `${milestoneCount > 0 ? (approvedCount / milestoneCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Meta */}
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            {job.estimated_duration && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Duration</dt>
                <dd className="font-medium text-gray-700">
                  {job.estimated_duration}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Milestones</dt>
              <dd className="font-medium text-gray-700">{milestoneCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Bids</dt>
              <dd className="font-medium text-gray-700">
                {job.bids?.length ?? 0}
              </dd>
            </div>
            {job.chain_job_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">On-chain ID</dt>
                <dd className="font-mono text-xs text-gray-500">
                  #{job.chain_job_id}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Action panel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Visitor — not logged in */}
          {role === "visitor" && !isAuthenticated && (
            <button
              onClick={onConnect}
              className="w-full rounded-lg bg-initia-600 py-2.5 text-sm font-semibold text-white transition hover:bg-initia-700"
            >
              Connect Wallet to Bid
            </button>
          )}

          {/* Visitor — logged in, job is open, hasn't bid */}
          {role === "visitor" &&
            isAuthenticated &&
            job.status === "open" &&
            !myBid && (
              <button
                onClick={() => setShowBidModal(true)}
                className="w-full rounded-lg bg-initia-600 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-initia-700 cursor-pointer"
              >
                Place a Bid
              </button>
            )}

          {/* Visitor — already bid */}
          {role === "visitor" && isAuthenticated && myBid && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-center text-sm text-blue-700">
              ✓ You&apos;ve placed a bid on this job.
            </div>
          )}

          {/* Visitor — has a pending bid, can edit once */}
          {role === "visitor" && myBid && myBid.status === "pending" && (
            <div className="space-y-2">
              <div className="border border-black px-4 py-3 text-center text-xs uppercase tracking-wide text-black">
                ✓ Bid submitted
              </div>
              {canEditBid ? (
                <button
                  onClick={() => setEditingBid(myBid)}
                  className="w-full border border-black py-2.5 text-xs font-medium uppercase tracking-widest text-black transition hover:bg-black hover:text-white"
                >
                  Edit Bid (1 edit remaining)
                </button>
              ) : myBid.has_been_edited ? (
                <p className="text-center text-xs text-neutral-400">
                  Bid locked — already edited once.
                </p>
              ) : null}
            </div>
          )}

          {/* Visitor — bid accepted */}
          {role === "visitor" && myBid && myBid.status === "accepted" && (
            <div className="border border-black px-4 py-3 text-center text-xs uppercase tracking-wide text-black">
              ✓ Your bid was accepted
            </div>
          )}

          {/* Visitor — job not open */}
          {role === "visitor" &&
            isAuthenticated &&
            job.status !== "open" &&
            !myBid && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                This job is no longer accepting bids.
              </div>
            )}

          {/* Freelancer — assigned */}
          {role === "freelancer" && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm text-green-700">
              ✓ You are the assigned freelancer. Submit work on each milestone
              below.
            </div>
          )}

          {/* Client — draft */}
          {role === "client" && job.status === "draft" && (
            <div className="border border-neutral-200 px-4 py-3 text-xs text-neutral-400">
              Waiting for on-chain confirmation…
            </div>
          )}

          {/* Client — open, can cancel (with fee disclosure) */}
          {role === "client" && job.status === "open" && job.chain_job_id && (
            <>
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full border border-black py-2.5 text-xs font-medium uppercase tracking-widest text-black transition hover:bg-black hover:text-white"
                >
                  Cancel Job
                </button>
              ) : (
                <div className="border border-black p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-black">
                    Confirm Cancellation
                  </p>
                  {/* Fee transparency */}
                  <div className="bg-neutral-50 border border-neutral-200 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Total locked</span>
                      <span className="font-medium text-black">
                        {totalEth} ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">
                        Cancellation fee (5%)
                      </span>
                      <span className="font-medium text-red-600">
                        − {cancellationFeeEth} ETH
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-neutral-200 pt-1.5">
                      <span className="font-medium text-black">
                        You receive
                      </span>
                      <span className="font-bold text-black">
                        {refundAfterFeeEth} ETH
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400">
                    The 5% fee is non-refundable. Funds are returned directly to
                    your wallet by the smart contract.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 border border-neutral-200 py-2 text-xs uppercase tracking-wide text-neutral-500 hover:border-black hover:text-black"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={cancelling}
                      className="flex-1 border border-black bg-black py-2 text-xs font-medium uppercase tracking-wide text-white transition hover:bg-white hover:text-black disabled:opacity-50"
                    >
                      {cancelling ? "Processing…" : "Confirm Cancel"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Client — in progress (no actions available) */}
          {role === "client" && job.status === "in_progress" && (
            <div className="border border-neutral-200 px-4 py-3 text-center text-xs text-neutral-400">
              Job in progress — approve milestones below
            </div>
          )}

          {/* Client — draft (waiting on-chain confirmation) */}
          {/* {role === "client" && job.status === "draft" && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Waiting for on-chain confirmation…
            </div>
          )} */}

          {/* Client — completed */}
          {role === "client" && job.status === "completed" && (
            <div className="border border-black px-4 py-3 text-center text-xs uppercase tracking-wide text-black">
              ✓ All milestones completed
            </div>
          )}

          {/* Error / success feedback */}
          {actionError && (
            <p className="mt-3 text-xs text-red-600">{actionError}</p>
          )}
          {actionSuccess && (
            <p className="mt-3 text-xs text-green-700">{actionSuccess}</p>
          )}
        </div>

        {/* Client info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Posted by
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-initia-100 text-sm font-semibold text-initia-700">
              {(job.client_username ?? job.client_address)?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {job.client_username ?? shortenAddress(job.client_address)}
              </p>
              <p className="font-mono text-xs text-gray-400">
                {shortenAddress(job.client_address)}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Bid modal */}
      {showBidModal && (
        <BidModal
          jobId={job.id}
          onSuccess={() => {
            setShowBidModal(false);
            onRefresh();
          }}
          onClose={() => setShowBidModal(false)}
        />
      )}

      {/* Edit bid modal */}
      {editingBid && (
        <BidModal
          jobId={job.id}
          existingBid={editingBid}
          onSuccess={() => {
            setEditingBid(null);
            onRefresh();
          }}
          onClose={() => setEditingBid(null)}
        />
      )}
    </>
  );
}
