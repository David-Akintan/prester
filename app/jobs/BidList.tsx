"use client";

import { useState } from "react";
import { useChainId } from "wagmi";
import { ApiError, bidsApi, jobsApi, type BidRecord } from "@/lib/api";
import { acceptBid } from "@/lib/contracts";
import { shortenAddress, parseContractError, cn } from "@/lib/utils";
import { ChainGuardedAction } from "@/app/components/ui/ChainGuardedAction";
import type { JsonRpcSigner } from "ethers";

interface BidListProps {
  jobId: string;
  chainJobId: number | null;
  jobChainId: number | null;
  bids: BidRecord[];
  isClient: boolean;
  jobStatus: string;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}

// Poll job detail until the target bid shows 'accepted'. Used as a backstop
// for the acceptBid flow — if the /confirm-accept endpoint fails silently or
// the chain listener is slow, the UI would otherwise be stuck on 'pending'.
// 20s cap (10 polls × 2s) is long enough to ride out a listener reconnect
// but short enough that a dead listener surfaces an error to the user.
async function waitForAcceptedStatus(
  jobId: string,
  bidId: string,
  maxAttempts = 10,
  intervalMs = 2000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const job = await jobsApi.get(jobId);
      const bid = job.bids?.find((b) => b.id === bidId);
      if (bid?.status === "accepted") return true;
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export function BidList({
  jobId,
  chainJobId,
  jobChainId,
  bids,
  isClient,
  jobStatus,
  signer,
  onRefresh,
}: BidListProps) {
  const walletChainId = useChainId();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedBid, setSelectedBid] = useState<BidRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleAccept(bid: BidRecord) {
    if (!signer || !chainJobId) return;
    setAcceptingId(bid.id);
    setError(null);
    setSuccessMsg(null);

    try {
      // On-chain: assign freelancer via escrow contract.
      const receipt = await acceptBid(
        signer,
        BigInt(chainJobId),
        bid.freelancer_address,
      );

      // Authoritative DB sync via confirm endpoint. Failures here used to
      // be swallowed, which left the UI staring at a stale "pending" bid
      // while users thought the action succeeded. We now surface the error
      // and fall through to a polling backstop that waits for the chain
      // listener to catch up before giving up.
      let confirmFailed = false;
      try {
        await bidsApi.confirmAccept(jobId, bid.id, walletChainId, receipt.hash);
      } catch (confirmErr) {
        confirmFailed = true;
        console.warn(
          "[BidList] confirm-accept failed, falling back to listener:",
          confirmErr,
        );
      }

      await onRefresh();

      // Backstop: if the confirm endpoint failed (or the DB write hasn't
      // landed yet), poll until the bid flips to 'accepted' via the
      // on-chain listener. Caps at ~20s so a dead listener surfaces an
      // error instead of hanging forever.
      const accepted = await waitForAcceptedStatus(jobId, bid.id);
      if (!accepted) {
        throw new Error(
          confirmFailed
            ? "Bid confirmation failed to sync. Refresh in a moment — if it stays pending, the chain listener may be down."
            : "On-chain acceptance confirmed, but the database hasn't updated yet. Refresh in a moment.",
        );
      }

      setSuccessMsg(
        `Bid accepted! ${bid.username ?? shortenAddress(bid.freelancer_address)} is now assigned.`,
      );
      setSelectedBid(null);
    } catch (err) {
      const parsed =
        err instanceof ApiError ? err.message : parseContractError(err);
      if (parsed.includes("JobAlreadyHasFreelancer")) {
        setError(
          "This job already has a freelancer assigned on-chain. Refreshing data…",
        );
        await onRefresh();
      } else {
        setError(parsed);
      }
    } finally {
      setAcceptingId(null);
    }
  }

  if (bids.length === 0) {
    return (
      <div className="rounded-xl border border-gray-300 bg-gray-50 py-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
          <svg
            className="h-6 w-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-600 font-medium">No bids yet</p>
        <p className="text-xs text-gray-500 mt-1">
          Share this job to get proposals from talented freelancers
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Feedback banners */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-slide-down">
            <div className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-red-500 mt-0.5"
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
              <p>{error}</p>
            </div>
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 animate-slide-down">
            <div className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-green-500 mt-0.5"
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
              <p>{successMsg}</p>
            </div>
          </div>
        )}

        {bids.map((bid, index) => {
          const isAccepting = acceptingId === bid.id;
          const canAccept =
            isClient &&
            jobStatus === "open" &&
            bid.status === "pending" &&
            !!signer &&
            !!chainJobId;

          return (
            <div
              key={bid.id}
              className={cn(
                "group rounded-xl border bg-white transition-all duration-200 hover:shadow-xl animate-fade-in-up",
                bid.status === "accepted" &&
                  "border-green-500 bg-green-50 shadow-sm",
                bid.status === "rejected" && "border-gray-200 opacity-60",
                bid.status === "pending" &&
                  "border-gray-300 hover:border-black cursor-pointer",
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => bid.status === "pending" && setSelectedBid(bid)}
            >
              {/* Bid header */}
              <div className="flex items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-50 group-hover:border-black transition-colors">
                    <span className="text-sm font-bold text-gray-700 group-hover:text-black">
                      {(bid.username ??
                        bid.freelancer_address)?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {bid.username ?? shortenAddress(bid.freelancer_address)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(bid.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {bid.proposed_timeline && (
                        <span className="ml-2">• {bid.proposed_timeline}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status pill */}
                  {bid.status === "accepted" && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                      ✓ Accepted
                    </span>
                  )}
                  {bid.status === "rejected" && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200">
                      Rejected
                    </span>
                  )}

                  {/* View bid button */}
                  {bid.status === "pending" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBid(bid);
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all hover:border-black hover:bg-black hover:text-white"
                    >
                      View Bid
                    </button>
                  )}
                </div>
              </div>

              {/* Bid preview snippet */}
              {bid.status === "pending" && (
                <div className="px-6 pb-4">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {bid.cover_letter}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Helpful note for client if no chain job id yet */}
        {isClient && !chainJobId && jobStatus === "open" && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-xs text-gray-500">
                Waiting for on-chain confirmation before bids can be accepted
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bid Modal */}
      {selectedBid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedBid(null)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="sticky top-0 border-b border-gray-300 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-50">
                    <span className="text-sm font-bold text-gray-700">
                      {(selectedBid.username ??
                        selectedBid.freelancer_address)?.[0]?.toUpperCase() ??
                        "?"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedBid.username ??
                        shortenAddress(selectedBid.freelancer_address)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(selectedBid.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                      {selectedBid.proposed_timeline &&
                        ` • ${selectedBid.proposed_timeline}`}
                    </p>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setSelectedBid(null)}
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
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              {/* Cover Letter */}
              <div className="mb-6">
                <h4 className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Cover Letter
                </h4>
                <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                    {selectedBid.cover_letter}
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              {selectedBid.proposed_timeline && (
                <div className="mb-6">
                  <h4 className="mb-2 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Proposed Timeline
                  </h4>
                  <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                      {selectedBid.proposed_timeline}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 border-t border-gray-300 bg-white px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedBid(null)}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-black hover:bg-gray-100"
                >
                  Close
                </button>

                {/* Accept button - client only */}
                {isClient &&
                  jobStatus === "open" &&
                  selectedBid.status === "pending" &&
                  !!signer &&
                  !!chainJobId && (
                    <ChainGuardedAction
                      jobChainId={jobChainId}
                      label="Accept Bid"
                      containerClassName="w-full"
                    >
                      <button
                        onClick={() => handleAccept(selectedBid)}
                        disabled={!!acceptingId}
                        className="rounded-lg border border-black bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {acceptingId === selectedBid.id
                          ? "Accepting…"
                          : "Accept Bid"}
                      </button>
                    </ChainGuardedAction>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
