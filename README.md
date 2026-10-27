# Hono Framework (Laravel-inspired, TypeScript)

A Bun + Hono + Drizzle + Zod framework workspace. Specification: [framwork.md](framwork.md) and [folder.md](folder.md). Decisions and pinned versions: [docs/architecture/decisions.md](docs/architecture/decisions.md).

## Documentation

| Doc                                        | Contents                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [Getting started](docs/getting-started.md) | From zero to a running API — reference app and generated apps                                    |
| [Helpers](docs/helpers.md)                 | Laravel-style `config()`, `env()`, `abort()`, `logger()`, `retry()` and context helpers          |
| [CLI reference](docs/cli-reference.md)     | Every command, option and example                                                                |
| [Authoring modules](docs/modules.md)       | Module anatomy, the Drizzle→Zod pipeline, mixins, hooks, policies, OpenAPI                       |
| [Platform guide](docs/platform.md)         | Request context, errors, pagination/filter/sort, audit, events & realtime, queues, import/export |
| [Testing](docs/testing.md)                 | Isolated databases, endpoint suites, test modes, release gates                                   |
| [Deployment](docs/deployment.md)           | Processes, configuration, migrations as a release step, scaling                                  |
| [AI integration](docs/ai.md)               | MCP server (framework tools + docs resources) and agent skills                                   |
| [Implementation status](docs/status.md)    | What is validated, implemented or planned                                                        |

The same documentation ships as a [Starlight](https://starlight.astro.build) site (static MDX output, served by nginx on Dokploy) in `apps/docs`:

```sh
bun run docs:dev      # local preview
bun run docs:build    # static build to apps/docs/dist
docker build -f apps/docs/Dockerfile .   # the image Dokploy deploys on push to main
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
apps/docs            Starlight documentation site (MDX, Dokploy)
deployment/          local PostgreSQL + Redis (compose)
```

## Ecosystem Repositories

| Repository                                                                              | Role                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`mohamedhabibwork/framework`](https://github.com/mohamedhabibwork/framework)           | Main framework monorepo (source of truth for all packages, reference apps, and release tooling)                                                |
| [`mohamedhabibwork/framework-app`](https://github.com/mohamedhabibwork/framework-app)   | **GitHub Template Repository** — create a new standalone application based on the framework                                                    |
| [`mohamedhabibwork/framework-docs`](https://github.com/mohamedhabibwork/framework-docs) | Standalone documentation repository (Starlight MDX site + Markdown guides, deployed at [framework.habib.cloud](https://framework.habib.cloud)) |

### Package Repositories (25 Subtree-Split Packages)

Every package in `packages/*` is synced to its own GitHub repository and linked back to [`mohamedhabibwork/framework`](https://github.com/mohamedhabibwork/framework):

| Package                    | GitHub Repository                                                                                         | Description                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@framework/ai-mcp`        | [`mohamedhabibwork/framework-ai-mcp`](https://github.com/mohamedhabibwork/framework-ai-mcp)               | MCP server bridging the framework CLI and documentation for AI coding agents                  |
| `@framework/auth`          | [`mohamedhabibwork/framework-auth`](https://github.com/mohamedhabibwork/framework-auth)                   | Session & personal API token authentication, password hashing, TOTP, and guards               |
| `@framework/cache`         | [`mohamedhabibwork/framework-cache`](https://github.com/mohamedhabibwork/framework-cache)                 | Cache manager, service provider, and drivers (`@mohamedhabibwork/cachekit`)                   |
| `@framework/cli`           | [`mohamedhabibwork/framework-cli`](https://github.com/mohamedhabibwork/framework-cli)                     | CLI runtime, command registry, and application/module/auth code generators                    |
| `@framework/core`          | [`mohamedhabibwork/framework-core`](https://github.com/mohamedhabibwork/framework-core)                   | IoC container, service providers, configuration loader, lifecycle, and execution context      |
| `@framework/crud`          | [`mohamedhabibwork/framework-crud`](https://github.com/mohamedhabibwork/framework-crud)                   | Generic CRUD service/controller, audit endpoints, and queued CSV/JSON import-export           |
| `@framework/database`      | [`mohamedhabibwork/framework-database`](https://github.com/mohamedhabibwork/framework-database)           | PostgreSQL connection, transactions, Drizzle CRUD mixins, audit trail, pagination, migrations |
| `@framework/events`        | [`mohamedhabibwork/framework-events`](https://github.com/mohamedhabibwork/framework-events)               | Typed event bus (in-memory + Redis pub/sub) and WebSocket realtime hub                        |
| `@framework/http`          | [`mohamedhabibwork/framework-http`](https://github.com/mohamedhabibwork/framework-http)                   | Hono HTTP kernel, structured errors, request scope, middleware registry, policies             |
| `@framework/logging`       | [`mohamedhabibwork/framework-logging`](https://github.com/mohamedhabibwork/framework-logging)             | Structured logger provider and context-aware logging (`@mohamedhabibwork/loggerkit`)          |
| `@framework/mail`          | [`mohamedhabibwork/framework-mail`](https://github.com/mohamedhabibwork/framework-mail)                   | Typed mailable builder, transports, and mail service provider                                 |
| `@framework/notifications` | [`mohamedhabibwork/framework-notifications`](https://github.com/mohamedhabibwork/framework-notifications) | Multi-channel notification dispatcher and builders (`@mohamedhabibwork/notifykit`)            |
| `@framework/oauth-server`  | [`mohamedhabibwork/framework-oauth-server`](https://github.com/mohamedhabibwork/framework-oauth-server)   | OAuth 2.0 / OIDC authorization server, PKCE, token introspection, client management           |
| `@framework/observatory`   | [`mohamedhabibwork/framework-observatory`](https://github.com/mohamedhabibwork/framework-observatory)     | Request, query, event, job, and exception telemetry and inspection                            |
| `@framework/openapi`       | [`mohamedhabibwork/framework-openapi`](https://github.com/mohamedhabibwork/framework-openapi)             | OpenAPI 3.1 specification generator and schema drift checker                                  |
| `@framework/prompts`       | [`mohamedhabibwork/framework-prompts`](https://github.com/mohamedhabibwork/framework-prompts)             | Interactive terminal prompts, spinners, tables, and structured CLI output                     |
| `@framework/queue`         | [`mohamedhabibwork/framework-queue`](https://github.com/mohamedhabibwork/framework-queue)                 | BullMQ job queue manager, worker runtime, and retry policies                                  |
| `@framework/scheduler`     | [`mohamedhabibwork/framework-scheduler`](https://github.com/mohamedhabibwork/framework-scheduler)         | Cron schedule registry, distributed locking, and scheduled job/workflow runner                |
| `@framework/search`        | [`mohamedhabibwork/framework-search`](https://github.com/mohamedhabibwork/framework-search)               | Full-text and indexed model search with pluggable drivers and queue-backed syncing            |
| `@framework/socialite`     | [`mohamedhabibwork/framework-socialite`](https://github.com/mohamedhabibwork/framework-socialite)         | OAuth2 social authentication providers (GitHub, Google, Discord, and custom OIDC)             |
| `@framework/storage`       | [`mohamedhabibwork/framework-storage`](https://github.com/mohamedhabibwork/framework-storage)             | Disk storage manager and local/S3 drivers (`@mohamedhabibwork/storagekit`)                    |
| `@framework/support`       | [`mohamedhabibwork/framework-support`](https://github.com/mohamedhabibwork/framework-support)             | Laravel-style helpers (`config`, `env`, `abort`, `logger`, `retry`, context)                  |
| `@framework/testing`       | [`mohamedhabibwork/framework-testing`](https://github.com/mohamedhabibwork/framework-testing)             | Isolated PostgreSQL test databases, transaction sandboxes, and HTTP test helpers              |
| `@framework/validation`    | [`mohamedhabibwork/framework-validation`](https://github.com/mohamedhabibwork/framework-validation)       | Request validation middleware and typed form requests powered by Hono and Zod                 |
| `@framework/workflow`      | [`mohamedhabibwork/framework-workflow`](https://github.com/mohamedhabibwork/framework-workflow)           | Multi-stage, multi-step resumable workflow engine with policies and persistence               |

Syncing all 25 package repos, the app template repo, and the docs repo from the monorepo:

```sh
bun run sync:repos              # create/update and push all 27 linked GitHub repositories
bun run sync:repos -- --dry-run # preview without pushing
```

## Minimal commands

### Create a standalone app from the GitHub template

```sh
gh repo create my-api --template mohamedhabibwork/framework-app --clone
cd my-api
cp .env.example .env
bun install
docker compose -f deployment/compose.yaml up -d --wait
bun run cli -- db:migrate
bun run dev
```

### Develop inside the framework workspace

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
