# Laravel-Inspired TypeScript Framework Specification

## 1. Status, Scope, and Document Ownership

This document specifies the intended framework; it does not claim implementation. The current repository is a minimal Bun/Hono template. Only its `bun run dev` script is presently configured.

- `framwork.md`: architecture, component contracts, Hono integration, CLI behavior, delivery phases, and release criteria.
- `folder.md`: framework/application layouts, ownership rules, generator destinations, and the same CLI inventory for convenient lookup.
- Keep command names and options synchronized between both documents.

Use TypeScript, native Hono routing/middleware, Drizzle ORM, and Zod validation. Start by validating Bun, matching the current template. Add Node support through an explicit tested runtime adapter; selecting Node is unavailable until its build/start and integration matrix pass. PostgreSQL is the initial database. Redis-backed features are optional providers. Avoid assuming Hono runtime portability automatically makes database drivers, workers, or adapters portable.

## 2. Core and Application Lifecycle

The core contains typed dependency tokens, explicit factories, singleton/execution-scoped/transient bindings, validated configuration, and provider registration. HTTP, database, Redis, and queue dependencies remain outside core.

Lifecycle: load configuration → validate required provider settings → register all bindings → boot providers in dependency order → start the selected process → create/dispose execution scopes → drain and close resources.

HTTP requests, jobs, and CLI commands have separate scopes. Singletons must not capture scoped services. Detect dependency cycles with a readable resolution path. Providers declare dependencies and support cleanup after partial boot failures. Deferred providers activate only when required and must still participate in shutdown. Facades are optional context-aware conveniences, with explicit errors outside a supported scope. Use a PSR-11-inspired container vocabulary without claiming compatibility with the PHP standard.

## 3. Configuration and Integration Contracts

Validate environment input before serving requests; use typed immutable resolved configuration. Environment examples contain placeholders only. Redact credentials in logs, diagnostics, JSON CLI output, and error responses. Define process environment precedence over environment files and configuration defaults.

Optional adapters include CacheKit, QueueKit, StorageKit, LoggerKit, BullMQ, mail transports, and tracing. Verify actual installed APIs/version compatibility before implementation. Use one queue backend per connection. Each adapter declares capabilities, runtime support, initialization, failure behavior, and disposal. Application code can also import ordinary Hono middleware directly without an adapter.

## 4. HTTP, Validation, and API Contracts

Expose the real typed Hono instance and context. Support native handlers/sub-applications alongside controllers, route groups, named routes, API resources, parameter binding, and middleware aliases. Explicit registration is the initial discovery strategy. Duplicate routes/aliases/names fail during bootstrap.

Configure request correlation, request scope, CORS/security/body limits, authentication, validation, parameter binding, authorization, handler execution, and response serialization in a documented order. Resource authorization happens after the identity and resource needed by that policy are available. Central errors use Hono `onError`; do not assume downstream exceptions escape `await next()`.

Form requests define parameter/query/body schemas, authorization hooks, and typed validated input. Separate persistence schemas from writable input and public output. Explicit allowlists prevent mass assignment. Errors contain a stable code, safe message, optional field errors, and request ID. Define 400/401/403/404/409/422/429/500 behavior and production redaction.

OpenAPI 3.1 uses explicit operation IDs, schema metadata, responses, errors, and auth requirements. Runtime-only transformations/refinements need documented representation. Native routes used for RPC export their actual inferred type; dynamic alias/resource registration must not promise inference without compiler evidence.

## 5. Persistence and Models

Keep Drizzle tables/relations in one canonical application schema directory. Provide typed repositories and optional thin model metadata/serialization, scopes, soft-delete behavior, explicit relation loading, factories, and seeders. Do not build a second independent Eloquent schema/query engine.

Transactions propagate through scoped services without crossing connections accidentally. Document nested transaction/savepoint semantics, explicit commit/rollback, and connection cleanup. Bound pagination, define deterministic cursor ordering, avoid hidden lazy-loading, and test deleted-row filtering/restoration.

Use pinned Drizzle Kit to generate reviewed SQL and apply migrations through a controlled deployment step. Framework migration locks/status and authored reverse migrations have explicit adapters. Rollback is available only for reversible migrations; destructive changes require a recovery plan. Test fresh installation and upgrade from the prior supported schema. Database APIs and migrations: [Drizzle documentation](https://orm.drizzle.team/docs/migrations).

## 6. Identity and Authorization

Separate guards (resolve identity), user providers (load principals), and policies (authorize operations). Deliver session authentication and personal API tokens first, then recovery, verification, OTP, and JWT when required.

Require appropriate cookie security, session rotation/invalidation, CSRF policy for browser cookie authentication, hashed API tokens with expiry/abilities/revocation, generic identity lookup responses, and atomic single-use reset/verification credentials. OTP flows enforce purpose binding, hashed secrets, expiry, resend throttles, and attempt limits. Authorization defaults to denial and has endpoint-level positive and negative tests. Native JWT/JWK middleware authenticates claims; it does not replace resource policy checks.

## 7. Cache, Queues, Events, and Scheduling

Cache supports memory for development/tests and Redis for shared state. Define TTL, serialization, namespace, failure, and capability contracts. Tags, locks, counters, and rate limiting require explicitly supported atomic operations. Keep application cache separate from Hono response cache. Session and security-limit failure behavior must be documented rather than silently bypassed.

Jobs declare versioned validated payloads, handler identity, retries/backoff, timeout, concurrency, and idempotency rules. Design for duplicate delivery. Dispatch after transaction commit where sufficient; use a transactional outbox for durable database-to-queue transfer. Failed-job inspection/replay preserves business deduplication. BullMQ job guidance: [Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs).

Separate in-process events from durable queued listeners. Register listeners explicitly and specify failure propagation. Scheduling declares timezone, due-run calculation, distributed coordination, overlap lock expiry, and missed-run behavior. Workers and schedulers run separately from HTTP and handle interruption gracefully.

Workflows are the durable orchestration layer over jobs. The composition model is Workflow → Pipeline → Stage → Action: workflows declare versioned validated input and a failure policy; pipelines order stages; stages are the checkpoint boundaries (with `precheck` gates and `when` conditions); actions are the atomic, compensable units. Every level may run inline within its parent or as its own queue job (`via`), with parallel groups joined by persisted counters. Run state and the node tree persist in PostgreSQL with conditional transitions (idempotent claims — a delivered job never double-executes a node); the queue is transport only. Actions may declare `compensate` handlers, which run newest-first when a later step fails, ending the run `compensated`. Stages may park the run to wait for a domain event with a timeout. Runs are inspectable (status, node tree, per-node attempts and outputs) and operable (cancel, retry from any node, resume, retention pruning). Progress publishes as domain events so dashboards observe runs live. In-process `pipeline(input).through(...).then(...)` composition stays a core helper for synchronous service code; durable pipelines are workflows.

## 8. Storage, Mail, and Notifications

Storage disks declare local/cloud capabilities, streaming, metadata, and signed access where supported. Validate upload sizes/content, prevent traversal, separate private/public access, and define temporary-upload cleanup. Never expose the private disk through a public symlink.

Mail separates message/template construction from transport. Notifications select email/SMS/database channels explicitly, support queued delivery, and expose delivery status/retry contracts. Testing fakes record intended delivery while real adapter integration tests prove provider behavior. Queue dashboards and administrative routes require policies.

## 9. Testing, Observability, and Deployment

Use focused unit tests for container/config/policy logic, HTTP feature tests for validation/middleware/auth, real PostgreSQL/Redis adapter tests, queue duplicate-delivery/retry/shutdown tests, OpenAPI contract checks, typed RPC compilation, and generated-project installation/build tests.

Provide test application lifecycle helpers, scoped binding overrides, isolated databases/namespaces, factories, and cache/queue/mail/storage fakes. Do not treat fakes as evidence for real infrastructure behavior.

Require structured redacted logs, correlation across requests/jobs, liveness versus readiness, bounded shutdown, explicit pool/concurrency limits, and deployment instructions for server/worker/scheduler. Migration execution is a release step. CI installs from the lockfile, checks types/lint/format/tests, builds packages and the generated starter, and checks optional integrations on their supported runtime matrix. Benchmark a documented workload and environment before setting performance budgets.

## 10. Delivery Phases and Completion Gates

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | Runtime/adapter decisions and pinned dependencies | Written compatibility matrix and architecture decisions |
| 1 | Core lifecycle, config, request scope, HTTP errors | Concurrent isolation and graceful cleanup verified |
| 2 | One coherent CRUD module with schemas/policy/OpenAPI | Real HTTP workflow plus migration and inference checks |
| 3 | Sessions/tokens/recovery/OTP/policies | Security behavior verified through endpoints |
| 4 | Cache/queue/storage/mail/events/scheduling | Real adapter failures/retries/duplicate delivery verified |
| 5 | CLI inventory and generators | Clean generated application compiles, starts, and passes feature tests |
| 6 | Release documentation and deployment | Server/worker/scheduler and upgrade procedure validated |

Classify commands as planned, implemented, or validated in release documentation. Infrastructure commands become available only with their corresponding providers. First-release scope must explicitly identify deferred commands; do not label the full planned catalog as implemented.

Release acceptance: clean project creation, validated config, generated module, reviewed migrations, authenticated and authorized CRUD, retry-safe jobs, private upload, usable OpenAPI, passing checks, and reproducible deployment. Documentation covers getting started, Laravel conceptual mapping, middleware/native Hono usage, package integrations, CLI, testing, migration recovery, runtime boundaries, and upgrade policy.

## 11. Hono Ecosystem Integration


### 1. Native Compatibility

The framework must accept native Hono middleware directly.

Support:

- Built-in Hono middleware.
- Third-party middleware packages.
- Application-defined middleware.
- Hono sub-applications.
- Native handlers and helpers.
- Framework middleware for dependency injection, sessions, policies, and other application conventions.

Preserve Hono’s `Context`, `Request`, `Response`, and `next()` behavior throughout the HTTP layer.

Laravel-inspired route groups and middleware aliases are convenience features. Native Hono registration remains available.

### 2. Built-in Middleware Support

Allow applications to configure every built-in middleware listed by the installed Hono version.

| Category | Middleware | Framework integration policy |
|---|---|---|
| Authentication | Basic Authentication, Bearer Authentication, JWT, JWK | Available directly; connect identity to framework guards when needed |
| Request security | Body Limit, CORS, CSRF Protection, Secure Headers, IP Restriction | Configurable application and route presets |
| Response handling | Compress, ETag, Pretty JSON | Optional, with explicit ordering |
| Caching | Cache | Enable when the runtime supports the required Cache API |
| Execution context | Context Storage, Request ID | Integrate with request scope and correlation |
| Observability | Logger, Timing | Allow native usage or configured logging adapters |
| Routing behavior | Method Not Allowed, Method Override, Trailing Slash | Explicit application configuration |
| Composition | Combine | Preserve native middleware composition |
| Localization | Language | Available to API and rendering modules |
| Rendering | JSX Renderer | Optional rendering support |

Hono’s Cache middleware uses the Web Cache API. Keep its HTTP response caching separate from Redis-backed application caching and document runtime requirements. [Hono Cache documentation](https://hono.dev/docs/middleware/builtin/cache)

Availability does not mean every middleware runs globally. Applications select middleware according to their routes and runtime.

### 3. Third-Party Package Integration

Provide optional integrations for ecosystem packages.

| Area | Examples listed by Hono | Framework responsibility |
|---|---|---|
| Authentication | Auth.js, Clerk, Firebase Auth, OAuth, OIDC | Optional mapping to the framework principal |
| Authorization | Casbin | Optional policy adapter |
| Validation | Zod, Valibot, ArkType, Ajv, Standard Schema | Preserve validated input types |
| API documentation | Zod OpenAPI, Hono OpenAPI, Scalar, Swagger UI | Route metadata integration and documentation endpoints |
| Observability | OpenTelemetry, Prometheus, Sentry, Pino | Configuration, correlation, and lifecycle integration |
| API protocols | GraphQL, tRPC, oRPC | Mount native handlers or sub-applications |
| Utilities | Rate limiting, sessions, idempotency, dependency injection | Direct usage with optional framework adapters |
| Rendering | React Renderer, Qwik City | Optional application modules |

These are integration candidates from Hono’s directory, not a claim that every package has been tested with the framework. [Hono third-party middleware](https://hono.dev/docs/middleware/third-party)

Each maintained integration must document:

- Compatible framework, Hono, and package versions.
- Supported runtimes.
- Required context variables and middleware ordering.
- Configuration and resource cleanup.
- Error and response behavior.
- Focused integration tests.

Install integrations as optional dependencies or separate adapter packages.

### 4. Registration API

Expose the actual typed Hono application so developers can use native APIs:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

const http = new Hono()
  .use(requestId())
  .use(secureHeaders())
  .use(
    "/api/*",
    cors({
      origin: "https://app.example.com",
    }),
  )
  .get("/health", (c) => c.json({ status: "ok" }));
```

The framework bootstrap accepts this application and attaches its lifecycle services.

Also provide optional framework APIs for:

- Named middleware aliases.
- Middleware groups such as `api`, `web`, and `admin`.
- Provider-installed middleware.
- Controller and resource-route registration.

Resolve aliases during bootstrap. Unknown aliases fail before serving requests.

Typed middleware factories and native chained routes remain available where applications need context inference or typed RPC clients.

### 5. Custom Middleware

Use Hono’s middleware contract and `createMiddleware()` for reusable typed middleware. [Hono Factory helper](https://hono.dev/docs/helpers/factory)

```ts
import { createMiddleware } from "hono/factory";

type Principal = {
  id: string;
};

type AuthEnvironment = {
  Variables: {
    principal: Principal;
  };
};

export const requirePrincipal = (
  resolvePrincipal: (
    request: Request,
  ) => Promise<Principal | null>,
) =>
  createMiddleware<AuthEnvironment>(async (c, next) => {
    const principal = await resolvePrincipal(c.req.raw);

    if (!principal) {
      return c.json({ code: "UNAUTHENTICATED" }, 401);
    }

    c.set("principal", principal);
    await next();
  });
```

Framework services may create native middleware through dependency injection. Third-party packages do not need to implement a framework-specific middleware interface.

### 6. Helpers, Rendering, and RPC

Allow direct imports of Hono helpers:

- Accepts, Adapter, ConnInfo, Cookie.
- Factory, Route, Dev, Testing.
- JWT and Proxy.
- Streaming and WebSocket.
- HTML, CSS, JSX rendering, and SSG.

Keep runtime-specific helpers documented and optional.

Support Hono RPC through exported route types and native typed route construction. Any controller or resource generator that promises RPC support must demonstrate that its generated routes retain the necessary inference. [Hono RPC documentation](https://hono.dev/docs/guides/rpc)

API-first remains the default starter template. Rendering, static generation, streaming, and WebSocket features remain accessible through optional modules.

### 7. Ordering and Error Handling

Preserve Hono’s registration order and before/after `next()` execution.

Use `app.onError()` for centralized framework error conversion. Hono catches downstream exceptions before returning through the middleware chain, so an outer `try/catch` around `await next()` must not be the framework’s primary error boundary. [Hono execution and error behavior](https://hono.dev/docs/guides/middleware)

Document ordering for:

- CORS preflight and authentication.
- Request scope and service resolution.
- Validation and authorization.
- Cache eligibility and personalized responses.
- Compression and response headers.
- Streaming and WebSocket upgrades.

Avoid automatic response rewriting that changes third-party middleware behavior.

### 8. Acceptance Criteria

Native compatibility is complete when:

1. Built-in middleware works without framework adapters.
2. Representative third-party packages work through native registration.
3. Custom middleware preserves typed context variables.
4. Native Hono sub-applications can be mounted.
5. Early responses and post-handler middleware behave as documented.
6. Framework error handling uses Hono’s error lifecycle.
7. Native route types support a working Hono RPC client.
8. Middleware aliases and groups preserve declared ordering.
9. Runtime-specific integrations have explicit support boundaries.
10. Framework providers can install integrations without duplicate registration.


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
