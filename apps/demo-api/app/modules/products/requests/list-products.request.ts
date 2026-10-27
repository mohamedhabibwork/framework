import { defineFormRequest } from '@framework/validation';
import { productPolicy } from '../policies/product.policy';
import { listProductsQuerySchema } from '../schemas';

export const listProductsRequest = defineFormRequest({
  schema: listProductsQuerySchema,
  authorize: (c) => productPolicy.viewAny(c),
});
