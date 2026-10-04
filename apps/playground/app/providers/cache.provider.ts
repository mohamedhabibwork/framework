import { createCacheProvider } from '@framework/cache';
import { defineProvider } from '@framework/core';
import type { AppConfig } from '../../config';

/**
 * Application cache, lock store and rate limiter on one driver (`CACHE`,
 * `LOCK_STORE`, `RATE_LIMITER`). Registered before the auth provider so the
 * login rate limiter can bind; `memory` is per-process, `redis` (the default)
 * shares state across instances via REDIS_URL.
 */
export const cacheProvider = defineProvider<AppConfig>(
  createCacheProvider<AppConfig>((config: AppConfig) => ({
    driver: config.cache.driver,
    redis: config.cache.driver === 'redis' ? { url: config.cache.url, prefix: config.cache.prefix } : undefined,
  })),
);
