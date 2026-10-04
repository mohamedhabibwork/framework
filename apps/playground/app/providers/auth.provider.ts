import { createAuthProvider } from '@framework/auth';
import { defineProvider } from '@framework/core';
import type { AppConfig } from '../../config';

/**
 * Session + personal API token authentication over the framework-owned
 * `users`/`sessions`/`api_tokens` tables (singletons on the database
 * connection; the guard is wired into the HTTP kernel in bootstrap/http.ts).
 */
export const authProvider = defineProvider<AppConfig>(createAuthProvider<AppConfig>());
