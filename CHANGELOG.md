# Changelog

All notable changes to the framework are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
releases are tagged `vX.Y.Z` in git and every pre-1.0 minor release freezes a
documentation snapshot (see the [docs versions page](apps/docs/src/content/docs/versions.mdx)).
Rendered release notes live at [framework.habib.cloud/releases](https://framework.habib.cloud/releases/).

## [Unreleased]

### Changed

- The documentation site deploys on Dokploy instead of Cloudflare Workers:
  `apps/docs/Dockerfile` builds the static Starlight output with Bun and
  serves it from nginx (immutable `/_astro` caching, security headers,
  `/404.html`); Dokploy rebuilds it on every push to `main`. The Cloudflare
  adapter, `wrangler.jsonc`, the `docs:deploy` script and the wrangler CI
  deploy job are removed — CI now builds the image instead.

## [0.2.0] — 2026-10-27

### Tests

- New direct suites for `@framework/validation` (envelope shape, field-path
  rendering, 403-before-422 ordering, async authorization hooks) and
  `@framework/testing` (missing-URL contract, create/drop idempotence,
  production and application-URL guards, migration application, cleanup on
  failure). Deepened `scheduler` (fire-payload bounds, TTL clamps, replace
  overlap, direct fire-job rejection) and `events` (channel validation,
  schema round-trip, dispatch error reporting, realtime fan-in, subscription
  limits). 379 → 427 tests.
- `@framework/ai-mcp`: tests moved to `packages/ai-mcp/tests` (now covered by
  `bun run typecheck`) and extended to command admission, argument
  validation, banned-flag stripping, envelope fallbacks, docs-search clamping
  and the published `checks` schema.
- Queue retry/timeout tests use scheduler-tolerant margins (50ms backoff,
  200ms timeout against a 2s handler) so the suite stays deterministic under
  coverage instrumentation and parallel load.

### Fixes

- `@framework/ai-mcp`: the `checks` tool declares `kind` as required in its
  published schema (it was optional but required in practice); the MCP server
  reports the application's framework version instead of a hardcoded
  `0.1.0`; `searchDocs` honors a zero limit as zero matches.
- Removed stale `@framework/testing` devDependencies from five packages that
  never imported it (cache, logging, mail, notifications, storage).

### Features

- Seven more Laravel-style generators moved from planned to implemented:
  `make:mail` (typed mailable with HTML-escaped interpolation and a send
  helper), `make:notification` (`--channels`, one builder per channel),
  `make:command` (application commands in `app/commands`, appended to the
  catalog in `bin/cli.ts`; new `app` command group), `make:schedule`
  (`--job`/`--workflow`, validated five-field cron, `@framework:schedules`
  registry), `make:guard` (header-credential `ActorResolver`),
  `make:user-provider` (`UserProvider` decorating `DatabaseUserProvider`) and
  `make:migration` (empty custom SQL migration via `drizzle-kit generate
  --custom`). Package-importing generators refuse when the app lacks the
  dependency. Covered by the scaffold-generator gate (input validation,
  registry wiring, generated command execution, journal entry, typecheck).
- The playground depends on `@framework/mail` and `@framework/notifications`
  and its schedule registry carries the `@framework:schedules` marker.

- Thirteen scaffold generators moved from planned to implemented:
  `make:schema`, `make:repository`, `make:dto`, `make:request`, `make:response`,
  `make:service`, `make:controller`, `make:policy`, `make:middleware`,
  `make:provider`, `make:event`, `make:listener` and `make:test`. The eight
  resource slices render through the `make:crud` pipeline (byte-identical
  single artifacts, actionable prerequisite errors, `--module`/`--table`
  overrides); the runtime scaffolds register through app markers — a new
  `@framework:middleware` alias marker and an `app/listeners` registry
  (consumed by a generated `listenersProvider` subscribing at boot) join the
  existing `@framework:providers`/`@framework:schema-exports` markers in
  generated apps and the playground. Gate-tested as a batch
  (`packages/cli/tests/generators.test.ts`: dry-run byte-neutrality, conflict
  refusal, registration visible to `module:list`/`middleware:list`/
  `db:generate`, one typecheck over all generated code).
- Per-status OpenAPI error schemas: every declared error status emits an
  `ErrorEnvelope<status>` component whose `code` is the exact
  `ERROR_CATALOG` enum for that status (422 additionally carries `fields`).
  The catalog moved to `@framework/core` (re-exported from
  `@framework/http` unchanged) so `@framework/openapi` derives the enums
  without a dependency on the HTTP kernel; `ErrorStatusCode` now also covers
  405/415/503. Generated specs with a committed snapshot will report drift
  once — regenerate with `openapi:generate`.
- Coverage gate: `bun run coverage` runs the whole suite with lcov coverage,
  aggregates per package and enforces line/function thresholds
  (scripts/coverage.ts; `--report` measures without enforcing). Test files
  and template-literal generator files are excluded via `bunfig.toml`; CI now
  runs the gate in place of the bare test step.
- AI integration layer: `@framework/ai-mcp`, a Model Context Protocol server
  that bridges the application CLI in-process (embeddable `runCli`, no child
  process, `--json --no-interaction` enforced) and exposes structured tools
  for discovery, scaffolding (`crud_scaffold`, `auth_install`), database
  lifecycle, queues, workflows, OpenAPI, project checks and whitelisted
  documentation search/read — plus `fwdocs://` resources. Registered via
  `.mcp.json`; documented in `docs/ai.md`.
- Project agent skills under `.zcode/skills/` (`hono-framework`,
  `hono-framework-crud`, `hono-framework-auth`, `hono-framework-testing`,
  `hono-framework-ops`) encoding the workspace conventions: the envelope
  contract, migration discipline, generator ownership rules, auth defaults
  and the release gate.
- Application CLI entries (`create` template and the playground) now export
  their `project` adapter and only execute under `import.meta.main`, making
  generated apps embeddable by AI tooling while behaving identically as
  CLIs.
- Email verification: single-use hashed tokens (`account_tokens`),
  `verified()` middleware, `/auth/email/*` endpoints, delivery via app
  notifier hooks.
- Password recovery: no user enumeration (identical 202 responses),
  constant-time verification, token supersession, and full credential
  rotation on reset (every session and API token revoked).
- Two-step login (TOTP, RFC 6238 §5 SHA-256 variant) with one-time recovery
  codes: enrollment with first-code activation, challenge-based second factor
  (`{ twoStep, challenge }` from `/auth/login`), and per-login-attempt code
  verification.
- JWT guard over `jose`: RS/ES/PS/EdDSA verification against a remote JWKS
  (rotation-aware `kid` lookup) or inline key set, `iss`/`aud` checks,
  scope/abilities claim mapping, plugged into `resolveActor` via
  `auth.guards: ['jwt']`.
- Row-level ownership: `ownedBy('userId')` scopes every service operation to
  the acting user — cross-owner access is 404, writes stamp the owner,
  owner-less scopes see nothing.
- `db:fresh` (drop + re-migrate with a production guard) and `db:seed`
  (`defineSeeder`/`defineFactory` shared with tests) lifecycle commands.
- Queue management commands `queue:pause`, `queue:resume`, `queue:failed`,
  `queue:retry`, `queue:retry-all`, `queue:forget`, `queue:prune` over the
  QueueManager surface.
- `build` command compiling production binaries with `bun build --compile`
  (optional storage/notifications peer SDKs kept external).
- `make:job`, `make:seeder` and `make:factory` generators on the shared
  plan/conflict/dry-run pipeline, registered via markers.
- `DiskExportStore`: export artifacts through any `@framework/storage` disk
  (s3/r2/minio) for multi-node deployments, alongside the local store.
- Generated apps ship a multi-stage Bun `Dockerfile`, compose services for
  `server`/`worker` (profile `app`) with healthchecks, and a `/health/ready`
  probing database, Redis and the queue.
- Duplicate-route detection catches the same handler (e.g. a sub-app)
  mounted twice back to back — the previous blind spot.

### Security

- Guardable admin route families (`workflowRoutes`, `auditRoutes`,
  `importExportRoutes`) now require mount-time authorization: a guard
  callback, ready-made auth middleware (`requireAuth()`,
  `requireAbility(...)`) or the explicit `'public'` opt-out. Guards run
  before validation, so anonymous callers get 401/403 instead of schema
  disclosure through 422 field errors.
- The HTTP kernel ships strict security headers by default
  (`STRICT_SECURE_HEADERS`: CSP, HSTS, frame-deny, no-referrer, COOP/CORP)
  with a config knob (`http.secureHeaders`), and config-driven CORS
  (`http.corsOrigins`, off by default).
- Generic `throttle` middleware over the cache rate limiter (structural
  contract — no new dependency), wired as an `api` group alias with
  `http.throttle` config knobs and 429 + `Retry-After` responses.

### Documentation

- status.md rows moved to Validated/implemented for every delivered item;
  remaining planned commands documented with the forward-only migration
  decision.

## [0.1.0] — 2026-10-04

First tagged release: the full Laravel-inspired framework on Bun + Hono +
Drizzle + Zod, from the initial workspace scaffolding through the kit-backed
subsystems and the Starlight documentation site. See the
[release notes](apps/docs/src/content/docs/releases.mdx) for the highlight tour.

### Features

- Generated apps ship kit-backed subsystems and CLI hooks
- Kit-backed cache, logging and storage live end to end in the playground
- Push and messaging channels over NotifyKit
- Explicit-channel notifications over mail and queue
- Infrastructure commands `cache:clear`, `storage:check`, `session:prune`
- Login rate limiting over the cache rate limiter
- Structured logging over LoggerKit
- Message/transport mail with redacted console and memory transports
- BullMQ transport routed through QueueKit
- Storage disks over StorageKit with multi-driver config
- Cache, locks and rate limiting over CacheKit
- Starlight documentation site
- Reference application exercising the framework
- Project runtime, generators and operational commands
- Sessions, personal API tokens, guards and auth endpoints
- Generic resource layer, audit routes and import/export
- Cron scheduling on BullMQ job schedulers
- Durable workflow, pipeline, stage and action engine
- BullMQ dispatch, worker and batches
- Event bus, realtime hub and websocket gateway
- OpenAPI 3.1 generation and route drift check
- Laravel-style helpers as imported functions
- Isolated database and loopback test harness
- Connections, transactions, mixins, audit and migrations
- Zod validation and form requests
- Kernel, error envelope, middleware registry, policies and auth plumbing
- Container, config, lifecycle and execution context

### Documentation

- Kit-backed subsystems end to end (playground, generated apps, notifications channels)
- Phase 4 delivered — kit-adapter packages, ADR-11, command catalog
- Framework specification, layout and status documents

### Style

- Biome import order and formatting for queue package and schema index

### Chores

- Lockfile for playground kit deps
- Workspace scaffolding and tooling

[Unreleased]: https://framework.habib.cloud/releases/
[0.2.0]: https://framework.habib.cloud/releases/
[0.1.0]: https://framework.habib.cloud/releases/
