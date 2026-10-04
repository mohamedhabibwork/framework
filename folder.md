# Framework and Application Folder Structure

This is the target layout, not the current generated application. The repository currently contains a minimal Bun/Hono starter. See [framwork.md](./framwork.md) for architecture and behavior. CLI commands below are planned until implemented and validated.

## 1. Framework Workspace

```text
framework/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── application.ts
│   │   │   ├── container/
│   │   │   ├── providers/
│   │   │   ├── config/
│   │   │   ├── lifecycle/
│   │   │   ├── contracts/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── http/
│   │   ├── src/
│   │   │   ├── application.ts       # Creates/configures the Hono application
│   │   │   ├── routing/             # Groups, resources, named routes
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   │   ├── registry.ts       # Optional aliases and groups
│   │   │   │   └── request-scope.ts
│   │   │   ├── errors/              # Hono onError integration
│   │   │   ├── responses/
│   │   │   └── index.ts
│   │   └── tests/
│   │
│   ├── validation/
│   │   └── src/
│   │       ├── form-request.ts
│   │       ├── validators/
│   │       └── index.ts
│   │
│   ├── database/
│   │   └── src/
│   │       ├── connections/
│   │       ├── transactions/
│   │       ├── repositories/
│   │       ├── pagination/
│   │       ├── migrations/
│   │       ├── factories/
│   │       └── index.ts
│   │
│   ├── auth/
│   │   └── src/
│   │       ├── guards/
│   │       ├── providers/
│   │       ├── policies/
│   │       ├── sessions/
│   │       ├── tokens/
│   │       ├── flows/              # OTP, reset, verification
│   │       ├── middleware/
│   │       └── index.ts
│   │
│   ├── cache/
│   ├── queue/
│   ├── storage/
│   ├── events/
│   ├── mail/
│   ├── notifications/
│   ├── scheduler/
│   ├── workflow/
│   ├── openapi/
│   ├── testing/
│   ├── logging/
│   │
│   └── cli/
│       ├── src/
│       │   ├── commands/
│       │   ├── generators/
│       │   └── index.ts
│       └── templates/
│           ├── application/
│           └── module/
│
├── integrations/                    # Optional maintained adapter packages
│   ├── cachekit/
│   ├── queuekit/
│   ├── storagekit/
│   ├── loggerkit/
│   ├── bullmq/
│   └── opentelemetry/
│
├── apps/
│   └── playground/                  # Exercises the framework during development
│
├── examples/
│   ├── rest-api/
│   ├── hono-rpc/
│   ├── custom-middleware/
│   └── background-jobs/
│
├── tests/
│   ├── compatibility/
│   ├── generated-app/
│   └── end-to-end/
│
├── docs/
│   ├── getting-started/
│   ├── architecture/
│   ├── middleware/
│   ├── integrations/
│   └── deployment/
│
├── tooling/
├── .github/workflows/
├── package.json
├── bun.lock                         # Default Bun workspace lockfile
├── pnpm-workspace.yaml               # Only for a separately tested pnpm workspace
├── tsconfig.base.json
└── biome.json
```

Each package and integration follows the same layout:

```text
package/
├── src/
│   └── index.ts
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

Create optional integration packages when they provide configuration, lifecycle management, or framework-specific behavior. Ordinary Hono middleware can be imported directly.

## 2. Generated Application

```text
my-app/
├── app/
│   ├── modules/
│   │   ├── users/
│   │   │   ├── controllers/
│   │   │   │   └── user.controller.ts
│   │   │   ├── requests/
│   │   │   │   ├── create-user.request.ts
│   │   │   │   └── update-user.request.ts
│   │   │   ├── responses/
│   │   │   │   └── user.response.ts
│   │   │   ├── services/
│   │   │   │   └── user.service.ts
│   │   │   ├── repositories/
│   │   │   │   └── user.repository.ts
│   │   │   ├── policies/
│   │   │   │   └── user.policy.ts
│   │   │   ├── events/
│   │   │   ├── listeners/
│   │   │   ├── models/              # Optional thin model metadata
│   │   │   ├── middleware/
│   │   │   ├── mail/
│   │   │   ├── notifications/
│   │   │   ├── jobs/
│   │   │   ├── tests/
│   │   │   ├── routes.ts
│   │   │   ├── provider.ts
│   │   │   └── index.ts             # Public module exports
│   │   └── blog/
│   │       └── ...
│   │
│   ├── middleware/                  # Custom application-wide Hono middleware
│   ├── providers/                   # Application-wide service providers
│   ├── commands/
│   ├── schedules/
│   ├── auth/
│   │   ├── guards/
│   │   └── providers/
│   └── shared/                      # Explicitly shared application contracts
│
├── bootstrap/
│   ├── app.ts                       # Framework application and provider setup
│   ├── http.ts                      # Typed Hono app, middleware, route mounting
│   ├── middleware.ts                # Optional aliases and groups
│   └── providers.ts                 # Explicit provider registration
│
├── config/
│   ├── app.ts
│   ├── http.ts
│   ├── database.ts
│   ├── auth.ts
│   ├── cache.ts
│   ├── queue.ts
│   ├── storage.ts
│   ├── logger.ts
│   ├── mail.ts
│   ├── notifications.ts
│   ├── events.ts
│   ├── scheduler.ts
│   └── integrations.ts
│
├── database/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── posts.ts
│   │   └── index.ts
│   ├── migrations/
│   ├── factories/
│   └── seeders/
│
├── routes/
│   ├── api.ts                       # Composes module API routes
│   ├── web.ts                       # Optional rendering routes
│   └── health.ts
│
├── resources/
│   ├── views/                       # Optional JSX templates
│   ├── emails/
│   └── locales/
│
├── public/                          # Intentionally public static assets
├── storage/                         # Local runtime files; ignored by Git
│   ├── private/
│   ├── tmp/
│   └── logs/
│
├── bin/
│   ├── server.ts                    # HTTP process entry point
│   ├── worker.ts                    # Queue process entry point
│   ├── scheduler.ts                 # Scheduling process entry point
│   └── cli.ts
│
├── tests/
│   ├── feature/
│   ├── integration/
│   └── setup.ts
│
├── deployment/
│   ├── Dockerfile
│   └── compose.yaml
│
├── .env.example
├── .gitignore
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── bun.lock                         # For the default Bun template
├── biome.json
└── README.md
```

## 3. Placement Rules

| Component | Location |
|---|---|
| Business feature | `app/modules/<feature>/` |
| Custom global middleware | `app/middleware/` |
| Native Hono middleware registration | `bootstrap/http.ts` |
| Route-specific middleware | Module `routes.ts` |
| Middleware aliases and groups | `bootstrap/middleware.ts` |
| Third-party package configuration | `config/integrations.ts` or a dedicated config file |
| Infrastructure lifecycle registration | `app/providers/` |
| Drizzle tables and relations | `database/schema/` |
| Database access behavior | Module `repositories/` |
| Public API serialization | Module `responses/` |
| HTTP, worker, scheduler startup | `bin/` |

Import built-in middleware from `hono/*` and third-party middleware from their installed packages. Keep local adapter code only where the application needs additional behavior.

Export the composed typed Hono application from `bootstrap/http.ts` so tests and RPC clients can use its route types. Keep server startup in `bin/server.ts`.

Use explicit module registration initially. Create feature subfolders only when they contain code.

## 4. Missing Layout and Ownership Details

### Package internals

Use the common package layout above; create feature directories only when needed:

| Package | Internal responsibilities |
|---|---|
| `cache` | Contracts, manager, memory/Redis adapters, namespace/TTL/capabilities |
| `queue` | Job schemas, dispatcher, worker lifecycle, failed-job management |
| `storage` | Disk contracts, manager, local adapter, upload validation |
| `events` | Typed event contracts, explicit listener registry, queued listeners |
| `mail` | Message builders, templates, transport registry, fakes |
| `notifications` | Channel registry, delivery status, dispatch |
| `scheduler` | Task registry, timezone calculation, distributed locks — implemented over BullMQ job schedulers (`defineSchedule`, overlap locks, dedicated fires queue) |
| `workflow` | Durable Workflow → Pipeline → Stage → Action engine: Postgres run/node persistence, queue transport, compensation, wait-for-event, admin routes and CLI |
| `logging` | Structured logger contract, redaction, correlation |
| `openapi` | Route metadata, schema conversion, generation/validation |
| `testing` | Test app lifecycle, overrides, fixtures, infrastructure fakes |
| `cli` | Parser, command registry, execution context, generators, templates |

The framework workspace uses Bun workspaces and `bun.lock` by default. A pnpm-specific manifest/lockfile belongs only to a separately tested workspace variant. A generated project uses the lockfile belonging to its selected package manager, not multiple competing lockfiles.

### Global versus module placement

Generators using `--module users` target `app/modules/users/`. Without it, generated application code goes into global folders created on demand: `app/controllers/`, `requests/`, `responses/`, `services/`, `repositories/`, `models/`, `policies/`, `events/`, `listeners/`, `jobs/`, `workflows/` (workflow definitions + registry provider), `schedules/` (cron schedule registry), `mail/`, `notifications/`, and `tests/unit/` for default unit tests. Module-local tests go under the module's `tests/`.

Canonical Drizzle schema/migration/factory/seeder files always live under `database/`, even when a generator selects a module. Avoid duplicating tables under module models. Application integration adapters, if needed, live under `app/integrations/`; published reusable adapters live in the framework workspace's `integrations/`.

Add `bootstrap/modules.ts`, `bootstrap/events.ts`, and `bootstrap/schedules.ts` when these registries are introduced. Providers explicitly register module exports; route composition exports the actual inferred Hono type. Entry points start processes and must not be imported by unit tests or RPC clients.

### CLI implementation layout

```text
packages/cli/
├── src/
│   ├── bin.ts
│   ├── command.ts
│   ├── registry.ts
│   ├── context.ts
│   ├── output.ts
│   ├── errors.ts
│   ├── commands/
│   │   ├── project/
│   │   ├── generators/
│   │   ├── database/
│   │   ├── queue/
│   │   ├── scheduler/
│   │   ├── cache/
│   │   ├── storage/
│   │   ├── openapi/
│   │   └── tooling/
│   ├── generators/
│   │   ├── naming.ts
│   │   ├── paths.ts
│   │   ├── plan.ts
│   │   ├── writer.ts
│   │   └── registration.ts
│   └── index.ts
├── templates/
│   ├── application/
│   │   ├── base/
│   │   ├── api/
│   │   ├── web/
│   │   └── runtimes/
│   │       ├── bun/
│   │       └── node/
│   └── artifacts/
├── tests/
│   ├── commands/
│   ├── generators/
│   └── generated-app/
└── package.json
```

Command groups orchestrate operations; generators calculate a reviewed file/change plan and then apply it. Runtime templates are selectable only after validation. A generic native Hono package never needs copied source under this tree.

### Generated file naming examples

| Input | Destination |
|---|---|
| `make:controller User --module users` | `app/modules/users/controllers/user.controller.ts` |
| `make:request CreateUser --module users` | `app/modules/users/requests/create-user.request.ts` |
| `make:response User --module users` | `app/modules/users/responses/user.response.ts` |
| `make:repository User --module users` | `app/modules/users/repositories/user.repository.ts` |
| `make:model User --module users` | `app/modules/users/models/user.model.ts` |
| `make:middleware RequireUser --module users` | `app/modules/users/middleware/require-user.middleware.ts` |
| `make:schema User` | `database/schema/users.ts` (explicit pluralization override supported) |
| `make:factory User` | `database/factories/user.factory.ts` |
| `make:seeder User` | `database/seeders/user.seeder.ts` |
| `make:guard ApiKey` | `app/auth/guards/api-key.guard.ts` |
| `make:user-provider DatabaseUser` | `app/auth/providers/database-user.provider.ts` |
| `make:command ImportUsers` | `app/commands/import-users.command.ts` |
| `make:schedule Cleanup` | `app/schedules/cleanup.schedule.ts` |
| `make:integration CustomStorage` | `app/integrations/custom-storage/` |

Other named artifacts follow `<kebab-name>.<artifact-kind>.ts` within the matching directory. SQL migration names/metadata follow the pinned Drizzle toolchain rather than an independent timestamp convention. `make:mail` also creates `resources/emails/<kebab-name>.tsx`; templates may use a different explicit engine when configured.

### Build and version-control rules

Ignore `node_modules/`, `dist/`, coverage, runtime storage contents, real environment files, and temporary uploads. Commit configuration examples, source migrations, seeders, schemas, and one package-manager lockfile. Preserve tracked storage placeholder files where needed.

Generated package scripts cover `dev`, `start`, `build`, `cli`, `typecheck`, `test`, `lint`, and `format`; their actual executables come from the selected runtime/tooling template. The current starter's single `dev` script remains unchanged by this documentation update.

Tests must prove that a clean generated application installs, type-checks, builds, mounts native middleware, exports RPC-compatible types, applies migrations, and starts through its documented entry point. Do not create empty directories just to match the conceptual tree.



## One-Command CRUD: Required Generator Contract

### Goal and command

Any developer can generate a complete CRUD feature and execute its API tests with one command, once the planned CLI has been implemented:

```sh
bun run cli -- make:crud Product --module products --fields 'name:text:required,price:numeric:required' --verify
```

For an existing table:

```sh
bun run cli -- make:crud Product --module products --table products --verify
```

`make:crud` is the canonical command. `make:module products --crud Product` delegates to the same generator pipeline; it must not maintain a separate CRUD implementation. A single command generates the table when needed, schema-derived validators, form requests, DTOs, repository, service, controller, policies, native Hono routes, OpenAPI metadata, fixtures, and API tests. `--verify` also runs type checking and the generated endpoint suite against an isolated real PostgreSQL database.

This is a specification requirement, not an implemented CLI feature in the current starter. Verification requires configured test infrastructure; missing prerequisites fail with instructions rather than reporting success or silently skipping tests.

### Options and input contract

| Option | Required behavior |
|---|---|
| `--module <name>` | Destination module; default to the resource's explicit plural name |
| `--table <export>` | Reuse a statically identifiable existing Drizzle table export |
| `--schema-file <path>` | Locate the canonical table export when names are ambiguous |
| `--fields '<definition>'` | Create a new table; mutually exclusive with existing `--table` |
| `--definition <path>` | Typed/validated JSON resource definition for complex fields, exposure rules, and fixtures |
| `--route <path>` | Default `/api/v1/<module>`; check route collisions |
| `--primary-key <column>` | Required for ambiguous keys; composite keys require explicit route mapping |
| `--soft-delete` | Generate matching column/query behavior and deletion tests |
| `--verify` | Typecheck, prepare isolated test schema, call all generated endpoints, report results |
| `--test-mode in-process\|network` | Default in-process Hono request execution; network mode starts a local test HTTP server |
| `--dry-run` | Preview all artifacts/registrations and test plan without applying changes or running mutation tests |
| `--force` | Existing-file policy from the CLI contract; never replace unrelated module files |

For new tables, the first version supports explicitly documented field types such as text, integer, numeric, boolean, UUID, and timestamps. The compact field syntax is `<name>:<type>:required\|nullable\|default=<literal>`. Decimal numeric columns use string transport values to avoid floating-point money errors. A JSON definition handles enums, relations, JSON fields, custom names, uniqueness, read/write allowlists, refinements, and valid/invalid fixtures. Reject unsupported types or unresolved relations instead of producing unusable tests.

When neither a table nor field definition is supplied, interactive mode collects and validates the definition. Noninteractive mode fails with usage examples. Never invent business columns or sample values from a resource name.

### Canonical schema → validation → DTO pipeline

Create the database definition once under `database/schema/`. All CRUD insert, update, and select validation originates from that Drizzle table through Drizzle–Zod. Form-request schemas and DTO types derive from those validators; manually duplicated interfaces or handwritten copies of database field rules are forbidden in generated CRUD.

Current upstream documentation demonstrates `createInsertSchema`, `createUpdateSchema`, and `createSelectSchema` imported from `drizzle-orm/zod`, with a release-candidate installation example. Pin a tested version set before adoption. If the project uses the standalone `drizzle-zod` package, verify equivalent exports and Zod compatibility and use that import through a central compatibility adapter. Do not install release candidates or change dependencies automatically just because the latest docs show them. [Drizzle–Zod documentation](https://orm.drizzle.team/docs/zod)

```text
Drizzle table (canonical persistence shape)
  → Drizzle–Zod insert/update/select schemas
  → explicit writable/public picks and business refinements
  → create/update form-request schemas and response schema
  → z.input / z.output DTO types
  → Hono validation + OpenAPI + API contract tests
```

Database-derived shape is a foundation. Authorization, business rules, unique conflict handling, and public exposure still require explicit policy/metadata. Generated identity, ownership, role, tenant, audit, and secret fields are not automatically writable/public.

Proposed generated example for a `products` table with generated `id` and required `name`:

```ts
import { z } from 'zod/v4';
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from 'drizzle-orm/zod'; // use the version-verified adapter when needed
import { products } from '../../../database/schema/products';

export const createProductSchema = createInsertSchema(products, {
  name: (field) => field.trim().min(1).max(120),
}).pick({ name: true }).strict();

export const updateProductSchema = createUpdateSchema(products, {
  name: (field) => field.trim().min(1).max(120),
}).pick({ name: true }).strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one writable field is required' },
);

export const productResponseSchema = createSelectSchema(products)
  .pick({ id: true, name: true });

export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProductDto = z.output<typeof createProductSchema>;
export type UpdateProductDto = z.output<typeof updateProductSchema>;
export type ProductResponseDto = z.output<typeof productResponseSchema>;
```

The example belongs in `app/modules/products/schemas.ts`; imports use the actual project convention. The writable/public picks come from the resource definition, not inferred sensitive-field naming heuristics. Each additional declared field must appear in the appropriate allowlist and generated fixtures.

Create/update form requests import these schemas and add authorization/operation-specific refinements. DTO files re-export inferred types. Response serializers explicitly project public fields. Response validation tests parse the actual serialized JSON, including declared date/decimal/bigint mappings. Do not validate JSON timestamps using an unmodified `z.date()` persistence schema: configure string-mode columns or derive explicit JSON transport overrides. URL parameters use a derived primary-key validator with explicit string-to-key parsing; query schemas compose pagination/filter allowlists.

The same form schema is exported for optional client-side forms, validation errors, and OpenAPI. UI field widgets/labels are explicit metadata; Zod alone does not define a complete form UI. Other Hono validators remain usable for unrelated routes, but generated CRUD always follows this canonical Drizzle–Zod pipeline.

### TypeScript mixin architecture

Generators compose reusable behavior with typed mixins instead of copying a large CRUD implementation into every controller or repository. Use constrained class-expression mixins and explicit resource contracts. [TypeScript mixins](https://www.typescriptlang.org/docs/handbook/mixins.html)

Proposed internal layout:

```text
packages/database/src/mixins/
├── readable.ts
├── creatable.ts
├── updatable.ts
├── deletable.ts
└── soft-deletable.ts
packages/http/src/crud/
├── resource-contract.ts
├── controller-mixins.ts
└── register-resource.ts
packages/cli/src/generators/crud/
├── definition.ts
├── schema.ts
├── requests.ts
├── dto.ts
├── resource.ts
├── tests.ts
└── plan.ts
```

Mixin requirements:

- Preserve inferred create/update/select DTO types and the primary-key type through composition.
- Inject the repository/transaction context and resource policy explicitly; never hide a global connection in static methods.
- Expose stable typed hooks for before/after validation and writes, serialization, scope filtering, and authorization.
- Reject incompatible mixins and method collisions; soft deletion replaces deletion strategy without registering duplicate methods.
- Use compiler-checked generic constraints. Generated DTO boundaries must not depend on `any` or unsafe type assertions.
- Keep concrete native Hono route declarations in generated modules so RPC inference and route-level schemas are preserved.
- Permit operation overrides while retaining shared validation, policies, and endpoint contract tests.

### Generated artifacts

```text
app/modules/products/
├── schemas.ts                       # Drizzle-derived form/response schemas
├── dto/product.dto.ts               # Inferred type exports
├── requests/
│   ├── create-product.request.ts
│   ├── update-product.request.ts
│   └── list-products.request.ts
├── responses/product.response.ts
├── repositories/product.repository.ts
├── services/product.service.ts
├── controllers/product.controller.ts
├── policies/product.policy.ts
├── tests/product.crud.api.test.ts
├── routes.ts                        # Concrete native typed Hono routes
├── provider.ts
└── index.ts

database/schema/products.ts          # New table only; never duplicate existing tables
database/factories/product.factory.ts
```

The generator also updates schema exports and module/provider/route registration, and generates migration artifacts using the configured migration adapter. Dry-run lists every change. File application uses a staged plan with recovery for partial failures; verification failure preserves reviewable generated code and returns nonzero.

### API surface and mandatory endpoint tests

| Method | Route | Success contract | Test evidence |
|---|---|---|---|
| POST | `/api/v1/products` | `201`, public created DTO | Valid create persisted; forbidden fields rejected |
| GET | `/api/v1/products` | `200`, items and pagination | Created record appears; ordering/filter/page limits correct |
| GET | `/api/v1/products/:id` | `200`, public DTO | Read created ID; unknown ID returns `404` |
| PATCH | `/api/v1/products/:id` | `200`, updated public DTO | Changed fields persist; untouched fields preserved |
| DELETE | `/api/v1/products/:id` | `204`, empty body | Record removed/soft-deleted and subsequent read returns `404` |

POST/GET/PATCH/DELETE tests must call the registered Hono API, not repository methods masquerading as endpoint tests. Default mode uses `http.request()` against the complete test application with real PostgreSQL; network mode calls the local HTTP listener through `fetch`. Do not substitute a mocked controller or database for this suite.

Also generate tests for malformed JSON/IDs, missing required fields, invalid types/refinements, empty updates, immutable fields, pagination bounds, secret-field exclusion, and configured unique/foreign-key conflicts. Auth-enabled resources require authorized fixtures plus `401`/`403` cases. Public access is explicit in the resource definition, never silently generated to make tests pass.

Verification obtains an isolated test database/schema from the test provider, applies migrations only there, creates valid schema-aware fixtures, executes create → list → read → update → read → delete → missing-read, and checks the public schema and real persistence changes. Schema cleanup runs in success/failure paths. Reject an application production connection as the test target; network mode binds locally on an ephemeral port and closes afterward.

Custom refinements, relationships, uniqueness constraints, and advanced types require declared fixture providers. Missing fixtures are an actionable generation error, not a skipped test. Unsupported PUT replacement semantics are not emitted by default; `--methods` support, if later added, must generate and test every selected operation.

### Verification output and acceptance gate

`--verify` reports generated/updated files, migration preparation, typecheck outcome, each tested method/route, passed/failed counts, and cleanup status. Preserve the same information in JSON output. Generation success and verification success are separate reported states; neither implies deployment.

Release acceptance requires the one-command examples to work in a clean generated application for new and existing tables, with all five default endpoints tested, inferred DTO/compiler checks passing, no private-field exposure, no unrelated overwritten files, and no leaked database schemas or server processes. A generator that only creates stubs fails this requirement.


## Complete Planned CLI Reference

This is the target CLI specification, not a list of implemented commands. The current template exposes only `bun run dev`; the CLI below must be built before these commands can run. `framework` is a provisional executable name, not an existing published package.

### Invocation and shared options

After CLI implementation, generated applications expose a `cli` package script that invokes `bin/cli.ts`:

```sh
bun run cli -- help
bun run cli -- make:module users --dry-run
bun run cli -- make:controller User --module users --resource
```

Examples below use `framework` as shorthand for the installed executable or `bun run cli --`. An application-local CLI discovers the project root from its configuration; it must not rely on the shell working directory alone.

| Shared option | Contract |
|---|---|
| `--help`, `-h` | Usage, arguments, options, examples, capability requirements |
| `--version`, `-V` | Installed CLI and framework versions |
| `--cwd <path>` | Explicit project root |
| `--env-file <path>` | Explicit environment file; do not override supplied process variables silently |
| `--json` | Machine-readable results where supported; diagnostics go to stderr |
| `--no-interaction` | Disable prompts; fail when required input is missing |
| `--verbose` | Additional diagnostics with secret redaction |

Generator-only options: `--module <name>`, `--dry-run`, and `--force`. `--force` applies only to generator-owned files and shows an overwrite diff first; noninteractive overwrites require both an explicit file selection and `--force`. Operational commands do not inherit generator overwrite behavior.

### Project, configuration, and runtime

| Command | Options / arguments | Purpose |
|---|---|---|
| `create <directory>` | `--template api\|web`, `--runtime bun\|node`, `--package-manager bun\|pnpm\|npm`, `--no-install` | Generate a project into an empty directory; choose only tested runtime/template combinations |
| `help [command]` | — | Command help |
| `list` | `--json` | List commands, including provider extensions and availability |
| `doctor` | `--connections` | Validate configuration and optional connectivity; redact credentials |
| `config:check` | — | Validate configuration without starting HTTP or workers |
| `config:show [key]` | `--json` | Show resolved non-secret configuration |
| `serve` | `--host`, `--port` | Start the configured HTTP runtime |
| `dev` | `--host`, `--port` | Start the runtime's development watcher |
| `build` | — | Run the selected runtime's production build pipeline |
| `module:list` | — | Show explicitly registered modules and providers |
| `route:list` | `--method`, `--path`, `--name`, `--json` | Show route metadata and middleware order |
| `middleware:list` | `--json` | Show registered aliases and groups |
| `integration:list` | — | Show configured adapters, versions, and capabilities |
| `integration:check [name]` | `--connections` | Validate adapter compatibility and optional connectivity |

### Code generators

Names use PascalCase at the CLI boundary and become kebab-case files. Module names use kebab-case. Resolve files relative to the selected module or the documented global directory.

| Command | Options | Generated artifact |
|---|---|---|
| `make:crud <resource>` | `--module`, `--table` or `--fields`/`--definition`, `--verify`, `--test-mode`, `--dry-run` | Complete Drizzle-derived CRUD feature and API tests; optional one-command execution |
| `make:module <name>` | `--crud <resource>`, CRUD options | Module routes/provider/exports; CRUD mode delegates to `make:crud` |
| `make:controller <name>` | `--module`, `--resource` | Controller, optional CRUD handlers |
| `make:request <name>` | `--module`, `--table`, `--operation create\|update` | CRUD requests import the canonical Drizzle–Zod form schema and authorization hook |
| `make:response <name>` | `--module`, `--table` | Public schema derived from select schema plus explicit serialization/exposure |
| `make:dto <name>` | `--module`, `--schema <export>` | Export inferred Zod input/output DTO types; no copied field interfaces |
| `make:service <name>` | `--module` | Business service with explicit dependencies |
| `make:repository <name>` | `--module`, `--table <name>` | Typed Drizzle repository |
| `make:model <name>` | `--module`, `--migration` | Thin model metadata/serialization, optional migration stub; no second schema source |
| `make:schema <name>` | `--dialect postgres` | Drizzle table definition and schema export |
| `make:migration <name>` | `--custom` | Custom SQL migration; generated schema diffs use `db:generate` |
| `make:factory <name>` | `--table <name>` | Database factory |
| `make:seeder <name>` | — | Named seeder |
| `make:policy <name>` | `--module` | Resource policy |
| `make:middleware <name>` | `--module` | Native typed Hono middleware |
| `make:provider <name>` | `--module` | Provider lifecycle class/factory |
| `make:guard <name>` | — | Authentication guard implementation |
| `make:user-provider <name>` | — | Principal lookup implementation |
| `make:event <name>` | `--module` | Typed event contract |
| `make:listener <name>` | `--module`, `--event <name>`, `--queued` | Event listener with optional job dispatch |
| `make:job <name>` | `--module` | Validated versioned job payload and handler |
| `make:mail <name>` | `--module` | Message builder and email template |
| `make:notification <name>` | `--module`, `--channels email,sms,database` | Notification with explicit channel selection |
| `make:command <name>` | `--signature <command>` | Application CLI command |
| `make:schedule <name>` | `--cron <expression>`, `--timezone <zone>` | Explicit scheduled task registration |
| `make:test <name>` | `--module`, `--type unit\|feature\|integration` | Meaningful test scaffold |
| `make:auth` | `--guard session\|api-token`, `--dry-run` | Auth routes, requests, services, policies, config references, tests |
| `make:integration <name>` | `--package <specifier>` | Optional lifecycle adapter; does not automatically install or execute packages |

All generators must reject traversal paths, invalid identifiers, and unexpected existing files. Cross-file changes to routes, providers, and exports appear in the same dry-run plan. Generators use syntax-aware edits or explicit registration markers, never arbitrary text insertion.

### Database

| Command | Options | Behavior |
|---|---|---|
| `db:generate` | `--name <name>` | Delegate schema-diff generation to pinned Drizzle Kit |
| `db:migrate` | `--connection <name>` | Apply reviewed pending migrations under a migration lock |
| `db:status` | `--connection`, `--json` | Applied/pending migration state |
| `db:check` | — | Validate migration metadata through the configured adapter |
| `db:seed [name]` | `--connection`, `--allow-production` | Run explicitly registered seeders; production requires explicit opt-in |
| `db:rollback` | `--steps <n>`, `--allow-production` | Run only authored and registered reverse migrations; reject irreversible changes |
| `db:fresh` | `--seed`, `--allow-production`, `--confirm-target <database>` | Drop/recreate application schema; require explicit target confirmation |

Migration status, locking, and reverse migration handling are framework responsibilities where the underlying tool does not provide the required contract. Do not represent these wrapper commands as native Drizzle commands. Do not migrate automatically on every server or worker startup.

### Queues and failed jobs

| Command | Options | Behavior |
|---|---|---|
| `queue:work` | `--connection`, `--queue`, `--concurrency`, `--once` | Consume configured queues; `--once` processes at most one available job |
| `queue:status` | `--connection`, `--queue`, `--json` | Queue counts and adapter health |
| `queue:failed` | `--queue`, `--limit`, `--cursor` | Paginated failed-job metadata; redact payload secrets |
| `queue:retry <job-id>` | `--queue` | Retry a selected failed job without removing idempotency protection |
| `queue:retry-all` | `--queue`, `--confirm` | Explicitly replay failed jobs in the selected queue |
| `queue:forget <job-id>` | `--queue`, `--confirm` | Delete a selected failed-job record |
| `queue:prune` | `--queue`, `--older-than <duration>`, `--dry-run`, `--confirm` | Remove eligible retained terminal jobs only |
| `queue:pause` | `--queue` | Pause consumption according to adapter scope |
| `queue:resume` | `--queue` | Resume consumption |

Queue management requires a capable adapter. Unsupported operations fail with a clear capability error. Workers drain on SIGTERM/SIGINT within a configured deadline; deployments restart workers through their process supervisor.

### Scheduling, cache, sessions, and storage

| Command | Options | Behavior |
|---|---|---|
| `schedule:list` | `--json` | Tasks, timezone, next execution, overlap policy |
| `schedule:run` | — | Run currently due tasks using distributed coordination |
| `schedule:work` | — | Long-running scheduler loop with graceful shutdown |
| `schedule:test <task>` | `--confirm` | Execute a selected task immediately; may cause business effects |
| `cache:clear` | `--store`, `--prefix`, `--dry-run`, `--confirm` | Clear only the application's configured namespace, never flush shared Redis |
| `cache:prune` | `--store`, `--dry-run`, `--confirm` | Adapter-supported expiry cleanup |
| `session:prune` | `--store`, `--dry-run`, `--confirm` | Remove expired sessions only |
| `storage:check` | `--disk` | Validate disk configuration; connection probes are explicitly requested |
| `storage:link` | `--disk public` | Link only a configured local public disk; reject private disks |
| `storage:prune` | `--disk`, `--older-than`, `--dry-run`, `--confirm` | Remove framework-owned temporary uploads only |

### API documentation and validation tooling

| Command | Options | Behavior |
|---|---|---|
| `openapi:generate` | `--output <path>`, `--api-version <version>` | Emit the documented routes' OpenAPI 3.1 specification |
| `openapi:check` | `--spec <path>` | Validate specification and route metadata consistency |
| `test` | `--type`, `--filter`, `--coverage`, `--watch` | Run configured Vitest suites |
| `typecheck` | — | TypeScript checking without emitting files |
| `lint` | `--fix` | Run configured lint tools; modifying fixes are explicit |
| `format` | `--check` | Formatting; check mode performs no writes |

Runtime, test, build, and lint commands delegate to project-configured tooling. List delegated executables without exposing secrets. Do not invent framework implementations of formatters, compilers, or watchers.

### CLI execution contract

- Exit `0`: success; `1`: execution failure; `2`: invalid usage/configuration; `3`: unsupported capability; `130`: interruption.
- Dry-run performs no project writes, package installation, database mutations, or job dispatch. Read-only inspection is allowed.
- Commands initialize only their required providers. `help`, `list`, and generator previews require no live database or Redis.
- All mutation commands validate arguments and capabilities before acting. Destructive operations require the specific confirmation options above; noninteractive execution without them fails.
- Provider extensions declare names, descriptions, options, capabilities, and disposal requirements. Duplicate command names fail at bootstrap.
- Stable JSON output uses `{ command, status, data, warnings }`; failures include a safe error code/message and never credentials.
- Auth secrets and tokens are never printed by generic diagnostics. Secret generation, if added later, needs a dedicated documented output contract.
- Pin tooling versions, bound operational timeouts, redact secrets, and dispose connections on success, failure, and interruption.

### Example implementation workflow

These examples run only once the corresponding CLI commands exist:

```sh
framework create my-app --runtime bun --package-manager bun
cd my-app
framework config:check
framework make:module users --crud User --dry-run
framework make:module users --crud User
framework db:generate --name create-users
framework db:migrate
framework db:seed
framework route:list
framework openapi:generate --output docs/openapi.json
framework typecheck
framework test --type feature
framework dev
```

Run `framework queue:work --queue default` and `framework schedule:work` as separate processes when those providers are configured.
