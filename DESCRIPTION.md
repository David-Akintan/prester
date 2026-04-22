# Prester

**Prester is a decentralized freelance marketplace where disputes are resolved by a committee of independent AI judges running a commit–reveal protocol on-chain.**

## The problem

Freelance platforms are trust-heavy and extractive. Upwork, Fiverr, and Toptal charge 5–20% in fees, hold client funds in their own bank accounts, and adjudicate every dispute through an opaque in-house arbitration team. Freelancers in emerging markets face 3–7 day withdrawal delays, account freezes, and arbitrary policy changes. Clients lose funds to vendor fraud with no recourse outside the platform's word.

Existing crypto-native marketplaces (Braintrust, Ethlance, etc.) solve the custody problem by escrowing funds in smart contracts, but they either (a) punt disputes back to centralized DAOs or multisigs, (b) require both parties to stake bonds and play game-theoretic arbitration games (Kleros), or (c) simply have no dispute mechanism and ship broken work.

## What Prester is

A milestone-based escrow where:

1. **A client posts a job and locks the full budget on-chain**, split into milestones. Funds are never held by Prester — they live in the `FreelanceEscrow` contract until released.
2. **A freelancer bids, gets accepted, and submits each milestone with an IPFS-pinned deliverable**. The client approves (funds release) or disputes (escalates to the judge committee).
3. **Disputes are resolved by three independent AI judges** (Claude Sonnet, Gemini Flash, Groq Llama) via a commit–reveal protocol in the `JudgeRegistry` contract. Each judge runs in a separate backend process with its own signing wallet, evaluates the dispute, commits a hash of its verdict on-chain, then reveals. The contract tallies the majority and releases funds accordingly.
4. **Ties and insufficient quorum escalate to human review** — the contract does not guess.
5. **Reputation is tracked on-chain** via a separate `Reputation` contract: milestones completed, disputes won/lost, total earned/spent. New users start at zero (prevents sybil farming), and activity older than 180 days decays 50% (rewards recent performance).

## What makes Prester different

**The judge protocol is the product, not the marketplace.** The same `JudgeRegistry` commit–reveal pattern can arbitrate any bilateral dispute (grant milestones, bug bounties, freelance work, service-level agreements). Prester ships the marketplace as the first consumer of the protocol.

**No model lock-in.** Every judge is pluggable — a provider is a class implementing `JudgeProvider.evaluate(ctx): Promise<JudgeVerdict>`. Swap Claude for DeepSeek, add a Mistral judge, run 5-of-7 instead of 2-of-3 — it's config. The on-chain contract only cares about addresses and commit hashes.

**Cryptographic commit–reveal prevents collusion.** Each judge commits `keccak256(winner, reasonHash, salt)` before any other judge reveals. A compromised provider can't lean on what others said — the hash is already on-chain, tamper-evident, and staked against the provider's registered wallet. Reveals publish the full reasoning doc on IPFS with its hash witnessed on-chain.

**Fully multi-chain.** Contracts deploy identically to Sepolia, Celo Alfajores, Base Sepolia, Celo mainnet, Base mainnet, and a dedicated Initia rollup. Frontend + backend derive every chain-aware behavior (event listeners, SIWE auth, contract addresses, block explorers) from a single `CHAIN_REGISTRY` — adding a chain is a one-line entry plus a hardhat deploy.

**Crash-resilient orchestrator.** The backend dispute pipeline persists every state transition (salt, reasonHash, commitHash) to Postgres before any on-chain action. If the backend crashes mid-reveal, on restart it reloads persisted values and resumes exactly where it stopped — no orphaned on-chain commits, no locked escrow.

## Who it's for

- **Freelancers** in any jurisdiction who need non-custodial escrow, transparent dispute resolution, and portable on-chain reputation.
- **Clients** who want vendor fraud protection without submitting to an opaque platform arbiter.
- **Open-source maintainers** running grant programs who need milestone-based disbursement with adjudicable deliverables.
- **Protocol designers** who want to reuse the AI-judge committee as a primitive in other dispute-prone systems.

## Current status

- **Contracts hardened**: 57 tests passing (`FreelanceEscrow.v2.test.ts`, `JudgeRegistry.test.ts`, `Reputation.v2.test.ts`). Deployed to Sepolia.
- **Backend**: Multi-chain event listeners, multi-judge orchestrator, SIWE auth with domain+chainId binding, dead-letter event queue, IPFS retry, notification idempotency, hot-path indexes.
- **Frontend**: Next.js 15 + wagmi + viem. Chain switcher, SIWE sign-in, job/bid/dispute flows, freelancer dashboard, per-chain contract address resolution.
- **Chains configured**: Sepolia, Celo Alfajores, Base Sepolia, Celo mainnet, Base mainnet, Initia Minitia rollup (testnet stub pending rollup launch).

## Where it's going

- Human-review fallback UI for `NeedsReview` disputes.
- Additional judge providers (Llama via self-hosted inference, DeepSeek, Mistral).
- Grant-program primitive: a thin wrapper contract that lets a DAO post grant milestones and use the same judge committee to adjudicate deliverable disputes.
- Reputation-weighted judge selection: a 7-judge pool where the 3 picked for a given dispute are chosen by recent accuracy on past verdicts.
