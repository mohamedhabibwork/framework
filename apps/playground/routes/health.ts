import { cacheHealthCheck } from '@framework/cache';
import { databaseHealthCheck } from '@framework/database';
import { healthRoutes as frameworkHealthRoutes } from '@framework/http';
import { queueHealthCheck } from '@framework/queue';

/** Liveness never touches dependencies; readiness probes the database, cache and queue (2s each). */
export const healthRoutes = frameworkHealthRoutes({
  checks: [databaseHealthCheck(), cacheHealthCheck(), queueHealthCheck()],
});
