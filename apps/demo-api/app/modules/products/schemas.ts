import { createInsertSchema, createSelectSchema, createUpdateSchema, paginationQuerySchema } from '@framework/database';
import { z } from 'zod/v4';
import { products } from '../../../database/schema/products';

const productSelectSchema = createSelectSchema(products);

/** Writable allowlist. id, timestamps and other generated columns are never client-writable. */
export const createProductSchema = createInsertSchema(products, {
  name: (field) => field.trim().min(1).max(255),
})
  .pick({ name: true, price: true })
  .strict();

export const updateProductSchema = createUpdateSchema(products, {
  name: (field) => field.trim().min(1).max(255),
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

/** Primary-key parameter derived from the select schema with explicit string-to-key parsing. */
export const productIdParamSchema = z.object({ id: productSelectSchema.shape.id });

/** Listing accepts only pagination; unknown query keys are rejected. */
export const listProductsQuerySchema = paginationQuerySchema().strict();
