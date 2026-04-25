// Auto-generated and merged by contracts/scripts/deploy.ts.
// Each deploy patches only its own chainId's slot — addresses for other
// chains are preserved. Do not hand-edit unless you know what you're doing.

export interface ContractAddressSet {
  JudgeRegistry: string;
  FreelanceEscrow: string;
  Reputation: string;
}

export const CONTRACT_ADDRESSES_BY_CHAIN: Record<number, ContractAddressSet> = {
  42220: {
    JudgeRegistry:   "0xf779Bf02Fa371A088a6311FAFffAe0BcFB17d67f",
    FreelanceEscrow: "0x0f3f660A49843F6713940F850038b453997B2d97",
    Reputation:      "0x154b482EF8a64F43350c60DA683247E9d9018F21",
  },
  11155111: {
    JudgeRegistry:   "0xfF968C32D86CF785B9EF0B1FC80C6aFFD46DC38F",
    FreelanceEscrow: "0x35A81eaA4724c26dccEd4008AC1340E77248C998",
    Reputation:      "0x4AC4188758D32A800aCE16Fe8CE028E2b30C80B1",
  },
};

export function getContractAddresses(chainId: number): ContractAddressSet {
  const set = CONTRACT_ADDRESSES_BY_CHAIN[chainId];
  if (!set) {
    throw new Error(
      `No contract addresses configured for chainId ${chainId}.`,
    );
  }
  return set;
}

// Deprecated alias — points at chainId 11155111. New code should call
// getContractAddresses(chainId).
export const CONTRACT_ADDRESSES = getContractAddresses(11155111);
