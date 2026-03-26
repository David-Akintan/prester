import { ethers } from "ethers";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { JobStatus, MilestoneStatus } from "@/index";

// ─────────────────────────────────────────────────────────────
// Tailwind helper
// ─────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

/** Format wei to ETH with up to 4 decimal places */
export function formatEth(wei: bigint, decimals = 4): string {
  return parseFloat(ethers.formatEther(wei)).toFixed(decimals);
}

/** Shorten an Ethereum address for display: 0x1234...abcd */
export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Convert ETH string input (from user) to wei bigint */
export function ethToWei(ethAmount: string): bigint {
  try {
    return ethers.parseEther(ethAmount);
  } catch {
    return 0n;
  }
}

/** Format a unix timestamp bigint to a readable date string */
export function formatTimestamp(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Status label helpers
// ─────────────────────────────────────────────────────────────

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.Open]: "Open",
  [JobStatus.InProgress]: "In Progress",
  [JobStatus.Completed]: "Completed",
  [JobStatus.Cancelled]: "Cancelled",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  [JobStatus.Open]: "bg-blue-100 text-blue-800",
  [JobStatus.InProgress]: "bg-yellow-100 text-yellow-800",
  [JobStatus.Completed]: "bg-green-100 text-green-800",
  [JobStatus.Cancelled]: "bg-gray-100 text-gray-800",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  [MilestoneStatus.Pending]: "Pending",
  [MilestoneStatus.Submitted]: "Submitted",
  [MilestoneStatus.Approved]: "Approved",
  [MilestoneStatus.Disputed]: "Disputed",
  [MilestoneStatus.Resolved]: "Resolved",
};

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  [MilestoneStatus.Pending]: "bg-gray-100 text-gray-700",
  [MilestoneStatus.Submitted]: "bg-blue-100 text-blue-700",
  [MilestoneStatus.Approved]: "bg-green-100 text-green-700",
  [MilestoneStatus.Disputed]: "bg-red-100 text-red-700",
  [MilestoneStatus.Resolved]: "bg-purple-100 text-purple-700",
};

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

export function isValidAddress(addr: string): boolean {
  return ethers.isAddress(addr);
}

export function isValidEthAmount(amount: string): boolean {
  if (!amount || isNaN(parseFloat(amount))) return false;
  try {
    const wei = ethers.parseEther(amount);
    return wei > 0n;
  } catch {
    return false;
  }
}

/** Parse a contract error to a human-readable message */
export function parseContractError(err: unknown): string {
  if (!(err instanceof Error)) return "An unknown error occurred";

  const msg = err.message;

  // FIX: Always log the raw error to the console so it's visible during
  // development. Previously errors were silently swallowed into the generic
  // "Transaction failed" message with no way to diagnose the real cause.
  console.error("[parseContractError] raw error:", err);

  // Missing / invalid contract address — our own guard in contracts.ts
  if (msg.includes("not configured") || msg.includes("NEXT_PUBLIC_ESCROW")) {
    return msg;
  }
  if (msg.includes("Invalid escrow contract address")) {
    return msg;
  }

  // User rejected
  if (
    msg.includes("user rejected") ||
    msg.includes("ACTION_REJECTED") ||
    msg.includes("denied")
  ) {
    return "Transaction cancelled.";
  }

  // Insufficient funds
  if (msg.includes("insufficient funds")) {
    return "Insufficient balance to complete this transaction.";
  }

  // Network mismatch
  if (msg.includes("network") || msg.includes("chain")) {
    return "Network mismatch. Make sure your wallet is on the correct network.";
  }

  const customErrors: Record<string, string> = {
    NotClient: "Only the job client can perform this action.",
    NotFreelancer: "Only the assigned freelancer can perform this action.",
    NotJudge: "Only the judge can execute verdicts.",
    NotClientOrFreelancer: "Only the client or freelancer can raise a dispute.",
    JobNotOpen: "This job is no longer open.",
    JobNotInProgress: "This job is not currently in progress.",
    JobAlreadyHasFreelancer: "This job already has a freelancer assigned.",
    InvalidMilestoneIndex: "Invalid milestone index.",
    MilestoneNotPending:
      "This milestone has already been submitted or resolved.",
    MilestoneNotSubmitted:
      "Work has not been submitted for this milestone yet.",
    MilestoneNotDisputed: "This milestone is not in a disputed state.",
    NoMilestonesProvided: "At least one milestone is required.",
    MilestoneAmountMismatch: "Milestone amounts must match the total payment.",
    ZeroAddress: "A required address is missing or invalid.",
    ZeroAmount: "Amount must be greater than zero.",
    FeeTooHigh: "Platform fee cannot exceed 10%.",
    TransferFailed: "Payment transfer failed.",
    JobNotCancellable: "Only open jobs (with no freelancer) can be cancelled.",
    EnforcedPause: "The contract is currently paused.",
  };

  for (const [errorName, humanMessage] of Object.entries(customErrors)) {
    if (msg.includes(errorName)) return humanMessage;
  }
  // FIX: Return the actual error message as a last resort rather than the
  // generic "Transaction failed. Please try again." which gives no actionable info.
  // Trim ethers.js boilerplate prefix if present.
  const cleaned = msg
    .replace(/^Error: /, "")
    .replace(/\(action="[^"]+", [^)]+\)/, "")
    .trim();

  return cleaned || "Transaction failed. Please try again.";
}
