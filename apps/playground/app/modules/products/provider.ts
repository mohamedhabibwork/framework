import { defineProvider, token } from '@framework/core';
import { DATA_CONTEXT } from '@framework/database';
import { EVENT_BUS } from '@framework/events';
import type { AppConfig } from '../../../config';
import { products } from '../../../database/schema/products';
import { ProductController } from './controllers/product.controller';
import { ProductRepository } from './repositories/product.repository';
import { toProductResponse } from './responses/product.response';
import { ProductService } from './services/product.service';

export const PRODUCT_REPOSITORY = token<ProductRepository>('products.repository');
export const PRODUCT_SERVICE = token<ProductService>('products.service');
export const PRODUCT_CONTROLLER = token<ProductController>('products.controller');

/**
 * Request-scoped: every request shares one data context (transaction +
 * execution) across its repository, service and controller. Entity events
 * publish on the event bus when one is bound (this app binds one).
 */
export const productsProvider = defineProvider<AppConfig>({
  name: 'products',
  dependsOn: ['database', 'events'],
  register({ container }) {
    container.scoped(PRODUCT_REPOSITORY, (r) => new ProductRepository(products, r.resolve(DATA_CONTEXT)));
    container.scoped(
      PRODUCT_SERVICE,
      (r) =>
        new ProductService(r.resolve(PRODUCT_REPOSITORY), r.resolve(DATA_CONTEXT), {
          channel: 'products',
          ...(r.has(EVENT_BUS) ? { bus: r.resolve(EVENT_BUS), serialize: (entity) => toProductResponse(entity) } : {}),
        }),
    );
    container.scoped(PRODUCT_CONTROLLER, (r) => new ProductController(r.resolve(PRODUCT_SERVICE)));
  },
});
