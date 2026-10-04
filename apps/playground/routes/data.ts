import { EXECUTION_CONTEXT } from '@framework/core';
import { importExportRoutes } from '@framework/crud';
import { resolve } from '@framework/http';
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
 */
export const dataRoutes = importExportRoutes({
  porter: (c) => resolve(c, DATA_PORTER),
  execution: (c) => resolve(c, EXECUTION_CONTEXT),
});
