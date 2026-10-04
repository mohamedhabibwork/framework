import type { DeepReadonly } from '@framework/core';
import { config as readConfig } from './config';

/** Non-object values terminate path generation. */
type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Every dotted path of an object's leaves —
 * `DeepKeys<{ http: { port: number } }>` = `'http.port'`. Powers editor
 * autocomplete for the typed config reader.
 */
export type DeepKeys<T> = T extends Primitive
  ? never
  : T extends readonly unknown[]
    ? never
    : { [K in keyof T & string]: T[K] extends Primitive ? K : K | `${K}.${DeepKeys<T[K]>}` }[keyof T & string];

/** Value at a dotted path (`PathValue<Cfg, 'http.port'>` = number). */
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? PathValue<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

export interface ConfigReader<TConfig extends object> {
  /**
   * Dot-path access with **editor autocomplete for every path** and the exact
   * value type as the return type.
   */
  get<P extends DeepKeys<DeepReadonly<TConfig>>>(path: P): PathValue<DeepReadonly<TConfig>, P>;
  /** Same, with a fallback for paths that may be unset at runtime. */
  getWithDefault<P extends DeepKeys<DeepReadonly<TConfig>>>(
    path: P,
    fallback: NonNullable<PathValue<DeepReadonly<TConfig>, P>>,
  ): NonNullable<PathValue<DeepReadonly<TConfig>, P>>;
}

/**
 * Creates a config reader with **editor autocomplete for every dotted path**
 * and exact value types. Call it once per app with the app's `AppConfig`:
 *
 * ```ts
 * export const { get: config } = createConfigReader<AppConfig>();
 * config('http.port'); // number — `http.` suggests every known key
 * ```
 *
 * The runtime implementation is the same validated, frozen config the global
 * `config()` helper reads; only the path/value types are added.
 */
export function createConfigReader<TConfig extends object>(): ConfigReader<TConfig> {
  type Frozen = DeepReadonly<TConfig>;
  return {
    get<P extends DeepKeys<Frozen>>(path: P): PathValue<Frozen, P> {
      return readConfig(path as string) as PathValue<Frozen, P>;
    },
    getWithDefault<P extends DeepKeys<Frozen>>(
      path: P,
      fallback: NonNullable<PathValue<Frozen, P>>,
    ): NonNullable<PathValue<Frozen, P>> {
      const value = readConfig(path as string);
      return (value === undefined ? fallback : value) as NonNullable<PathValue<Frozen, P>>;
    },
  };
}
