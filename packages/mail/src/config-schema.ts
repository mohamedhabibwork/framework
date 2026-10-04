import { z } from 'zod/v4';

/**
 * Validated shape of the application's `mail` configuration section. Apps
 * compose it into their config schema: `mail: mailConfigSchema` (the driver
 * defaults to `console`; `from` must always be configured).
 */
export const mailConfigSchema = z.object({
  driver: z.enum(['console', 'memory']).default('console'),
  from: z.string().trim().toLowerCase().email(),
});
