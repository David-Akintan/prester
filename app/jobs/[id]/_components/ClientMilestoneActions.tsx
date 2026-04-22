"use client";

import { useState } from "react";
import { useChainId } from "wagmi";
import { approveMilestone, raiseDispute } from "@/lib/contracts";
import { parseContractError } from "@/lib/utils";
import {
  milestonesApi,
  disputesApi,
  type MilestoneRecord,
} from "@/lib/api";
import { ChainGuardedAction } from "@/app/components/ui/ChainGuardedAction";
import type { JsonRpcSigner } from "ethers";

interface Props {
  jobId: string;
  chainJobId: number | null;
  jobChainId: number | null;
  milestone: MilestoneRecord;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}

export function ClientMilestoneActions({
  jobId,
  chainJobId,
  jobChainId,
  milestone,
  signer,
  onRefresh,
}: Props) {
  const walletChainId = useChainId();
  const [loading, setLoading] = useState<"approve" | "dispute" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (milestone.status === "pending") {
    return (
      <div className="border border-default px-4 py-3 text-xs text-muted uppercase tracking-widest rounded-lg">
        Awaiting freelancer submission
      </div>
    );
  }

  if (milestone.status === "disputed") {
    return (
      <div className="border-l-4 border-l-[var(--color-foreground)] border border-default px-4 py-3 text-xs text-muted uppercase tracking-widest rounded-lg">
        ⚖ Dispute raised — AI judges reviewing
      </div>
    );
  }

  if (milestone.status === "approved" || milestone.status === "resolved") {
    return null;
  }

  async function handle(action: "approve" | "dispute") {
    if (!signer || !chainJobId) return;
    setLoading(action);
    setErr(null);
    try {
      let receipt;
      if (action === "approve") {
        receipt = await approveMilestone(
          signer,
          BigInt(chainJobId),
          milestone.milestone_index,
        );
        try {
          await milestonesApi.confirmApprove(
            jobId,
            milestone.milestone_index,
            { chain_id: walletChainId, tx_hash: receipt.hash },
          );
        } catch (confirmErr) {
          console.warn(
            "[ClientMilestoneActions] confirm-approve failed, listener will backstop:",
            confirmErr,
          );
        }
      } else {
        receipt = await raiseDispute(
          signer,
          BigInt(chainJobId),
          milestone.milestone_index,
        );
        try {
          await disputesApi.confirmRaise(jobId, milestone.milestone_index, {
            chain_id: walletChainId,
            tx_hash: receipt.hash,
          });
        } catch (confirmErr) {
          console.warn(
            "[ClientMilestoneActions] confirm-dispute failed, listener will backstop:",
            confirmErr,
          );
        }
      }
      await onRefresh();
    } catch (e) {
      setErr(parseContractError(e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border-l-4 border-l-[var(--color-foreground)] border border-default bg-muted px-4 py-3 text-sm text-fg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <DocIcon />
            <span className="font-medium">
              Freelancer submitted a deliverable
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
              View deliverable ↗
            </a>
          )}
        </div>
      </div>
      {err && <p className="text-xs text-muted">{err}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <ChainGuardedAction
          jobChainId={jobChainId}
          label="Approve & Release"
          containerClassName="flex-1"
        >
          <button
            onClick={() => handle("approve")}
            disabled={!!loading}
            className="w-full border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-[var(--color-background)] rounded-lg transition hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-40"
          >
            {loading === "approve" ? "Approving…" : "Approve & Release"}
          </button>
        </ChainGuardedAction>
        <ChainGuardedAction
          jobChainId={jobChainId}
          label="Raise Dispute"
          containerClassName="flex-1"
        >
          <button
            onClick={() => handle("dispute")}
            disabled={!!loading}
            className="w-full border border-[var(--color-foreground)] px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-fg rounded-lg transition hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] disabled:opacity-40"
          >
            {loading === "dispute" ? "Raising…" : "Raise Dispute"}
          </button>
        </ChainGuardedAction>
      </div>
    </div>
  );
}

function DocIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
