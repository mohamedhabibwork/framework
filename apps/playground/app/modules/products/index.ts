import { defineModule } from '@framework/http';
import type { Operation } from '@framework/openapi';
import type { AppConfig } from '../../../config';
import { productOperations } from './openapi';
import { productsProvider } from './provider';
import { productRoutes } from './routes';

export type * from './dto/product.dto';
export { PRODUCT_CONTROLLER, PRODUCT_REPOSITORY, PRODUCT_SERVICE, productsProvider } from './provider';
export { productRoutes } from './routes';
export {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  productResponseSchema,
  updateProductSchema,
} from './schemas';

/** The module's single registration point: listed in `defineApp({ modules })`. */
export const productsModule = defineModule<AppConfig, Operation>({
  name: 'products',
  providers: [productsProvider],
  routes: { path: '/products', app: productRoutes },
  operations: productOperations,
});
