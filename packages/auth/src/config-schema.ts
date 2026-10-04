import { z } from 'zod/v4';
import type { AuthConfig } from './types';

/**
 * Validated shape of the application's `auth` configuration section. Apps
 * compose it into their config schema: `auth: authConfigSchema.default({})`.
 */
export const authConfigSchema = z.object({
  guards: z
    .array(z.enum(['session', 'api-token']))
    .min(1)
    .default(['session', 'api-token']),
  session: z
    .object({
      cookie: z.string().min(1).default('fw_session'),
      ttlSeconds: z
        .number()
        .int()
        .positive()
        .default(7 * 24 * 60 * 60),
      secure: z.boolean().default(false),
    })
    .prefault({}),
  token: z
    .object({
      ttlSeconds: z
        .number()
        .int()
        .positive()
        .nullable()
        .default(30 * 24 * 60 * 60),
    })
    .prefault({}),
  rateLimit: z
    .object({
      /** Master switch for login throttling; disabling is an explicit choice, not a silent bypass. */
      enabled: z.boolean().default(true),
      /** Failed logins allowed per email inside one window; the next attempt is answered 429. */
      maxAttempts: z.number().int().min(1).default(5),
      /** Fixed-window length in seconds; the failure counter expires with it. */
      windowSeconds: z.number().int().min(1).default(60),
    })
    .prefault({}),
});

/** Resolved defaults, exported for tests and documentation. */
export const defaultAuthConfig: AuthConfig = authConfigSchema.parse({});
