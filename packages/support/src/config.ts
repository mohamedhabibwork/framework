import type { JsonObject, JsonValue } from '@framework/core';
import { applicationConfigOrThrow } from '@framework/core';

/**
 * Dot-path access into the booted application's validated config —
 * `config('http.port')`, `config('database.url')`. Reads the same frozen
 * config the container exposes as `CONFIG`; throws when no application was
 * constructed (scripts must load config explicitly).
 */
export function config<T extends JsonValue = JsonValue>(path: string, fallback?: T): T {
  const found = getAtPath(applicationConfigOrThrow(), path);
  return (found === undefined ? fallback : found) as T;
}

function getAtPath(source: object, path: string): JsonValue | undefined {
  let node: JsonValue | undefined = source as JsonValue;
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = (node as JsonObject)[key];
  }
  return node;
}

/** Process-environment lookup (`env('DATABASE_URL')`); process env always wins over files. */
export function env(name: string): string | undefined;
export function env<T extends string>(name: string, fallback: T): string;
export function env(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}
