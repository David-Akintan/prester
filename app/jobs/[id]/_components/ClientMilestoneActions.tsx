"use client";

import { useEffect, useRef, useState } from "react";
import { useChainId } from "wagmi";
import { approveMilestone, raiseDispute } from "@/lib/contracts";
import { parseContractError } from "@/lib/utils";
import {
  ApiError,
  disputesApi,
  ipfsApi,
  judgesApi,
  milestonesApi,
  ndaKeysApi,
  type JobVisibility,
  type MilestoneRecord,
} from "@/lib/api";
import { ChainGuardedAction } from "@/app/components/ui/ChainGuardedAction";
import {
  decodeDeliverablePayload,
  decryptAsRecipient,
  type DecodedDeliverable,
  encodePubKey,
  encryptForRecipients,
  getOrDeriveMyKeypair,
  isEnvelopeRecipient,
} from "@/lib/nda";
import type { JsonRpcSigner } from "ethers";

interface Props {
  jobId: string;
  chainJobId: number | null;
  jobChainId: number | null;
  jobVisibility?: JobVisibility;
  milestone: MilestoneRecord;
  signer: JsonRpcSigner | null;
  onRefresh: () => Promise<void>;
}

export function ClientMilestoneActions({
  jobId,
  chainJobId,
  jobChainId,
  jobVisibility,
  milestone,
  signer,
  onRefresh,
}: Props) {
  const walletChainId = useChainId();
  const isNda = jobVisibility === "nda";
  const [loading, setLoading] = useState<"approve" | "dispute" | "open" | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [disputePrepMsg, setDisputePrepMsg] = useState<string | null>(null);
  const [waitingForShare, setWaitingForShare] = useState(false);
  const [revealed, setRevealed] = useState<
    | ({ kind: "text"; text: string; legacy: boolean; href: string | null })
    | ({
        kind: "file";
        name: string;
        mimeType: string;
        legacy: boolean;
        href: string;
      })
    | null
  >(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealedHrefRef = useRef<string | null>(null);

  // Friendly in-flight banner shown when the client clicks "Open" or
  // "Raise dispute" but the envelope on IPFS doesn't include them yet
  // (the freelancer submitted before the client registered their key).
  // Backend has been pinged via ndaKeysApi.register; freelancer was
  // notified; we poll onRefresh until the milestone's deliverable_uri
  // updates with a re-keyed envelope that includes us.
  const waitingShareMsg =
    "We just enabled your confidential access and asked the freelancer to share this with you. You'll see it here automatically once they reopen the job.";

  function clearPoll() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function clearRevealedFileHref() {
    if (revealedHrefRef.current) {
      URL.revokeObjectURL(revealedHrefRef.current);
      revealedHrefRef.current = null;
    }
  }

  function startPollForReshare() {
    clearPoll();
    setWaitingForShare(true);
    let attempts = 0;
    pollTimerRef.current = setInterval(() => {
      attempts += 1;
      void onRefresh();
      if (attempts >= 5) {
        clearPoll();
      }
    }, 8_000);
  }

  useEffect(() => {
    return () => {
      clearPoll();
      clearRevealedFileHref();
    };
  }, []);

  // Once a refresh brings in an envelope that *does* include us, drop the
  // waiting banner so the next click on "Open confidential file" succeeds.
  useEffect(() => {
    if (!waitingForShare) return;
    setWaitingForShare(false);
    clearPoll();
  }, [milestone.deliverable_uri]);

  useEffect(() => {
    clearRevealedFileHref();
    setRevealed(null);
  }, [milestone.deliverable_uri]);

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

  // ── Helpers ─────────────────────────────────────────────────

  async function fetchEnvelope(uri: string): Promise<unknown> {
    const httpUrl = uri.startsWith("ipfs://")
      ? uri.replace("ipfs://", "https://ipfs.io/ipfs/")
      : uri;
    const resp = await fetch(httpUrl);
    if (!resp.ok) {
      throw new Error(`Couldn't fetch the confidential file (HTTP ${resp.status}).`);
    }
    return resp.json();
  }

  function revealDeliverable(deliverable: DecodedDeliverable) {
    clearRevealedFileHref();
    if (deliverable.kind === "text") {
      setRevealed({
        kind: "text",
        text: deliverable.text,
        legacy: deliverable.legacy,
        href: toSubmissionHref(deliverable.text),
      });
      return;
    }

    const href = URL.createObjectURL(
      new Blob([Uint8Array.from(deliverable.bytes)], {
        type: deliverable.mimeType,
      }),
    );
    revealedHrefRef.current = href;
    setRevealed({
      kind: "file",
      name: deliverable.name,
      mimeType: deliverable.mimeType,
      legacy: deliverable.legacy,
      href,
    });
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function openConfidentialFile() {
    if (!signer || jobChainId == null || !milestone.deliverable_uri) return;
    setLoading("open");
    setErr(null);
    try {
      const kp = await getOrDeriveMyKeypair(signer, jobId, jobChainId);
      const myAddress = await signer.getAddress();
      // Register — no-op if already on file. The act of registering also
      // pings the backend to notify the freelancer of any pending shares.
      try {
        await ndaKeysApi.register(jobId, encodePubKey(kp));
      } catch {
        /* ignore */
      }
      const envelope = (await fetchEnvelope(
        milestone.deliverable_uri,
      )) as Parameters<typeof decryptAsRecipient>[0];
      if (!isEnvelopeRecipient(envelope, myAddress)) {
        // Envelope was uploaded before we registered. Don't dead-end — the
        // backend has notified the freelancer; show the in-flight banner
        // and start polling for the re-keyed envelope.
        startPollForReshare();
        return;
      }
      const plaintext = await decryptAsRecipient(envelope, myAddress, kp);
      revealDeliverable(
        decodeDeliverablePayload(new Uint8Array(plaintext)),
      );
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Couldn't open this confidential file.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleApprove() {
    if (!signer || !chainJobId) return;
    setLoading("approve");
    setErr(null);
    try {
      const receipt = await approveMilestone(
        signer,
        BigInt(chainJobId),
        milestone.milestone_index,
      );
      try {
        await milestonesApi.confirmApprove(jobId, milestone.milestone_index, {
          chain_id: walletChainId,
          tx_hash: receipt.hash,
        });
      } catch (confirmErr) {
        console.warn(
          "[ClientMilestoneActions] confirm-approve failed, listener will backstop:",
          confirmErr,
        );
      }
      await onRefresh();
    } catch (e) {
      setErr(parseContractError(e));
    } finally {
      setLoading(null);
    }
  }

  async function handleDispute() {
    if (!signer || chainJobId == null) return;
    setLoading("dispute");
    setErr(null);
    setDisputePrepMsg(null);
    try {
      // For NDA jobs, prepare a review copy BEFORE the on-chain tx so the
      // judge pipeline has something to read. For public jobs, skip
      // straight to the on-chain raise.
      if (isNda && milestone.deliverable_uri && jobChainId != null) {
        setDisputePrepMsg("Preparing dispute review…");
        try {
          const kp = await getOrDeriveMyKeypair(signer, jobId, jobChainId);
          const myAddress = await signer.getAddress();
          try {
            await ndaKeysApi.register(jobId, encodePubKey(kp));
          } catch {
            /* ignore */
          }
          const envelope = (await fetchEnvelope(
            milestone.deliverable_uri,
          )) as Parameters<typeof decryptAsRecipient>[0];
          if (!isEnvelopeRecipient(envelope, myAddress)) {
            // Same in-flight pattern as openConfidentialFile — the
            // freelancer has been pinged; surface the banner and abort
            // the dispute attempt without an alarming error.
            setDisputePrepMsg(null);
            startPollForReshare();
            return;
          }
          const plaintext = await decryptAsRecipient(envelope, myAddress, kp);

          const [{ keys: partyKeys }, { keys: judgeKeys }] = await Promise.all([
            ndaKeysApi.list(jobId),
            judgesApi.pubkeys(),
          ]);
          const allRecipients = [...partyKeys, ...judgeKeys];
          const reEnc = await encryptForRecipients(
            new Uint8Array(plaintext),
            kp,
            allRecipients,
          );
          const { uri: disputeUri } = await ipfsApi.upload(
            reEnc as unknown as Record<string, unknown>,
            "deliverable",
          );
          await milestonesApi.setDisputeDeliverable(
            jobId,
            milestone.milestone_index,
            disputeUri,
          );
        } catch (prepErr) {
          console.warn(
            "[ClientMilestoneActions] dispute review prep failed:",
            prepErr,
          );
          if (prepErr instanceof ApiError && prepErr.status === 429) {
            throw new Error(
              "Server is rate-limiting requests. Please wait a moment and try again.",
            );
          }
          throw new Error(
            "Couldn't prepare the dispute review copy. Try again in a moment.",
          );
        }
      }

      const receipt = await raiseDispute(
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
      await onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : parseContractError(e));
    } finally {
      setLoading(null);
      setDisputePrepMsg(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border-l-4 border-l-[var(--color-foreground)] border border-default bg-muted px-4 py-3 text-sm text-fg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <DocIcon />
            <span className="font-medium">
              {isNda
                ? "Freelancer submitted confidential work"
                : "Freelancer submitted a deliverable"}
            </span>
          </div>
          {milestone.deliverable_uri && !isNda && (
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
          {milestone.deliverable_uri && isNda && (
            <button
              type="button"
              onClick={openConfidentialFile}
              disabled={loading === "open"}
              className="text-fg hover:underline font-medium text-xs disabled:opacity-50"
            >
              {loading === "open"
                ? "Opening…"
                : "🔒 Open confidential file"}
            </button>
          )}
        </div>
      </div>

      {isNda && (
        <p className="text-xs text-muted">
          Our reviewers are given one-time read access only if you raise a
          dispute.
        </p>
      )}

      {disputePrepMsg && (
        <p className="text-xs text-muted">{disputePrepMsg}</p>
      )}
      {waitingForShare && (
        <div className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
          {waitingShareMsg}
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {revealed && (
        <div className="rounded-lg border border-default bg-muted/40 px-4 py-3 text-sm text-fg space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">
              {revealed.kind === "text"
                ? "Confidential submission"
                : "Confidential file ready"}
            </span>
            {revealed.kind === "file" && (
              <a
                href={revealed.href}
                download={revealed.name}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg hover:underline font-medium text-xs"
              >
                Download file ↗
              </a>
            )}
          </div>
          {revealed.kind === "text" ? (
            revealed.href ? (
              <a
                href={revealed.href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-fg hover:underline"
              >
                {revealed.text.trim()}
              </a>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-fg">
                {revealed.text}
              </pre>
            )
          ) : (
            <p className="break-all text-xs text-muted">
              {revealed.name}
              {revealed.mimeType !== "application/octet-stream"
                ? ` • ${revealed.mimeType}`
                : ""}
            </p>
          )}
          {revealed.legacy && (
            <p className="text-xs text-muted">
              Opened from an older confidential submission format.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <ChainGuardedAction
          jobChainId={jobChainId}
          label="Approve & Release"
          containerClassName="flex-1"
        >
          <button
            onClick={handleApprove}
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
            onClick={handleDispute}
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

function toSubmissionHref(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function DocIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
