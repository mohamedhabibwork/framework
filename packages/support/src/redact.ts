import { isSecretKey, redact } from '@framework/core';

/** Redacts secret-looking keys before an object reaches a log line. */
export function redactForLogs<T>(value: T): T {
  return redact(value);
}

/** `true` when a key looks like a secret (token, password, authorization…). */
export function isSecret(key: string): boolean {
  return isSecretKey(key);
}
