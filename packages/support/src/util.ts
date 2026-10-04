import { randomUUID } from 'node:crypto';

/** Resolves to the value, calling functions (Laravel `value()`). */
export function value<T>(input: T | (() => T)): T {
  return typeof input === 'function' ? (input as () => T)() : input;
}

/** Taps into a value chain without breaking it (Laravel `tap()`). */
export function tap<T>(value: T, callback: (value: T) => void): T {
  callback(value);
  return value;
}

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  readonly attempts?: number;
  /** Base delay for exponential backoff in ms (default 200; doubled per try). */
  readonly backoffMs?: number;
}

/**
 * Retries `work` with exponential backoff until it resolves or attempts run
 * out; rejects with the last error. For queue semantics (at-least-once,
 * idempotency) use `defineJob` instead.
 */
export async function retry<T>(work: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? 200;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(backoffMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

/** RFC 4122 v4 UUID (primary keys, correlation of one-off operations). */
export function uuid(): string {
  return randomUUID();
}

/** Current time as ISO-8601 (the framework's JSON timestamp format). */
export function nowIso(): string {
  return new Date().toISOString();
}
