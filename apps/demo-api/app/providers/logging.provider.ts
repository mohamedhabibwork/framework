import { createLoggingProvider } from '@framework/logging';
import type { AppConfig } from '../../config';

/**
 * The shared structured logger (`LOGGER`) from the `logging` section:
 * console sink at info level by default; switch to `file` (with
 * `LOG_FILE_PATH`) for production. Every entry is redacted and enriched
 * with the ambient execution context (actor, correlation id).
 */
export const loggingProvider = createLoggingProvider<AppConfig>((config) => config.logging);
