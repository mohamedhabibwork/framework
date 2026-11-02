import { join } from 'node:path';
import { authConfigSchema } from '@framework/auth';
import { type DefineConfigLoadOptions, defineConfig, fromEnv, type InferConfig } from '@framework/core';
import { loggingConfigSchema } from '@framework/logging';
import { z } from 'zod/v4';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * Kit-backed subsystem sections (see providers in app/providers/):
 * - `cache` feeds `cacheProvider` (@framework/cache): the default namespace
 *   cache, lock store and rate limiter. `memory` is per-process (development);
 *   `redis` shares state across instances and defaults to REDIS_URL.
 * - `logging` feeds `loggingProvider` (@framework/logging): console driver at
 *   info level by default; `file` requires LOG_FILE_PATH.
 * - `storage` feeds `storageProvider` (@framework/storage): one local disk
 *   rooted under the playground directory (created on first use, never by
 *   `storage:check`).
 */
const storageRoot = join(import.meta.dir, '..', 'storage');

const notificationProvider = (typeVariable: string) =>
  z
    .object({
      type: fromEnv(typeVariable, z.string().trim().min(1)),
      target: z.string().trim().min(1).optional(),
      options: z.record(z.string(), z.unknown()).optional(),
    })
    .optional();

/** One schema per setting, bound to its variable. Precedence: process env > env file > defaults. */
export const appConfig = defineConfig({
  app: z.object({
    name: fromEnv('APP_NAME', z.string().min(1).default('playground')),
    env: fromEnv('APP_ENV', z.enum(['development', 'test', 'production']).default('development')),
    debug: fromEnv('APP_DEBUG', booleanString.default(false)),
  }),
  http: z.object({
    host: fromEnv('HTTP_HOST', z.string().min(1).default('127.0.0.1')),
    port: fromEnv('HTTP_PORT', z.coerce.number().int().min(0).max(65535).default(3000)),
    corsOrigins: fromEnv(
      'CORS_ORIGINS',
      z
        .string()
        .default('')
        .transform((value) =>
          value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
        ),
    ),
    maxBodyBytes: fromEnv(
      'HTTP_MAX_BODY_BYTES',
      z.coerce
        .number()
        .int()
        .min(1)
        .default(1024 * 1024),
    ),
    secureHeaders: fromEnv('HTTP_SECURE_HEADERS', booleanString.default(true)),
    throttle: z.object({
      enabled: fromEnv('HTTP_THROTTLE_ENABLED', booleanString.default(true)),
      limit: fromEnv('HTTP_THROTTLE_LIMIT', z.coerce.number().int().min(1).default(120)),
      windowSeconds: fromEnv('HTTP_THROTTLE_WINDOW_SECONDS', z.coerce.number().int().min(1).default(60)),
    }),
    shutdownTimeoutMs: fromEnv('SHUTDOWN_TIMEOUT_MS', z.coerce.number().int().min(100).default(10_000)),
  }),
  database: z.object({
    url: fromEnv('DATABASE_URL', z.url({ protocol: /^postgres(ql)?$/ })),
    maxConnections: fromEnv('DATABASE_MAX_CONNECTIONS', z.coerce.number().int().min(1).max(100).default(10)),
    migrationsFolder: fromEnv('DATABASE_MIGRATIONS_FOLDER', z.string().default('database/migrations')),
  }),
  redis: z.object({
    url: fromEnv('REDIS_URL', z.url({ protocol: /^redis$/ }).default('redis://127.0.0.1:6379')),
  }),
  queue: z.object({
    name: fromEnv('QUEUE_NAME', z.string().min(1).default('default')),
    concurrency: fromEnv('QUEUE_CONCURRENCY', z.coerce.number().int().min(1).max(64).default(4)),
    prefix: fromEnv('QUEUE_PREFIX', z.string().min(1).default('playground')),
  }),
  workflow: z.object({
    /** Terminal runs older than this are removed by `workflow:prune`. */
    retentionDays: fromEnv('WORKFLOW_RETENTION_DAYS', z.coerce.number().int().min(1).max(365).default(7)),
  }),
  scheduler: z.object({
    timezone: fromEnv('SCHEDULER_TIMEZONE', z.string().min(1).optional()),
  }),
  events: z.object({
    driver: fromEnv('EVENTS_DRIVER', z.enum(['memory', 'redis']).default('memory')),
  }),
  cache: z.object({
    driver: fromEnv('CACHE_DRIVER', z.enum(['memory', 'redis']).default('redis')),
    url: fromEnv(['CACHE_URL', 'REDIS_URL'], z.string().min(1).default('redis://127.0.0.1:6379')),
    prefix: fromEnv('CACHE_PREFIX', z.string().min(1).default('playground')),
  }),
  // The package's schema, with its defaults and file-driver check, plus env bindings.
  logging: loggingConfigSchema.safeExtend({
    level: fromEnv('LOG_LEVEL', loggingConfigSchema.shape.level.clone()),
    driver: fromEnv('LOG_DRIVER', loggingConfigSchema.shape.driver.clone()),
    filePath: fromEnv('LOG_FILE_PATH', loggingConfigSchema.shape.filePath.clone()),
  }),
  storage: z.object({
    default: fromEnv('STORAGE_DEFAULT_DISK', z.string().min(1).default('local')),
    disks: z.object({
      local: z.object({
        driver: z.literal('local').default('local'),
        root: fromEnv('STORAGE_ROOT', z.string().min(1).default(storageRoot)),
        visibility: z.enum(['private', 'public']).default('private'),
        publicBaseUrl: z.string().min(1).optional(),
      }),
    }),
  }),
  mail: z.object({
    driver: fromEnv('MAIL_DRIVER', z.enum(['console', 'memory']).default('console')),
    from: fromEnv('MAIL_FROM', z.string().trim().toLowerCase().email().default('no-reply@playground.local')),
  }),
  notifications: z.object({
    providers: z
      .object({
        push: notificationProvider('NOTIFICATIONS_PUSH_TYPE'),
        messaging: notificationProvider('NOTIFICATIONS_MESSAGING_TYPE'),
      })
      .optional(),
  }),
  auth: authConfigSchema,
});

export type AppConfig = InferConfig<typeof appConfig>;

export const loadAppConfig = (options?: DefineConfigLoadOptions) => appConfig.load(options);
