"use client";

import { useState } from "react";
import { bidsApi, ApiError, type BidRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BidModalProps {
  jobId: string;
  existingBid?: BidRecord | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function BidModal({
  jobId,
  existingBid,
  onSuccess,
  onClose,
}: BidModalProps) {
  const isEditing = !!existingBid;
  const [coverLetter, setCoverLetter] = useState(
    existingBid?.cover_letter || "",
  );
  const [timeline, setTimeline] = useState(
    existingBid?.proposed_timeline || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (coverLetter.trim().length < 20) {
      setError("Cover letter must be at least 20 characters.");
      return;
    }

    if (isEditing && !warningAcknowledged) {
      setError("Please acknowledge the warning before submitting your edit.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isEditing && existingBid) {
        await bidsApi.update(jobId, existingBid.id, {
          cover_letter: coverLetter.trim(),
          proposed_timeline: timeline.trim() || undefined,
        });
      } else {
        await bidsApi.create(jobId, {
          cover_letter: coverLetter.trim(),
          proposed_timeline: timeline.trim() || undefined,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit bid.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditing ? "Edit Your Bid" : "Submit a Bid"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Edit warning — shown only when editing */}
        {isEditing && (
          <div className="border-b border-black bg-neutral-50 px-6 py-4">
            <p className="text-xs font-medium text-black mb-3">
              ⚠️ <strong>One-time edit.</strong> You can only update your bid
              once. After submitting this edit, your bid will be locked and
              cannot be changed again. Make sure everything is correct before
              proceeding.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={warningAcknowledged}
                onChange={(e) => setWarningAcknowledged(e.target.checked)}
                className="h-4 w-4 border-black"
              />
              <span className="text-xs font-medium text-black uppercase tracking-wide">
                I understand this is my one and only edit
              </span>
            </label>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Cover Letter <span className="text-red-500">*</span>
            </label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={5}
              placeholder="Explain why you're a great fit, your relevant experience, and how you'll approach this project…"
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-initia-500",
                error && coverLetter.length < 20
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300",
              )}
            />
            <p className="mt-1 text-xs text-gray-400">
              {coverLetter.length} / 2000
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Proposed Timeline{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              placeholder="e.g. 10 days"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-initia-500"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (isEditing && !warningAcknowledged)}
              className="border border-black bg-black px-5 py-2 text-xs font-medium uppercase tracking-wide text-white transition hover:bg-white hover:text-black disabled:opacity-50"
            >
              {submitting
                ? "Submitting…"
                : isEditing
                  ? "Update Bid"
                  : "Submit Bid"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
