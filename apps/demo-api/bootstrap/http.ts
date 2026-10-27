import { authActorResolver } from '@framework/auth';
import { auditRoutes } from '@framework/crud';
import { AUDIT_READER } from '@framework/database';
import { assertNoDuplicateRoutes, createHttpKernel, type FrameworkEnv, forbidden, resolve } from '@framework/http';
import type { Context } from 'hono';
import { authRoutes } from '../app/modules/auth';
import { WEBSOCKET_GATEWAY } from '../app/providers/events.provider';
import { apiRoutes } from '../routes/api';
import { healthRoutes } from '../routes/health';
import type { DemoApiTestApplication } from './app';
import { createMiddleware } from './middleware';

/**
 * Composes the typed Hono application. The kernel owns the fixed outer order:
 * request id -> body limit -> request scope -> secure headers (strict preset,
 * `http.secureHeaders`) -> CORS (`http.corsOrigins`, off when empty) ->
 * module routes. The `api` middleware group adds the shared throttle.
 *
 * Audit endpoints (`/audit`) read the framework-owned audit trail; they are
 * denied in production until an identity/authorization layer exists. The
 * `/ws` gateway opens private `user.<id>` channels for authenticated
 * actors and broadcasts presence.
 */
export function createHttp(application: DemoApiTestApplication) {
  const { config } = application;
  const http = createHttpKernel(application, {
    resolveActor: authActorResolver(application),
    exposeInternalErrors: config.app.debug && config.app.env !== 'production',
    maxBodyBytes: config.http.maxBodyBytes,
    secureHeaders: config.http.secureHeaders,
    cors: { origins: config.http.corsOrigins },
    report: (error, context) => console.error('[http] unhandled error', context, error),
  })
    .use(...createMiddleware(config).resolve(['api']))
    .route('/health', healthRoutes)
    .route('/api/v1', apiRoutes)
    .route('/api/v1/auth', authRoutes(config))
    .route(
      '/audit',
      auditRoutes({
        authorize: (_c: Context<FrameworkEnv>) => {
          if (config.app.env === 'production') throw forbidden('Audit endpoints require authorization');
        },
        reader: (c: Context<FrameworkEnv>) => resolve(c, AUDIT_READER),
      }),
    )
    .route('/ws', application.container.resolve(WEBSOCKET_GATEWAY).routes());

  assertNoDuplicateRoutes(http);
  return http;
}

/** Route types for Hono RPC clients (`hc<AppType>()`). */
export type AppType = ReturnType<typeof createHttp>;
