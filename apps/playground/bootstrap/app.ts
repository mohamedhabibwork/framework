import { AUTH_SERVICE, authActorResolver, defineAuthRoutes, requireAbility } from '@framework/auth';
import type { Application } from '@framework/core';
import { defineApp, defineModule, requireAuth } from '@framework/http';
import { generateOpenApiDocument, type Operation } from '@framework/openapi';
import { apiPreset } from '@framework/presets';
import { workflowProvider, workflowRoutes } from '@framework/workflow';
import { csrf } from 'hono/csrf';
import { authOperations } from '../app/auth/openapi';
import { notificationDeliveryJob } from '../app/jobs';
import { productExportJob, productImportJob } from '../app/jobs/products.jobs';
import { listeners } from '../app/listeners';
import { productsModule } from '../app/modules/products';
import { notifications } from '../app/notifications';
import { authProvider } from '../app/providers/auth.provider';
import { eventsProvider, WEBSOCKET_GATEWAY } from '../app/providers/events.provider';
import { workflowsProvider } from '../app/workflows';
import type { AppConfig } from '../config';
import { createMiddleware } from './middleware';

export type PlaygroundApplication = Application<AppConfig>;

/** Documents the auth endpoints; their routes need the config, so `routes` below mounts them. */
const authModule = defineModule<AppConfig, Operation>({ name: 'auth', operations: authOperations });

/**
 * The standard API stack. The playground replaces `events` with its own
 * provider, which adds the realtime hub and workflow channels.
 */
const api = apiPreset<AppConfig>({
  events: eventsProvider,
  listeners,
  data: {
    imports: [productImportJob],
    exports: [productExportJob],
    resources: ['products'],
    // Dispatching jobs and reading artifacts is authenticated-only.
    authorize: requireAuth(),
  },
  notifications: { definitions: notifications, job: notificationDeliveryJob },
});

/**
 * The application, registered in one place. Generators add providers and
 * modules below their markers; list order does not matter (boot order comes
 * from each provider's `dependsOn` / `provides` / `requires` / `optional`).
 *
 * The kernel owns the fixed outer order: request id -> body limit -> request
 * scope -> secure headers (strict preset, `http.secureHeaders`) -> CORS
 * (`http.corsOrigins`, off when empty). The `api` middleware group (shared
 * throttle) then wraps every module under `/api/v1` and the app routes;
 * `/health` stays outside it so the probes still answer during a Redis outage.
 */
export const app = defineApp<AppConfig, Operation>({
  http: (config, application) => ({
    exposeInternalErrors: config.app.debug && config.app.env !== 'production',
    maxBodyBytes: config.http.maxBodyBytes,
    secureHeaders: config.http.secureHeaders,
    cors: { origins: config.http.corsOrigins },
    // Session/Bearer authentication happens before the request scope exists,
    // so every `currentActor()` call in the chain sees the real identity.
    resolveActor: authActorResolver(application),
    report: (error, context) => console.error('[http] unhandled error', context, error),
  }),
  middleware: (config) => createMiddleware(config).resolve(['api']),
  providers: [
    ...api.providers,
    authProvider,
    // @framework:providers
    workflowProvider,
    workflowsProvider,
  ],
  modules: [
    // @framework:modules
    authModule,
    productsModule,
    ...api.modules,
  ],
  // Liveness never touches dependencies; readiness probes the database, cache and queue (2s each).
  health: api.health,
  routes: (http, application) => {
    const { config, container } = application;
    // @framework:app-routes
    // Framework auth endpoints (register/login/logout/me + API tokens). The
    // AUTH_SERVICE token resolves per request, so pre-boot composition stays
    // legal. CSRF guards the cookie flows; browser clients pass CORS origins.
    http.route(
      '/api/v1/auth',
      defineAuthRoutes({
        service: AUTH_SERVICE,
        session: config.auth.session,
        csrf: csrf({ origin: [...config.http.corsOrigins] }),
      }),
    );

    // Composing routes for inspection (route:list, OpenAPI) happens without
    // booting; boot-scoped subsystems exist once providers have registered.
    if (application.state !== 'booted') return;
    // The request scope's actor (authenticated or anonymous) opens a private
    // `user.<id>` channel automatically; channel joins broadcast presence.
    http.route('/ws', container.resolve(WEBSOCKET_GATEWAY).routes());
    // Workflow introspection/control (list, status, retry, cancel, dispatch).
    // Mounted outside the documented /api prefix (like /health) so the OpenAPI
    // drift check applies to client-facing resources; the ability guard makes
    // it admin-only (401 anonymous, 403 without `workflow.admin`).
    http.route('/admin/workflows', workflowRoutes({ authorize: requireAbility('workflow.admin') }));
  },
});

/** Builds the framework application with overrides applied. Callers boot it and own its shutdown. */
export const createApplication = (config: AppConfig): PlaygroundApplication => app.createApplication(config);

/**
 * The HTTP app. Hono RPC clients type against a module's routes, e.g.
 * `hc<typeof productRoutes>('/api/v1/products')`.
 */
export const createHttp = (application: PlaygroundApplication) => app.createHttp(application);

/** Session auth is a cookie; API clients authenticate with Bearer tokens. */
const securitySchemes = {
  sessionCookie: {
    type: 'apiKey',
    in: 'cookie',
    name: 'fw_session',
    description: 'Session cookie issued by /auth/login',
  },
  bearerAuth: { type: 'http', scheme: 'bearer', description: 'Personal API token (`fw_pat_…`)' },
} as const;

export function buildOpenApiDocument(version = '1.0.0') {
  return generateOpenApiDocument({ title: 'Playground API', version, operations: app.operations, securitySchemes });
}
