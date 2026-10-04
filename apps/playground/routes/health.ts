import { DATABASE, pingDatabase } from '@framework/database';
import { type FrameworkEnv, resolve } from '@framework/http';
import { Hono } from 'hono';

/** Liveness never touches dependencies; readiness checks the database. */
export const healthRoutes = new Hono<FrameworkEnv>()
  .get('/live', (c) => c.json({ status: 'ok' as const }))
  .get('/ready', async (c) => {
    const database = await pingDatabase(resolve(c, DATABASE));
    return database
      ? c.json({ status: 'ready' as const, checks: { database: 'ok' as const } }, 200)
      : c.json({ status: 'unavailable' as const, checks: { database: 'failed' as const } }, 503);
  });
