// ─────────────────────────────────────────────────────────────
// Domain types mirroring the smart contract data structures
// ─────────────────────────────────────────────────────────────

export enum JobStatus {
  Open = 0,
  InProgress = 1,
  Completed = 2,
  Cancelled = 3,
}

export enum MilestoneStatus {
  Pending = 0,
  Submitted = 1,
  Approved = 2,
  Disputed = 3,
  Resolved = 4,
}

export interface Milestone {
  index: number;
  amount: bigint; // wei
  amountEth: string; // formatted for display
  description: string;
  deliverableUri: string;
  status: MilestoneStatus;
}

export interface Job {
  id: bigint;
  client: string; // checksummed address
  freelancer: string; // address(0) if not yet assigned
  totalAmount: bigint; // wei
  totalAmountEth: string; // formatted for display
  metadataUri: string; // IPFS URI
  status: JobStatus;
  milestoneCount: number;
  milestones: Milestone[];
  createdAt: bigint; // unix timestamp
}

// Job metadata stored on IPFS — fetched via metadataUri
export interface JobMetadata {
  title: string;
  description: string;
  category: string;
  tags: string[];
  requiredSkills: string[];
  estimatedDuration: string; // e.g. "2 weeks"
  createdAt: string; // ISO 8601
}

// Form input for creating a new job
export interface CreateJobFormData {
  title: string;
  description: string;
  category: string;
  tags: string;
  requiredSkills: string;
  estimatedDuration: string;
  milestones: MilestoneFormItem[];
}

export interface MilestoneFormItem {
  description: string;
  amountEth: string; // user inputs ETH, we convert to wei before tx
}

// Reputation
export interface ReputationScore {
  jobsCompleted: bigint;
  jobsAbandoned: bigint;
  disputesWon: bigint;
  disputesLost: bigint;
  totalEarned: bigint;
  totalSpent: bigint;
  lastUpdated: bigint;
  trustScore: bigint; // 0–100
}

// Transaction state for UI feedback
export type TxState =
  | { status: "idle" }
  | { status: "pending"; message: string }
  | { status: "success"; txHash: string; message: string }
  | { status: "error"; message: string };
