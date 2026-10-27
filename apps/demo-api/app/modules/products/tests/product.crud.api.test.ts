import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { JsonValue } from '@framework/core';
import { jsonInit } from '@framework/testing';
import { productFactory } from '../../../../database/factories/product.factory';
import { createTestContext, type TestContext } from '../../../../tests/support';
import { productResponseSchema } from '../schemas';

const BASE = '/api/v1/products';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const MALFORMED_ID = 'not-a-uuid';
const PUBLIC_FIELDS = ['createdAt', 'id', 'name', 'price', 'updatedAt'];
const UPDATE_FIELD = 'name';

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

async function create(): Promise<Record<string, JsonValue> & { id: string | number }> {
  const response = await call(BASE, 'POST', productFactory.valid());
  expect(response.status).toBe(201);
  return productResponseSchema.parse(await response.json()) as Record<string, JsonValue> & { id: string | number };
}

function updateValue(): JsonValue {
  return (productFactory.valid() as Record<string, JsonValue>)[UPDATE_FIELD] as JsonValue;
}

describe('Product API (real PostgreSQL)', () => {
  test('create -> list -> read -> update -> read -> delete -> missing-read', async () => {
    const input = productFactory.valid();

    const created = await call(BASE, 'POST', input);
    expect(created.status).toBe(201);
    const record = productResponseSchema.parse(await created.json()) as Record<string, JsonValue> & {
      id: string | number;
    };
    expect(record).toMatchObject(input);

    const list = await call(`${BASE}?page=1&limit=100`);
    expect(list.status).toBe(200);
    const page = (await list.json()) as { items: { id: string | number }[] };
    expect(page.items.map((item) => item.id)).toContain(record.id);

    const read = await call(`${BASE}/${record.id}`);
    expect(read.status).toBe(200);
    expect(productResponseSchema.parse(await read.json())).toEqual(record as never);

    const changes = { [UPDATE_FIELD]: updateValue() };
    const updated = await call(`${BASE}/${record.id}`, 'PATCH', changes);
    expect(updated.status).toBe(200);
    const updatedRecord = productResponseSchema.parse(await updated.json()) as Record<string, JsonValue>;
    expect(updatedRecord[UPDATE_FIELD]).toEqual(changes[UPDATE_FIELD]);
    for (const field of PUBLIC_FIELDS) {
      if (field !== UPDATE_FIELD && field !== 'updatedAt') expect(updatedRecord[field]).toEqual(record[field]);
    }

    const reread = productResponseSchema.parse(await (await call(`${BASE}/${record.id}`)).json()) as Record<
      string,
      JsonValue
    >;
    expect(reread[UPDATE_FIELD]).toEqual(changes[UPDATE_FIELD]);

    const deleted = await call(`${BASE}/${record.id}`, 'DELETE');
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');

    const missing = await call(`${BASE}/${record.id}`);
    expect(missing.status).toBe(404);
    expect(await errorCode(missing)).toBe('NOT_FOUND');
  });

  test('responses expose only the public allowlist', async () => {
    const record = await create();
    expect(Object.keys(record).sort()).toEqual(PUBLIC_FIELDS);
  });

  test('listing is ordered deterministically and bounded', async () => {
    for (let i = 0; i < 3; i++) await create();
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
    expect((await call(BASE, 'POST', '{"broken":')).status).toBe(400);
    expect((await call(`${BASE}/${MALFORMED_ID}`)).status).toBe(422);
    expect((await call(`${BASE}/${UNKNOWN_ID}`)).status).toBe(404);
  });

  test('rejects invalid payloads (missing, mistyped, refinement, forbidden fields)', async () => {
    for (const [name, build] of Object.entries(productFactory.invalid)) {
      const response = await call(BASE, 'POST', build());
      expect({ name, status: response.status }).toEqual({ name, status: 422 });
      expect(await errorCode(response)).toBe('VALIDATION_FAILED');
    }
  });

  test('rejects empty and immutable-field updates; unknown ids are 404', async () => {
    const record = await create();
    expect((await call(`${BASE}/${record.id}`, 'PATCH', {})).status).toBe(422);
    expect((await call(`${BASE}/${record.id}`, 'PATCH', { id: UNKNOWN_ID })).status).toBe(422);
    expect((await call(`${BASE}/${record.id}`, 'PATCH', { createdAt: '2000-01-01T00:00:00Z' })).status).toBe(422);
    expect((await call(`${BASE}/${UNKNOWN_ID}`, 'PATCH', changesFor())).status).toBe(404);
    expect((await call(`${BASE}/${UNKNOWN_ID}`, 'DELETE')).status).toBe(404);
  });
});

function changesFor(): Record<string, JsonValue> {
  return { [UPDATE_FIELD]: updateValue() };
}
