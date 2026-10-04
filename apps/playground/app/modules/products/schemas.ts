import { createInsertSchema, createSelectSchema, createUpdateSchema, paginationQuerySchema } from '@framework/database';
import { z } from 'zod/v4';
import { products } from '../../../database/schema/products';

/** numeric(12,2) transported as a string to avoid floating-point money errors. */
const DECIMAL_12_2 = /^\d{1,10}(\.\d{1,2})?$/;
const DECIMAL_MESSAGE = 'Must be a non-negative decimal with at most 10 integer and 2 fraction digits';

const productSelectSchema = createSelectSchema(products);

/** Writable allowlist: name, price. id and timestamps are never client-writable. */
export const createProductSchema = createInsertSchema(products, {
  name: (field) => field.trim().min(1).max(120),
  price: (field) => field.regex(DECIMAL_12_2, DECIMAL_MESSAGE),
})
  .pick({ name: true, price: true })
  .strict();

export const updateProductSchema = createUpdateSchema(products, {
  name: (field) => field.trim().min(1).max(120),
  price: (field) => field.regex(DECIMAL_12_2, DECIMAL_MESSAGE),
})
  .pick({ name: true, price: true })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one writable field is required' });

/** Public allowlist for responses. */
export const productResponseSchema = productSelectSchema.pick({
  id: true,
  name: true,
  price: true,
  createdAt: true,
  updatedAt: true,
});

/** Primary-key parameter derived from the select schema. */
export const productIdParamSchema = z.object({ id: productSelectSchema.shape.id });

/** Listing accepts only pagination; unknown query keys are rejected. */
export const listProductsQuerySchema = paginationQuerySchema().strict();
