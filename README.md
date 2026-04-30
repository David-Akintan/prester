# Prester

**Decentralized freelance marketplace with AI-judge dispute resolution.** Milestone escrow on-chain, three-judge commit–reveal arbitration, multi-chain.

## Documentation

- **[DESCRIPTION.md](DESCRIPTION.md)** — what Prester is and why it exists.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — protocol spec, system design, security model.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to send a PR.
- **[CHANGELOG.md](CHANGELOG.md)** — release history.

---

## Repository layout

```
prester/
├── contracts/                 Hardhat — Solidity contracts + deploy scripts
│   ├── contracts/             FreelanceEscrow · JudgeRegistry · Reputation
│   ├── scripts/deploy.ts      Patches frontend addresses on each deploy
│   └── test/                  57 hardhat tests
├── backend/                   Express API + multi-judge orchestrator
│   ├── src/services/          Chain listeners, orchestrator, IPFS, notifications
│   └── src/db/migrations/     Auto-discovered SQL migrations
├── frontend/my-app/           Next.js 15 client (wagmi + viem + SIWE)
│   ├── app/                   App Router routes + colocated components
│   ├── lib/                   Chain registry, ABIs, API client, IPFS, NDA crypto
│   └── hooks/                 useAuth, useFreelancerDashboard, useNotifications, …
├── DESCRIPTION.md             One-page pitch
├── ARCHITECTURE.md            Technical whitepaper

```

Each subproject has its own `package.json` and runs independently.

---

## Prerequisites

- **Node.js** ≥ 20.x (tested on 20.11 and 22.x)
- **PostgreSQL** ≥ 14 (local or hosted — Supabase / Neon / RDS all work)
- **npm** ≥ 10
- **An EVM wallet with testnet funds** — used for deploying contracts and signing judge verdicts. Faucets: Sepolia, Celo Alfajores, Base Sepolia.
- **API keys**:
  - [Pinata](https://pinata.cloud) — IPFS pinning
  - [Anthropic](https://console.anthropic.com) — Claude judge
  - [Google AI Studio](https://aistudio.google.com) — Gemini judge
  - [Groq](https://console.groq.com) — Llama judge (free tier works)
  - RPC provider — public endpoints work; Alchemy or Infura recommended for mainnet

---

## Quickstart

Three terminals, three packages. Each step builds on the previous.

### 1. Clone and install

```bash
git clone <repo-url> prester
cd prester

(cd contracts && npm install)
(cd backend && npm install)
(cd frontend/my-app && npm install)
```

### 2. Deploy contracts (one chain at a time)

```bash
cd contracts
cp .env.example .env
# Set PRIVATE_KEY to a deployer wallet funded on the target chain
# (Sepolia faucet: https://sepoliafaucet.com/)

npx hardhat compile
npx hardhat test                           # 57 tests, should pass clean
npx hardhat run scripts/deploy.ts --network sepolia
# → patches frontend/my-app/lib/addresses.ts for chainId 11155111
```

Repeat for any other target network (`celoAlfajores`, `baseSepolia`, `celo`, `base`). Each deploy patches only its own slot — addresses for other chains are preserved.

After deploy, register the three judge wallets and set the quorum (see step 3).

#### `contracts/.env`

```env
PRIVATE_KEY=0x...              # Deployer wallet, must have gas on the target chain
SEPOLIA_RPC_URL=               # Optional — defaults to a public endpoint
CELO_ALFAJORES_RPC_URL=
BASE_SEPOLIA_RPC_URL=
CELO_RPC_URL=
BASE_RPC_URL=
ETHERSCAN_API_KEY=             # For verify (Etherscan V2 covers Sepolia + Base)
CELOSCAN_API_KEY=              # Separate — Celo isn't in Etherscan V2
```

### 3. Set up the backend

```bash
cd backend
cp .env.example .env
# Edit .env — see reference below
npm run migrate                            # Auto-discovers src/db/migrations/*.sql
npm run dev
# → API on http://localhost:4000
```

#### Generate and register judge wallets

```bash
# One wallet per AI provider (3 total)
node -e "const {ethers}=require('ethers');for(let i=1;i<=3;i++){const w=ethers.Wallet.createRandom();console.log(\`JUDGE_WALLET_PRIVATE_KEY_\${i}=\${w.privateKey}  # \${w.address}\`)}"
```

Paste into `backend/.env`. Fund each address with ~0.01 test ETH on every chain you deployed to (they pay gas to commit + reveal). Then register them:

```bash
cd contracts
npx hardhat console --network sepolia
> const r = await ethers.getContractAt("JudgeRegistry", "<JudgeRegistry_addr>")
> await r.addJudge("<wallet1_addr>")
> await r.addJudge("<wallet2_addr>")
> await r.addJudge("<wallet3_addr>")
> await r.setQuorum(2)                    // 2-of-3 majority
```

#### `backend/.env` (minimal)

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000

DATABASE_URL=postgres://user:pass@localhost:5432/prester
JWT_SECRET=                                # openssl rand -hex 32
APP_DOMAIN=localhost:3000
APP_ORIGIN=http://localhost:3000

# Multi-chain — one CHAIN_N_* block per deployed chain (up to 10)
CHAIN_1_NAME=sepolia
CHAIN_1_CHAIN_ID=11155111
CHAIN_1_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CHAIN_1_WS_URL=wss://ethereum-sepolia-rpc.publicnode.com
CHAIN_1_ESCROW_ADDRESS=0x...
CHAIN_1_JUDGE_REGISTRY_ADDRESS=0x...

# Judge wallets — one per provider
JUDGE_WALLET_PRIVATE_KEY_1=0x...
JUDGE_WALLET_PRIVATE_KEY_2=0x...
JUDGE_WALLET_PRIVATE_KEY_3=0x...

# AI providers
ANTHROPIC_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=

# IPFS
PINATA_JWT=
```

Full reference: [`backend/.env.example`](backend/.env.example).

### 4. Start the frontend

```bash
cd frontend/my-app
cp .env.example .env.local                # if present, otherwise create below
npm run dev
# → http://localhost:3000
```

#### `frontend/my-app/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
# Optional — only needed once the Initia rollup is live
NEXT_PUBLIC_MINITIA_CHAIN_ID=
NEXT_PUBLIC_MINITIA_RPC_URL=
NEXT_PUBLIC_MINITIA_WS_URL=
NEXT_PUBLIC_MINITIA_EXPLORER_URL=
```

The frontend reads deployed contract addresses directly from [`frontend/my-app/lib/addresses.ts`](frontend/my-app/lib/addresses.ts) — no env var needed for those.

---

## Architecture at a glance

```
┌────────────────┐   SIWE       ┌──────────────────┐  on-chain  ┌──────────────────┐
│  Next.js app   │ ───────────▶ │ Express API      │ ─────────▶ │ FreelanceEscrow  │
│  (wagmi/viem)  │   REST       │ + event listener │   events   │ + JudgeRegistry  │
│                │ ◀─────────── │                  │ ◀───────── │ + Reputation     │
└────────────────┘              └──────────────────┘            └──────────────────┘
                                         │
                                         ▼
                               ┌──────────────────────┐
                               │ Multi-judge          │
                               │  orchestrator        │
                               │  ├── Claude          │
                               │  ├── Gemini          │
                               │  └── Groq            │
                               │                      │
                               │ commit → reveal →    │
                               │ tally → IPFS-pin     │
                               └──────────────────────┘
```

Full protocol spec, security model, and runbook in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Adding a new chain

Adding a chain is a one-entry change in each of three files. To add Arbitrum Sepolia (`421614`):

1. **Frontend** — [`frontend/my-app/lib/chains.ts`](frontend/my-app/lib/chains.ts): add `arbitrumSepolia` (from `viem/chains`) to `CHAIN_REGISTRY`.
2. **Contracts** — [`contracts/hardhat.config.ts`](contracts/hardhat.config.ts): add an `arbitrumSepolia` network entry plus an `etherscan.customChains` entry. Run `npx hardhat run scripts/deploy.ts --network arbitrumSepolia`.
3. **Backend** — [`backend/.env`](backend/.env.example): add a `CHAIN_N_*` block with the chainId, RPC, WS, and deployed addresses. The backend auto-discovers up to 10 chain blocks.

The frontend's chain switcher, the backend listener spawner, the SIWE validator, and the block-explorer links all derive from these three sources. Nothing else needs editing.

---

## Common workflows

### Run all tests

```bash
(cd contracts && npx hardhat test)
(cd backend && npm test)                  # vitest
(cd frontend/my-app && npm run lint && npm run type-check && npm test)
```

### Create a database migration

Drop a file in [`backend/src/db/migrations/`](backend/src/db/migrations/) named `NNN_short_name.sql`. The migrator auto-discovers `*.sql` files in lexical order — do not hardcode the filename anywhere.

```bash
cd backend
npm run migrate
```

### Debug a stuck dispute

1. Tail [`backend/src/services/chainListener.ts`](backend/src/services/chainListener.ts) logs to confirm the events arrived.
2. Inspect the `disputes` and `judge_verdicts` tables — `pipeline_phase` shows where the orchestrator stopped.
3. Failed event handlers land in `dead_letter_events` — restart the backend and `replayDeadLetters()` reruns them (bounded by `retry_count < 5`).
4. Verdict docs that failed to pin are parked in `app_config` under `ipfs_pending_verdict_<disputeId>` — the 10-minute retry cron drains them.

### Verify contracts on a block explorer

```bash
cd contracts
npx hardhat verify --network sepolia <contractAddress> "<constructorArg1>" ...
```

Etherscan V2 covers Sepolia, Base, and their mainnets. Celo needs `CELOSCAN_API_KEY` separately.

---

## Troubleshooting

**"Failed to start server"** — Check that `DATABASE_URL` reaches Postgres, `JWT_SECRET` is set, and at least one `CHAIN_N_*` block is configured.

**Migrations error "relation already exists"** — The schema is partially applied but `_migrations` is empty. Manually `INSERT INTO _migrations (filename) VALUES ('001_initial.sql'), …` for each migration already present, then re-run `npm run migrate`.

**SIWE sign-in fails with "chainId not supported"** — The wallet is on a chain not in the backend's `config.chains`. Either switch chains or add a matching `CHAIN_N_*` block.

**"No chains configured" warning at boot** — `backend/.env` has no `CHAIN_N_*` block. Set at least `CHAIN_1_*` for the chain you deployed to.

**Judge commits fail with "insufficient funds"** — Fund `JUDGE_WALLET_PRIVATE_KEY_{1,2,3}` with gas on every chain the backend listens to.

**Pinata 429** — Free-tier rate limit. The orchestrator retries 3× with exponential backoff, then parks the verdict doc in `app_config` for the 10-minute retry cron.

---

## Contributing

Contributions welcome. Open an issue before sending a large PR. The judge provider interface ([`backend/src/services/judges/types.ts`](backend/src/services/judges/types.ts)) is the friendliest entry point — adding a new model is around 50 lines. Full guide: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT.
