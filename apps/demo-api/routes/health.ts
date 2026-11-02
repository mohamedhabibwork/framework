import { cacheHealthCheck } from '@framework/cache';
import { databaseHealthCheck } from '@framework/database';
import { healthRoutes as frameworkHealthRoutes } from '@framework/http';
import { queueHealthCheck } from '@framework/queue';

/**
 * Liveness never touches dependencies; readiness probes every backing service,
 * each under a deadline because `/health` is mounted ahead of the throttle and
 * a BullMQ command against an unreachable Redis otherwise never settles.
 */
export const healthRoutes = frameworkHealthRoutes({
  checks: [databaseHealthCheck(), cacheHealthCheck(), queueHealthCheck()],
});
