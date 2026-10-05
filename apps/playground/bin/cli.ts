import { join } from 'node:path';
import { PgSessionStore } from '@framework/auth';
import { MemoryCache, RedisCache } from '@framework/cache';
import { defineProject, frameworkCommands, runCli } from '@framework/cli';
import { createConnection } from '@framework/database';
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

/** Application-local CLI: the project root comes from this file, never from the shell's cwd. */
const project = defineProject({
  name: 'playground',
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
    scheduler: ['bun', 'run', 'bin/scheduler.ts'],
  },
  // Workspace-level test env (see .env.test.example at the repository root).
  testEnvFile: join(root, '..', '..', '.env.test'),
  loadConfig: (envFile) => loadAppConfig({ envFile: envFile ?? join(root, '.env') }),
  databaseUrl: (config) => (config as AppConfig).database.url,
  queueUrl: (config) => ({
    url: (config as AppConfig).redis.url,
    prefix: (config as AppConfig).queue.prefix,
    queue: (config as AppConfig).queue.name,
  }),
  // Runtime handles for the infrastructure commands. Each opens its resources
  // from the parsed config on demand (the container is never booted here) and
  // the command closes the handle exactly once.
  cache: async (config) => {
    const cacheConfig = (config as AppConfig).cache;
    const cache =
      cacheConfig.driver === 'redis'
        ? new RedisCache({ url: cacheConfig.url, prefix: cacheConfig.prefix })
        : new MemoryCache();
    return {
      driver: cacheConfig.driver,
      clear: () => cache.clear(),
      close: () => cache.close(),
    };
  },
  sessions: async (config) => {
    const appConfig = config as AppConfig;
    const connection = createConnection({
      url: appConfig.database.url,
      maxConnections: 1,
      applicationName: `${appConfig.app.name}-cli`,
    });
    const sessions = new PgSessionStore(connection);
    return {
      countExpired: (now?: Date) => sessions.countExpired(now),
      prune: (now?: Date) => sessions.prune(now),
      close: () => connection.close(),
    };
  },
  routes: async (config) => listRoutes(createHttp(createApplication(config as AppConfig))),
  seeders: async () => (await import('../database/seeders')).seeders,
  providers: () => providers.map((provider) => provider.name),
  middleware: () => middleware.describe(),
  openapi: () => ({ operations, build: buildOpenApiDocument }),
});

process.exitCode = await runCli({
  argv: process.argv.slice(2),
  project,
  commands: frameworkCommands,
  cliVersion: '0.1.0',
});
