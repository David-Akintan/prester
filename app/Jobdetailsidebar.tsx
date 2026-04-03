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
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
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
    // Remove the confirm() call since we're using the modal
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
    // Remove the confirm() call and use modal state instead
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
          {role === "visitor" && isAuthenticated && job.status !== "open" && (
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
              {(() => {
                const acceptedBid = job.bids?.find(
                  (b) => b.status === "accepted",
                );
                if (acceptedBid) {
                  return (
                    <>
                      <div className="mb-2">
                        ✓ This job has been assigned to{" "}
                        <span className="font-medium text-gray-700">
                          {acceptedBid.username ??
                            shortenAddress(acceptedBid.freelancer_address)}
                        </span>
                      </div>
                      <div className="text-xs">Work is now in progress.</div>
                    </>
                  );
                }

                switch (job.status) {
                  case "in_progress":
                    return "A freelancer has been assigned to this job.";
                  case "completed":
                    return "This job has been completed.";
                  default:
                    return "This job is no longer accepting bids.";
                }
              })()}
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
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-black hover:text-white rounded-lg"
            >
              Cancel Job
            </button>
          )}

          {/* Client — completed, can archive */}
          {role === "client" && job.status === "completed" && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="w-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-black hover:text-white rounded-lg"
            >
              Archive Job
            </button>
          )}
        </div>

        {/* Error / success feedback */}
        {actionError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <span>{actionError}</span>
            </div>
          </div>
        )}
        {actionSuccess && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-green-500"
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
              <span>{actionSuccess}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Cancel Job Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowCancelConfirm(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="border-b border-gray-300 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-black">Cancel Job</h3>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-400 transition-all hover:border-black hover:bg-black hover:text-white"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this job? This action cannot be
                undone and will refund your ETH with a cancellation fee.
              </p>

              {/* Fee transparency */}
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-black">
                  Refund Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total locked</span>
                    <span className="font-medium text-black">
                      {totalEth} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cancellation fee (5%)</span>
                    <span className="font-medium text-red-600">
                      − {cancellationFeeEth} ETH
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-2">
                    <span className="font-semibold text-black">
                      You receive
                    </span>
                    <span className="font-bold text-black">
                      {refundAfterFeeEth} ETH
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                The 5% fee is non-refundable. Funds are returned directly to
                your wallet by the smart contract.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-300 bg-white px-6 py-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-gray-100"
                >
                  Go Back
                </button>
                <button
                  onClick={handleDelete}
                  disabled={cancelling}
                  className="flex-1 rounded-lg border border-black bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? "Processing…" : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Job Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowArchiveConfirm(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="border-b border-gray-300 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-black">
                  Archive Job
                </h3>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-400 transition-all hover:border-black hover:bg-black hover:text-white"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Archive this job? It will be hidden from your dashboard but can
                be restored later if needed.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-300 bg-white px-6 py-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  disabled={cancelling}
                  className="flex-1 rounded-lg border border-black bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? "Archiving…" : "Archive Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client — in progress (no actions available) */}
      {role === "client" &&
        job.status === "in_progress" &&
        (() => {
          const hasSubmitted = job.milestones?.some(
            (m) => m.status === "submitted",
          );
          return (
            <div
              className={`px-4 py-3 text-center text-xs border rounded-lg ${
                hasSubmitted
                  ? "border-black bg-black text-white"
                  : "border-gray-300 text-gray-400"
              }`}
            >
              {hasSubmitted
                ? "⚡ A milestone is ready to review below"
                : "Waiting for freelancer to submit work…"}
            </div>
          );
        })()}

      {/* Client — draft (waiting on-chain confirmation) */}
      {/* {role === "client" && job.status === "draft" && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Waiting for on-chain confirmation…
            </div>
          )} */}

      {/* Client — completed */}
      {role === "client" && job.status === "completed" && (
        <div className="border border-black px-4 py-3 text-center text-xs uppercase tracking-wide text-black rounded-lg">
          ✓ All milestones completed
        </div>
      )}

      {/* Error / success feedback */}
      {actionError && (
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
            <span>{actionError}</span>
          </div>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-green-500"
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
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      {/* Cancel Job Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowCancelConfirm(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="border-b border-gray-300 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-black">Cancel Job</h3>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-400 transition-all hover:border-black hover:bg-black hover:text-white"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this job? This action cannot be
                undone and will refund your ETH with a cancellation fee.
              </p>

              {/* Fee transparency */}
              <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-black">
                  Refund Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total locked</span>
                    <span className="font-medium text-black">
                      {totalEth} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cancellation fee (5%)</span>
                    <span className="font-medium text-red-600">
                      − {cancellationFeeEth} ETH
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-2">
                    <span className="font-semibold text-black">
                      You receive
                    </span>
                    <span className="font-bold text-black">
                      {refundAfterFeeEth} ETH
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                The 5% fee is non-refundable. Funds are returned directly to
                your wallet by the smart contract.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-300 bg-white px-6 py-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-gray-100"
                >
                  Go Back
                </button>
                <button
                  onClick={handleDelete}
                  disabled={cancelling}
                  className="flex-1 rounded-lg border border-black bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? "Processing…" : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Job Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowArchiveConfirm(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="border-b border-gray-300 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-black">
                  Archive Job
                </h3>
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-400 transition-all hover:border-black hover:bg-black hover:text-white"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Archive this job? It will be hidden from your dashboard but can
                be restored later if needed.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-300 bg-white px-6 py-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  disabled={cancelling}
                  className="flex-1 rounded-lg border border-black bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? "Archiving…" : "Archive Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Posted by
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
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
