import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { listRoutes } from '@framework/http';
import { checkOperations } from '@framework/openapi';
import { hc } from 'hono/client';
import type { AppType } from '../bootstrap/http';
import { buildOpenApiDocument, operations } from '../bootstrap/openapi';
import { createTestContext, type TestContext } from './support';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx?.close();
});

describe('API contract', () => {
  test('every /api route is documented and every operation has a route', () => {
    const apiRoutes = listRoutes(ctx.http).filter((route) => route.path.startsWith('/api/'));
    expect(checkOperations(apiRoutes, operations)).toEqual([]);
    expect(buildOpenApiDocument().openapi).toBe('3.1.0');
  });

  test('typed Hono RPC client works against the composed application', async () => {
    const client = hc<AppType>('http://in-process.test', {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        ctx.http.request(input instanceof Request ? input : String(input), init),
    });

    const created = await client.api.v1.products.$post({ json: { name: 'rpc product', price: '3.50' } });
    expect(created.status).toBe(201);
    if (created.status !== 201) throw new Error('unreachable');
    const product = await created.json();
    const name: string = product.name;
    expect(name).toBe('rpc product');

    const shown = await client.api.v1.products[':id'].$get({ param: { id: product.id } });
    expect(shown.status).toBe(200);

    // Compile-time evidence: inputs are inferred from the Drizzle-derived schemas.
    // @ts-expect-error price is required
    await client.api.v1.products.$post({ json: { name: 'missing price' } }).catch(() => undefined);
  });
});
