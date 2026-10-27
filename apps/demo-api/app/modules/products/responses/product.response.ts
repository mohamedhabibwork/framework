import { mapPage, type Page, type SelectOf, toIsoTimestamp } from '@framework/database';
import type { products } from '../../../../database/schema/products';
import type { ProductPageDto, ProductResponseDto } from '../dto/product.dto';

type ProductRow = SelectOf<typeof products>;

/** Explicit public projection; adding a column never exposes it automatically. Timestamps are ISO-8601. */
export function toProductResponse(row: ProductRow): ProductResponseDto {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt),
  };
}

export function toProductPage(page: Page<ProductRow>): ProductPageDto {
  return mapPage(page, toProductResponse);
}
