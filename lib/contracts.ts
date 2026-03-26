import { ethers, BrowserProvider, JsonRpcSigner } from "ethers";
import FreelanceEscrowABI from "./abis/FreelanceEscrow.json";
import { config, isContractDeployed } from "./config";
import type { Job, Milestone, JobStatus, MilestoneStatus } from "@/index";

// ─────────────────────────────────────────────────────────────
// Provider helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns a read-only provider connected to the configured Ethereum RPC.
 * Used for data fetching that doesn't require a wallet.
 */
export function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.chain.rpcUrl);
}

/**
 * Returns a BrowserProvider wrapping the injected wallet (window.ethereum).
 * Works with MetaMask and any EIP-1193 compatible browser wallet.
 * Throws if no wallet is available.
 */
export function getWalletProvider(): BrowserProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "No wallet found. Please install MetaMask or another Ethereum wallet.",
    );
  }
  return new BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

// ─────────────────────────────────────────────────────────────
// Contract instances
// ─────────────────────────────────────────────────────────────

/** Read-only escrow contract instance (no signer required) */
export function getEscrowContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
): ethers.Contract {
  // FIX: Guard against empty/missing escrow address before ethers throws an
  // opaque error. This is the most common cause of "Transaction failed"
  // with no wallet popup — the address env var is missing or empty.
  if (!isContractDeployed()) {
    throw new Error(
      "Escrow contract address is not configured. " +
        "Set NEXT_PUBLIC_ESCROW_ADDRESS in your .env.local file.",
    );
  }
  if (!ethers.isAddress(config.contracts.escrowAddress)) {
    throw new Error(
      `Invalid escrow contract address: "${config.contracts.escrowAddress}". ` +
        "Check NEXT_PUBLIC_ESCROW_ADDRESS in your .env.local file.",
    );
  }
  const provider = signerOrProvider ?? getReadProvider();
  return new ethers.Contract(
    config.contracts.escrowAddress,
    FreelanceEscrowABI,
    provider,
  );
}
// ─────────────────────────────────────────────────────────────
// Read functions
// ─────────────────────────────────────────────────────────────

/** Fetch a single job with all its milestones */
export async function fetchJob(jobId: bigint): Promise<Job> {
  const contract = getEscrowContract();
  const [
    client,
    freelancer,
    totalAmount,
    metadataUri,
    status,
    milestoneCount,
    createdAt,
  ] = await contract.getJob(jobId);

  const milestones: Milestone[] = await Promise.all(
    Array.from({ length: Number(milestoneCount) }, async (_, i) => {
      const [amount, description, deliverableUri, mStatus] =
        await contract.getMilestone(jobId, i);
      return {
        index: i,
        amount: amount as bigint,
        amountEth: ethers.formatEther(amount),
        description: description as string,
        deliverableUri: deliverableUri as string,
        status: Number(mStatus) as MilestoneStatus,
      };
    }),
  );

  return {
    id: jobId,
    client: client as string,
    freelancer: freelancer as string,
    totalAmount: totalAmount as bigint,
    totalAmountEth: ethers.formatEther(totalAmount),
    metadataUri: metadataUri as string,
    status: Number(status) as JobStatus,
    milestoneCount: Number(milestoneCount),
    milestones,
    createdAt: createdAt as bigint,
  };
}
/** Fetch multiple jobs by IDs */
export async function fetchJobs(ids: bigint[]): Promise<Job[]> {
  return Promise.all(ids.map(fetchJob));
}

/** Fetch the total number of jobs created (useful for paginating) */
export async function fetchJobCount(): Promise<bigint> {
  const contract = getEscrowContract();
  return contract.jobCount() as Promise<bigint>;
}

// ─────────────────────────────────────────────────────────────
// Write functions (require signer)
// ─────────────────────────────────────────────────────────────

export interface CreateJobParams {
  metadataUri: string;
  milestoneDescriptions: string[];
  milestoneAmountsWei: bigint[];
  totalAmountWei: bigint;
}

/** Create a job on-chain. Returns the transaction receipt. */
export async function createJob(
  signer: JsonRpcSigner,
  params: CreateJobParams,
): Promise<{ receipt: ethers.TransactionReceipt; jobId: bigint }> {
  const contract = getEscrowContract(signer);

  // FIX: Log what we're sending so it's visible in the console if it fails.
  // This makes it immediately obvious if the address, value, or args are wrong.
  console.log("[createJob] contract address:", config.contracts.escrowAddress);
  console.log("[createJob] metadataUri:", params.metadataUri);
  console.log(
    "[createJob] milestoneDescriptions:",
    params.milestoneDescriptions,
  );
  console.log(
    "[createJob] milestoneAmountsWei:",
    params.milestoneAmountsWei.map(String),
  );
  console.log(
    "[createJob] totalAmountWei (value):",
    params.totalAmountWei.toString(),
  );

  const tx = await contract.createJob(
    params.metadataUri,
    params.milestoneDescriptions,
    params.milestoneAmountsWei,
    { value: params.totalAmountWei },
  );

  console.log("[createJob] tx hash:", tx.hash);
  const receipt: ethers.TransactionReceipt = await tx.wait();
  console.log("[createJob] confirmed in block:", receipt.blockNumber);

  const iface = new ethers.Interface(FreelanceEscrowABI);
  let jobId = 0n;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "JobCreated") {
        jobId = parsed.args.jobId as bigint;
        break;
      }
    } catch {
      // not our event — skip
    }
  }

  console.log("[createJob] parsed jobId:", jobId.toString());
  return { receipt, jobId };
}

/** Accept a freelancer bid */
export async function acceptBid(
  signer: JsonRpcSigner,
  jobId: bigint,
  freelancerAddress: string,
): Promise<ethers.TransactionReceipt> {
  const contract = getEscrowContract(signer);
  const tx = await contract.acceptBid(jobId, freelancerAddress);
  return tx.wait();
}

/** Submit deliverable for a milestone */
export async function submitMilestone(
  signer: JsonRpcSigner,
  jobId: bigint,
  milestoneIndex: number,
  deliverableUri: string,
): Promise<ethers.TransactionReceipt> {
  const contract = getEscrowContract(signer);
  const tx = await contract.submitMilestone(
    jobId,
    milestoneIndex,
    deliverableUri,
  );
  return tx.wait();
}

/** Approve a submitted milestone (releases payment) */
export async function approveMilestone(
  signer: JsonRpcSigner,
  jobId: bigint,
  milestoneIndex: number,
): Promise<ethers.TransactionReceipt> {
  const contract = getEscrowContract(signer);
  const tx = await contract.approveMilestone(jobId, milestoneIndex);
  return tx.wait();
}

/** Raise a dispute on a milestone */
export async function raiseDispute(
  signer: JsonRpcSigner,
  jobId: bigint,
  milestoneIndex: number,
): Promise<ethers.TransactionReceipt> {
  const contract = getEscrowContract(signer);
  const tx = await contract.raiseDispute(jobId, milestoneIndex);
  return tx.wait();
}

/** Cancel an open job (full refund to client) */
export async function cancelJob(
  signer: JsonRpcSigner,
  jobId: bigint,
): Promise<ethers.TransactionReceipt> {
  const contract = getEscrowContract(signer);
  const tx = await contract.cancelJob(jobId);
  return tx.wait();
}
