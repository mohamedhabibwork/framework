import { defineFormRequest } from '@framework/validation';
import { productPolicy } from '../policies/product.policy';
import { updateProductSchema } from '../schemas';

export const updateProductRequest = defineFormRequest({
  schema: updateProductSchema,
  authorize: (c) => productPolicy.update(c),
});
