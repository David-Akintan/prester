"use client";

import { useEffect, useState } from "react";
import { useChainId } from "wagmi";
import { submitMilestone } from "@/lib/contracts";
import { parseContractError } from "@/lib/utils";
import {
  ipfsApi,
  milestonesApi,
  ndaKeysApi,
  type JobVisibility,
  type MilestoneRecord,
} from "@/lib/api";
import { ChainGuardedAction } from "@/app/components/ui/ChainGuardedAction";
import {
  decryptAsRecipient,
  encodeDeliverableManifest,
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

type SubmitStage =
  | "idle"
  | "enabling"
  | "encrypting"
  | "uploading"
  | "confirming_chain"
  | "confirming_server";

const STAGE_LABEL: Record<SubmitStage, string> = {
  idle: "",
  enabling: "Getting ready…",
  encrypting: "Encrypting your file…",
  uploading: "Uploading to IPFS…",
  confirming_chain: "Confirming on-chain…",
  confirming_server: "Finishing up…",
};

export function SubmitDeliverableButton({
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

  const [uri, setUri] = useState("");
  const [textBody, setTextBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<SubmitStage>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [warnBanner, setWarnBanner] = useState<string | null>(null);

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

  useEffect(() => {
    if (
      !isNda ||
      !signer ||
      jobChainId == null ||
      milestone.status !== "submitted"
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { pending } = await ndaKeysApi.listPending(jobId);
        const pendingRow = pending.find(
          (row) => row.milestone_index === milestone.milestone_index,
        );
        if (!pendingRow) return;

        const kp = await getOrDeriveMyKeypair(signer, jobId, jobChainId);
        const myAddress = await signer.getAddress();
        try {
          await ndaKeysApi.register(jobId, encodePubKey(kp));
        } catch {
          /* ignore */
        }

        const { keys } = await ndaKeysApi.list(jobId);
        if (keys.length < 2) return;

        const envelope = (await fetchEnvelope(
          pendingRow.envelope_uri,
        )) as Parameters<typeof decryptAsRecipient>[0];
        if (!isEnvelopeRecipient(envelope, myAddress)) {
          return;
        }

        const plaintext = await decryptAsRecipient(envelope, myAddress, kp);
        const reEncrypted = await encryptForRecipients(
          new Uint8Array(plaintext),
          kp,
          keys,
        );
        const { uri: deliverableUri } = await ipfsApi.upload(
          reEncrypted as unknown as Record<string, unknown>,
          "deliverable",
        );

        await milestonesApi.confirmSubmit(jobId, milestone.milestone_index, {
          chain_id: walletChainId,
          deliverable_uri: deliverableUri,
        });
        await ndaKeysApi.clearPending(jobId, milestone.milestone_index);

        if (!cancelled) {
          setWarnBanner(null);
          await onRefresh();
        }
      } catch (rekeyErr) {
        console.warn(
          "[SubmitDeliverableButton] pending NDA re-key failed:",
          rekeyErr,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isNda,
    signer,
    jobChainId,
    jobId,
    milestone.milestone_index,
    milestone.status,
    onRefresh,
    walletChainId,
  ]);

  // ── Public (non-NDA) submitted view ─────────────────────────
  if (milestone.status === "submitted") {
    return (
      <div className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckIcon />
            <span className="font-medium">
              {isNda
                ? "Work submitted — awaiting client review"
                : "Deliverable submitted — awaiting client review"}
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
              View submission ↗
            </a>
          )}
          {isNda && (
            <span className="text-xs text-muted font-medium">
              🔒 Shared with the client
            </span>
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

  // ── Public submit ───────────────────────────────────────────
  async function handleSubmitPublic() {
    if (!signer || !chainJobId || !uri.trim()) return;
    setStage("confirming_chain");
    setErr(null);
    try {
      const receipt = await submitMilestone(
        signer,
        BigInt(chainJobId),
        milestone.milestone_index,
        uri.trim(),
      );
      setStage("confirming_server");
      try {
        await milestonesApi.confirmSubmit(jobId, milestone.milestone_index, {
          chain_id: walletChainId,
          deliverable_uri: uri.trim(),
          tx_hash: receipt.hash,
        });
      } catch (confirmErr) {
        console.warn(
          "[SubmitDeliverableButton] confirm-submit failed, listener will backstop:",
          confirmErr,
        );
      }
      await onRefresh();
    } catch (e) {
      setErr(parseContractError(e));
    } finally {
      setStage("idle");
    }
  }

  // ── NDA submit ──────────────────────────────────────────────
  async function handleSubmitNda() {
    if (!signer || !chainJobId || !jobChainId) return;
    if (!file && !textBody.trim()) {
      setErr("Add a file or type a message first.");
      return;
    }

    let plaintext: Uint8Array;
    try {
      plaintext = await encodeDeliverableManifest(file, textBody);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read your file.");
      return;
    }
    setErr(null);
    setWarnBanner(null);
    setStage("enabling");
    try {
      // 1. Derive + register my keypair (silent if cached).
      const myKp = await getOrDeriveMyKeypair(signer, jobId, jobChainId);
      try {
        await ndaKeysApi.register(jobId, encodePubKey(myKp));
      } catch {
        // Non-fatal — another tab may have already registered the same key.
      }

      // 2. Fetch both parties' pubkeys.
      const { keys } = await ndaKeysApi.list(jobId);
      const myAddress = (await signer.getAddress()).toLowerCase();
      const recipients = keys.filter(
        (k) => k.address.toLowerCase() !== myAddress,
      );
      const selfKey = keys.find(
        (k) => k.address.toLowerCase() === myAddress,
      );

      // 3. Encrypt. Always include self so we can decrypt later from any
      //    device; include the other party if they've registered.
      setStage("encrypting");
      const allRecipients = selfKey ? [selfKey, ...recipients] : recipients;
      if (allRecipients.length === 0) {
        throw new Error(
          "Confidential setup hasn't finished. Refresh the page and try again.",
        );
      }
      const envelope = await encryptForRecipients(
        plaintext,
        myKp,
        allRecipients,
      );

      // 4. Upload envelope.
      setStage("uploading");
      const uploadContent = envelope as unknown as Record<string, unknown>;
      const { uri: envelopeUri } = await ipfsApi.upload(
        uploadContent,
        "deliverable",
      );

      const clientRegistered = recipients.length > 0;

      // 5. Submit URI on-chain.
      setStage("confirming_chain");
      const receipt = await submitMilestone(
        signer,
        BigInt(chainJobId),
        milestone.milestone_index,
        envelopeUri,
      );

      // 6. Server confirmation.
      setStage("confirming_server");
      try {
        await milestonesApi.confirmSubmit(jobId, milestone.milestone_index, {
          chain_id: walletChainId,
          deliverable_uri: envelopeUri,
          tx_hash: receipt.hash,
        });
      } catch (confirmErr) {
        console.warn(
          "[SubmitDeliverableButton] confirm-submit failed, listener will backstop:",
          confirmErr,
        );
      }

      if (!clientRegistered) {
        // Mark as pending so the backend notifies us to re-key once the
        // client registers. The envelope we just uploaded is visible only
        // to the freelancer — client will re-fetch after rekey.
        try {
          await ndaKeysApi.recordPending(jobId, {
            milestone_index: milestone.milestone_index,
            envelope_uri: envelopeUri,
          });
        } catch {
          /* non-fatal */
        }
        setWarnBanner(
          "The client hasn't opened this job yet. Your work is saved and will be shared automatically the moment they do — we'll notify you.",
        );
      }

      // Reset composer.
      setFile(null);
      setTextBody("");
      await onRefresh();
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : parseContractError(e) ?? "Something went wrong.",
      );
    } finally {
      setStage("idle");
    }
  }

  const busy = stage !== "idle";

  // ── NDA composer UI ─────────────────────────────────────────
  if (isNda) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-default bg-muted/40 p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Your work (choose one)
          </label>
          <input
            type="file"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-foreground)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--color-background)] file:cursor-pointer disabled:opacity-50"
          />
          <div className="text-xs text-muted">— or —</div>
          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Paste a link or type a message…"
            rows={4}
            disabled={busy}
            className="w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] px-4 py-2.5 text-sm text-fg placeholder-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none transition-colors disabled:opacity-50"
          />
          <p className="text-xs text-muted">
            🔒 What you submit here will be readable only by you and the
            client.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start">
          <div className="w-full sm:w-auto">
            <ChainGuardedAction
              jobChainId={jobChainId}
              label="Submit Work"
            >
              <button
                onClick={handleSubmitNda}
                disabled={busy || (!file && !textBody.trim())}
                className="w-full sm:w-auto rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-6 py-2.5 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? STAGE_LABEL[stage] : "Submit Work"}
              </button>
            </ChainGuardedAction>
          </div>
          {busy && (
            <div className="text-xs text-muted self-center">
              {STAGE_LABEL[stage]}
            </div>
          )}
        </div>

        {warnBanner && (
          <div className="rounded-lg border border-default bg-muted px-4 py-3 text-sm text-fg">
            {warnBanner}
          </div>
        )}
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

  // ── Public composer UI (unchanged behavior) ─────────────────
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="Deliverable URI (IPFS, URL, etc.)"
          className="flex-1 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input)] px-4 py-2.5 text-sm text-fg placeholder-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none transition-colors"
          disabled={busy}
        />
        <div className="w-full sm:w-auto">
          <ChainGuardedAction
            jobChainId={jobChainId}
            label="Submit Deliverable"
          >
            <button
              onClick={handleSubmitPublic}
              disabled={!uri.trim() || busy}
              className="w-full sm:w-auto rounded-lg border border-[var(--color-foreground)] bg-[var(--color-foreground)] px-6 py-2.5 text-sm font-semibold text-[var(--color-background)] transition-all hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? STAGE_LABEL[stage] : "Submit Deliverable"}
            </button>
          </ChainGuardedAction>
        </div>
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

// ─── Helpers ───────────────────────────────────────────────────

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
