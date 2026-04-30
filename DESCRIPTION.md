# Prester

**Prester is a decentralized freelance marketplace where disputes are resolved by a committee of independent AI judges running a commit–reveal protocol on-chain.**

> See [ARCHITECTURE.md](ARCHITECTURE.md) for the technical design and protocol specification, or [README.md](README.md) for setup and run instructions.

## The problem

Freelance platforms are trust-heavy and extractive. Upwork, Fiverr, and Toptal charge 5–20% in fees, hold client funds in their own bank accounts, and adjudicate every dispute through an opaque in-house arbitration team. Freelancers in emerging markets face 3–7 day withdrawal delays, account freezes, and arbitrary policy changes. Clients lose funds to vendor fraud with no recourse outside the platform's word.

Crypto-native marketplaces (Braintrust, Ethlance, etc.) solve the custody problem by escrowing funds in smart contracts, but they fall into one of three traps:

- **Punt the dispute** back to a centralized DAO or multisig — same opaque arbiter, just on-chain.
- **Force both parties to play arbitration games** (Kleros) — high latency, bond requirements, and a steep game-theoretic learning curve.
- **Ship no dispute mechanism at all** — and accept that broken work is the cost of doing business.

## What Prester is

A milestone-based escrow protocol with three integrated layers — smart contracts, an off-chain orchestrator, and a multi-chain web client — held together by a single guarantee: **funds move only when the contract says so, and the contract never guesses.**

1. **A client posts a job and locks the full budget on-chain**, split into milestones. Funds are never held by Prester — they live in the `FreelanceEscrow` contract until released.
2. **A freelancer bids, gets accepted, and submits each milestone with an IPFS-pinned deliverable.** The client approves (funds release) or disputes (escalates to the judge committee).
3. **Disputes are resolved by three independent AI judges** — Claude Sonnet, Gemini Flash, Groq Llama — via a commit–reveal protocol in the `JudgeRegistry` contract. Each judge runs in a separate backend process with its own signing wallet, evaluates the dispute, commits a hash of its verdict on-chain, then reveals. The contract tallies the majority and releases funds accordingly.
4. **Ties and insufficient quorum escalate to human review.** A community-vote workflow gathers ballots from eligible users; the recommended winner is then applied via the contract's owner-only `emergencyResolveDispute` escape hatch. The contract itself never picks.
5. **Reputation is tracked on-chain** in a separate `Reputation` contract: milestones completed, disputes won/lost, total earned/spent. New users start at zero (anti-sybil); activity older than 180 days decays 50% (rewards recent performance).

## What makes Prester different

**The judge protocol is the product, not the marketplace.** The same `JudgeRegistry` commit–reveal pattern can arbitrate any bilateral dispute — grant milestones, bug bounties, freelance work, service-level agreements. Prester ships the marketplace as the first consumer of the protocol; the contract is reusable as a primitive in any system that needs adjudicable off-chain witnesses.

**No model lock-in.** Every judge is pluggable — a provider is a class implementing `JudgeProvider.evaluate(ctx): Promise<JudgeVerdict>`. Swap Claude for DeepSeek, add a Mistral judge, run 5-of-7 instead of 2-of-3 — it's config. The on-chain contract only cares about addresses and commit hashes.

**Cryptographic commit–reveal prevents collusion.** Each judge commits `keccak256(winner, reasonHash, salt)` before any other judge reveals. A compromised provider can't lean on what others said — the hash is already on-chain, tamper-evident, and bound to the provider's registered wallet. Reveals publish the full reasoning doc on IPFS with its hash already witnessed on-chain.

**Fully multi-chain.** Contracts deploy with identical bytecode to Sepolia, Celo Alfajores, Celo Sepolia, Base Sepolia, Celo mainnet, Base mainnet, and a dedicated Initia rollup. Frontend and backend derive every chain-aware behavior — event listeners, SIWE auth, contract addresses, block explorers — from a single `CHAIN_REGISTRY`. Adding a chain is one entry plus a hardhat deploy.

**Crash-resilient orchestrator.** The backend dispute pipeline persists every state transition (salt, reasonHash, commitHash) to Postgres before any on-chain action. If the backend crashes mid-reveal, on restart it reloads persisted values and resumes exactly where it stopped — no orphaned commits, no locked escrow.

**Confidential jobs without losing the audit trail.** NDA-flagged jobs encrypt deliverables and dispute evidence client-side using x25519 sealed envelopes addressed to the registered participants (client, freelancer, judges). Plaintext never leaves the browser; the on-chain hash and the encrypted CID give every party an identical, verifiable record.

## Who it's for

- **Freelancers** in any jurisdiction who need non-custodial escrow, transparent dispute resolution, and portable on-chain reputation.
- **Clients** who want vendor fraud protection without submitting to an opaque platform arbiter.
- **Open-source maintainers** running grant programs who need milestone-based disbursement with adjudicable deliverables.
- **Protocol designers** who want to reuse the AI-judge committee as a primitive in other dispute-prone systems.

## Status and roadmap

**Shipped.**

- *Contracts* — `FreelanceEscrow`, `JudgeRegistry`, `Reputation`. 57 hardhat tests passing. Deployed to Sepolia and Celo mainnet, ready for further networks via the unified deploy script.
- *Backend* — multi-chain event listeners with reconcile cron, multi-judge orchestrator (Claude + Gemini + Groq), SIWE auth with domain + chainId binding, dead-letter event queue, IPFS retry, notification idempotency, hot-path indexes.
- *Frontend* — Next.js 15 with wagmi + viem. Chain switcher, SIWE sign-in, full job/bid/dispute lifecycle, freelancer dashboard, community-vote workflow for `NeedsReview`, admin console for emergency resolution, NDA envelope encryption.
- *Chains configured* — Sepolia, Celo Alfajores, Celo Sepolia, Base Sepolia, Celo mainnet, Base mainnet, plus the Initia Minitia EVM rollup entry (active once the rollup launches).

**Next.**

- Reputation-weighted judge selection — a pool of seven judges from which the three for a given dispute are picked by recent verdict accuracy.
- Additional judge providers (self-hosted Llama, DeepSeek, Mistral) so a single API outage cannot stall the committee.
- Grant-program primitive — a thin wrapper contract letting a DAO post grant milestones and reuse the judge committee for deliverable disputes.
- Secondary IPFS pinning (Filebase or web3.storage) plus a reseed cron, so verdict docs survive Pinata's free-tier eviction.
- Production audit and mainnet launch on the Initia rollup as Prester's canonical deployment.
