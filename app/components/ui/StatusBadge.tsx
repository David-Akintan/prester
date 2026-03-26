import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  // Job
  draft: "border-neutral-200 text-neutral-400",
  open: "border-black text-black",
  in_progress: "border-black bg-black text-white",
  completed: "border-neutral-400 text-neutral-500",
  cancelled: "border-neutral-200 text-neutral-300",
  // Milestone
  pending: "border-neutral-200 text-neutral-400",
  submitted: "border-black text-black",
  approved: "border-neutral-400 text-neutral-600",
  disputed: "border-black bg-black text-white",
  resolved: "border-neutral-400 text-neutral-500",
  // Bid
  accepted: "border-black bg-black text-white",
  rejected: "border-neutral-200 text-neutral-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
  submitted: "Submitted",
  approved: "Approved",
  disputed: "Disputed",
  resolved: "Resolved",
  accepted: "Accepted",
  rejected: "Rejected",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        STATUS_STYLES[status] ?? "border-neutral-200 text-neutral-400",
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
