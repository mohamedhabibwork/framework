import { RATE_LIMITER } from '@framework/cache';
import { MiddlewareRegistry, resolve, throttle } from '@framework/http';
import type { AppConfig } from '../config';

/**
 * Named aliases and groups, derived from the validated config. Resolved and
 * validated at bootstrap so unknown names fail before any request is served.
 * Native `hono/*` middleware can always be registered directly instead.
 *
 * Secure headers and CORS are owned by the kernel (`http.secureHeaders`,
 * `http.corsOrigins`). `throttle` is the generic fixed-window limiter over
 * the cache package's `RATE_LIMITER` (Redis counters are cluster-wide); the
 * limiter resolves per request, so the alias is safe to declare pre-boot.
 * Mounted on the `api` group with the `http.throttle` knobs (120/min/IP by
 * default; test suites disable it via `HTTP_THROTTLE_ENABLED=false`).
 */
export function createMiddleware(config: AppConfig): MiddlewareRegistry {
  return (
    new MiddlewareRegistry()
      .alias(
        'throttle',
        throttle({
          limiter: (c) => resolve(c, RATE_LIMITER),
          enabled: config.http.throttle.enabled,
          limit: config.http.throttle.limit,
          windowSeconds: config.http.throttle.windowSeconds,
          prefix: 'http.api',
        }),
      )
      // @framework:middleware
      .group('api', ['throttle'])
  );
}
