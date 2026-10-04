import { afterEach, describe, expect, test } from 'bun:test';
import { deepFreeze, ExecutionContext, runWithExecution, setApplicationConfig } from '@framework/core';
import {
  abort,
  abort_if,
  abort_unless,
  config,
  correlationId,
  currentActor,
  env,
  execution,
  isSecret,
  logger,
  nowIso,
  redactForLogs,
  retry,
  sleep,
  tap,
  uuid,
  value,
} from '../src';

const APP_CONFIG = deepFreeze({
  app: { name: 'support-test', debug: false },
  http: { port: 3000, corsOrigins: ['http://localhost:5173'] },
});

setApplicationConfig(APP_CONFIG);

describe('config()', () => {
  test('reads dot paths from the booted application config', () => {
    expect(config('app.name')).toBe('support-test');
    expect(config('http.port')).toBe(3000);
    expect(config('http.corsOrigins')).toEqual(['http://localhost:5173']);
    expect(config('app.debug', true as boolean)).toBe(false);
  });

  test('falls back when a path is missing and works in nested scopes', async () => {
    expect(config('database.url', 'postgres://fallback')).toBe('postgres://fallback');
    await runWithExecution(new ExecutionContext('request', 'r1'), async () => {
      expect(config('app.name')).toBe('support-test');
    });
  });
});

describe('env()', () => {
  const KEY = 'SUPPORT_TEST_KEY';
  afterEach(() => {
    delete process.env[KEY];
  });

  test('reads process env with optional fallback (empty string is missing)', () => {
    process.env[KEY] = 'yes';
    expect(env(KEY)).toBe('yes');
    process.env[KEY] = '';
    expect(env(KEY, 'fallback')).toBe('fallback');
    expect(env('SUPPORT_TEST_MISSING', 'fallback')).toBe('fallback');
  });
});

describe('context helpers', () => {
  test('outside a scope they resolve to the standalone default', () => {
    expect(correlationId()).toBe('standalone');
    expect(currentActor().type).toBe('anonymous');
    expect(execution().kind).toBe('command');
  });

  test('inside a request/job chain they carry the actor and correlation id', async () => {
    const actor = { id: 'user-9', type: 'user' } as const;
    await runWithExecution(new ExecutionContext('request', 'req-42', actor), async () => {
      expect(correlationId()).toBe('req-42');
      expect(currentActor()).toEqual(actor);
      expect(execution().kind).toBe('request');
      await sleep(1);
      expect(correlationId()).toBe('req-42');
    });
    expect(correlationId()).toBe('standalone');
  });
});

describe('abort helpers', () => {
  test('abort throws the catalogued HttpError for status or code', () => {
    expect(() => abort(404)).toThrow(expect.objectContaining({ code: 'NOT_FOUND', status: 404 }));
    expect(() => abort('VALIDATION_FAILED', 'bad input')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
    expect(() => abort(999 as never)).toThrow(expect.objectContaining({ code: 'UNKNOWN_ERROR_STATUS' }));
  });

  test('abort_if / abort_unless are conditional', () => {
    expect(() => abort_if(true, 403)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => abort_if(false, 403)).not.toThrow();
    expect(() => abort_unless(false, 401)).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => abort_unless(true, 401)).not.toThrow();
  });
});

describe('logger()', () => {
  test('emits one JSON line per entry with scope context on stderr', async () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (line: string) => lines.push(line);
    try {
      await runWithExecution(new ExecutionContext('request', 'req-log', { id: 'u1', type: 'user' }), async () => {
        logger('orders').warn('order dropped', { orderId: 'o-1' });
      });
    } finally {
      console.error = original;
    }
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: 'warn',
      scope: 'orders',
      message: 'order dropped',
      correlationId: 'req-log',
      actorId: 'u1',
    });
    expect(entry.data).toEqual({ orderId: 'o-1' });
  });
});

describe('utilities', () => {
  test('value resolves functions, tap passes values through', () => {
    expect(value(5)).toBe(5);
    expect(value(() => 5)).toBe(5);
    expect(tap([1], (arr) => arr.push(2))).toEqual([1, 2]);
  });

  test('retry succeeds after transient failures with bounded attempts', async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error(`transient ${calls}`);
        return 'ok';
      },
      { attempts: 3, backoffMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    await expect(
      retry(
        async () => {
          throw new Error('always');
        },
        { attempts: 2, backoffMs: 1 },
      ),
    ).rejects.toMatchObject({ message: 'always' });
  });

  test('uuid and nowIso produce framework formats', () => {
    expect(uuid()).toMatch(/^[0-9a-f-]{36}$/);
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(uuid()).not.toBe(uuid());
  });
});

describe('redaction helpers', () => {
  test('redactForLogs masks secret-looking keys and isSecret detects them', () => {
    expect(redactForLogs({ apiKey: 'secret', name: 'ok' })).toEqual({ apiKey: '[REDACTED]', name: 'ok' });
    expect(isSecret('password')).toBe(true);
    expect(isSecret('name')).toBe(false);
  });
});
