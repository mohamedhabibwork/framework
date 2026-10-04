import type { Page } from '@framework/database';
import type { z } from 'zod/v4';
import type {
  createProductSchema,
  listProductsQuerySchema,
  productResponseSchema,
  updateProductSchema,
} from '../schemas';

export type CreateProductInput = z.input<typeof createProductSchema>;
export type CreateProductDto = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type UpdateProductDto = z.output<typeof updateProductSchema>;
export type ListProductsDto = z.output<typeof listProductsQuerySchema>;
export type ProductResponseDto = z.output<typeof productResponseSchema>;
export type ProductPageDto = Page<ProductResponseDto>;
