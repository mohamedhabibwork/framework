# Contributing

## Setup

```sh
bun install
bun run db:up            # local Postgres (54329) + Redis (63799)
cp .env.test.example .env.test
bun run typecheck && bun run lint && bun run test
```

Tests run against real PostgreSQL and Redis (`bun run test`); endpoint tests
create and drop isolated `fw_test_*` databases automatically.

## Conventions

- **Commits:** conventional commits (`feat:`, `fix:`, `docs:`, `chore:`) —
  the changelog and release notes are generated from them.
- **Status honesty:** every feature lands with tests (`docs/status.md`
  distinguishes validated / implemented / planned). A feature without a
  passing test is "implemented", never "validated".
- **Architecture decisions** are recorded in `docs/architecture/decisions.md`.
- **Guides** live in `apps/docs/src/content/docs/`; code samples must match
  real exports.

## Releases

Maintainers cut releases with `bun run release -- <version>` (gates on a
clean tree and green checks, bumps the version pins, updates
`CHANGELOG.md`, tags, and snapshots the docs on pre-1.0 minor bumps).
Pushing the tag publishes the GitHub Release.
