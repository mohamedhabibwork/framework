import { join } from 'node:path';
import {
  createTestDatabase,
  type JsonRequester,
  requireTestDatabaseUrl,
  serveOnEphemeralPort,
} from '@framework/testing';
import { createApplication, createHttp, type PlaygroundApplication } from '../bootstrap/app';
import { appConfig } from '../config';

const APP_ROOT = join(import.meta.dir, '..');

export interface TestContext {
  readonly application: PlaygroundApplication;
  readonly http: ReturnType<typeof createHttp>;
  /** In-process `http.request` by default; real loopback HTTP when TEST_MODE=network. */
  readonly client: JsonRequester;
  close(): Promise<void>;
}

/**
 * Boots the complete application against a fresh, migrated PostgreSQL
 * database. `close()` shuts down, stops any listener and drops the database
 * even when an earlier step fails.
 */
export async function createTestContext(): Promise<TestContext> {
  const database = await createTestDatabase({
    adminUrl: requireTestDatabaseUrl(),
    migrationsFolder: join(APP_ROOT, 'database/migrations'),
    applicationUrl: process.env.DATABASE_URL,
    environment: process.env.APP_ENV,
  });

  let application: PlaygroundApplication | undefined;
  try {
    const config = appConfig.parse({
      APP_ENV: 'test',
      APP_DEBUG: 'false',
      DATABASE_URL: database.url,
      DATABASE_MAX_CONNECTIONS: '4',
      // Cache, locks and rate limits stay in-process, isolated per context.
      CACHE_DRIVER: 'memory',
      // The explicit env above hides .env.test; queues need the Redis it names.
      REDIS_URL: process.env.REDIS_URL,
      // Suites issue many rapid requests from one client; the coarse
      // api-group ceiling is production behavior, not a test subject here.
      HTTP_THROTTLE_ENABLED: 'false',
    });
    application = await createApplication(config).boot();
    const http = createHttp(application);
    const server = process.env.TEST_MODE === 'network' ? serveOnEphemeralPort(http.fetch) : undefined;
    const booted = application;

    return {
      application: booted,
      http,
      client: server?.requester ?? { request: async (path, init) => http.request(path, init) },
      async close() {
        try {
          await server?.stop();
          await booted.shutdown();
        } finally {
          await database.drop();
        }
      },
    };
  } catch (error) {
    await application?.shutdown().catch(() => undefined);
    await database.drop();
    throw error;
  }
}
