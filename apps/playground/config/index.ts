import { authConfigSchema } from '@framework/auth';
import { type DeepReadonly, loadConfig } from '@framework/core';
import { z } from 'zod/v4';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const configSchema = z.object({
  app: z.object({
    name: z.string().min(1).default('playground'),
    env: z.enum(['development', 'test', 'production']).default('development'),
    debug: booleanString.default(false),
  }),
  http: z.object({
    host: z.string().min(1).default('127.0.0.1'),
    port: z.coerce.number().int().min(0).max(65535).default(3000),
    corsOrigins: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    maxBodyBytes: z.coerce
      .number()
      .int()
      .min(1)
      .default(1024 * 1024),
    shutdownTimeoutMs: z.coerce.number().int().min(100).default(10_000),
  }),
  database: z.object({
    url: z.url({ protocol: /^postgres(ql)?$/ }),
    maxConnections: z.coerce.number().int().min(1).max(100).default(10),
    migrationsFolder: z.string().default('database/migrations'),
  }),
  redis: z.object({
    url: z.url({ protocol: /^redis$/ }).default('redis://127.0.0.1:6379'),
  }),
  queue: z.object({
    name: z.string().min(1).default('default'),
    concurrency: z.coerce.number().int().min(1).max(64).default(4),
    prefix: z.string().min(1).default('playground'),
  }),
  workflow: z.object({
    /** Terminal runs older than this are removed by `workflow:prune`. */
    retentionDays: z.coerce.number().int().min(1).max(365).default(7),
  }),
  scheduler: z.object({
    timezone: z.string().min(1).optional(),
  }),
  events: z.object({
    driver: z.enum(['memory', 'redis']).default('memory'),
  }),
  auth: authConfigSchema,
});

export type AppConfig = DeepReadonly<z.output<typeof configSchema>>;

/** Maps environment variables onto the config schema. Precedence: process env > env file > defaults. */
export const mapEnvironment = (env: Readonly<Record<string, string>>): z.input<typeof configSchema> => ({
  app: { name: env.APP_NAME, env: env.APP_ENV as never, debug: env.APP_DEBUG as never },
  http: {
    host: env.HTTP_HOST,
    port: env.HTTP_PORT,
    corsOrigins: env.CORS_ORIGINS,
    maxBodyBytes: env.HTTP_MAX_BODY_BYTES,
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  },
  database: {
    url: env.DATABASE_URL as string,
    maxConnections: env.DATABASE_MAX_CONNECTIONS,
    migrationsFolder: env.DATABASE_MIGRATIONS_FOLDER,
  },
  redis: { url: env.REDIS_URL },
  queue: { name: env.QUEUE_NAME, concurrency: env.QUEUE_CONCURRENCY, prefix: env.QUEUE_PREFIX },
  workflow: { retentionDays: env.WORKFLOW_RETENTION_DAYS },
  scheduler: { timezone: env.SCHEDULER_TIMEZONE },
  events: { driver: env.EVENTS_DRIVER as never },
  auth: {},
});

export function loadAppConfig(options: { envFile?: string; processEnv?: Record<string, string | undefined> } = {}) {
  return loadConfig({ schema: configSchema, map: mapEnvironment, envFile: options.envFile ?? '.env', ...options });
}
