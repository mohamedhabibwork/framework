import { CACHE } from '@framework/cache';
import { DATABASE, pingDatabase } from '@framework/database';
import { type FrameworkEnv, resolve } from '@framework/http';
import { QUEUE } from '@framework/queue';
import { Hono } from 'hono';

/** One dependency probe; a thrown error becomes a 'failed' check, never a 500. */
const check = async (name: string, probe: () => Promise<unknown>): Promise<[string, 'ok' | 'failed']> => {
  try {
    await probe();
    return [name, 'ok'];
  } catch {
    return [name, 'failed'];
  }
};

/** Liveness never touches dependencies; readiness probes every backing service. */
export const healthRoutes = new Hono<FrameworkEnv>()
  .get('/live', (c) => c.json({ status: 'ok' as const }))
  .get('/ready', async (c) => {
    // Cache `has` is a Redis round-trip (false on a missing key, error on an
    // unreachable engine); queue counts exercises the BullMQ connection.
    const checks = await Promise.all([
      check('database', () => pingDatabase(resolve(c, DATABASE))),
      check('redis', () => resolve(c, CACHE).has('__health__')),
      check('queue', () => resolve(c, QUEUE).counts()),
    ]);
    const failed = checks.some(([, state]) => state === 'failed');
    return c.json(
      { status: failed ? ('unavailable' as const) : ('ready' as const), checks: Object.fromEntries(checks) },
      failed ? 503 : 200,
    );
  });
