import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { JsonValue } from '@framework/core';
import { jsonInit } from '@framework/testing';
import { productFactory } from '../../../../database/factories/product.factory';
import { createTestContext, type TestContext } from '../../../../tests/support';
import { productResponseSchema } from '../schemas';

const BASE = '/api/v1/products';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const PUBLIC_FIELDS = ['createdAt', 'id', 'name', 'price', 'updatedAt'];

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx?.close();
});

const call = (path: string, method = 'GET', body?: JsonValue) => ctx.client.request(path, jsonInit(method, body));

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe('Products API (real PostgreSQL)', () => {
  test('create -> list -> read -> update -> read -> delete -> missing-read', async () => {
    const input = productFactory.valid();

    const created = await call(BASE, 'POST', input);
    expect(created.status).toBe(201);
    const product = productResponseSchema.parse(await created.json());
    expect(product).toMatchObject({ name: input.name, price: input.price });

    const list = await call(`${BASE}?page=1&limit=100`);
    expect(list.status).toBe(200);
    const page = (await list.json()) as { items: { id: string }[]; meta: { total: number } };
    expect(page.items.map((item) => item.id)).toContain(product.id);

    const read = await call(`${BASE}/${product.id}`);
    expect(read.status).toBe(200);
    expect(productResponseSchema.parse(await read.json())).toEqual(product);

    const updated = await call(`${BASE}/${product.id}`, 'PATCH', { name: 'renamed' });
    expect(updated.status).toBe(200);
    const updatedProduct = productResponseSchema.parse(await updated.json());
    expect(updatedProduct.name).toBe('renamed');
    expect(updatedProduct.price).toBe(input.price);

    const reread = productResponseSchema.parse(await (await call(`${BASE}/${product.id}`)).json());
    expect(reread).toMatchObject({ name: 'renamed', price: input.price });

    const deleted = await call(`${BASE}/${product.id}`, 'DELETE');
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');

    const missing = await call(`${BASE}/${product.id}`);
    expect(missing.status).toBe(404);
    expect(await errorCode(missing)).toBe('NOT_FOUND');
  });

  test('responses expose only the public allowlist', async () => {
    const created = await call(BASE, 'POST', productFactory.valid());
    expect(Object.keys((await created.json()) as object).sort()).toEqual(PUBLIC_FIELDS);
  });

  test('listing is ordered deterministically and bounded', async () => {
    for (let i = 0; i < 3; i++) expect((await call(BASE, 'POST', productFactory.valid())).status).toBe(201);
    const first = (await (await call(`${BASE}?page=1&limit=2`)).json()) as {
      items: JsonValue[];
      meta: { limit: number };
    };
    const again = (await (await call(`${BASE}?page=1&limit=2`)).json()) as { items: JsonValue[] };
    expect(first.items).toHaveLength(2);
    expect(first.meta.limit).toBe(2);
    expect(again.items).toEqual(first.items);

    expect((await call(`${BASE}?limit=0`)).status).toBe(422);
    expect((await call(`${BASE}?limit=101`)).status).toBe(422);
    expect((await call(`${BASE}?page=0`)).status).toBe(422);
    expect((await call(`${BASE}?unknown=1`)).status).toBe(422);
  });

  test('rejects malformed JSON and malformed ids', async () => {
    expect((await call(BASE, 'POST', '{"name":')).status).toBe(400);
    expect((await call(`${BASE}/not-a-uuid`)).status).toBe(422);
    expect((await call(`${BASE}/${UNKNOWN_ID}`)).status).toBe(404);
  });

  test('rejects missing, mistyped, refinement-violating and forbidden fields', async () => {
    for (const payload of Object.values(productFactory.invalid)) {
      const response = await call(BASE, 'POST', payload);
      expect(response.status).toBe(422);
      expect(await errorCode(response)).toBe('VALIDATION_FAILED');
    }
  });

  test('rejects empty and immutable-field updates; unknown ids are 404', async () => {
    const product = productResponseSchema.parse(await (await call(BASE, 'POST', productFactory.valid())).json());
    expect((await call(`${BASE}/${product.id}`, 'PATCH', {})).status).toBe(422);
    expect((await call(`${BASE}/${product.id}`, 'PATCH', { id: UNKNOWN_ID })).status).toBe(422);
    expect((await call(`${BASE}/${product.id}`, 'PATCH', { createdAt: '2000-01-01' })).status).toBe(422);
    expect((await call(`${BASE}/${UNKNOWN_ID}`, 'PATCH', { name: 'x' })).status).toBe(404);
    expect((await call(`${BASE}/${UNKNOWN_ID}`, 'DELETE')).status).toBe(404);
  });
});
