import { createAuthProvider } from '@framework/auth';
import type { AppConfig } from '../../../config';

/**
 * Session + personal API token authentication over the framework-owned
 * `users`/`sessions`/`api_tokens` tables (singletons on the database
 * connection). The guard is wired into the HTTP kernel by bootstrap/http.ts.
 */
export const authProvider = createAuthProvider<AppConfig>();
