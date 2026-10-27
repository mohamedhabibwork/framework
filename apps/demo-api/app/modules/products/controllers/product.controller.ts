import { ResourceController } from '@framework/crud';
import type { SelectOf } from '@framework/database';
import type { products } from '../../../../database/schema/products';
import type { CreateProductDto, ProductResponseDto, UpdateProductDto } from '../dto/product.dto';
import { toProductResponse } from '../responses/product.response';
import type { ProductService } from '../services/product.service';

type Product = SelectOf<typeof products>;

/**
 * Maps validated HTTP input to service calls and serializes public output.
 * The base provides list/show/store/update/destroy (+restore); override any
 * method for custom behavior while keeping the route contract.
 */
export class ProductController extends ResourceController<
  Product,
  CreateProductDto,
  UpdateProductDto,
  ProductResponseDto
> {
  constructor(service: ProductService) {
    super(service, toProductResponse);
  }
}
