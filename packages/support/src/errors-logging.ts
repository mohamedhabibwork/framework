import { FrameworkError, type JsonObject, type JsonValue } from '@framework/core';
import { codesForStatus, ERROR_CATALOG, type ErrorCode, type ErrorStatus, httpError } from '@framework/http';
import { correlationId, currentActor } from './context';

/**
 * Throws the framework's HTTP error for a status or code — `abort(404)`,
 * `abort('VALIDATION_FAILED', 'details')`. Every error response carries a
 * stable catalog code, so clients never parse messages.
 */
export function abort(codeOrStatus: ErrorCode | ErrorStatus, message?: string): never {
  throw httpError(toCode(codeOrStatus), message);
}

/** `abort_if(condition, 403)` — throws only when the condition holds. */
export function abort_if(condition: boolean, codeOrStatus: ErrorCode | ErrorStatus, message?: string): void {
  if (condition) abort(codeOrStatus, message);
}

/** `abort_unless(condition, 401)` — throws only when the condition fails. */
export function abort_unless(condition: boolean, codeOrStatus: ErrorCode | ErrorStatus, message?: string): void {
  if (!condition) abort(codeOrStatus, message);
}

function toCode(codeOrStatus: ErrorCode | ErrorStatus): ErrorCode {
  if (typeof codeOrStatus === 'string') {
    if (codeOrStatus in ERROR_CATALOG) return codeOrStatus;
    throw new FrameworkError('UNKNOWN_ERROR_CODE', `"${codeOrStatus}" is not a catalogued error code`);
  }
  const code = codesForStatus(codeOrStatus)[0];
  if (!code) throw new FrameworkError('UNKNOWN_ERROR_STATUS', `No error code maps to status ${codeOrStatus}`);
  return code;
}

export interface Logger {
  debug(message: string, data?: JsonObject): void;
  info(message: string, data?: JsonObject): void;
  warn(message: string, data?: JsonObject): void;
  error(message: string, data?: JsonObject): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured logger bound to the current request/job: every line is one JSON
 * object on stderr carrying the correlation id and actor, so logs from one
 * request (and the jobs it dispatched) are greppable together. Secrets must
 * be redacted by the caller (`redact()`); data values must be JSON-safe.
 */
export function logger(scope = 'app'): Logger {
  const write = (level: LogLevel, message: string, data?: JsonObject) => {
    const entry: Record<string, JsonValue | string> = {
      time: new Date().toISOString(),
      level,
      scope,
      message,
      correlationId: correlationId(),
      actorId: currentActor().id ?? null,
      ...(data ? { data: data as JsonValue } : {}),
    };
    console.error(JSON.stringify(entry));
  };
  return {
    debug: (message, data) => write('debug', message, data),
    info: (message, data) => write('info', message, data),
    warn: (message, data) => write('warn', message, data),
    error: (message, data) => write('error', message, data),
  };
}
