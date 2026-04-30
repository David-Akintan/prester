# Contributing to the Prester frontend

Thanks for your interest in contributing. This directory contains the Next.js 15 client for Prester. Contributions of any size are welcome — bug fixes, UI polish, new chain entries, accessibility improvements, test coverage.

For backend or smart-contract contributions, see the `backend/` and `contracts/` packages in the parent monorepo — they have their own conventions.

## Getting started

1. **Fork and clone** the repository.
2. From this directory:
   ```bash
   npm install
   npm run dev      # http://localhost:3000
   ```
3. **Create a branch** from `main`: `git checkout -b feat/short-description`.

The frontend talks to a Prester backend at `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) and reads from on-chain contracts via the RPCs registered in [`lib/chains.ts`](lib/chains.ts). For full setup of those upstream services, see the root [README.md](README.md).

## Development workflow

```bash
npm run dev          # http://localhost:3000
npm run lint         # ESLint (Next config)
npm run lint:fix     # auto-fix
npm run type-check   # tsc --noEmit (also runs as prebuild)
npm test             # Vitest
npm run test:watch   # interactive
npm run format       # Prettier across ts/tsx/json/md/css
```

`npm run build` runs `type-check` first via `prebuild` — a build that fails locally will fail in CI for the same reason.

## Pull requests

- Keep PRs focused — one feature or fix per PR.
- Open an issue first for anything larger than a small fix so we can align on approach before you build.
- Ensure `npm run lint`, `npm run type-check`, and `npm test` all pass before pushing.
- Write a clear PR description explaining the *why*, not just the *what*. Screenshots or short clips are appreciated for UI changes.

## Code conventions

- **TypeScript everywhere.** No `any` unless you can explain why in a comment.
- **Server components by default.** Mark with `"use client"` only when you need state, effects, wallet hooks, or browser APIs.
- **No hardcoded chain IDs or contract addresses in components.** Read from [`lib/chains.ts`](lib/chains.ts) and [`lib/addresses.ts`](lib/addresses.ts).
- **API calls go through [`lib/api.ts`](lib/api.ts).** It handles JWT injection, 401 → silent re-auth dispatch, and error shaping. Don't `fetch()` the backend directly from a component.
- **On-chain calls go through [`lib/contracts.ts`](lib/contracts.ts).** New write functions follow the existing `(signer, …, chainId?)` signature.
- **Tailwind for styling.** Reuse the primitives in `app/components/ui` rather than introducing a new component library.
- **Files use `.tsx` for components, `.ts` for plain modules.** Two-space indentation. Prettier is the source of truth — run `npm run format` before pushing.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) where possible:

```
feat: add Arbitrum Sepolia support
fix: handle missing RPC URL in rpcFor
chore: bump Next.js to 16.x
docs: clarify wagmi connector setup
```

## Adding a new chain

The frontend is designed so that adding an EVM chain is a one-entry change. To add Arbitrum Sepolia (`421614`), for example:

1. Import `arbitrumSepolia` from `viem/chains` (or `defineChain` it inline) in [`lib/chains.ts`](lib/chains.ts) and append an entry to `CHAIN_REGISTRY`.
2. Add the deployed contract addresses to [`lib/addresses.ts`](lib/addresses.ts) under the new chain's id (the `contracts/scripts/deploy.ts` script in the parent repo writes this for you).
3. That's it on the frontend — wagmi's chain list, the `ChainSwitcher`, the block-explorer links, and the per-chain accent colors all derive from `CHAIN_REGISTRY`.

The backend needs a matching `CHAIN_N_*` env block before SIWE on the new chain will succeed. See the root README for the upstream change.

## Testing

- Unit tests live next to the code they cover (`*.test.ts` / `*.test.tsx`) and run under jsdom via Vitest.
- Mock the wallet by stubbing the `useAccount` / `useChainId` / `useSignMessage` returns from `wagmi`.
- For SIWE flows, mock `lib/api.ts` rather than `fetch` — the API client owns the JWT lifecycle.
- For pure utility functions in `lib/`, prefer node-style tests with no DOM.

## Reporting bugs

Open an issue at https://github.com/David-Akintan/prester/issues with:

- Steps to reproduce (URL, wallet state, chain selected, what you clicked).
- Expected vs actual behavior, including any console errors or failed network requests.
- Browser + extension versions (MetaMask version matters for wallet-related bugs).
- Whether the same bug reproduces on another chain — multi-chain regressions are a frequent shape.

## Code of conduct

Be kind. Disagree on technical merits, not on people. Assume good faith.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
