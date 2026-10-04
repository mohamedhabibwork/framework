# Changelog

All notable changes to the framework are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
releases are tagged `vX.Y.Z` in git and every pre-1.0 minor release freezes a
documentation snapshot (see the [docs versions page](apps/docs/src/content/docs/versions.mdx)).
Rendered release notes live at [framework.habib.cloud/releases](https://framework.habib.cloud/releases/).

## [Unreleased]

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
