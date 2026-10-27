import { EXECUTION_CONTEXT } from '@framework/core';
import { importExportRoutes } from '@framework/crud';
import { forbidden, resolve } from '@framework/http';
import { config } from '@framework/support';
import { DATA_PORTER } from '../app/providers/data.tokens';

/**
 * Queued import/export endpoints (documented via `dataOperations` in
 * `bootstrap/openapi.ts`):
 *
 * ```text
 * POST /api/v1/data/import                 dispatch an import (CSV/JSON)
 * GET  /api/v1/data/import/status/:jobId   job state and row errors
 * POST /api/v1/data/export                 dispatch an export
 * GET  /api/v1/data/export/status/:jobId   job state and progress
 * GET  /api/v1/data/export/download/:jobId the finished artifact
 * ```
 *
 * Import/export touches every resource, so it is denied in production until
 * an authorization layer is wired: replace this guard with e.g.
 * `requireAuth()` or `requireAbility('data.import')` once auth exists.
 *
 * The guard reads the booted application's validated config through the
 * `config()` helper (registered by the `Application` constructor) instead of
 * re-loading `.env` from disk at import time, so it never depends on the
 * working directory and cannot diverge from the app's own config.
 */
export const dataRoutes = importExportRoutes({
  porter: (c) => resolve(c, DATA_PORTER),
  execution: (c) => resolve(c, EXECUTION_CONTEXT),
  authorize: () => {
    if (config('app.env') === 'production') throw forbidden('Import/export endpoints require authorization');
  },
});
