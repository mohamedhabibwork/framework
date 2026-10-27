import { AUTH_SERVICE, type AuthConfig, defineAuthRoutes } from '@framework/auth';
import { csrf } from 'hono/csrf';
import type { AppConfig } from '../../../config';

/**
 * Framework auth endpoints (register/login/logout/me + API tokens). CSRF
 * guards the cookie flows with the app’s CORS origins; AUTH_SERVICE is
 * resolved per request, so composition order stays free.
 */
export const authRoutes = (config: Pick<AppConfig, 'auth' | 'http'>) =>
  defineAuthRoutes({
    service: AUTH_SERVICE,
    session: config.auth.session as Pick<AuthConfig['session'], 'cookie' | 'ttlSeconds' | 'secure'>,
    csrf: csrf({ origin: [...config.http.corsOrigins] }),
  });
