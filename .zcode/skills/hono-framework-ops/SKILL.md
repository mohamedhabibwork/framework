---
name: hono-framework-ops
description: Operating this hono-framework application — database migrations, queues, schedules, durable workflows, cache and session maintenance, doctor/openapi diagnostics. Use for runtime operations and troubleshooting rather than feature scaffolding.
---

# Operations

Prefer the MCP tools (`db_status`, `queue_status`, `workflow_list`, …) when the MCP server
is connected; the CLI equivalents below behave identically. Read-only diagnostics first,
mutations only after stating what they do.

## Database

1. `db:generate --name <n>` (or `db_generate`) — offline Drizzle Kit diff; **read the
   generated SQL** before applying.
2. `db:migrate` — applies pending migrations under a lock. This is an explicit step;
   nothing applies on startup. `db:status` shows applied/pending; `db:check` validates
   metadata.
3. Rollback/destructive changes need a recovery plan — do not hand-edit applied migrations.

## Queues and schedules (need reachable Redis: `bun run db:up`)

- `queue:status [--queue <n>]` — counts per state (waiting/active/completed/failed/delayed).
- `queue:work` / `schedule:work` — long-running processes; start them in a terminal, never
  as a one-shot tool call (SIGTERM drains gracefully).
- `schedule:list` — timetables with next due run; `schedule:run <name>` enqueues one fire.

## Workflows (PostgreSQL; retry also needs Redis)

`workflow:list`, `workflow:status <id>` (full node tree), `workflow:retry <id>
[--from <path>]`, `workflow:cancel <id>`, `workflow:prune [--days <n>]`. When diagnosing a
failed run, read `workflow:status` first and report the failing node path and error before
retrying anything.

## Cache, sessions, storage (provider-gated)

`cache:clear`, `session:prune` require `--confirm` and a registered provider (exit 3
otherwise). Redis engines cannot clear a namespace (`CACHE_UNSUPPORTED_OPERATION`) —
delete known keys instead. `session:prune --dry-run` only counts. `storage:check` is
read-only.

## Diagnostics

- `doctor [--connections]` — config validation (+ database probe).
- `config:show [key]` — resolved config, secrets redacted.
- `route:list`, `module:list`, `middleware:list` — registration state, no connections.
- `openapi:generate --output <p>` and `openapi:check` — document generation and drift.

In production, migrations run as a release step (`docs/deployment.md`), never from
application startup.
