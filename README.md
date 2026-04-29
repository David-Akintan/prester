# Prester

Decentralized freelance marketplace with AI-judge dispute resolution. Milestone escrow on-chain, three-judge commit–reveal arbitration, multi-chain.

[Full project description](DESCRIPTION.md) · [Architecture & whitepaper](ARCHITECTURE.md) · [Contribute to Prester](CONTRIBUTING.md)

---

## Quick Start (Frontend Only)

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## Repository layout

```
prester/
├── contracts/        Hardhat project — Solidity contracts + deploy scripts
├── backend/          Express API + multi-judge orchestrator + event listeners
├── frontend/my-app/  Next.js 15 client (wagmi + viem + SIWE)
├── DESCRIPTION.md    One-page pitch
├── ARCHITECTURE.md   Technical whitepaper
└── PHASE*_CHECKPOINT.md  Historical milestone notes
```

Each subproject has its own `package.json` and runs independently.

---

## Prerequisites

- **Node.js** ≥ 20.x (tested on 20.11, 22.x)
- **PostgreSQL** ≥ 14 (local or Supabase/Neon/RDS)
- **npm** ≥ 10
- **An EVM wallet with testnet funds** for deploying contracts and signing judge verdicts (EVM Compatible Wallet + Sepolia / Celo Alfajores / Base Sepolia faucets)
- **API keys**:
  - [Pinata](https://pinata.cloud) (IPFS pinning)
  - [Anthropic](https://console.anthropic.com) (Claude judge)
  - [Google AI Studio](https://aistudio.google.com) (Gemini judge)
  - [Groq](https://console.groq.com) (Llama judge, free tier)
  - RPC provider — public endpoints work; Alchemy/Infura recommended for mainnet

---

## Quickstart — local development

Three terminals. Each step builds on the previous.

### 1. Clone & install

```bash
git clone <repo-url> prester
cd prester

# Install workspace deps
(cd contracts && npm install)
(cd backend && npm install)
(cd frontend/my-app && npm install)
```

### 2. Deploy contracts (one chain at a time)

```bash
cd contracts
cp .env.example .env        # if .env.example exists; otherwise see below
# Fill PRIVATE_KEY with a deployer wallet funded on your target chain
# (Sepolia faucet: https://sepoliafaucet.com/)

npx hardhat compile
npx hardhat test             # 57 tests, should pass clean

npx hardhat run scripts/deploy.ts --network sepolia
# → writes FreelanceEscrow + JudgeRegistry + Reputation addresses to
#   frontend/my-app/lib/addresses.ts for chainId 11155111
```

Repeat for any other target network (`--network celoAlfajores`, `baseSepolia`, `celo`, `base`). The deploy script only patches its own chain's slot — other chains' addresses are preserved.

After deployment, register the 3 judge wallets (see "Judge wallets" below) and set the quorum.

#### `contracts/.env` vars

```env
PRIVATE_KEY=0x...              # Deployer wallet (needs gas on target chain)
SEPOLIA_RPC_URL=               # Optional — defaults to public
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
# Edit .env — see the reference section below
npm run migrate                 # Auto-discovers all migrations in src/db/migrations/
npm run dev
# → API listening on http://localhost:4000
```

#### Generate judge wallets

```bash
# Create three wallets — one per AI provider
node -e "const {ethers}=require('ethers');for(let i=1;i<=3;i++){const w=ethers.Wallet.createRandom();console.log(\`JUDGE_WALLET_PRIVATE_KEY_\${i}=\${w.privateKey}  # \${w.address}\`)}"
```

Paste the output into `backend/.env`. Fund each address with ~0.01 test ETH on every chain you deployed to (they need gas to submit commits/reveals). Then register them:

```bash
cd contracts
npx hardhat console --network sepolia
> const r = await ethers.getContractAt("JudgeRegistry", "<your_JudgeRegistry_addr>")
> await r.addJudge("<wallet1_addr>")
> await r.addJudge("<wallet2_addr>")
> await r.addJudge("<wallet3_addr>")
> await r.setQuorum(2)           // 2-of-3 majority
```

#### `backend/.env` reference

Minimum viable dev config:

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000

DATABASE_URL=postgres://user:pass@localhost:5432/prester
JWT_SECRET=                     # openssl rand -hex 32
APP_DOMAIN=localhost:3000
APP_ORIGIN=http://localhost:3000

# Multi-chain — one CHAIN_N_* block per deployed chain
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

See [backend/.env.example](backend/.env.example) for the full list.

### 4. Start the frontend

```bash
cd frontend/my-app
cp .env.example .env.local   # if present; otherwise create below
npm run dev
# → http://localhost:3000
```

#### `frontend/my-app/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
# Optional — only needed when the Initia rollup goes live
NEXT_PUBLIC_MINITIA_CHAIN_ID=
NEXT_PUBLIC_MINITIA_RPC_URL=
NEXT_PUBLIC_MINITIA_WS_URL=
NEXT_PUBLIC_MINITIA_EXPLORER_URL=
```

The frontend reads deployed contract addresses directly from [`frontend/my-app/lib/addresses.ts`](frontend/my-app/lib/addresses.ts) — no env var needed for those.

---

## Adding a new chain

Prester is designed so that adding a chain is a one-entry change in each of three files. For example, to add Arbitrum Sepolia (421614):

1. **Frontend** — [`frontend/my-app/lib/chains.ts`](frontend/my-app/lib/chains.ts): add `arbitrumSepolia` (from `viem/chains`) to `CHAIN_REGISTRY`.
2. **Contracts** — [`contracts/hardhat.config.ts`](contracts/hardhat.config.ts): add an `arbitrumSepolia` network entry + `etherscan.customChains` entry. Run `npx hardhat run scripts/deploy.ts --network arbitrumSepolia`.
3. **Backend** — [`backend/.env`](backend/.env.example): add a `CHAIN_N_*` block with the chainId, RPC, WS, and deployed addresses. The backend auto-discovers up to 10 chain blocks.

The frontend's chain switcher, backend event listener spawner, SIWE validator, and block-explorer links all derive from these three sources. No other file needs editing.

---

## Common workflows

### Running tests

```bash
(cd contracts && npx hardhat test)
(cd backend && npm test)          # vitest
(cd frontend/my-app && npm run lint && npx tsc --noEmit)
```

### Creating a new DB migration

Drop a file in [`backend/src/db/migrations/`](backend/src/db/migrations/) named `NNN_short_name.sql`. The migrator auto-discovers `*.sql` files in lexical order. Do NOT hardcode the filename anywhere.

```bash
cd backend
npm run migrate
```

### Debugging a dispute

1. Check [`backend/src/services/chainListener.ts`](backend/src/services/chainListener.ts) logs — events that arrived.
2. Check the `disputes` + `judge_verdicts` Postgres tables for `pipeline_phase` state.
3. Failed events land in `dead_letter_events` — restart the backend and they replay (`replayDeadLetters` in `server.ts`).
4. Verdict docs that failed to pin live in `app_config` under key `ipfs_pending_verdict_<disputeId>` — the 10-min cron retries them.

### Verifying contracts

```bash
cd contracts
npx hardhat verify --network sepolia <contractAddress> "<constructorArg1>" ...
```

Etherscan V2 API key handles Sepolia + Base (mainnet + sepolia). Celo needs `CELOSCAN_API_KEY`.

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

Full architecture and protocol spec in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Troubleshooting

**"Failed to start server"** — Check `DATABASE_URL` reaches Postgres, JWT*SECRET is set, and at least one `CHAIN_N*\*` block is configured.

**Migrations error "relation already exists"** — Your schema is partially applied but `_migrations` is empty. Manually `INSERT INTO _migrations (filename) VALUES ('001_initial.sql'), …` for each migration already present, then re-run `npm run migrate`.

**SIWE sign-in fails with "chainId not supported"** — Your wallet is on a chain that isn't in the backend's `config.chains`. Either switch chains or add a `CHAIN_N_*` block for it.

**"No chains configured" warning at boot** — You haven't set any `CHAIN_N_*` block in `backend/.env`. Set at least `CHAIN_1_*` for the chain you deployed to.

**Judge commits fail with "insufficient funds"** — Fund `JUDGE_WALLET_PRIVATE_KEY_{1,2,3}` with gas on every chain you listen to.

**Pinata 429** — Free-tier rate limit. The orchestrator retries 3× with exponential backoff, then parks the verdict doc in `app_config` for the 10-min retry cron.

---

## License

MIT.

## Contributing

Contributions welcome. Open an issue before sending a large PR. The judge provider interface ([`backend/src/services/judges/types.ts`](backend/src/services/judges/types.ts)) is the friendliest entry point — adding a new model is ~50 lines.
