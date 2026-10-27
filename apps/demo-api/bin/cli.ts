import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryCache, RedisCache } from '@framework/cache';
import { defineProject, frameworkCommands, runCli } from '@framework/cli';
import { createConnection, type DatabaseConnection } from '@framework/database';
import { listRoutes } from '@framework/http';
import { createApplication } from '../bootstrap/app';
import { createHttp } from '../bootstrap/http';
import { createMiddleware } from '../bootstrap/middleware';
import { buildOpenApiDocument, operations } from '../bootstrap/openapi';
import { providers } from '../bootstrap/providers';
import { type AppConfig, loadAppConfig } from '../config';

const root = join(import.meta.dir, '..');

// The middleware alias table is config-driven; load it once for `middleware:list`.
const middleware = createMiddleware(await loadAppConfig({ envFile: join(root, '.env') }));

/**
 * `make:auth` installs the auth module (and the `@framework/auth`
 * dependency) into an existing application, so a freshly created app has
 * neither: the `sessions` hook below therefore only exists once the module
 * does, and the package is loaded through a runtime specifier for the same
 * reason. Without it, `session:prune` reports itself as unsupported and
 * points at `make:auth`.
 */
const authInstalled = existsSync(join(root, 'app/modules/auth/provider.ts'));
const AUTH_SPECIFIER: string = '@framework/auth';

/** Opens the application cache for `cache:clear`; the driver comes from configuration. */
const openCache = async (rawConfig: unknown) => {
  const config = rawConfig as AppConfig;
  const cache =
    config.cache.driver === 'redis'
      ? new RedisCache({ url: config.cache.redis.url, prefix: config.cache.redis.prefix })
      : new MemoryCache();
  return {
    driver: config.cache.driver,
    clear: () => cache.clear(),
    close: () => cache.close(),
  };
};

/**
 * Opens the auth session store for `session:prune` on its own connection:
 * the store satisfies the CLI's structural contract (count/prune/close) and
 * `close()` releases that connection.
 */
const openSessionStore = authInstalled
  ? async (rawConfig: unknown) => {
      const config = rawConfig as AppConfig;
      const auth = (await import(AUTH_SPECIFIER)) as {
        PgSessionStore: new (
          connection: DatabaseConnection,
        ) => {
          countExpired(now?: Date): Promise<number>;
          prune(now?: Date): Promise<number>;
        };
      };
      const connection = createConnection({
        url: config.database.url,
        maxConnections: config.database.maxConnections,
        applicationName: config.app.name,
      });
      const store = new auth.PgSessionStore(connection);
      return {
        countExpired: (now?: Date) => store.countExpired(now),
        prune: (now?: Date) => store.prune(now),
        close: () => connection.close(),
      };
    }
  : undefined;

/**
 * Application-local CLI: the project root comes from this file, never from the
 * shell's cwd. Exported for embedders (e.g. the MCP server) that invoke
 * commands in-process.
 */
export const project = defineProject({
  name: 'demo-api-test',
  root,
  frameworkVersion: '0.1.0',
  apiPrefix: '/api/v1',
  paths: {
    modules: 'app/modules',
    schemaDir: 'database/schema',
    schemaIndex: 'database/schema/index.ts',
    factories: 'database/factories',
    migrations: 'database/migrations',
    apiRoutes: 'routes/api.ts',
    providers: 'bootstrap/providers.ts',
    middleware: 'bootstrap/middleware.ts',
    openapi: 'bootstrap/openapi.ts',
    config: 'config/index.ts',
    testSupport: 'tests/support.ts',
  },
  tools: {
    typecheck: ['bunx', 'tsc', '-p', 'tsconfig.json'],
    test: ['bun', 'test'],
    lint: ['bunx', 'biome', 'check', '.'],
    format: ['bunx', 'biome', 'format', '.'],
    drizzleKit: ['bunx', 'drizzle-kit'],
    dev: ['bun', 'run', '--hot', 'bin/server.ts'],
    serve: ['bun', 'run', 'bin/server.ts'],
    worker: ['bun', 'run', 'bin/worker.ts'],
  },
  loadConfig: (envFile) => loadAppConfig({ envFile: envFile ?? join(root, '.env') }),
  databaseUrl: (config) => (config as AppConfig).database.url,
  queueUrl: (config) => ({
    url: (config as AppConfig).redis.url,
    prefix: (config as AppConfig).queue.prefix,
    queue: (config as AppConfig).queue.name,
  }),
  cache: openCache,
  ...(openSessionStore ? { sessions: openSessionStore } : {}),
  routes: async (config) => {
    // Booting only registers bindings (nothing connects); it makes the
    // listed route table match what the server actually serves.
    const booted = await createApplication(config as AppConfig).boot();
    try {
      return listRoutes(createHttp(booted));
    } finally {
      await booted.shutdown();
    }
  },
  providers: () => providers.map((provider) => provider.name),
  seeders: async () => (await import('../database/seeders')).seeders,
  middleware: () => middleware.describe(),
  openapi: () => ({ operations, build: buildOpenApiDocument }),
});

if (import.meta.main) {
  process.exitCode = await runCli({
    argv: process.argv.slice(2),
    project,
    commands: frameworkCommands,
    cliVersion: '0.1.0',
  });
}
