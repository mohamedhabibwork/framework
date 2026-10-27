---
name: hono-framework-auth
description: Installing and extending authentication/authorization in this hono-framework workspace — make:auth, session vs API-token guards, policies and requireAbility, TOTP two-step, email verification, password recovery, JWT. Use when securing endpoints or touching the auth module.
---

# Authentication and authorization

## Install (once per app)

`make:auth` installs the `app/modules/auth` module, the `users`/`sessions`/`api_tokens`
framework tables, the `auth` config section, the `@framework/auth` dependency, provider
registration, the kernel guard and the `/api/v1/auth` mount — all through explicit
markers, previewable with `--dry-run`:

```sh
bun run cli -- make:auth            # or MCP tool auth_install with dryRun
bun run cli -- db:migrate           # apply the generated migration (explicit step)
```

`--guards session,api-token` selects enabled guards (default: both).

## Endpoints and tokens

- `POST /auth/register`, `POST /auth/login` → httpOnly session cookie (CSRF-protected).
- `POST /auth/tokens` → Bearer token `fw_pat_…`, **shown once**, ability-scoped, revocable.
- Implemented flows beyond the basics: email verification (`verified()` middleware,
  `/auth/email/*`), password recovery (enumeration-safe 202s, full credential rotation on
  reset — every session and API token revoked), two-step login with TOTP + one-time
  recovery codes, and a JWT guard verifying against a remote JWKS (authentication only —
  it never replaces resource policy).

## Protecting resources

```ts
import { requireAuth, requireAbility, authenticatedPolicy } from '@framework/auth';
```

- `requireAuth()` — any authenticated actor.
- `requireAbility('<resource>.<ability>')` — token ability check (`*` wildcards for
  sessions).
- Admin route families (`workflowRoutes`, `auditRoutes`, `importExportRoutes`) take a
  mount-time guard — a middleware, `authenticatedPolicy` or explicit `'public'`. Guards run
  before validation so anonymous callers get 401/403, not 422 schema disclosure.

Defaults are deny. Any authorization change needs positive and negative endpoint tests
(401 for anonymous, 403 for authenticated-but-unable) — `make:crud --access authenticated`
generates these automatically for scaffolded resources.

Expired-session cleanup is `session:prune` (needs the auth module; `--dry-run` counts,
`--confirm` deletes). Reference: `docs/cli-reference.md` (make:auth section).
