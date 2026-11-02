import { join } from 'node:path';
import { PgSessionStore } from '@framework/auth';
import { frameworkCommands, runCli } from '@framework/cli';
import { createConnection } from '@framework/database';
import { listRoutes } from '@framework/http';
import { apiProject } from '@framework/presets/cli';
import { app, buildOpenApiDocument, createApplication, createHttp } from '../bootstrap/app';
import { createMiddleware } from '../bootstrap/middleware';
import { type AppConfig, loadAppConfig } from '../config';

const root = join(import.meta.dir, '..');

/** Application-local CLI: the project root comes from this file, never from the shell's cwd. */
export const project = await apiProject({
  name: 'playground',
  frameworkVersion: '0.2.0',
  root,
  app,
  loadConfig: loadAppConfig,
  createMiddleware,
  buildOpenApiDocument,
  seeders: async () => (await import('../database/seeders')).seeders,
  overrides: {
    tools: { scheduler: ['bun', 'run', 'bin/scheduler.ts'] },
    // Workspace-level test env (see .env.test.example at the repository root).
    testEnvFile: join(root, '..', '..', '.env.test'),
    // The session store opens on its own connection, closed exactly once by the command.
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
    // Lists without booting: boot-scoped routes (/ws, /admin/workflows) stay out of the table.
    routes: async (config) => listRoutes(createHttp(createApplication(config as AppConfig))),
  },
});

if (import.meta.main) {
  process.exitCode = await runCli({
    argv: process.argv.slice(2),
    project,
    commands: frameworkCommands,
    cliVersion: '0.2.0',
  });
}
