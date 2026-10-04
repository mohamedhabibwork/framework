import { AUTH_SERVICE, authActorResolver, defineAuthRoutes } from '@framework/auth';
import { assertNoDuplicateRoutes, createHttpKernel } from '@framework/http';
import { workflowRoutes } from '@framework/workflow';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { WEBSOCKET_GATEWAY } from '../app/providers/events.provider';
import { apiRoutes } from '../routes/api';
import { healthRoutes } from '../routes/health';
import type { PlaygroundApplication } from './app';
import { middleware } from './middleware';

/**
 * Composes the typed Hono application. Order:
 * request id -> body limit -> request scope (kernel) -> secure headers ->
 * CORS (API only, before auth so preflight succeeds) -> module routes.
 */
export function createHttp(application: PlaygroundApplication) {
  const { config } = application;
  const http = createHttpKernel(application, {
    exposeInternalErrors: config.app.debug && config.app.env !== 'production',
    maxBodyBytes: config.http.maxBodyBytes,
    // Session/Bearer authentication happens before the request scope exists,
    // so every `currentActor()` call in the chain sees the real identity.
    resolveActor: authActorResolver(application),
    report: (error, context) => console.error('[http] unhandled error', context, error),
  })
    .use(...middleware.resolve(['api']))
    .use('/api/*', cors({ origin: [...config.http.corsOrigins] }))
    .route('/health', healthRoutes)
    .route('/api/v1', apiRoutes)
    // Framework auth endpoints (register/login/logout/me + API tokens). The
    // AUTH_SERVICE token resolves per request, so pre-boot composition stays
    // legal. CSRF guards the cookie flows; browser clients pass CORS origins.
    .route(
      '/api/v1/auth',
      defineAuthRoutes({
        service: AUTH_SERVICE,
        session: config.auth.session,
        csrf: csrf({ origin: [...config.http.corsOrigins] }),
      }),
    );

  // Composing routes for inspection (route:list, OpenAPI) happens without
  // booting; boot-scoped subsystems exist once providers have registered.
  if (application.state === 'booted') {
    http.route(
      '/ws',
      // The request scope's actor (authenticated or anonymous) opens a
      // private `user.<id>` channel automatically; channel joins broadcast
      // presence.
      application.container.resolve(WEBSOCKET_GATEWAY).routes(),
    );
    // Workflow introspection/control (list, status, retry, cancel, dispatch).
    // Mounted outside the documented /api prefix (like /health) so the OpenAPI
    // drift check applies to client-facing resources; unprotected until Phase
    // 3 auth — pass `authorize` to workflowRoutes when guards land.
    http.route('/admin/workflows', workflowRoutes());
  }

  assertNoDuplicateRoutes(http);
  return http;
}

/** Route types for Hono RPC clients (`hc<AppType>()`). */
export type AppType = ReturnType<typeof createHttp>;
