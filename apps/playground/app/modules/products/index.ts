import { defineResource } from '@framework/crud';
import type { z } from 'zod/v4';
import { products } from '../../../database/schema/products';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  productResponseSchema,
  updateProductSchema,
} from './schemas';

export * from './schemas';
export type CreateProductInput = z.input<typeof createProductSchema>;

/**
 * The whole module: listed in `defineApp({ modules })`. Pass `repository`,
 * `service`, `controller` or `toResponse` to replace a layer.
 */
export const productsModule = defineResource(products, {
  access: 'public',
  name: 'Product',
  path: '/products',
  schemas: {
    create: createProductSchema,
    update: updateProductSchema,
    response: productResponseSchema,
    query: listProductsQuerySchema,
    param: productIdParamSchema,
  },
});

/** Hono RPC clients type against this: `hc<typeof productRoutes>('/api/v1/products')`. */
export const productRoutes = productsModule.routes.app;
