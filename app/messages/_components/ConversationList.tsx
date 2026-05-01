"use client";

import { cn, shortenAddress } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/api";

interface Props {
  conversations: ConversationSummary[];
  currentAddress: string | null;
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
}

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return relativeTime.format(Math.round(diffSec), "second");
  if (abs < 3600) return relativeTime.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relativeTime.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604_800) return relativeTime.format(Math.round(diffSec / 86_400), "day");
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Cheap deterministic gradient avatar from an address — no extra dep.
function avatarGradient(addr: string): string {
  const hex = addr.replace(/^0x/, "").slice(0, 12);
  const a = parseInt(hex.slice(0, 4) || "0", 16) % 360;
  const b = parseInt(hex.slice(4, 8) || "0", 16) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 55%), hsl(${b} 70% 45%))`;
}

export default function ConversationList({
  conversations,
  currentAddress,
  selectedJobId,
  onSelect,
}: Props) {
  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-semibold text-fg">No conversations</p>
        <p className="text-xs text-muted">
          Threads appear here once a bid is accepted on one of your jobs.
        </p>
      </div>
    );
  }

  return (
    <ul className="h-full overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
      {conversations.map((c) => {
        const me = (currentAddress ?? "").toLowerCase();
        const other =
          c.client_address.toLowerCase() === me
            ? c.freelancer_address
            : c.client_address;
        const isActive = c.job_id === selectedJobId;
        const preview = c.last_kind === "system"
          ? `· ${trimPreview(c.last_preview ?? "")}`
          : trimPreview(c.last_preview ?? "");

        return (
          <li key={c.job_id}>
            <button
              type="button"
              onClick={() => onSelect(c.job_id)}
              className={cn(
                "w-full text-left px-3 py-3 flex items-start gap-3 transition-colors",
                isActive ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <div
                className="h-9 w-9 flex-shrink-0 rounded-full"
                style={{ backgroundImage: avatarGradient(other) }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-fg">
                    {c.job_title}
                  </p>
                  <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-muted">
                    {formatRelative(c.last_message_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{shortenAddress(other)}</span>
                    {preview ? (
                      <span className="ml-1 opacity-80">{preview}</span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {c.read_only && (
                      <span
                        title={`Read-only — job ${c.job_status}`}
                        className="text-muted"
                        aria-label="Read-only"
                      >
                        🔒
                      </span>
                    )}
                    {c.unread_count > 0 && (
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-foreground)] px-1 text-[10px] font-bold text-[var(--color-background)]">
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function trimPreview(s: string): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? oneLine.slice(0, 77) + "…" : oneLine;
}
