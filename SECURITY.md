# Security Policy

## Supported versions

Only the `main` branch receives security updates. Prester is pre-1.0; no LTS branches are maintained.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Email **akintandavid96@gmail.com** with:

- A clear description of the vulnerability
- Steps to reproduce (a proof-of-concept is appreciated but not required)
- The affected component (frontend, backend, smart contract, judge orchestrator)
- Your assessment of impact (funds at risk, data exposure, DoS, etc.)

You should expect an acknowledgment within **72 hours** and a status update within **7 days**.

## Scope

In scope:

- Smart contracts in [`contracts/`](https://github.com/David-Akintan/prester/tree/main/contracts) — escrow, dispute, judge registry, reputation
- Backend API and event listener — auth, signature verification, event ingestion, judge orchestration
- Frontend — wallet handling, SIWE flow, on-chain transaction construction
- Judge wallet key management

Out of scope:

- Issues in third-party dependencies — report upstream
- Social engineering against project maintainers
- Vulnerabilities requiring a compromised user device or wallet
- Rate-limiting on public RPC endpoints we don't operate

## Disclosure

We follow coordinated disclosure. Once a fix is shipped and users have had a reasonable upgrade window, we'll publish an advisory crediting the reporter (unless you prefer to remain anonymous).

## Bounty

Prester does not currently run a paid bounty program. We will publicly credit reporters of valid issues in advisories and the changelog.
