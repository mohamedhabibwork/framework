import { ResourceService } from '@framework/crud';
import type { SelectOf } from '@framework/database';
import type { products } from '../../../../database/schema/products';
import type { CreateProductDto, UpdateProductDto } from '../dto/product.dto';

type Product = SelectOf<typeof products>;

/**
 * Business operations. Everything works with the defaults; the module
 * provider injects the repository, the shared request context (actor +
 * transaction scope) and the event wiring. Add rules by overriding hooks
 * or methods — nothing else needs to change.
 */
export class ProductService extends ResourceService<Product, CreateProductDto, UpdateProductDto> {
  // Example hook override:
  // protected override beforeCreate(input: CreateProductDto): CreateProductDto {
  //   return { ...input /* adjust validated input */ };
  // }
}
