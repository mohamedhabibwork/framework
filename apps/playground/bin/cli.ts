import { join } from 'node:path';
import { defineProject, frameworkCommands, runCli } from '@framework/cli';
import { listRoutes } from '@framework/http';
import { createApplication } from '../bootstrap/app';
import { createHttp } from '../bootstrap/http';
import { middleware } from '../bootstrap/middleware';
import { buildOpenApiDocument, operations } from '../bootstrap/openapi';
import { providers } from '../bootstrap/providers';
import { type AppConfig, loadAppConfig } from '../config';

const root = join(import.meta.dir, '..');

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
  routes: async (config) => listRoutes(createHttp(createApplication(config as AppConfig))),
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
