import { describe, expect, test } from 'bun:test';
import type { Operation } from '@framework/openapi';
import { z } from 'zod/v4';
import { pluralizeResource, resourceOperations } from '../src/openapi';

const schemas = {
  create: z.object({ name: z.string() }).strict(),
  update: z.object({ name: z.string().optional() }).strict(),
  response: z.object({ id: z.string(), name: z.string() }).strict(),
  query: z.object({ page: z.number().optional(), limit: z.number().optional() }).strict(),
  param: z.object({ id: z.string().uuid() }).strict(),
};

describe('resourceOperations', () => {
  const operations = resourceOperations({ mount: '/api/v1/products', resource: 'Product', schemas });
  const op = (id: string): Operation => {
    const found = operations.find((operation) => operation.operationId === id);
    expect(found).toBeDefined();
    return found as Operation;
  };
  const list = op('listProducts');
  const create = op('createProduct');
  const show = op('showProduct');
  const update = op('updateProduct');
  const destroy = op('deleteProduct');

  test('derives the five controller endpoints with stable operation ids', () => {
    expect(operations.map((operation) => `${operation.method.toUpperCase()} ${operation.fullPath}`)).toEqual([
      'GET /api/v1/products',
      'POST /api/v1/products',
      'GET /api/v1/products/:id',
      'PATCH /api/v1/products/:id',
      'DELETE /api/v1/products/:id',
    ]);
    expect(operations.map((operation) => operation.operationId)).toEqual([
      'listProducts',
      'createProduct',
      'showProduct',
      'updateProduct',
      'deleteProduct',
    ]);
  });

  test('documents requests, responses and error statuses per operation', () => {
    expect(list.request?.query).toBe(schemas.query);
    expect(list.responses[200]?.schema).toBeDefined();
    expect(list.errors).toEqual([422]);

    expect(create.request?.body).toBe(schemas.create);
    expect(Object.keys(create.responses)).toEqual(['201']);
    expect(create.errors).toEqual([400, 409, 422]);

    expect(show.request?.params).toBe(schemas.param);
    expect(update.request?.params).toBe(schemas.param);
    expect(update.request?.body).toBe(schemas.update);
    expect(destroy.responses[204]).toEqual({ description: 'Deleted' });
    expect(destroy.errors).toEqual([404, 422]);
  });

  test('tags default to the English plural and security defaults to public', () => {
    expect(operations.every((operation) => operation.tag === 'Products' && operation.security === 'public')).toBe(true);
    expect(pluralizeResource('Category')).toBe('Categories');
    expect(pluralizeResource('Box')).toBe('Boxes');
  });

  test('security scheme names flow through to every operation', () => {
    const secured = resourceOperations({
      mount: '/api/v1/orders',
      resource: 'Order',
      security: ['bearerAuth'],
      schemas,
    });
    expect(
      secured.every((operation) => operation.security !== 'public' && operation.security.includes('bearerAuth')),
    ).toBe(true);
    expect(secured.every((operation) => operation.tag === 'Orders')).toBe(true);
  });
});
