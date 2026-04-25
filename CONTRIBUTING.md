# Contributing to Prester

Thanks for your interest in contributing. Prester is a multi-chain decentralized freelance marketplace, and contributions of all kinds are welcome — from bug reports to new chain integrations.

## Getting started

1. **Fork and clone** the repository.
2. **Install dependencies** — see [README.md](README.md) for the full setup (frontend, backend, contracts).
3. **Create a branch** from `main` for your work: `git checkout -b feat/short-description`.

## Development workflow

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # ESLint
npm run type-check   # TypeScript
npm test             # Vitest
```

## Pull requests

- Keep PRs focused — one feature or fix per PR.
- Open an issue first for anything larger than a small fix so we can align on approach before you build.
- Make sure `npm run lint` and `npm run type-check` pass before pushing.
- Write a clear PR description explaining the *why*, not just the *what*.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) where possible:

```
feat: add Arbitrum Sepolia support
fix: handle missing RPC URL in rpcFor
chore: bump Next.js to 16.x
docs: clarify judge wallet setup
```

## Adding a new chain

The frontend is designed so that adding a chain is a one-entry change in `lib/chains.ts`. See the *"Adding a new chain"* section in [README.md](README.md) for the full three-file procedure.

## Reporting bugs

Open an issue at https://github.com/David-Akintan/prester/issues with:

- Steps to reproduce
- Expected vs actual behavior
- Browser / Node version
- Wallet + chain you were on (if relevant)

## Code of conduct

Be kind. Disagree on technical merits, not on people. Assume good faith.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
