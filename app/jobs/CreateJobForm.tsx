"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/app/components/wallet/WalletContext";
import { createJob } from "@/lib/contracts";
import { jobsApi, ipfsApi } from "@/lib/api";
import {
  ethToWei,
  isValidEthAmount,
  parseContractError,
  cn,
} from "@/lib/utils";
import type { CreateJobFormData, MilestoneFormItem, TxState } from "@/index";
import { isContractDeployed } from "@/lib/config";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const EMPTY_MILESTONE: MilestoneFormItem = {
  description: "",
  amountEth: "",
};

const JOB_CATEGORIES = [
  "Design",
  "Development",
  "Writing",
  "Marketing",
  "Data",
  "Video",
  "Audio",
  "Other",
];

// ─────────────────────────────────────────────────────────────
// Shared input class helpers
// ─────────────────────────────────────────────────────────────

const inputBase =
  "w-full border px-4 py-3 text-sm bg-white text-black placeholder-neutral-400 focus:outline-none focus:ring-0 transition-colors";

const inputNormal = "border-neutral-300 focus:border-black";
const inputError = "border-black bg-neutral-50";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CreateJobForm() {
  const router = useRouter();
  const { signer, isConnected, isAuthenticated } = useWallet();
  const [form, setForm] = useState<CreateJobFormData>({
    title: "",
    description: "",
    category: "Development",
    tags: "",
    requiredSkills: "",
    estimatedDuration: "",
    milestones: [{ ...EMPTY_MILESTONE }],
  });

  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // ── Computed total ────────────────────────────────────────
  const totalEth = form.milestones
    .map((m) => parseFloat(m.amountEth) || 0)
    .reduce((a, b) => a + b, 0);

  // ── Validation ────────────────────────────────────────────
  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (form.title.length > 100)
      errs.title = "Title must be under 100 characters.";
    if (!form.description.trim()) errs.description = "Description is required.";
    if (!form.estimatedDuration.trim())
      errs.estimatedDuration = "Estimated duration is required.";
    form.milestones.forEach((m, i) => {
      if (!m.description.trim())
        errs[`milestone_desc_${i}`] = "Description required.";
      if (!isValidEthAmount(m.amountEth))
        errs[`milestone_amount_${i}`] = "Enter a valid amount > 0.";
    });
    if (Object.keys(errs).length === 0 && totalEth <= 0) {
      errs.total = "Total payment must be greater than zero.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Milestone helpers ─────────────────────────────────────
  function addMilestone() {
    setForm((f) => ({
      ...f,
      milestones: [...f.milestones, { ...EMPTY_MILESTONE }],
    }));
  }

  function removeMilestone(index: number) {
    if (form.milestones.length === 1) return;
    setForm((f) => ({
      ...f,
      milestones: f.milestones.filter((_, i) => i !== index),
    }));
  }

  function updateMilestone(
    index: number,
    field: keyof MilestoneFormItem,
    value: string,
  ) {
    setForm((f) => {
      const milestones = [...f.milestones];
      milestones[index] = { ...milestones[index], [field]: value };
      return { ...f, milestones };
    });
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!signer || !isAuthenticated) {
      setTxState({
        status: "error",
        message: "Please connect and sign in with your wallet first.",
      });
      return;
    }

    try {
      const milestoneAmountsWei = form.milestones.map((m) =>
        ethToWei(m.amountEth),
      );
      const totalAmountWei = milestoneAmountsWei.reduce((a, b) => a + b, 0n);

      // 1. Upload metadata to IPFS (via backend — keeps Pinata key server-side)

      setTxState({
        status: "pending",
        message: "Uploading job details to IPFS…",
      });

      const metadata = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        requiredSkills: form.requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        estimatedDuration: form.estimatedDuration.trim(),
        createdAt: new Date().toISOString(),
      };

      const { uri: metadataUri } = await ipfsApi.upload(metadata, "metadata");

      // 2. Create off-chain job record in the backend (status: 'draft')
      setTxState({ status: "pending", message: "Saving job record…" });

      const offchainJob = await jobsApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        required_skills: form.requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        estimated_duration: form.estimatedDuration.trim(),
        metadata_uri: metadataUri,
        total_amount_wei: totalAmountWei.toString(),
        milestones: form.milestones.map((m, _i) => ({
          description: m.description.trim(),
          amount_wei: ethToWei(m.amountEth).toString(),
        })),
      });

      // 3. Send on-chain createJob transaction

      if (isContractDeployed()) {
        setTxState({
          status: "pending",
          message: "Confirm the transaction in your wallet…",
        });

        const { receipt, jobId } = await createJob(signer, {
          metadataUri,
          milestoneDescriptions: form.milestones.map((m) =>
            m.description.trim(),
          ),
          milestoneAmountsWei,
          totalAmountWei,
        });

        setTxState({
          status: "pending",
          message: "Confirming on-chain transaction…",
        });
        await jobsApi.confirm(offchainJob.id, Number(jobId), metadataUri);

        setTxState({
          status: "success",
          txHash: receipt.hash,
          message: "Job posted and payment locked in escrow!",
        });
      } else {
        // Contract not deployed yet — job saved as draft in the DB.
        // After deployment, add NEXT_PUBLIC_ESCROW_ADDRESS to .env.local
        // and re-post to lock payment on-chain.
        setTxState({
          status: "success",
          txHash: "",
          message:
            "Job saved as draft. Deploy the contract to lock payment on-chain.",
        });
      }

      // Redirect to job detail page
      setTimeout(() => router.push(`/jobs/${offchainJob.id}`), 1500);
    } catch (err) {
      setTxState({ status: "error", message: parseContractError(err) });
    }
  }

  const isPending = txState.status === "pending";

  // ── Render ────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Job Details ── */}
      <section className="border border-black p-8">
        {/* Section header */}
        <div className="mb-8 pb-4 border-b border-neutral-200">
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
              01
            </span>
            <h2 className="text-lg font-bold tracking-tight text-black uppercase">
              Job Details
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-500 ml-8">
            Provide comprehensive information about your project to attract the
            right talent.
          </p>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
              Job Title <span className="text-neutral-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Build a React dashboard with dark mode"
              maxLength={100}
              className={cn(inputBase, errors.title ? inputError : inputNormal)}
            />
            {errors.title && (
              <p className="mt-1.5 text-xs text-black">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
              Description <span className="text-neutral-400">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Describe the project in detail — requirements, expected output, technical constraints…"
              rows={5}
              className={cn(
                inputBase,
                "resize-none",
                errors.description ? inputError : inputNormal,
              )}
            />
            {errors.description && (
              <p className="mt-1.5 text-xs text-black">{errors.description}</p>
            )}
          </div>

          {/* Category + Duration */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className={cn(inputBase, inputNormal, "cursor-pointer")}
              >
                {JOB_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
                Estimated Duration <span className="text-neutral-400">*</span>
              </label>
              <input
                type="text"
                value={form.estimatedDuration}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estimatedDuration: e.target.value }))
                }
                placeholder="e.g. 2 weeks"
                className={cn(
                  inputBase,
                  errors.estimatedDuration ? inputError : inputNormal,
                )}
              />
              {errors.estimatedDuration && (
                <p className="mt-1.5 text-xs text-black">
                  {errors.estimatedDuration}
                </p>
              )}
            </div>
          </div>

          {/* Skills + Tags */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
                Required Skills{" "}
                <span className="text-neutral-400 normal-case font-normal tracking-normal">
                  (comma-separated)
                </span>
              </label>
              <input
                type="text"
                value={form.requiredSkills}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiredSkills: e.target.value }))
                }
                placeholder="React, TypeScript, Solidity"
                className={cn(inputBase, inputNormal)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
                Tags{" "}
                <span className="text-neutral-400 normal-case font-normal tracking-normal">
                  (comma-separated)
                </span>
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="DeFi, UI, Frontend"
                className={cn(inputBase, inputNormal)}
              />
            </div>
          </div>
        </div>
      </section>
      {/* ── Milestones ── */}
      <section className="border border-black p-8">
        {/* Section header */}
        <div className="mb-8 pb-4 border-b border-neutral-200 flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                02
              </span>
              <h2 className="text-lg font-bold tracking-tight text-black uppercase">
                Project Milestones
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500 ml-8">
              Break your project into clear deliverables with payment
              milestones.
            </p>
          </div>
          <button
            type="button"
            onClick={addMilestone}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-neutral-400 text-xs font-semibold text-neutral-600 uppercase tracking-widest hover:border-black hover:text-black transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v12m6-6H6"
              />
            </svg>
            Add
          </button>
        </div>

        <div className="space-y-4">
          {form.milestones.map((m, i) => (
            <div
              key={i}
              className="border border-neutral-200 p-6 hover:border-black transition-colors"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                  Milestone {String(i + 1).padStart(2, "0")}
                </span>
                {form.milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    className="text-xs text-neutral-400 hover:text-black uppercase tracking-widest transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
                    Deliverable <span className="text-neutral-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={m.description}
                    onChange={(e) =>
                      updateMilestone(i, "description", e.target.value)
                    }
                    placeholder="e.g. Approved Figma designs for all screens"
                    className={cn(
                      inputBase,
                      errors[`milestone_desc_${i}`] ? inputError : inputNormal,
                    )}
                  />
                  {errors[`milestone_desc_${i}`] && (
                    <p className="mt-1.5 text-xs text-black">
                      {errors[`milestone_desc_${i}`]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-black uppercase tracking-widest">
                    Amount (ETH) <span className="text-neutral-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-neutral-400 text-xs font-mono">
                        ETH
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={m.amountEth}
                      onChange={(e) =>
                        updateMilestone(i, "amountEth", e.target.value)
                      }
                      placeholder="0.5"
                      className={cn(
                        inputBase,
                        "pl-14",
                        errors[`milestone_amount_${i}`]
                          ? inputError
                          : inputNormal,
                      )}
                    />
                  </div>
                  {errors[`milestone_amount_${i}`] && (
                    <p className="mt-1.5 text-xs text-black">
                      {errors[`milestone_amount_${i}`]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-6 border border-black px-6 py-4 bg-black">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-white uppercase tracking-widest">
                Total Escrow
              </span>
              <p className="text-xs text-neutral-400 mt-0.5">
                Locked until milestones are completed
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white font-mono">
                {totalEth.toFixed(4)}{" "}
                <span className="text-sm text-neutral-400">ETH</span>
              </div>
            </div>
          </div>
        </div>
        {errors.total && (
          <p className="mt-2 text-xs text-black">{errors.total}</p>
        )}
      </section>
      {/* ── Transaction Feedback ── */}
      {txState.status !== "idle" && (
        <div
          className={cn(
            "border px-5 py-4 text-sm",
            txState.status === "pending" &&
              "border-neutral-300 bg-neutral-50 text-black",
            txState.status === "success" && "border-black bg-black text-white",
            txState.status === "error" && "border-black bg-white text-black",
          )}
        >
          <div className="flex items-center gap-3">
            {txState.status === "pending" && (
              <svg
                className="h-4 w-4 animate-spin shrink-0"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {txState.status === "success" && (
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {txState.status === "error" && (
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            <span className="text-xs uppercase tracking-widest font-semibold">
              {txState.message}
            </span>
          </div>
          {txState.status === "success" && txState.txHash && (
            <p className="mt-2 font-mono text-xs text-neutral-400 pl-7">
              {txState.txHash}
            </p>
          )}
        </div>
      )}
      {/* ── Submit ── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-neutral-400 max-w-xs">
          Funds will be locked in the escrow contract until milestones are
          approved.
        </p>
        <button
          type="submit"
          disabled={isPending || !isConnected || !isAuthenticated}
          className={cn(
            "px-8 py-3 text-xs font-semibold uppercase tracking-widest transition-colors",
            "bg-black text-white border border-black",
            "hover:bg-white hover:text-black",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white",
          )}
        >
          {isPending ? "Processing…" : `Post Job — ${totalEth.toFixed(4)} ETH`}
        </button>
      </div>
      {(!isConnected || !isAuthenticated) && (
        <p className="text-center text-xs text-neutral-400 uppercase tracking-widest">
          {!isConnected
            ? "Connect your wallet to post a job."
            : "Sign in with your wallet to post a job."}
        </p>
      )}
    </form>
  );
}
