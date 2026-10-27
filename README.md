# Hono Framework (Laravel-inspired, TypeScript)

A Bun + Hono + Drizzle + Zod framework workspace. Specification: [framwork.md](framwork.md) and [folder.md](folder.md). Decisions and pinned versions: [docs/architecture/decisions.md](docs/architecture/decisions.md).

## Documentation

| Doc | Contents |
|---|---|
| [Getting started](docs/getting-started.md) | From zero to a running API — reference app and generated apps |
| [Helpers](docs/helpers.md) | Laravel-style `config()`, `env()`, `abort()`, `logger()`, `retry()` and context helpers |
| [CLI reference](docs/cli-reference.md) | Every command, option and example |
| [Authoring modules](docs/modules.md) | Module anatomy, the Drizzle→Zod pipeline, mixins, hooks, policies, OpenAPI |
| [Platform guide](docs/platform.md) | Request context, errors, pagination/filter/sort, audit, events & realtime, queues, import/export |
| [Testing](docs/testing.md) | Isolated databases, endpoint suites, test modes, release gates |
| [Deployment](docs/deployment.md) | Processes, configuration, migrations as a release step, scaling |
| [AI integration](docs/ai.md) | MCP server (framework tools + docs resources) and agent skills |
| [Implementation status](docs/status.md) | What is validated, implemented or planned |

The same documentation ships as a [Starlight](https://starlight.astro.build) site (MDX + Cloudflare adapter) in `apps/docs`:

```sh
bun run docs:dev      # local preview
bun run docs:build    # static build to apps/docs/dist
bun run docs:deploy   # wrangler deploy to Cloudflare
```

## Layout

```text
packages/core        container, providers, config, lifecycle, execution context
packages/http        Hono kernel, errors, request scope, middleware registry, policies
packages/validation  validators and form requests
packages/database    connection, transactions, CRUD mixins, audit trail, pagination, migrations
packages/crud        generic service/controller, audit endpoints, CSV/JSON import-export (queued)
packages/events      event bus (in-memory + Redis pub/sub), WebSocket realtime hub
packages/queue       BullMQ queue manager and worker
packages/openapi     OpenAPI 3.1 generation and drift checks
packages/support     Laravel-style helpers (config, env, abort, logger, context)
packages/testing     isolated PostgreSQL test databases
packages/cli         CLI runtime, commands, app + make:crud generators
packages/ai-mcp      MCP server bridging the app CLI and docs for AI agents
apps/playground      reference application (products module)
apps/docs            Starlight documentation site (MDX, Cloudflare)
deployment/          local PostgreSQL + Redis (compose)
```

## Minimal commands

```sh
bun install
bun run db:up                                                # PostgreSQL + Redis (compose)
cp .env.test.example .env.test                               # TEST_DATABASE_URL
bun run cli -- create apps/my-api --with-demo                # full app + sample module, one command
cd apps/my-api && cp .env.example .env                       # set DATABASE_URL
bun run cli -- db:migrate
bun run dev                                                  # http://127.0.0.1:3000
bun test                                                     # endpoint suite on an isolated DB
```

`create --with-demo` generates the application (config, bootstrap, providers,
health/audit/realtime routes, server/worker/CLI entry points, tests, compose),
installs through the workspace, and generates a sample products module with
its migration — see [Getting started](docs/getting-started.md).

## Checks

```sh
bun run typecheck
bun run lint
bun run test        # unit, HTTP, real-PostgreSQL, real-Redis and generator end-to-end tests
```

## One-command CRUD

```sh
bun run cli -- make:crud Category \
  --fields 'title:text:required,position:integer:default=0,budget:numeric:nullable' \
  --access public --verify
```

Generates the Drizzle table and migration, Drizzle–Zod schemas, DTOs, form
requests, repository (mixins), service, controller, policy, typed native
Hono routes, OpenAPI operations, fixtures and an endpoint suite, registers
the module, then typechecks and runs the suite against an isolated
PostgreSQL database. Use `--dry-run` to preview, `--table <export>` for
existing tables, `--json` for machine output. `bun run cli -- list` shows
every command and whether it is planned or implemented.

## AI agents

The framework ships an MCP server (`packages/ai-mcp`, registered via
[`.mcp.json`](.mcp.json), or `bun run mcp`) that exposes the application CLI — catalog,
scaffolding, migrations, queues, workflows, OpenAPI, checks — as structured tools plus the
repository documentation as resources. Project skills in `.zcode/skills/` teach agents the
workspace conventions. See [docs/ai.md](docs/ai.md).
