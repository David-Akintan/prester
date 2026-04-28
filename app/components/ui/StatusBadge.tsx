import { cn } from "@/lib/utils";

// Two visual variants, both theme-safe via CSS tokens:
//  - "solid": inverted foreground bg — used for active/current states
//  - "outline": border + muted text — used for passive/terminal states
const STATUS_VARIANT: Record<string, "solid" | "outline"> = {
  // Job
  draft: "outline",
  open: "outline",
  in_progress: "solid",
  completed: "outline",
  cancelled: "outline",
  // Milestone
  pending: "outline",
  submitted: "solid",
  approved: "outline",
  disputed: "solid",
  resolved: "outline",
  // Bid
  accepted: "solid",
  rejected: "outline",
  // Dispute / poll
  needs_review: "solid",
  vote_open: "solid",
  recommendation_ready: "outline",
  emergency_resolved: "outline",
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
  needs_review: "Needs Review",
  vote_open: "Vote Open",
  recommendation_ready: "Recommendation Ready",
  emergency_resolved: "Owner Resolved",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status] ?? "outline";
  const classes =
    variant === "solid"
      ? "border-[var(--color-foreground)] bg-[var(--color-foreground)] text-[var(--color-background)]"
      : "border-default text-muted";

  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-xs font-medium uppercase tracking-wide rounded",
        classes,
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
