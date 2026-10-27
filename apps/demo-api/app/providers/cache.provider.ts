import { createCacheProvider } from '@framework/cache';
import type { AppConfig } from '../../config';

/**
 * The application cache stack — `CACHE`, `LOCK_STORE` and `RATE_LIMITER`
 * — on one driver (config `cache.driver`): in-process memory for
 * single-instance development/tests, redis for state shared across
 * instances. The auth provider publishes this stack's rate limiter for login
 * throttling, which is why it registers after this provider.
 */
export const cacheProvider = createCacheProvider<AppConfig>((config) => config.cache);
