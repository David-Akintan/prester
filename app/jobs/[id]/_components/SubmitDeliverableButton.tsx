"use client";

import { useState } from "react";
import { submitMilestone } from "@/lib/contracts";
import { parseContractError } from "@/lib/utils";
import type { MilestoneRecord } from "@/lib/api";
import type { JsonRpcSigner } from "ethers";

interface Props {
  jobId: string;
  chainJobId: number | null;
  milestone: MilestoneRecord;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}

export function SubmitDeliverableButton({
  chainJobId,
  milestone,
  signer,
  onRefresh,
}: Props) {
  const [uri, setUri] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (milestone.status === "submitted") {
    return (
      <div className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckIcon />
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
              className="text-fg hover:underline font-medium text-xs"
            >
              View submission ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  if (milestone.status === "disputed") {
    return (
      <div className="rounded-lg border-l-4 border-l-[var(--color-foreground)] border border-default bg-muted px-4 py-3 text-sm text-fg">
        <div className="flex items-center gap-2">
          <GavelIcon />
          <span className="font-medium">
            Dispute raised — AI judges reviewing
          </span>
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="Deliverable URI (IPFS, URL, etc.)"
          className="flex-1 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] px-4 py-2.5 text-sm text-fg placeholder-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none transition-colors"
          disabled={submitting}
        />
        <button
          onClick={handleSubmit}
          disabled={!uri.trim() || submitting}
          className="w-full sm:w-auto rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-6 py-2.5 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit Deliverable"}
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
          <div className="flex items-center gap-2">
            <AlertIcon />
            <span>{err}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function GavelIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
