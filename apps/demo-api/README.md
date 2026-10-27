# DemoApiTest

Generated application on the framework workspace (Bun + Hono + Drizzle + Zod).

## Getting started

```sh
bun install
cp .env.example .env          # then edit the values
docker compose -f deployment/compose.yaml up -d --wait   # PostgreSQL + Redis

bun run cli -- config:check
bun run cli -- db:migrate     # apply the generated migration(s)
bun run dev                   # HTTP server (bun run cli -- serve for production)
bun run worker                # queue worker (bun run cli -- queue:work)
bun test                      # endpoint suite on an isolated database
```

If this app was created with `--with-demo`, a sample **products** module is
already generated (schema, migration, CRUD routes, OpenAPI, tests). Add more
resources any time:

```sh
bun run cli -- make:crud Order --module orders \\
  --fields 'total:numeric:required' --access public --verify
```

## Layout

- `app/modules/<feature>/` — business modules (generate with `make:crud`)
- `app/providers/` — application providers (database, events)
- `bootstrap/` — framework application, HTTP composition, middleware, OpenAPI
- `config/` — validated configuration (environment-mapped)
- `database/schema` — canonical Drizzle tables (including `audit_logs`)
- `bin/` — server, worker and CLI entry points
- `tests/` — endpoint tests (`bun test`)

Events: set `EVENTS_DRIVER=redis` to fan out `entity.*` / `import.*` /
`export.*` events across instances; `GET /ws` multiplexes them to WebSocket
clients (subscribe to allowlisted channels such as `events`).

## Kit-backed subsystems

The cache (`CACHE`/`LOCK_STORE`/`RATE_LIMITER` via `@framework/cache`),
structured logging (`LOGGER` via `@framework/logging`) and storage disks
(`STORAGE` via `@framework/storage`) are configured by the `cache`,
`logging` and `storage` sections of `config/index.ts` and registered in
`bootstrap/providers.ts`. Three CLI commands operate them:

```sh
bun run cli -- cache:clear --dry-run    # preview; add --confirm to execute
bun run cli -- storage:check            # validate disk configuration (read-only)
bun run cli -- session:prune --dry-run  # available once make:auth is installed
```
