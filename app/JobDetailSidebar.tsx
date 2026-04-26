"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEth, shortenAddress } from "@/lib/utils";
import { getNativeSymbol } from "@/lib/chains";
import { ChainGuardedAction } from "@/app/components/ui/ChainGuardedAction";
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
  const nativeSymbol = getNativeSymbol(job.chain_id);
  const milestoneCount = job.milestones?.length ?? 0;

  const approvedCount =
    job.milestones?.filter(
      (m) => m.status === "approved" || m.status === "resolved",
    ).length ?? 0;

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

  const cancellationFeeBps = 500;
  const cancellationFeeEth = formatEth(
    (BigInt(job.total_amount_wei) * BigInt(cancellationFeeBps)) / 10_000n,
  );
  const refundAfterFeeEth = formatEth(
    BigInt(job.total_amount_wei) -
      (BigInt(job.total_amount_wei) * BigInt(cancellationFeeBps)) / 10_000n,
  );

  async function handleDelete() {
    setCancelling(true);
    setActionError(null);
    try {
      if (job.status === "open" && job.chain_job_id && signer) {
        await cancelJob(signer, BigInt(job.chain_job_id));
      }
      await jobsApi.delete(job.id);
      setActionSuccess(
        `Job cancelled. ${refundAfterFeeEth} ${nativeSymbol} refunded to your wallet.`,
      );
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : parseContractError(err);
      setActionError(message);
      setCancelling(false);
    }
  }

  async function handleArchive() {
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

  const hasSubmittedMilestone = job.milestones?.some(
    (m) => m.status === "submitted",
  );

  return (
    <>
      <div className="w-full space-y-4">
        {/* ── Payment card ──────────────────────────────── */}
        <div className="rounded-xl border border-default bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted">
              Total Payment
            </span>
            <div className="flex items-center gap-1.5">
              {job.visibility === "nda" && (
                <span
                  title="NDA — deliverables confidential"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-background)]"
                >
                  🔒 NDA
                </span>
              )}
              <StatusBadge status={job.status} />
            </div>
          </div>

          <p className="mb-1 text-3xl font-bold text-fg">
            {totalEth}
            <span className="ml-1.5 text-base font-medium text-muted">
              {nativeSymbol}
            </span>
          </p>

          {milestoneCount > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Milestones</span>
                <span>
                  {approvedCount}/{milestoneCount} complete
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--color-foreground)] transition-all"
                  style={{
                    width: `${milestoneCount > 0 ? (approvedCount / milestoneCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <dl className="mt-4 space-y-2 border-t border-subtle pt-4 text-sm">
            {job.estimated_duration && (
              <div className="flex justify-between">
                <dt className="text-muted">Duration</dt>
                <dd className="font-medium text-fg">
                  {job.estimated_duration}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Milestones</dt>
              <dd className="font-medium text-fg">{milestoneCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Bids</dt>
              <dd className="font-medium text-fg">{job.bids?.length ?? 0}</dd>
            </div>
            {job.chain_job_id && (
              <div className="flex justify-between">
                <dt className="text-muted">On-chain ID</dt>
                <dd className="font-mono text-xs text-muted">
                  #{job.chain_job_id}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* ── Action panel ──────────────────────────────── */}
        <div className="rounded-xl border border-default bg-surface p-5 shadow-sm">
          {role === "visitor" && !isAuthenticated && (
            <button
              onClick={onConnect}
              className="w-full rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] py-2.5 text-sm font-semibold text-[var(--color-background)] transition hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
            >
              Connect Wallet to Bid
            </button>
          )}

          {role === "visitor" &&
            isAuthenticated &&
            !myBid &&
            (job.status === "open" ? (
              <ChainGuardedAction jobChainId={job.chain_id} label="Place a Bid">
                <button
                  onClick={() => setShowBidModal(true)}
                  className="w-full rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] py-2.5 text-sm font-semibold text-[var(--color-background)] transition hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] cursor-pointer"
                >
                  Place a Bid
                </button>
              </ChainGuardedAction>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Bidding closed — job already assigned"
                className="w-full rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] py-2.5 text-sm font-semibold text-[var(--color-background)] opacity-40 blur-[1px] cursor-not-allowed pointer-events-none select-none"
              >
                Place a Bid
              </button>
            ))}

          {role === "visitor" && myBid && myBid.status === "pending" && (
            <div className="space-y-2">
              <div className="border border-[var(--color-foreground)] bg-muted px-4 py-3 text-center text-xs uppercase tracking-wide text-fg rounded-lg">
                ✓ Bid submitted
              </div>
              {canEditBid ? (
                <button
                  onClick={() => setEditingBid(myBid)}
                  className="w-full border border-[var(--color-foreground)] py-2.5 text-xs font-medium uppercase tracking-widest text-fg rounded-lg transition hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]"
                >
                  Edit Bid (1 edit remaining)
                </button>
              ) : myBid.has_been_edited ? (
                <p className="text-center text-xs text-muted">
                  Bid locked — already edited once.
                </p>
              ) : null}
            </div>
          )}

          {role === "visitor" && myBid && myBid.status === "accepted" && (
            <div className="border border-[var(--color-foreground)] bg-muted px-4 py-3 text-center text-xs uppercase tracking-wide text-fg rounded-lg">
              ✓ Your bid was accepted
            </div>
          )}

          {role === "visitor" && isAuthenticated && job.status !== "open" && (
            <div className="rounded-lg bg-muted border border-default px-4 py-3 text-center text-sm text-muted">
              {(() => {
                const acceptedBid = job.bids?.find(
                  (b) => b.status === "accepted",
                );
                if (acceptedBid) {
                  return (
                    <>
                      <div className="mb-2">
                        ✓ Assigned to{" "}
                        <span className="font-medium text-fg">
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

          {role === "freelancer" && (
            <div className="rounded-lg border-l-4 border-l-[var(--color-foreground)] border border-default bg-muted px-4 py-3 text-sm text-fg">
              ✓ You are the assigned freelancer. Submit work on each milestone.
            </div>
          )}

          {/* {role === "client" && job.status === "draft" && (
            <div className="border border-default px-4 py-3 text-xs text-muted rounded-lg">
              Waiting for on-chain confirmation…
            </div>
          )} */}

          {role === "client" && job.status === "open" && job.chain_job_id && (
            <ChainGuardedAction jobChainId={job.chain_id} label="Cancel Job">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full border border-default bg-surface px-4 py-2.5 text-sm font-medium text-fg rounded-lg transition-all hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]"
              >
                Cancel Job
              </button>
            </ChainGuardedAction>
          )}

          {role === "client" && job.status === "in_progress" && (
            <div
              className={`px-4 py-3 text-center text-xs border rounded-lg ${
                hasSubmittedMilestone
                  ? "border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]"
                  : "border-default text-muted"
              }`}
            >
              {hasSubmittedMilestone
                ? "⚡ A milestone is ready to review"
                : "Waiting for freelancer to submit work…"}
            </div>
          )}

          {role === "client" && job.status === "completed" && (
            <div className="space-y-2">
              <div className="border border-[var(--color-foreground)] bg-muted px-4 py-3 text-center text-xs uppercase tracking-wide text-fg rounded-lg">
                ✓ All milestones completed
              </div>
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="w-full border border-default bg-surface px-4 py-2.5 text-sm font-medium text-fg rounded-lg transition-all hover:border-[var(--color-foreground)]"
              >
                Archive Job
              </button>
            </div>
          )}
        </div>

        {/* Feedback */}
        {actionError && (
          <div className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="rounded-lg border border-[var(--color-foreground)] bg-muted px-4 py-3 text-sm text-fg">
            {actionSuccess}
          </div>
        )}

        {/* Client info */}
        <div className="rounded-xl border border-default bg-surface p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
            Posted by
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted border border-default text-sm font-semibold text-fg">
              {(job.client_username ?? job.client_address)?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg truncate">
                {job.client_username ?? shortenAddress(job.client_address)}
              </p>
              <p className="font-mono text-xs text-muted truncate">
                {shortenAddress(job.client_address)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Job Modal */}
      {showCancelConfirm && (
        <Modal onClose={() => setShowCancelConfirm(false)} title="Cancel Job">
          <div className="px-6 py-4">
            <p className="text-sm text-muted mb-4">
              Are you sure you want to cancel this job? This action cannot be
              undone and will refund your {nativeSymbol} with a cancellation
              fee.
            </p>

            <div className="rounded-lg border border-default bg-muted p-4 space-y-3">
              <h4 className="text-sm font-semibold text-fg">Refund Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Total locked</span>
                  <span className="font-medium text-fg">
                    {totalEth} {nativeSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Cancellation fee (5%)</span>
                  <span className="font-medium text-fg">
                    − {cancellationFeeEth} {nativeSymbol}
                  </span>
                </div>
                <div className="flex justify-between border-t border-subtle pt-2">
                  <span className="font-semibold text-fg">You receive</span>
                  <span className="font-bold text-fg">
                    {refundAfterFeeEth} {nativeSymbol}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted mt-3">
              The 5% fee is non-refundable. Funds return directly to your wallet
              by the smart contract.
            </p>
          </div>

          <div className="border-t border-default bg-surface px-6 py-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 rounded-lg border border-default bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-all hover:border-[var(--color-foreground)]"
            >
              Go Back
            </button>
            <button
              onClick={handleDelete}
              disabled={cancelling}
              className="flex-1 rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? "Processing…" : "Confirm Cancel"}
            </button>
          </div>
        </Modal>
      )}

      {/* Archive Modal */}
      {showArchiveConfirm && (
        <Modal onClose={() => setShowArchiveConfirm(false)} title="Archive Job">
          <div className="px-6 py-4">
            <p className="text-sm text-muted">
              Archive this job? It will be hidden from your dashboard but can be
              restored later if needed.
            </p>
          </div>
          <div className="border-t border-default bg-surface px-6 py-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowArchiveConfirm(false)}
              className="flex-1 rounded-lg border border-default bg-surface px-4 py-2.5 text-sm font-medium text-fg transition-all hover:border-[var(--color-foreground)]"
            >
              Cancel
            </button>
            <button
              onClick={handleArchive}
              disabled={cancelling}
              className="flex-1 rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? "Archiving…" : "Archive Job"}
            </button>
          </div>
        </Modal>
      )}

      {/* Bid modals */}
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

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-default bg-surface shadow-2xl animate-scale-in">
        <div className="border-b border-default bg-surface px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-default text-muted transition-all hover:border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
