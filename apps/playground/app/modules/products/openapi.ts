import { resourceOperations } from '@framework/crud';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  productResponseSchema,
  updateProductSchema,
} from './schemas';

/**
 * CRUD operations derived from the Product controller contract: the same
 * schemas its routes validate and its responses serialize document the five
 * endpoints (list/show/create/update/delete) automatically.
 */
export const productOperations = resourceOperations({
  mount: '/api/v1/products',
  resource: 'Product',
  security: 'public',
  schemas: {
    create: createProductSchema,
    update: updateProductSchema,
    response: productResponseSchema,
    query: listProductsQuerySchema,
    param: productIdParamSchema,
  },
});
