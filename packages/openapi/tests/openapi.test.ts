import { describe, expect, test } from 'bun:test';
import { z } from 'zod/v4';
import { checkOperations, defineOperations, generateOpenApiDocument, toOpenApiPath } from '../src';

const item = z.object({ id: z.uuid(), name: z.string() });
const operations = defineOperations('/api/v1/items', 'Items', [
  {
    method: 'post',
    path: '/',
    operationId: 'createItem',
    summary: 'Create',
    security: 'public',
    request: { body: item.pick({ name: true }) },
    responses: { 201: { description: 'Created', schema: item } },
    errors: [400, 422],
  },
  {
    method: 'get',
    path: '/:id',
    operationId: 'showItem',
    summary: 'Show',
    security: ['bearerAuth'],
    request: { params: z.object({ id: z.uuid() }), query: z.object({ expand: z.string().optional() }) },
    responses: { 200: { description: 'Item', schema: item } },
    errors: [404],
  },
]);

describe('OpenAPI', () => {
  test('converts Hono paths', () => {
    expect(toOpenApiPath('/a/:id/b/:slug')).toBe('/a/{id}/b/{slug}');
  });

  test('generates a 3.1 document with explicit operation ids, auth and errors', () => {
    const doc = generateOpenApiDocument({ title: 'Test', version: '1.0.0', operations });
    expect(doc.openapi).toBe('3.1.0');
    const create = doc.paths['/api/v1/items']?.post as Record<string, unknown>;
    expect(create.operationId).toBe('createItem');
    expect(create.security).toEqual([]);
    expect(Object.keys(create.responses as object).sort()).toEqual(['201', '400', '422']);
    const show = doc.paths['/api/v1/items/{id}']?.get as {
      parameters: { name: string; in: string; required: boolean }[];
      security: unknown;
    };
    expect(show.security).toEqual([{ bearerAuth: [] }]);
    expect(show.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path', required: true }),
      expect.objectContaining({ name: 'expand', in: 'query', required: false }),
    ]);
  });

  test('rejects duplicate operation ids', () => {
    expect(() =>
      generateOpenApiDocument({ title: 'T', version: '1', operations: [...operations, ...operations] }),
    ).toThrow(/Duplicate operationId/);
  });

  test('detects drift between routes and documentation', () => {
    const problems = checkOperations(
      [
        { method: 'POST', path: '/api/v1/items' },
        { method: 'DELETE', path: '/api/v1/items/:id' },
      ],
      operations,
    );
    expect(problems).toEqual([
      'Undocumented route: DELETE /api/v1/items/:id',
      'Documented operation has no route: GET /api/v1/items/:id',
    ]);
  });
});
