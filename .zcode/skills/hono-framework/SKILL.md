---
name: hono-framework
description: Working in this Laravel-inspired TypeScript framework workspace (Bun + Hono + Drizzle + Zod) — running the app CLI, checks, database lifecycle and understanding the package layout. Use for any work in packages/* or apps/*.
---

# hono-framework workspace

This repository is a Bun workspace: framework packages under `packages/*`, a reference
app in `apps/playground` and a Starlight docs site in `apps/docs`. Specification lives in
`framwork.md` (architecture) and `folder.md` (layout); user-facing guides live in `docs/`.

## The app CLI is the operation surface

Every generated app owns `bin/cli.ts`; from the workspace root run commands through the
playground script:

```sh
bun run cli -- <command>            # e.g. list, db:status, make:crud
bun run cli -- <command> --json     # machine-readable envelope: { command, status, data, warnings, error? }
```

Exit codes: `0` ok, `1` failure, `2` invalid usage, `3` unsupported capability, `130`
interrupted. Exit `3` usually means a provider is missing from
`apps/playground/bootstrap/providers.ts` (e.g. `cacheProvider`, `authProvider`) — that is a
text check, not a boot.

An MCP server exposing these commands as tools ships in `packages/ai-mcp` (registered via
`.mcp.json`, tools like `catalog`, `db_migrate`, `crud_scaffold`, `docs_search`). Prefer the
MCP tools when available; otherwise use the CLI exactly as above. `serve`, `dev`,
`queue:work` and `schedule:work` are long-running processes — never call them as one-shot
tool executions; start them in a terminal.

## Non-negotiables

- Migrations are never applied automatically on startup. Generate with `db:generate`,
  review the SQL, then apply explicitly with `db:migrate` (or a release pipeline).
- Destructive ops (`cache:clear`, `session:prune`) require `--confirm`; `--dry-run`
  writes nothing.
- Registration is explicit: generators edit files via markers/anchors. When hand-editing
  generated files, keep those markers intact.
- Never invent columns for `make:crud` — every field must come from the user or an
  existing table.

## Checks

```sh
bun run typecheck   # tsc over packages + apps
bun run lint        # biome check .
bun run test        # bun test ./packages ./apps (endpoint suites use isolated PostgreSQL)
bun run db:up       # docker compose: PostgreSQL + Redis needed by tests and queue commands
```

Run all three checks after changing framework packages; generator changes are also covered
by end-to-end tests in `packages/cli/tests/`.

## Doc map (read the one you need)

| Need                                                    | Read                    |
| ------------------------------------------------------- | ----------------------- |
| Command reference                                       | `docs/cli-reference.md` |
| Module anatomy, Drizzle→Zod pipeline, policies, OpenAPI | `docs/modules.md`       |
| Request context, errors, pagination, events, queues     | `docs/platform.md`      |
| Testing conventions                                     | `docs/testing.md`       |
| Deployment and release steps                            | `docs/deployment.md`    |
| Architecture contracts                                  | `framwork.md`           |
| File placement rules                                    | `folder.md`             |

Sibling skills: `hono-framework-crud` (scaffolding resources), `hono-framework-auth`
(authentication and authorization), `hono-framework-testing` (suites and release gates),
`hono-framework-ops` (db/queue/schedule/workflow/cache operations).
