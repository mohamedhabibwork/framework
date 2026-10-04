import { defineFormRequest } from '@framework/validation';
import { productPolicy } from '../policies/product.policy';
import { createProductSchema } from '../schemas';

export const createProductRequest = defineFormRequest({
  schema: createProductSchema,
  authorize: (c) => productPolicy.create(c),
});
