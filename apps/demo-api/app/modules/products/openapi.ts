import { resourceOperations } from '@framework/crud';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  productResponseSchema,
  updateProductSchema,
} from './schemas';

/**
 * CRUD operations derived from the controller contract: the schemas the
 * routes validate and the responses serialize document the five endpoints.
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
