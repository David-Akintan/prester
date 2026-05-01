"use client";

import { useRef, useState } from "react";
import { ipfsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  readOnly: boolean;
  readOnlyReason: string;
  onSend: (payload: {
    text?: string;
    attachment_uri?: string;
    attachment_name?: string;
    attachment_mime?: string;
  }) => Promise<void>;
}

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
];

export default function Composer({ readOnly, readOnlyReason, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    uri: string;
    name: string;
    mime: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (readOnly) {
    return (
      <div className="border-t border-[var(--color-border-subtle)] bg-muted px-4 py-3 text-center text-xs text-muted">
        🔒 {readOnlyReason}
      </div>
    );
  }

  async function handleSubmit() {
    const body = text.trim();
    if (!body && !pending) return;
    setSending(true);
    setError(null);
    try {
      await onSend({
        text: body || undefined,
        attachment_uri: pending?.uri,
        attachment_name: pending?.name,
        attachment_mime: pending?.mime,
      });
      setText("");
      setPending(null);
      // reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  function autoSize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(`Unsupported file type: ${file.type || "unknown"}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File is larger than 10MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await ipfsApi.uploadFile(file);
      setPending({ uri: result.uri, name: result.name, mime: result.mime });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const canSend = !sending && !uploading && (text.trim().length > 0 || !!pending);

  return (
    <div className="border-t border-[var(--color-border-subtle)] bg-surface px-3 py-3">
      {error && (
        <p className="mb-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-default bg-muted px-2 py-1 text-xs text-fg">
          📎 {pending.name}
          <button
            type="button"
            onClick={() => setPending(null)}
            className="text-muted hover:text-fg"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || sending}
          title="Attach a file"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-default bg-surface text-fg transition-colors hover:border-[var(--color-foreground)] disabled:opacity-50"
        >
          {uploading ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <span aria-hidden="true">📎</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={autoSize}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          rows={1}
          className="min-h-[36px] flex-1 resize-none rounded-2xl border border-default bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-[var(--color-foreground)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            "flex-shrink-0 rounded-full border px-4 h-9 text-xs font-semibold uppercase tracking-wide transition-all",
            canSend
              ? "border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)] hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]"
              : "border-default bg-muted text-muted cursor-not-allowed",
          )}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
