# Changelog

All notable changes to the Prester frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- MIT `LICENSE`, `CONTRIBUTING.md`, and `SECURITY.md`.
- `engines`, `repository`, `homepage`, `bugs`, `keywords`, `author`, `license` fields in `package.json`.
- `format`, `lint:fix`, `clean`, and `prebuild` scripts in `package.json`.

## [0.2.0] - 2026-04-25

### Added
- `ThemeProvider` context and theme toggle for light/dark mode.
- `/api/health` endpoint for service availability monitoring.
- `highlight` semantic color token in Tailwind config.

### Fixed
- TypeScript build error in `lib/contracts.ts` where `rpcFor` could return `string | undefined`.
- TypeScript build error in `lib/config.ts` where `CONTRIBUTING_ADDRESSES` could be `undefined`.

## [0.1.0] - 2026-03

### Added
- Initial Next.js 16 frontend.
- Multi-chain support: Sepolia, Celo Alfajores, Celo Sepolia, Base Sepolia, Celo, Base, Initia Minitia EVM.
- Wagmi + viem wallet integration with SIWE.
- Job creation, bidding, milestone submission, dispute, and judge verdict UI flows.
- IPFS upload via Pinata for job metadata and deliverables.
