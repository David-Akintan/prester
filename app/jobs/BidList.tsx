"use client";

import { useState } from "react";
import { bidsApi, jobsApi, ApiError, type BidRecord } from "@/lib/api";
import { acceptBid } from "@/lib/contracts";
import { shortenAddress, parseContractError, cn } from "@/lib/utils";
import type { JsonRpcSigner } from "ethers";

interface BidListProps {
  jobId: string;
  chainJobId: number | null;
  bids: BidRecord[];
  isClient: boolean;
  jobStatus: string;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}

export function BidList({
  jobId,
  chainJobId,
  bids,
  isClient,
  jobStatus,
  signer,
  onRefresh,
}: BidListProps) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleAccept(bid: BidRecord) {
    if (!signer || !chainJobId) return;
    setAcceptingId(bid.id);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. On-chain: assign freelancer via escrow contract
      await acceptBid(signer, BigInt(chainJobId), bid.freelancer_address);

      // 2. Off-chain: update bid + job status in backend DB
      await bidsApi.accept(jobId, bid.id);

      setSuccessMsg(
        `Bid accepted! ${bid.username ?? shortenAddress(bid.freelancer_address)} is now assigned.`,
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : parseContractError(err));
    } finally {
      setAcceptingId(null);
    }
  }

  if (bids.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-400">
        No bids yet. Share this job to get proposals.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Feedback banners */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {bids.map((bid) => {
        const isExpanded = expandedId === bid.id;
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
              "rounded-xl border bg-white transition",
              bid.status === "accepted" && "border-green-300 bg-green-50",
              bid.status === "rejected" && "border-gray-200 opacity-60",
              bid.status === "pending" &&
                "border-gray-200 hover:border-initia-200",
            )}
          >
            {/* Bid header */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-initia-100 text-sm font-semibold text-initia-700">
                  {(bid.username ??
                    bid.freelancer_address)?.[0]?.toUpperCase() ?? "?"}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {bid.username ?? shortenAddress(bid.freelancer_address)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(bid.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {bid.proposed_timeline && ` · ${bid.proposed_timeline}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status pill */}
                {bid.status === "accepted" && (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Accepted
                  </span>
                )}
                {bid.status === "rejected" && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    Rejected
                  </span>
                )}

                {/* Expand/collapse cover letter */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : bid.id)}
                  className="text-xs text-initia-600 hover:underline"
                >
                  {isExpanded ? "Hide" : "Read letter"}
                </button>

                {/* Accept button — client only */}
                {canAccept && (
                  <button
                    onClick={() => handleAccept(bid)}
                    disabled={!!acceptingId}
                    className="rounded-lg bg-initia-600 px-3.5 py-1.5 text-xs font-semibold text-gray-500 cursor-pointer transition hover:bg-initia-700 disabled:opacity-50"
                  >
                    {isAccepting ? "Accepting…" : "Accept Bid"}
                  </button>
                )}
              </div>
            </div>

            {/* Cover letter */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                <p className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed">
                  {bid.cover_letter}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Helpful note for client if no chain job id yet */}
      {isClient && !chainJobId && jobStatus === "open" && (
        <p className="text-center text-xs text-gray-400">
          Waiting for on-chain confirmation before bids can be accepted.
        </p>
      )}
    </div>
  );
}
