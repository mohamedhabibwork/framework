// Public API of @framework/support.
// Convention: every interface/type lives in `./types`; runtime values stay
// in their modules.
export { config, env } from './config';
// Grouped conventions: every type in ./types.
export type { ConfigReader, DeepKeys, PathValue } from './config-types';
export { createConfigReader } from './config-types';
export { correlationId, currentActor, execution } from './context';
export { abort, abort_if, abort_unless, logger } from './errors-logging';
export { isSecret, redactForLogs } from './redact';
export type { Logger, LogLevel, RetryOptions } from './types';
export { nowIso, retry, sleep, tap, uuid, value } from './util';
