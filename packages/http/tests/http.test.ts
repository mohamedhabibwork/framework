import { describe, expect, test } from 'bun:test';
import { Application, token } from '@framework/core';
import { validate } from '@framework/validation';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod/v4';
import {
  assertNoDuplicateRoutes,
  authenticatedPolicy,
  authorize,
  createHttpKernel,
  currentPrincipal,
  type FrameworkEnv,
  HttpError,
  listRoutes,
  MiddlewareRegistry,
  REQUEST_CONTEXT,
  requireAuth,
  resolve,
} from '../src';

async function bootedApp(register?: (app: Application<object>) => void) {
  const app = new Application<object>({ config: {}, providers: [] });
  await app.boot();
  register?.(app);
  return app;
}

const json = (body: string) => ({ method: 'POST', body, headers: { 'content-type': 'application/json' } });

describe('HTTP kernel', () => {
  test('errors use the stable envelope with request id', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false }).get('/fail', () => {
      throw new HttpError('UNIQUE_VIOLATION', 'Product already exists');
    });

    const response = await http.request('/fail');
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: Record<string, unknown> };
    expect(body.error.code).toBe('UNIQUE_VIOLATION');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id') ?? '');
  });

  test('unexpected errors are redacted in production mode', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false }).get('/boom', () => {
      throw new Error('db password is hunter2');
    });
    const body = await (await http.request('/boom')).text();
    expect(body).not.toContain('hunter2');
    expect(body).toContain('INTERNAL_ERROR');
  });

  test('HTTPException from native middleware keeps its status', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false }).get('/denied', () => {
      throw new HTTPException(401, { message: 'nope' });
    });
    const response = await http.request('/denied');
    expect(response.status).toBe(401);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
  });

  test('unknown routes return 404 envelope', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false });
    const response = await http.request('/missing');
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('validation failures return 422 with field errors; malformed JSON returns 400', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false }).post(
      '/items',
      validate('json', z.object({ name: z.string().min(1) }).strict()),
      (c) => c.json(c.req.valid('json'), 201),
    );

    const invalid = await http.request('/items', json('{"name":"","extra":1}'));
    expect(invalid.status).toBe(422);
    const body = (await invalid.json()) as { error: { fields: { path: string }[] } };
    expect(body.error.fields.map((f) => f.path).sort()).toEqual(['(root)', 'name']);

    expect((await http.request('/items', json('{nope'))).status).toBe(400);
    expect((await http.request('/items', json('{"name":"ok"}'))).status).toBe(201);
  });

  test('oversized bodies return 413', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false, maxBodyBytes: 16 }).post(
      '/upload',
      async (c) => c.text(await c.req.text()),
    );
    const response = await http.request('/upload', json(JSON.stringify({ data: 'x'.repeat(100) })));
    expect(response.status).toBe(413);
  });

  test('each request gets an isolated, disposed scope', async () => {
    const Counter = token<{ value: number; id: string }>('counter');
    const disposed: string[] = [];
    const app = await bootedApp((a) =>
      a.container.scoped(
        Counter,
        (r) => ({ value: 0, id: r.resolve(REQUEST_CONTEXT).requestId }),
        (counter) => void disposed.push(counter.id),
      ),
    );
    const http = createHttpKernel(app, { exposeInternalErrors: false }).get('/count', async (c) => {
      const counter = resolve(c, Counter);
      counter.value += 1;
      await Bun.sleep(2);
      counter.value += 1;
      return c.json({ value: counter.value });
    });

    const responses = await Promise.all(Array.from({ length: 10 }, () => http.request('/count')));
    const values = await Promise.all(responses.map((r) => r.json()));
    expect(values).toEqual(Array.from({ length: 10 }, () => ({ value: 2 })));
    expect(new Set(disposed).size).toBe(10);
  });

  test('native sub-applications and middleware preserve before/after ordering', async () => {
    const order: string[] = [];
    const sub = new Hono<FrameworkEnv>()
      .use(async (_c, next) => {
        order.push('before');
        await next();
        order.push('after');
      })
      .get('/', (c) => {
        order.push('handler');
        return c.text('ok');
      });
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false }).route('/sub', sub);
    expect((await http.request('/sub')).status).toBe(200);
    expect(order).toEqual(['before', 'handler', 'after']);
  });
});

describe('Middleware registry', () => {
  test('groups expand in declared order and unknown aliases fail at bootstrap', () => {
    const registry = new MiddlewareRegistry();
    const a = async (_c: unknown, next: () => Promise<void>) => next();
    const b = async (_c: unknown, next: () => Promise<void>) => next();
    registry.alias('a', a).alias('b', b).group('api', ['b', 'a']).group('admin', ['api', 'a']);
    expect(registry.resolve(['admin'])).toEqual([b, a, a]);
    expect(() => registry.resolve(['ghost'])).toThrow(/Unknown middleware/);
    expect(() => registry.alias('a', a)).toThrow(/already registered/);
    registry.group('broken', ['missing']);
    expect(() => registry.validate()).toThrow(/missing/);
  });
});

describe('Route table', () => {
  test('lists routes and rejects duplicate registrations', () => {
    const products = new Hono().get('/', (c) => c.text('list')).post('/', (c) => c.text('create'));
    const http = new Hono().route('/products', products).get('/health', (c) => c.text('ok'));
    expect(listRoutes(http).map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /products',
      'POST /products',
      'GET /health',
    ]);
    expect(() => assertNoDuplicateRoutes(http)).not.toThrow();

    http.route(
      '/products',
      new Hono().get('/', (c) => c.text('again')),
    );
    expect(() => assertNoDuplicateRoutes(http)).toThrow(/GET \/products/);
  });
});

describe('Authentication plumbing', () => {
  test('requireAuth rejects anonymous requests with 401 and passes principals through', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false })
      .use('/secure/*', async (c, next) => {
        c.set('principal', { id: 'u1', abilities: ['*'] });
        await next();
      })
      .get('/secure/me', requireAuth(), (c) => c.json(currentPrincipal(c)))
      .get('/open/me', requireAuth(), (c) => c.json(currentPrincipal(c)));

    const ok = await http.request('/secure/me');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { id: string }).id).toBe('u1');

    const denied = await http.request('/open/me');
    expect(denied.status).toBe(401);
    expect(((await denied.json()) as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
  });

  test('authenticatedPolicy grants abilities only to authenticated principals', async () => {
    const http = createHttpKernel(await bootedApp(), { exposeInternalErrors: false })
      .use('/anon/*', async (c, next) => {
        c.set('principal', null);
        await next();
      })
      .use('/auth/*', async (c, next) => {
        c.set('principal', { id: 'u1', abilities: ['*'] });
        await next();
      })
      .on('POST', ['/anon/things', '/auth/things'], authorize(authenticatedPolicy, 'create'), (c) => c.text('created'));

    expect((await http.request('/anon/things', { method: 'POST' })).status).toBe(403);
    expect((await http.request('/auth/things', { method: 'POST' })).status).toBe(200);
  });
});
