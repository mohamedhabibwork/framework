import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { listRoutes } from '@framework/http';
import { checkOperations } from '@framework/openapi';
import { hc } from 'hono/client';
import type { productRoutes } from '../app/modules/products';
import { app, buildOpenApiDocument } from '../bootstrap/app';
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
    expect(checkOperations(apiRoutes, app.operations)).toEqual([]);
    expect(buildOpenApiDocument().openapi).toBe('3.1.0');
  });

  test('typed Hono RPC client works against the products module in the composed application', async () => {
    const client = hc<typeof productRoutes>('http://in-process.test/api/v1/products', {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        ctx.http.request(input instanceof Request ? input : String(input), init),
    });

    const created = await client.index.$post({ json: { name: 'rpc product', price: '3.50' } });
    expect(created.status).toBe(201);
    if (created.status !== 201) throw new Error('unreachable');
    const product = await created.json();
    const name: string = product.name;
    expect(name).toBe('rpc product');

    const shown = await client[':id'].$get({ param: { id: product.id } });
    expect(shown.status).toBe(200);

    // Compile-time evidence: inputs are inferred from the Drizzle-derived schemas.
    // @ts-expect-error price is required
    await client.index.$post({ json: { name: 'missing price' } }).catch(() => undefined);
  });
});
