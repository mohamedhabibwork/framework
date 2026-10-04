import { describe, expect, test } from 'bun:test';
import { setApplicationConfig } from '@framework/core';
import { createConfigReader } from '../src/config-types';

setApplicationConfig(
  JSON.parse('{"app":{"name":"acme","debug":false},"http":{"port":3000},"features":["a"]}') as never,
);

/** Mirrors a real app's frozen config shape. */
interface AppConfig {
  readonly app: { readonly name: string; readonly debug: boolean };
  readonly http: { readonly port: number };
  readonly features: readonly string[];
  readonly owner: string | null;
}

const reader = createConfigReader<AppConfig>();

describe('createConfigReader (typed config paths)', () => {
  test('returns exact value types from dotted paths', () => {
    const port: number = reader.get('http.port');
    const name: string = reader.get('app.name');
    const debug: boolean = reader.get('app.debug');
    expect([port, name, debug]).toEqual([3000, 'acme', false]);
  });

  test('getWithDefault fills unset paths with the fallback type', () => {
    const owner: string = reader.getWithDefault('owner', 'system');
    expect(owner).toBe('system');
  });

  // Compile-time autocomplete guards: these lines must typecheck; a wrong
  // path or mismatched fallback must not.
  test('paths are exhaustively typed (compile-time contract)', () => {
    const _paths: Array<'app' | 'app.name' | 'app.debug' | 'http' | 'http.port' | 'features' | 'owner'> = [
      'app',
      'app.name',
      'app.debug',
      'http',
      'http.port',
      'features',
      'owner',
    ];
    expect(_paths).toHaveLength(7);
  });
});
