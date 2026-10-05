# Changelog

All notable changes to the framework are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
releases are tagged `vX.Y.Z` in git and every pre-1.0 minor release freezes a
documentation snapshot (see the [docs versions page](apps/docs/src/content/docs/versions.mdx)).
Rendered release notes live at [framework.habib.cloud/releases](https://framework.habib.cloud/releases/).

## [Unreleased]

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

### Features

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
[0.1.0]: https://framework.habib.cloud/releases/
