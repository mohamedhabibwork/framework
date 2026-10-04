# Security Policy

## Reporting a vulnerability

Do **not** open a public issue for security problems.

Report privately to **mohamedhabibwork@gmail.com** (or via GitHub private
vulnerability reporting on this repository). Include a reproduction, the
affected package (`@framework/*`), and the version you are running.

You will receive an acknowledgement within a few days and a fix timeline
once the issue is confirmed. Fixes land in the next minor release and are
described in `CHANGELOG.md`.

## Scope

The framework ships these deployable surfaces: the `@framework/*` packages,
the generated applications (`create`, `make:crud`, `make:auth` outputs), and
the docs site (`apps/docs`). The playground application is a demo — do not
deploy it as-is.
