---
name: hono-framework-testing
description: Running and authoring tests in this hono-framework workspace — isolated PostgreSQL test databases, generated endpoint suites, test modes and the release gate. Use before declaring work done or when tests fail.
---

# Testing

## Setup and runs

Endpoint suites run against real PostgreSQL — never mocks. The workspace test env comes
from `.env.test` (`cp .env.test.example .env.test` once), which provides
`TEST_DATABASE_URL`. Each suite gets an isolated database from `@framework/testing`.

```sh
bun run db:up                 # compose: PostgreSQL + Redis
bun test                      # ./packages ./apps
bun test packages/crud        # one package
bun test -t 'pagination'      # by test name
```

`make:crud`-generated suites exercise create → list → read → update → delete → missing-read
plus malformed input, forbidden fields, allowlist exposure and pagination bounds. Auth
access adds 401/403 cases. Endpoint transport: `in-process` (default, faster) or `network`
(boots the HTTP listener).

## Authoring new tests

- Endpoint tests: import `createTestContext()` from the app's `tests/support.ts`
  (path recorded in the project adapter as `testSupport`). Follow the shape of generated
  suites in the module's `__tests__`.
- Authorization changes need positive **and** negative cases — a route that only asserts
  200-for-allowed is incomplete.
- Do not weaken generated assertions (allowlists, pagination bounds, malformed-input
  status codes) to make a test pass; that is a spec regression, not a fix.

## Release gate

Before declaring any change done, run and report:

```sh
bun run typecheck && bun run lint && bun run test
```

CLI/OpenAPI-affecting changes additionally pass `bun run cli -- openapi:check`. Generator
changes are covered by the end-to-end tests in `packages/cli/tests/` (they generate real
apps and run their suites). Full conventions: `docs/testing.md`.
