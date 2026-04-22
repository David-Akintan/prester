// Auto-generated and merged by contracts/scripts/deploy.ts.
// Each deploy patches only its own chainId's slot — addresses for other
// chains are preserved. Do not hand-edit unless you know what you're doing.

export interface ContractAddressSet {
  JudgeRegistry: string;
  FreelanceEscrow: string;
  Reputation: string;
}

export const CONTRACT_ADDRESSES_BY_CHAIN: Record<number, ContractAddressSet> = {
  // Sepolia (11155111)
  11155111: {
    JudgeRegistry:   "0xfF968C32D86CF785B9EF0B1FC80C6aFFD46DC38F",
    FreelanceEscrow: "0x35A81eaA4724c26dccEd4008AC1340E77248C998",
    Reputation:      "0x4AC4188758D32A800aCE16Fe8CE028E2b30C80B1",
  },
  // Minitia / Prester L2 — populated on first deploy to the rollup
  // Celo Alfajores (44787) — deploy via: npx hardhat run scripts/deploy.ts --network celoAlfajores
  // 44787: { JudgeRegistry: "0x…", FreelanceEscrow: "0x…", Reputation: "0x…" },
  // Base Sepolia (84532) — deploy via: npx hardhat run scripts/deploy.ts --network baseSepolia
  // 84532: { JudgeRegistry: "0x…", FreelanceEscrow: "0x…", Reputation: "0x…" },
};

export function getContractAddresses(chainId: number): ContractAddressSet {
  const set = CONTRACT_ADDRESSES_BY_CHAIN[chainId];
  if (!set) {
    throw new Error(
      `No contract addresses configured for chainId ${chainId}. ` +
        `Deploy via hardhat first, or add the chain to CHAIN_REGISTRY.`,
    );
  }
  return set;
}

// Deprecated alias — points at Sepolia so Phase 2/4 imports keep compiling.
// New code should call getContractAddresses(chainId) instead.
export const CONTRACT_ADDRESSES = CONTRACT_ADDRESSES_BY_CHAIN[11155111];
