# Prester — Technical Architecture

**Version:** 1.0 (Phase 4 complete, multi-chain live)
**Audience:** Engineers evaluating the design, grant reviewers, contributors.

This document specifies the Prester protocol, its on-chain and off-chain components, the multi-judge commit–reveal scheme, and the cross-chain integration model. It assumes familiarity with EVM semantics, commit–reveal protocols, and Ethereum event-driven backends.

---

## 1. Problem statement

Bilateral service agreements — freelance work, grant milestones, bug bounties, SLA disputes — need a third party to adjudicate when counterparties disagree. Existing solutions have three failure modes:

1. **Trusted third party** (Upwork, Fiverr, Toptal): opaque decisions, custodial funds, extractive fees, jurisdictional blocks, arbitrary account freezes.
2. **Game-theoretic arbitration** (Kleros, Aragon Court): requires both parties to lock bonds and navigate voting rounds, produces high latency (days–weeks per case), and favors participants who understand the game.
3. **On-chain multisig DAOs**: concentrate power in a small set of signers, are gas-expensive at scale, and cannot inspect off-chain deliverables (text files, code repos, design documents) without off-chain signaling.

Prester's thesis: **a committee of independent AI models, operating under a cryptographic commit–reveal protocol, is the minimum viable decentralized arbiter for off-chain-witnessed deliverables.** The protocol is:

- **Low-latency**: 10-minute total dispute window (5 min commit + 5 min reveal in default config).
- **Tamper-evident**: every judge commits a hash of its verdict before any other judge reveals.
- **Pluggable**: judges are interchangeable across providers (Claude, Gemini, Groq, …) and can be weighted by reputation.
- **Fail-safe**: ties and insufficient quorum escalate to human review — the contract does not guess.

---

## 2. System overview

Prester consists of three layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                       Client (browser)                           │
│   Next.js 15 · wagmi + viem · SIWE · IPFS upload · MetaMask      │
└──────────────────────────────────────────────────────────────────┘
                                │
                   HTTPS (JSON) │ SIWE-authenticated sessions
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js / Express)                   │
│   · REST API: /auth /jobs /bids /disputes /ipfs /users ...       │
│   · Multi-chain event listener (WebSocket per chain)             │
│   · Multi-judge orchestrator (Claude + Gemini + Groq)            │
│   · Dead-letter event queue + IPFS retry cron                    │
│   · PostgreSQL (events, notifications, judge verdicts, IPFS)     │
└──────────────────────────────────────────────────────────────────┘
                                │
              JSON-RPC / WS     │ judge wallet signatures
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│              On-chain (Sepolia / Celo / Base / …)                │
│   FreelanceEscrow · JudgeRegistry · Reputation                   │
│   (identical bytecode across every chain)                        │
└──────────────────────────────────────────────────────────────────┘
```

Everything above the JSON-RPC line is horizontally scalable and non-custodial. Everything below is chain-replicated — the same bytecode runs on every supported network, and every network has its own isolated state.

---

## 3. Contract layer

### 3.1 FreelanceEscrow

Source: [`contracts/contracts/FreelanceEscrow.sol`](contracts/contracts/FreelanceEscrow.sol)

Holds client funds for the lifetime of a job. A job is a client-owned record containing an ordered list of milestones. Each milestone has a payout amount, a description, a deliverable URI (IPFS), and a status machine:

```
Pending ──submit──▶ Submitted ──approve──▶ Approved
                        │
                        └──dispute──▶ Disputed ──executeVerdict──▶ Resolved
```

**Critical invariants:**

- `totalAmount == sum(milestones[i].amount)` — checked at job creation.
- `platformFeeBps` and `cancellationFeeBps` are **locked at job creation** — the owner cannot retroactively change the fee on an active job.
- Once a milestone is `Approved` or `Resolved`, its funds are released and its status is terminal.
- `ReentrancyGuard` + `Pausable` + `Ownable` (OpenZeppelin v5).

**Auth model:**

- Client-only: `createJob`, `acceptBid`, `approveMilestone`, `cancelJob`.
- Freelancer-only: `submitMilestone`, `disputeMilestone`, `abandonJob`.
- `JudgeRegistry`-only: `executeVerdict`.

### 3.2 JudgeRegistry

Source: [`contracts/contracts/JudgeRegistry.sol`](contracts/contracts/JudgeRegistry.sol)

Implements the commit–reveal protocol. Stores a registered set of judge addresses, a quorum threshold, and per-dispute commit/reveal windows.

#### 3.2.1 State machine

```
DisputePhase:  None ──openDispute──▶ Commit ──(quorum commits OR deadline)──▶ Reveal
                                                                               │
                       ┌──────────── (majority reveals OR deadline) ───────────┘
                       ▼
                 (counting)
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
         Resolved           NeedsReview
    (unique majority)     (tie OR no quorum)
```

Phase transitions are strictly forward. There is no rewind, no judge-swap mid-dispute, no override.

#### 3.2.2 Commit

Each judge calls:

```solidity
function commitVerdict(
    uint256 jobId,
    uint256 milestoneIndex,
    bytes32 commitHash  // keccak256(abi.encode(winner, reasonHash, salt))
) external onlyJudge;
```

- `winner` is the address the judge believes should receive the escrowed milestone funds (client or freelancer).
- `reasonHash` is `keccak256(reasonDoc)` — the IPFS doc is uploaded only at reveal time, so during commit no judge can see another's reasoning.
- `salt` is a 32-byte random value. Without it, a judge could brute-force another's commit by trying both possible winners.

The contract rejects commits from unregistered addresses, commits after the deadline, and duplicate commits from the same judge.

#### 3.2.3 Reveal

```solidity
function revealVerdict(
    uint256 jobId,
    uint256 milestoneIndex,
    address winner,
    bytes32 reasonHash,
    bytes32 salt
) external onlyJudge;
```

The contract recomputes `keccak256(winner, reasonHash, salt)` and compares to the stored commit hash. Mismatch reverts. After reveal, the judge's vote is recorded and the global tally is incremented.

#### 3.2.4 Tally

After the reveal window closes (or earlier if all registered judges have revealed), anyone can call `finalizeDispute`. The contract counts votes per winner address. The outcome is:

- **Resolved** if one address has strictly more votes than any other AND total reveals ≥ quorum.
- **NeedsReview** on ties, below-quorum reveals, or any judge failing to reveal without consensus among the rest.

On `Resolved`, the contract calls `FreelanceEscrow.executeVerdict(jobId, milestoneIndex, winner)`, which atomically transfers funds and updates reputation.

### 3.3 Reputation

Source: [`contracts/contracts/Reputation.sol`](contracts/contracts/Reputation.sol)

A pure-recording contract: only `FreelanceEscrow` can call it. Tracks per-address scores:

```solidity
struct Score {
    uint256 jobsCompleted;      // milestones approved
    uint256 jobsAbandoned;      // never submitted
    uint256 disputesWon;
    uint256 disputesLost;
    uint256 totalEarned;        // cumulative freelancer payouts
    uint256 totalSpent;         // cumulative client payouts
    uint256 lastUpdated;
}
```

**Anti-sybil:**
- New addresses start at score 0 (no implicit trust).
- Activity older than `DECAY_PERIOD = 180 days` has its weight halved in the composite trust score — a long-dormant account isn't "locked in" as elite.

---

## 4. The off-chain pipeline

### 4.1 Event listener

Source: [`backend/src/services/chainListener.ts`](backend/src/services/chainListener.ts)

One listener per configured chain. Each listener maintains a WebSocket subscription to its RPC and handles the event set:

```
JobCreated          · on-chain job confirmed → mark DB row active
BidAccepted         · assignment → notify freelancer
MilestoneSubmitted  · mark milestone.submitted + notify client
MilestoneApproved   · release funds, update reputation, notify freelancer
DisputeRaised       · kick orchestrator, create dispute row
VerdictExecuted     · close dispute, reconcile state, notify both
JobCancelled        · refund, update reputation
```

Every event handler wraps its DB writes in `BEGIN / COMMIT` via a pooled client. On error: `ROLLBACK`, then the event is inserted into `dead_letter_events` with `retry_count` bound. On backend restart, `replayDeadLetters()` reprocesses the queue.

### 4.2 Reconcile path

WebSocket subscriptions drop silently. To guarantee correctness even when real-time delivery fails, [`backend/src/services/eventIndexer.ts`](backend/src/services/eventIndexer.ts) runs a 5-minute cron: it scans the last N blocks on each chain and replays any event whose `block_number + tx_hash + log_index` isn't already recorded in `processed_events`. Idempotency is enforced at the DB layer via partial unique indexes.

### 4.3 Multi-judge orchestrator

Source: [`backend/src/services/judges/orchestrator.ts`](backend/src/services/judges/orchestrator.ts)

Entry point: `runMultiJudge(ctx: DisputeContext)`. The seven-step pipeline:

```
1. Evaluate       ·  Promise.allSettled over all judges (Claude, Gemini, Groq)
                    Each judge returns JudgeVerdict { winner, reasoning, confidence }
                    Persist salt + reasonHash + commitHash PER JUDGE before step 2.

2. Commit         ·  For each new judge row, send commitVerdict() with its wallet.
                    Mark row 'committed' / 'failed_commit'.

3. Advance        ·  If still in Commit phase after all commits succeed, wait
                    for commit deadline, then call advanceToReveal().

4. Reveal         ·  For each committed row, send revealVerdict() with persisted
                    (winner, reasonHash, salt). Mark row 'revealed' / 'failed_reveal'.

5. Finalize       ·  Wait for reveal deadline if needed; call finalizeDispute().

6. Upload         ·  For each verdict, pin the reasoning doc to IPFS via Pinata.
                    Build a Merkle root of doc hashes (already committed on-chain).
                    If upload fails after 3 retries, park the doc in app_config
                    under key ipfs_pending_verdict_<disputeId>; retry cron picks it up.

7. Execute        ·  If Resolved, FreelanceEscrow.executeVerdict(winner) was
                    already called by JudgeRegistry. Reconcile DB state.
                    If NeedsReview, mark dispute 'escalated' for human review.
```

**Crash resilience:** every step writes `pipeline_phase` to the `disputes` table (`evaluating`, `committing`, `revealing`, `finalizing`, `uploading`, `done`, `ipfs_pending`, `aborted`) before the step begins. On backend start, [`backend/src/services/judges/resume.ts`](backend/src/services/judges/resume.ts) queries disputes in non-terminal phases and resumes them exactly where they left off. Salts are reloaded from the `judge_verdicts` table — a judge never re-generates a salt it already committed with.

### 4.4 IPFS layer

Pinata is the primary pinner. [`backend/src/services/ipfsRetry.ts`](backend/src/services/ipfsRetry.ts) implements a 10-min retry cron for uploads that failed inline. Content addressed via CID v1, referenced on-chain as `ipfs://<cid>`.

**Pin longevity risk:** Pinata's free tier does not guarantee perpetual pinning. Post-hackathon plan is a secondary pinner (Filebase, web3.storage) + a "reseed from archive" cron that re-pins any verdict doc whose CID becomes unreachable.

### 4.5 Notification system

Every event that changes user-visible state emits a notification row in Postgres with an `idempotency_key = sha256(address || type || canonical(metadata))`. Because both the live listener AND the reconcile cron can fire the same event, this deterministic key on a partial unique index (`ON CONFLICT DO NOTHING`) guarantees exactly-once user-visible delivery even through backend restarts.

---

## 5. Cross-chain model

Prester is **multi-chain, not cross-chain**. Jobs and disputes are local to the chain they're created on — a job on Sepolia cannot be disputed on Base. The architecture scales horizontally across independent networks without introducing bridging risk.

### 5.1 Single source of truth

Three files are the authoritative registry for supported chains:

- **Frontend** [`frontend/my-app/lib/chains.ts`](frontend/my-app/lib/chains.ts) — `CHAIN_REGISTRY`. Drives wagmi config, the chain-switcher UI, block-explorer links, per-chain accent colors.
- **Backend** [`backend/src/chains.ts`](backend/src/chains.ts) — `loadChainsFromEnv()`. Reads `CHAIN_N_*` env blocks (up to 10). One event listener + one orchestrator RPC route spawned per entry.
- **Contracts** [`contracts/hardhat.config.ts`](contracts/hardhat.config.ts) — `networks`. Hardhat deploy target + Etherscan V2 / Celoscan verification config.

Adding a new chain is a one-entry change in each file.

### 5.2 DB scoping

Every table that records on-chain data has a `chain_id INTEGER` column (migration [`007_chain_id.sql`](backend/src/db/migrations/007_chain_id.sql)). The `disputes` unique index is `(chain_id, chain_job_id, milestone_index)` (migration [`008_disputes_chain_scoped_unique.sql`](backend/src/db/migrations/008_disputes_chain_scoped_unique.sql)), so job #5 on Celo and job #5 on Sepolia are distinct disputes, not a collision.

All event handlers include `AND chain_id = $chainCfg.chainId` in every `UPDATE ... WHERE chain_job_id = ...` — no handler can cross-contaminate state across chains.

### 5.3 SIWE multi-chain auth

Source: [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts#L35)

The SIWE message carries the wallet's current `chainId`. The backend enforces three things:

1. `fields.domain === config.auth.appDomain` — prevents domain-mismatch replay.
2. `fields.uri === config.auth.appOrigin` — prevents origin-mismatch replay.
3. `fields.chainId ∈ config.chains.map(c => c.chainId)` — the user cannot sign in on an unsupported chain.

The frontend [`hooks/useAuth.ts`](frontend/my-app/hooks/useAuth.ts) reads `useChainId()` from wagmi and threads it into the SIWE message — there is no hardcoded chain ID.

### 5.4 Prester L2 (Initia Minitia rollup)

Phase 3 goal: run Prester's canonical deployment on a dedicated Initia Minitia EVM rollup. The rollup gives Prester:

- **Fee sovereignty**: users pay gas in a native token controlled by Prester.
- **IBC connectivity**: cross-chain payment settlement with other Initia and Cosmos-IBC chains (freelancers paid in their preferred asset).
- **Reputation portability**: the `Reputation` contract's authoritative record lives on the L2; other chains mirror.

The frontend already has a chain entry [`minitiaEvm` in chains.ts:16](frontend/my-app/lib/chains.ts#L16) gated on `NEXT_PUBLIC_MINITIA_*` env vars. Everything except rollup-launch is wired.

---

## 6. Security model

### 6.1 Trust assumptions

- **Contracts**: assumed correct. Covered by 57 hardhat tests ([`contracts/test/`](contracts/test/)). A professional audit is pre-mainnet-launch scope.
- **Judge wallets**: each judge wallet key is held by exactly one backend process. The backend is a trusted component; compromising any single judge wallet compromises 1/3 of the quorum — not the whole system.
- **AI providers**: mutually distrusting. Collusion between any two providers would require coordinating commit hashes before the first commit hits chain. Even a provider that is fully compromised cannot learn what the others committed until its own commit is in a mined block.
- **RPC provider**: trusted for liveness, not for safety. A malicious RPC can withhold events, but the reconcile path (§4.2) catches these.
- **Pinata / IPFS**: trusted for availability, not for integrity. Integrity is enforced by `reasonHash` being witnessed on-chain at commit time.

### 6.2 Adversarial scenarios

| Attack                                                          | Mitigation                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A client tries to approve their own dispute                     | Contract: `disputeMilestone` is `onlyFreelancer`, `approveMilestone` is `onlyClient`                                      |
| A freelancer submits the same deliverable twice                 | Off-chain dedup by IPFS CID; on-chain status machine blocks re-submission on `Submitted`                                  |
| A judge commits, then refuses to reveal                         | Contract: missing reveals reduce effective quorum; falls to `NeedsReview` if unique-majority condition breaks             |
| Two judges collude on a winner                                  | Commit is `keccak256(winner, reasonHash, salt)` — neither can see what the other committed; off-chain coordination caught by auditable `reasonHash` on IPFS |
| A front-runner sees a commit and tries to replay it             | `salt` is 32-byte random; commit is per-(judge, dispute) and bound to caller's address                                    |
| Replay of a SIWE message on a different origin                  | Backend rejects if `fields.domain` or `fields.uri` mismatch the configured app origin                                     |
| A stolen JWT                                                    | 7-day expiry; 401/403 from any endpoint dispatches a frontend `auth:expired` event that clears session and prompts re-SIWE |
| Weak `JWT_SECRET` in production                                 | Config refuses to boot when `NODE_ENV=production` and `JWT_SECRET` is <32 chars or matches a known default                |
| Unbounded `auth_nonces` growth                                  | Hourly cron deletes expired nonces                                                                                        |
| Double-processing an event (live listener AND reconcile)        | Unique index on `(chain_id, block_number, tx_hash, log_index)` in `processed_events`                                      |
| Double-notifying for the same event                             | `idempotency_key = sha256(address || type || canonical(metadata))` with `ON CONFLICT DO NOTHING`                          |
| Cross-chain job-ID collision                                    | `chain_id` in every query; unique index is `(chain_id, chain_job_id, milestone_index)`                                    |

### 6.3 Known limitations

- **AI determinism**: AI models are non-deterministic. Two judges given the same evidence may reach different answers. This is a feature (diversity of reasoning) until the disagreement rate breaks quorum — monitored via the `NeedsReview` rate.
- **Prompt injection in deliverables**: a malicious freelancer could embed instructions in their deliverable doc. Mitigated by instructing judges to treat all user content as untrusted input, not as instructions. An audit layer that scores each judge's verdict against the known-good dispute pattern is Phase 6 scope.
- **IPFS availability**: Pinata's free tier may drop pins. Secondary pinning is a near-term roadmap item.
- **Contract upgradability**: contracts are non-upgradable by design. Redeploy + migrate is the upgrade path.

---

## 7. Data model

### 7.1 Key tables

| Table                | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `users`              | SIWE-authenticated addresses, optional profile                          |
| `auth_nonces`        | SIWE challenge nonces, hourly-pruned                                    |
| `jobs`               | Job records mirrored from on-chain `FreelanceEscrow.createJob`          |
| `milestones`         | Per-milestone state + deliverable IPFS URIs                             |
| `bids`               | Freelancer bids (stored off-chain only)                                 |
| `disputes`           | One row per disputed milestone; carries `pipeline_phase` for resumability |
| `judge_verdicts`     | One row per (dispute, judge) — salt, reasonHash, commitHash, outcome   |
| `notifications`      | Per-user events; dedup via `idempotency_key`                            |
| `dead_letter_events` | Events whose handler threw; replayed on boot and retried up to 5×       |
| `processed_events`   | Idempotency ledger for the reconcile path                               |
| `app_config`         | KV store — IPFS pending uploads, feature flags, etc.                    |

See [`backend/src/db/migrations/`](backend/src/db/migrations/) for the authoritative schema. Migrations are auto-discovered in lexical order; the migrator records applied filenames in `_migrations`.

### 7.2 Key indexes (migration 011)

```sql
idx_milestones_status            -- dashboard "active work" query
idx_bids_status                  -- client's "review bids" query
idx_disputes_status              -- orchestrator resume query
idx_jobs_status_chain            -- per-chain job list
idx_disputes_chain_scoped_unique -- (chain_id, chain_job_id, milestone_index) UNIQUE
idx_notifications_idem           -- dedup partial unique on idempotency_key
```

---

## 8. Performance targets

| Operation                            | Target    | Current  |
| ------------------------------------ | --------- | -------- |
| SIWE sign-in round-trip              | < 1s      | ~400ms   |
| Job create (frontend → tx confirmed) | < 30s     | ~15s     |
| Milestone submit                     | < 10s     | ~8s      |
| Dispute resolution end-to-end        | < 15 min  | ~11 min  |
| Dashboard load (cold)                | < 500ms   | ~300ms   |
| Event listener → DB row              | < 2s      | ~500ms   |

The dispute resolution target is dominated by the 5+5 min commit/reveal windows — those are configurable in `JudgeRegistry.setWindows()`.

---

## 9. Operational runbook

### 9.1 Bootstrapping a new chain

1. Add the chain to `contracts/hardhat.config.ts`.
2. `npx hardhat run scripts/deploy.ts --network <chainName>`. Copy the printed addresses.
3. Add a `CHAIN_N_*` block to `backend/.env` with the deployed addresses.
4. Fund the three judge wallets with gas on the new chain.
5. Register the judges on the new chain's `JudgeRegistry` (hardhat console).
6. Add the chain to `frontend/my-app/lib/chains.ts`.
7. Restart the backend — the new listener will start and reconcile from genesis (or whatever `block_number` you set in the chain config).

### 9.2 Rotating a judge wallet

1. Generate a new wallet.
2. On every deployed `JudgeRegistry`: `removeJudge(oldAddress); addJudge(newAddress)`.
3. Update `JUDGE_WALLET_PRIVATE_KEY_<N>` in `backend/.env` and restart.

Outstanding commits from the old wallet will fail reveal; the dispute falls to `NeedsReview`. Plan rotations to not overlap active disputes.

### 9.3 Recovering from a pipeline crash

The orchestrator is idempotent. On backend start:

- `resumePendingDisputes()` reloads any dispute in a non-terminal `pipeline_phase` and continues.
- `retryPendingIpfsUploads()` drains parked verdict docs from `app_config`.
- `replayDeadLetters()` replays failed event handlers (bounded by `retry_count < 5`).

If a dispute is stuck in `aborted`, that's a hard failure — manual intervention is needed. The `judge_verdicts` table preserves every commit so the on-chain state can be reconciled.

### 9.4 Health check

`GET /health` returns JSON:

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "rpc": "ok",
    "pinata": "ok"
  }
}
```

The RPC check iterates `config.chains` — a failed chain pokes `degraded` status and a 503.

---

## 10. Roadmap

| Phase | Scope                                                                           | Status     |
| ----- | ------------------------------------------------------------------------------- | ---------- |
| 1     | Critical bug fixes on v1 contracts                                              | Done       |
| 2     | Contract rewrite — multi-judge commit-reveal, deadline mechanics, reputation v2 | Done       |
| 3     | Initia Minitia EVM rollup + IBC cross-chain payments                            | Stubbed    |
| 4     | Three-judge backend pipeline                                                    | Done       |
| 5     | Frontend modernization (dashboard, notifications, mobile)                       | In progress |
| 6     | Grant packaging (whitepaper, demo, applications)                                | Active     |
| 7     | Professional contract audit + mainnet launch                                    | Future     |
| 8     | Reputation-weighted judge selection                                             | Future     |
| 9     | Human-review UI for `NeedsReview` escalations                                   | Future     |
| 10    | Protocol generalization — grant-program and bug-bounty adapters                 | Future     |

---

## 11. References

- Commit–reveal in Ethereum: [EIP-2929 gas cost rationale (discusses front-running)](https://eips.ethereum.org/EIPS/eip-2929)
- SIWE: [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361)
- Kleros dispute protocol (contrast case): [kleros.io/whitepaper.pdf](https://kleros.io/whitepaper.pdf)
- Initia Minitia documentation: [docs.initia.xyz](https://docs.initia.xyz)
- OpenZeppelin contracts (v5): [docs.openzeppelin.com/contracts/5.x](https://docs.openzeppelin.com/contracts/5.x)

---

## Appendix A — Judge provider interface

New judge providers implement:

```ts
// backend/src/services/judges/types.ts
export interface JudgeProvider {
  readonly name: string;
  readonly model: string;
  evaluate(ctx: DisputeContext): Promise<JudgeVerdict>;
}

export interface DisputeContext {
  chainId: number;
  chainJobId: bigint;
  milestoneIndex: bigint;
  clientAddress: string;
  freelancerAddress: string;
  jobTitle: string;
  jobDescription: string;
  milestoneDescription: string;
  deliverableUri: string;
  clientStatement?: string;
  freelancerStatement?: string;
}

export interface JudgeVerdict {
  winner: string;      // client or freelancer address
  reasoning: string;   // full text reasoning
  confidence: number;  // 0.0 – 1.0
}
```

The orchestrator handles everything after `evaluate` returns — salt generation, hashing, on-chain commit/reveal, IPFS pinning.

## Appendix B — Glossary

- **Commit–reveal**: A two-phase protocol where participants first publish a hash of their answer, then later reveal the pre-image. Prevents front-running and collusion.
- **Quorum**: Minimum number of reveals required for a valid verdict. Default 2 of 3.
- **NeedsReview**: Terminal state for a dispute that cannot be auto-resolved (tie, below-quorum, or consensus broken by missing reveals). Requires human arbitration.
- **Pipeline phase**: Off-chain state marker on a dispute row indicating which step of the orchestrator is in flight; used for crash recovery.
- **Dead-letter event**: An on-chain event whose handler threw an exception. Persisted for replay instead of being lost.
- **Idempotency key**: Deterministic hash of (recipient, event type, canonical metadata) used to de-duplicate notifications.
- **Minitia**: An Initia-launched EVM rollup. Prester's Phase 3 target.
- **SIWE**: Sign-In with Ethereum. The EIP-4361 authentication flow where a user signs a human-readable message instead of submitting a password.
