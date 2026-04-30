import { ethers, BrowserProvider, JsonRpcSigner } from "ethers";
import FreelanceEscrowABI from "./abis/FreelanceEscrow.json";
import { CONTRACT_ADDRESSES_BY_CHAIN, getContractAddresses } from "./addresses";
import { CHAIN_REGISTRY, DEFAULT_CHAIN_ID } from "./chains";
import type { Job, Milestone, JobStatus, MilestoneStatus } from "@/index";

function rpcFor(chainId: number): string {
  const meta = CHAIN_REGISTRY[chainId];
  if (!meta) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }
  return meta.viemChain.rpcUrls.default.http[0];
}

export function getReadProvider(chainId?: number): ethers.JsonRpcProvider {
  const id = chainId ?? DEFAULT_CHAIN_ID;
  return new ethers.JsonRpcProvider(rpcFor(id));
}

export function getWalletProvider(): BrowserProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "No wallet found. Please install MetaMask or another Ethereum wallet.",
    );
  }
  return new BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

export function getEscrowContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
  chainId?: number,
): ethers.Contract {
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;
  let addr: string;
  try {
    addr = getContractAddresses(resolvedChainId).FreelanceEscrow;
  } catch (err) {
    throw new Error(
      `Escrow contract not deployed on chainId ${resolvedChainId}. ` +
        `Run \`npx hardhat run scripts/deploy.ts --network <name>\` first.`,
    );
  }
  if (!ethers.isAddress(addr)) {
    throw new Error(
      `Invalid escrow address "${addr}" for chainId ${resolvedChainId}.`,
    );
  }
  const provider = signerOrProvider ?? getReadProvider(resolvedChainId);
  return new ethers.Contract(addr, FreelanceEscrowABI, provider);
}
// ─────────────────────────────────────────────────────────────
// Read functions
// ─────────────────────────────────────────────────────────────

/** Fetch a single job with all its milestones */
export async function fetchJob(jobId: bigint, chainId?: number): Promise<Job> {
  const contract = getEscrowContract(undefined, chainId);
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
export async function fetchJobs(
  ids: bigint[],
  chainId?: number,
): Promise<Job[]> {
  return Promise.all(ids.map((id) => fetchJob(id, chainId)));
}

/** Fetch the total number of jobs created (useful for paginating) */
export async function fetchJobCount(chainId?: number): Promise<bigint> {
  const contract = getEscrowContract(undefined, chainId);
  return contract.jobCount() as Promise<bigint>;
}

export async function fetchJobCountAcrossChains(): Promise<{
  total: bigint;
  perChain: Record<number, bigint>;
  failedChains: number[];
}> {
  const chainIds = Object.keys(CONTRACT_ADDRESSES_BY_CHAIN).map(Number);
  const results = await Promise.all(
    chainIds.map(async (id) => {
      try {
        return { id, count: await fetchJobCount(id) };
      } catch {
        return { id, count: null as bigint | null };
      }
    }),
  );
  const perChain: Record<number, bigint> = {};
  const failedChains: number[] = [];
  let total = 0n;
  for (const { id, count } of results) {
    if (count == null) {
      failedChains.push(id);
    } else {
      perChain[id] = count;
      total += count;
    }
  }
  return { total, perChain, failedChains };
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
  chainId?: number,
): Promise<{ receipt: ethers.TransactionReceipt; jobId: bigint }> {
  const resolvedChainId =
    chainId ?? Number((await signer.provider!.getNetwork()).chainId);
  const contract = getEscrowContract(signer, resolvedChainId);

  console.log("[createJob] chainId:", resolvedChainId);
  console.log(
    "[createJob] contract address:",
    getContractAddresses(resolvedChainId).FreelanceEscrow,
  );
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

async function contractForSigner(
  signer: JsonRpcSigner,
  chainId?: number,
): Promise<ethers.Contract> {
  const resolved =
    chainId ?? Number((await signer.provider!.getNetwork()).chainId);
  return getEscrowContract(signer, resolved);
}

/** Accept a freelancer bid */
export async function acceptBid(
  signer: JsonRpcSigner,
  jobId: bigint,
  freelancerAddress: string,
  chainId?: number,
): Promise<ethers.TransactionReceipt> {
  const contract = await contractForSigner(signer, chainId);
  const tx = await contract.acceptBid(jobId, freelancerAddress);
  return tx.wait();
}

/** Submit deliverable for a milestone */
export async function submitMilestone(
  signer: JsonRpcSigner,
  jobId: bigint,
  milestoneIndex: number,
  deliverableUri: string,
  chainId?: number,
): Promise<ethers.TransactionReceipt> {
  const contract = await contractForSigner(signer, chainId);
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
  chainId?: number,
): Promise<ethers.TransactionReceipt> {
  const contract = await contractForSigner(signer, chainId);
  const tx = await contract.approveMilestone(jobId, milestoneIndex);
  return tx.wait();
}

/** Raise a dispute on a milestone */
export async function raiseDispute(
  signer: JsonRpcSigner,
  jobId: bigint,
  milestoneIndex: number,
  chainId?: number,
): Promise<ethers.TransactionReceipt> {
  const contract = await contractForSigner(signer, chainId);
  const tx = await contract.raiseDispute(jobId, milestoneIndex);
  return tx.wait();
}

/** Cancel an open job (full refund to client) */
export async function cancelJob(
  signer: JsonRpcSigner,
  jobId: bigint,
  chainId?: number,
): Promise<ethers.TransactionReceipt> {
  const contract = await contractForSigner(signer, chainId);
  const tx = await contract.cancelJob(jobId);
  return tx.wait();
}

export async function getEscrowOwner(chainId: number): Promise<string> {
  const contract = getEscrowContract(undefined, chainId);
  return (await contract.owner()) as string;
}

/**
 * Owner-only escape hatch for disputes that escalated to NeedsReview.
 */
export async function emergencyResolveDispute(
  signer: JsonRpcSigner,
  jobId: bigint,
  milestoneIndex: bigint,
  winnerAddress: string,
  chainId?: number,
): Promise<ethers.TransactionReceipt> {
  if (!ethers.isAddress(winnerAddress)) {
    throw new Error(`Invalid winner address: ${winnerAddress}`);
  }
  const contract = await contractForSigner(signer, chainId);
  const tx = await contract.emergencyResolveDispute(
    jobId,
    milestoneIndex,
    winnerAddress,
  );
  return tx.wait();
}
