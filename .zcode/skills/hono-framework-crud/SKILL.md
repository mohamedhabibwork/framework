---
name: hono-framework-crud
description: Scaffolding CRUD resources and modules in this hono-framework workspace with make:crud / make:module — field grammar, --table reuse, access control, verification and file ownership rules. Use when adding a resource, module or API endpoints.
---

# make:crud — one-command resources

`make:crud` generates the Drizzle table + migration, Drizzle–Zod schemas, DTOs, form
requests, repository (mixins), service, controller, policy, typed native Hono routes,
OpenAPI operations, fixtures and an endpoint test suite, then registers the module via
explicit markers. Delegate to the MCP `crud_scaffold` tool or run:

```sh
bun run cli -- make:crud Category \
  --fields 'title:text:required,position:integer:default=0,budget:numeric:nullable' \
  --access public --soft-delete --verify
```

## Field grammar (new tables only)

`name:type:modifier,…` — types: `text | integer | numeric | boolean | uuid | timestamp`;
modifiers: `required`, `nullable`, `default=<literal>`. The generator refuses to invent
columns: if the user did not specify a field, ask or inspect an existing table instead of
guessing.

## Choosing the mode

- New table → `--fields '<spec>'`
- Existing Drizzle table → `--table <ExportName>` (mutually exclusive with `--fields`;
  `--schema-file` points at the exporting module, default is the schema index)
- Enums, relations, exposure rules, fixtures → `--definition <path>` JSON file

## Required and behavioral options

- `--access public|authenticated` is required. `authenticated` requires the auth module
  (`make:auth` first), wraps routes in `requireAuth()` and emits ability-checking policies
  plus 401/403 test cases.
- `--soft-delete` adds `deletedAt`, restore behavior and deletion tests.
- `--route` overrides the mount path (default `/api/v1/<module>`).
- `--module <name>` selects the destination module (default: pluralized resource).

## Workflow

1. Always preview with `--dry-run` first; it prints every file change and the test plan and
   writes nothing.
2. Run for real, then `--verify` (typecheck + endpoint suite against an isolated PostgreSQL
   database) — do this after scaffolding, not as an optional extra.
3. `--force` overwrites **generator-owned files of this module only**. Never use it to push
   through conflicts in files the user edited — resolve those by hand, keeping registration
   markers intact.

Custom behavior goes in the generated service/controller afterwards — do not edit
generated route tables by hand unless adding a genuinely custom endpoint, and prefer the
service layer for business rules. Full contract: `docs/modules.md` and
`docs/cli-reference.md`.
