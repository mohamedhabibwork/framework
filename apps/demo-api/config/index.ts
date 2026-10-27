import { authConfigSchema } from '@framework/auth';
import { type DeepReadonly, loadConfig } from '@framework/core';
import { z } from 'zod/v4';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const configSchema = z.object({
  app: z.object({
    name: z.string().min(1).default('demo-api-test'),
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
    secureHeaders: booleanString.default(true),
    throttle: z.object({
      enabled: booleanString.default(true),
      limit: z.coerce.number().int().min(1).default(120),
      windowSeconds: z.coerce.number().int().min(1).default(60),
    }),
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
    prefix: z.string().min(1).default('demo-api-test'),
  }),
  events: z.object({
    driver: z.enum(['memory', 'redis']).default('memory'),
  }),
  cache: z.object({
    driver: z.enum(['memory', 'redis']).default('redis'),
    redis: z.object({
      url: z.url({ protocol: /^redis$/ }).default('redis://127.0.0.1:6379'),
      prefix: z.string().min(1).default('demo-api-test'),
    }),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    driver: z.enum(['console', 'file', 'memory']).default('console'),
    name: z.string().min(1).default('demo-api-test'),
    filePath: z.string().min(1).optional(),
    maxBytes: z.coerce.number().int().positive().optional(),
  }),
  storage: z.object({
    default: z.string().min(1).default('local'),
    disks: z.object({
      local: z.object({
        driver: z.literal('local'),
        root: z.string().min(1).default('storage'),
        visibility: z.enum(['private', 'public']).default('private'),
      }),
    }),
  }),
  mail: z.object({
    driver: z.enum(['console', 'memory']).default('console'),
    from: z.string().trim().toLowerCase().email().default('no-reply@demo-api-test.local'),
  }),
  notifications: z.object({
    providers: z
      .object({
        push: z
          .object({
            type: z.string().trim().min(1),
            target: z.string().trim().min(1).optional(),
            options: z.record(z.string(), z.unknown()).optional(),
          })
          .optional(),
        messaging: z
          .object({
            type: z.string().trim().min(1),
            target: z.string().trim().min(1).optional(),
            options: z.record(z.string(), z.unknown()).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
  // @framework:config-schema-sections
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
    secureHeaders: env.HTTP_SECURE_HEADERS as never,
    throttle: {
      enabled: env.HTTP_THROTTLE_ENABLED as never,
      limit: env.HTTP_THROTTLE_LIMIT,
      windowSeconds: env.HTTP_THROTTLE_WINDOW_SECONDS,
    },
    shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  },
  database: {
    url: env.DATABASE_URL as string,
    maxConnections: env.DATABASE_MAX_CONNECTIONS,
    migrationsFolder: env.DATABASE_MIGRATIONS_FOLDER,
  },
  redis: { url: env.REDIS_URL },
  queue: { name: env.QUEUE_NAME, concurrency: env.QUEUE_CONCURRENCY, prefix: env.QUEUE_PREFIX },
  events: { driver: env.EVENTS_DRIVER as never },
  cache: {
    driver: env.CACHE_DRIVER as never,
    redis: { url: env.CACHE_REDIS_URL, prefix: env.CACHE_REDIS_PREFIX },
  },
  logging: {
    level: env.LOG_LEVEL as never,
    driver: env.LOG_DRIVER as never,
    name: env.LOG_NAME,
    filePath: env.LOG_FILE_PATH,
    maxBytes: env.LOG_MAX_BYTES,
  },
  storage: {
    default: env.STORAGE_DEFAULT,
    disks: {
      local: { driver: 'local' as const, root: env.STORAGE_ROOT, visibility: env.STORAGE_VISIBILITY as never },
    },
  },
  mail: {
    driver: env.MAIL_DRIVER as never,
    from: env.MAIL_FROM,
  },
  notifications: {
    providers: {
      ...(env.NOTIFICATIONS_PUSH_TYPE ? { push: { type: env.NOTIFICATIONS_PUSH_TYPE } } : {}),
      ...(env.NOTIFICATIONS_MESSAGING_TYPE ? { messaging: { type: env.NOTIFICATIONS_MESSAGING_TYPE } } : {}),
    },
  },
  // @framework:config-env-sections
  auth: {},
});

export function loadAppConfig(options: { envFile?: string; processEnv?: Record<string, string | undefined> } = {}) {
  return loadConfig({ schema: configSchema, map: mapEnvironment, envFile: options.envFile ?? '.env', ...options });
}
