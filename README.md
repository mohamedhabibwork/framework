# Framework — Laravel-shaped, TypeScript

A Bun + Hono + Drizzle + Zod framework workspace: one-command applications,
CRUD generated from your schema, an audit trail in the same transaction, queues,
schedules, durable workflows, OAuth2 and OpenAPI — all verified against real
PostgreSQL and Redis rather than mocks.

Specification: [framwork.md](framwork.md) · layout rules: [folder.md](folder.md) ·
decisions and pinned versions: [docs/architecture/decisions.md](docs/architecture/decisions.md).

## Quickstart

```sh
bun install                                    # workspace dependencies
bun run db:up                                  # PostgreSQL :54329 + Redis :63799
bun run cli -- create apps/my-api --with-demo  # app + products module + tests
cd apps/my-api
cp .env.example .env                           # DATABASE_URL / REDIS_URL
bun run cli -- db:migrate
bun run dev                                    # http://127.0.0.1:3000
```

`create --with-demo` generates the application (config, bootstrap, providers,
health/audit/realtime routes, server/worker/scheduler/CLI entry points, tests,
compose) and runs `make:crud` inside it, so the first request you make is
already covered by an endpoint suite. Full walkthrough:
[docs/getting-started.md](docs/getting-started.md).

## Documentation

| Doc                                                                                                                                              | Contents                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [docs/](docs/README.md)                                                                                                                          | Documentation hub: map, reading paths and conventions                          |
| [Getting started](docs/getting-started.md)                                                                                                       | Zero to a running API, plus a troubleshooting table                            |
| [CLI reference](docs/cli-reference.md)                                                                                                           | Every command (74 implemented), options, exit codes and the planned catalog    |
| [Authoring modules](docs/modules.md)                                                                                                             | Module anatomy, the Drizzle→Zod pipeline, mixins, hooks, policies, OpenAPI     |
| [Platform guide](docs/platform.md)                                                                                                               | Request context, errors, pagination/filter/sort, audit, events, queues, import |
| [Helpers](docs/helpers.md)                                                                                                                       | `config()`, `env()`, `abort()`, `logger()`, `retry()` and context helpers      |
| [Authentication](docs/authentication.md)                                                                                                         | Sessions, API tokens, verification, recovery, TOTP, JWT guards                 |
| [Errors & codes](docs/errors.md)                                                                                                                 | The error envelope and the stable code catalog                                 |
| [Search](docs/search.md)                                                                                                                         | Declarative indexes, memory/PostgreSQL drivers, event-driven indexing          |
| [OAuth server](docs/oauth-server.md)                                                                                                             | Authorization code + PKCE, client credentials, introspection, revocation       |
| [Cache](docs/cache.md) · [Storage](docs/storage.md) · [Mail](docs/mail.md) · [Notifications](docs/notifications.md) · [Logging](docs/logging.md) | Subsystem guides                                                               |
| [Queues](docs/queues.md) · [Workflows](docs/workflows.md) · [Scheduling](docs/scheduling.md)                                                     | Work outside the request                                                       |
| [Testing](docs/testing.md)                                                                                                                       | Isolated databases, endpoint suites, test modes, release gates                 |
| [Deployment](docs/deployment.md)                                                                                                                 | Processes, configuration, migrations as a release step, scaling                |
| [AI integration](docs/ai.md)                                                                                                                     | MCP server, its tools/resources, and the agent skills                          |
| [Packages](docs/packages.md)                                                                                                                     | All 25 packages, their status and dependencies                                 |
| [Implementation status](docs/status.md)                                                                                                          | What is validated, implemented, contracts-only or planned — with evidence      |

### Docs site

The same guides ship as a Starlight site in [`apps/docs`](apps/docs) with its own
design system, dark/light themes, search, versioned lines and RTL support:

```sh
bun run docs:dev      # local preview
bun run docs:sync     # regenerate apps/docs pages from docs/*.md
bun run docs:check    # integrity: frontmatter, H1, sidebar, links, md↔mdx parity
bun run docs:build    # static build to apps/docs/dist (needs Node ≥ 22.23.4)
docker build -f apps/docs/Dockerfile .   # the image Dokploy deploys on push to main
```

`docs/*.md` is the single source: the site is generated, and `docs:check` fails
CI when the two drift.

## Layout

```text
packages/core        container, providers, config, lifecycle, execution context
packages/http        Hono kernel, errors, request scope, middleware registry, policies
packages/validation  validators and form requests
packages/database    connection, transactions, CRUD mixins, audit trail, pagination, migrations
packages/crud        generic service/controller, audit endpoints, CSV/JSON import-export (queued)
packages/auth        sessions, API tokens, verification, TOTP, JWT guards
packages/events      event bus (in-memory + Redis pub/sub), WebSocket realtime hub
packages/queue       BullMQ queue manager, batches, worker
packages/workflow    durable multi-stage workflows with saga compensation
packages/scheduler   cron registry, distributed locking, scheduled dispatch
packages/search      full-text search (memory + PostgreSQL drivers)
packages/oauth-server OAuth 2.0 / OIDC authorization server
packages/cache       cache, locks, rate limiting
packages/storage     disks (local), visibility separation, path guards
packages/mail        typed mailables and transports
packages/notifications multi-channel notification dispatcher
packages/logging     structured, redacted, correlation-aware logging
packages/openapi     OpenAPI 3.1 generation and drift checks
packages/support     Laravel-style helpers (config, env, abort, logger, context)
packages/testing     isolated PostgreSQL test databases
packages/cli         CLI runtime, commands, app + make:* generators
packages/prompts     terminal prompts used by the CLI
packages/ai-mcp      MCP server bridging the app CLI and docs for AI agents
apps/playground      reference application (products, auth, workflows, schedules)
apps/demo-api        second reference application (auth via make:auth)
apps/docs            Starlight documentation site (static, nginx, Dokploy)
deployment/          local PostgreSQL + Redis (compose)
```

## Checks

```sh
bun run typecheck     # tsc --noEmit over the workspace
bun run lint          # oxlint
bun run format:check  # oxfmt
bun run test          # unit, HTTP, real-PostgreSQL, real-Redis and generator end-to-end
bun run coverage      # suite + per-package line/function thresholds
bun run docs:check    # documentation integrity
```

## One-command CRUD

```sh
bun run cli -- make:crud Category \
  --fields 'title:text:required,position:integer:default=0,budget:numeric:nullable' \
  --access public --verify
```

Generates the Drizzle table and migration, Drizzle–Zod schemas, DTOs, form
requests, repository (mixins), service, controller, policy, typed native Hono
routes, OpenAPI operations, fixtures and an endpoint suite, registers the module,
then typechecks and runs the suite against an isolated PostgreSQL database.
`--dry-run` previews, `--table <export>` targets an existing table, `--json`
gives machine output. `bun run cli -- list` shows every command with its status.

## AI agents

The MCP server (`packages/ai-mcp`, registered in [`.mcp.json`](.mcp.json), or
`bun run mcp`) exposes the application CLI — catalog, scaffolding, migrations,
queues, workflows, OpenAPI, checks — as structured tools, plus the documentation
as `fwdocs://` resources. Project skills in `.zcode/skills/` teach agents the
workspace conventions. See [docs/ai.md](docs/ai.md).

## Ecosystem repositories

| Repository                                                                              | Role                                                                                            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`mohamedhabibwork/framework`](https://github.com/mohamedhabibwork/framework)           | Main monorepo (source of truth for packages, reference apps, release tooling)                   |
| [`mohamedhabibwork/framework-app`](https://github.com/mohamedhabibwork/framework-app)   | GitHub template repository for a standalone application                                         |
| [`mohamedhabibwork/framework-docs`](https://github.com/mohamedhabibwork/framework-docs) | Documentation site + guides, deployed at [framework.habib.cloud](https://framework.habib.cloud) |

Every package in `packages/*` is also synced to its own repository:

| Package                    | Repository                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `@framework/ai-mcp`        | [`framework-ai-mcp`](https://github.com/mohamedhabibwork/framework-ai-mcp)               |
| `@framework/auth`          | [`framework-auth`](https://github.com/mohamedhabibwork/framework-auth)                   |
| `@framework/cache`         | [`framework-cache`](https://github.com/mohamedhabibwork/framework-cache)                 |
| `@framework/cli`           | [`framework-cli`](https://github.com/mohamedhabibwork/framework-cli)                     |
| `@framework/core`          | [`framework-core`](https://github.com/mohamedhabibwork/framework-core)                   |
| `@framework/crud`          | [`framework-crud`](https://github.com/mohamedhabibwork/framework-crud)                   |
| `@framework/database`      | [`framework-database`](https://github.com/mohamedhabibwork/framework-database)           |
| `@framework/events`        | [`framework-events`](https://github.com/mohamedhabibwork/framework-events)               |
| `@framework/http`          | [`framework-http`](https://github.com/mohamedhabibwork/framework-http)                   |
| `@framework/logging`       | [`framework-logging`](https://github.com/mohamedhabibwork/framework-logging)             |
| `@framework/mail`          | [`framework-mail`](https://github.com/mohamedhabibwork/framework-mail)                   |
| `@framework/notifications` | [`framework-notifications`](https://github.com/mohamedhabibwork/framework-notifications) |
| `@framework/oauth-server`  | [`framework-oauth-server`](https://github.com/mohamedhabibwork/framework-oauth-server)   |
| `@framework/observatory`   | [`framework-observatory`](https://github.com/mohamedhabibwork/framework-observatory)     |
| `@framework/openapi`       | [`framework-openapi`](https://github.com/mohamedhabibwork/framework-openapi)             |
| `@framework/prompts`       | [`framework-prompts`](https://github.com/mohamedhabibwork/framework-prompts)             |
| `@framework/queue`         | [`framework-queue`](https://github.com/mohamedhabibwork/framework-queue)                 |
| `@framework/scheduler`     | [`framework-scheduler`](https://github.com/mohamedhabibwork/framework-scheduler)         |
| `@framework/search`        | [`framework-search`](https://github.com/mohamedhabibwork/framework-search)               |
| `@framework/socialite`     | [`framework-socialite`](https://github.com/mohamedhabibwork/framework-socialite)         |
| `@framework/storage`       | [`framework-storage`](https://github.com/mohamedhabibwork/framework-storage)             |
| `@framework/support`       | [`framework-support`](https://github.com/mohamedhabibwork/framework-support)             |
| `@framework/testing`       | [`framework-testing`](https://github.com/mohamedhabibwork/framework-testing)             |
| `@framework/validation`    | [`framework-validation`](https://github.com/mohamedhabibwork/framework-validation)       |
| `@framework/workflow`      | [`framework-workflow`](https://github.com/mohamedhabibwork/framework-workflow)           |

Syncing all package repos, the app template and the docs repo from the monorepo:

```sh
bun run sync:repos              # create/update and push all 27 linked repositories
bun run sync:repos -- --dry-run # preview without pushing
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Every
behaviour change ships with a test that runs in `bun run test` and a status row
in [docs/status.md](docs/status.md); documentation changes go through
`bun run docs:check`.
