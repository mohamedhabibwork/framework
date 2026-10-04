import { MiddlewareRegistry } from '@framework/http';
import { secureHeaders } from 'hono/secure-headers';

/**
 * Optional named aliases and groups. Resolved and validated at bootstrap so
 * unknown names fail before any request is served. Native `hono/*`
 * middleware can always be registered directly instead.
 */
export const middleware = new MiddlewareRegistry()
  .alias('secure-headers', secureHeaders())
  .group('api', ['secure-headers']);

middleware.validate();
