import { authorize, type FrameworkEnv, resolve } from '@framework/http';
import { authorizeRequest, validate } from '@framework/validation';
import { type Context, Hono } from 'hono';
import { productPolicy } from './policies/product.policy';
import { PRODUCT_CONTROLLER } from './provider';
import { createProductRequest } from './requests/create-product.request';
import { listProductsRequest } from './requests/list-products.request';
import { updateProductRequest } from './requests/update-product.request';
import { productIdParamSchema } from './schemas';

const controller = (c: Context<FrameworkEnv>) => resolve(c, PRODUCT_CONTROLLER);

/**
 * Concrete native routes (kept explicit so Hono RPC inference is preserved).
 * Per-route order: validation/parameter binding -> authorization -> handler.
 */
export const productRoutes = new Hono<FrameworkEnv>()
  .get('/', validate('query', listProductsRequest.schema), authorizeRequest(listProductsRequest), async (c) =>
    c.json(await controller(c).list(c.req.valid('query')), 200),
  )
  .post('/', validate('json', createProductRequest.schema), authorizeRequest(createProductRequest), async (c) =>
    c.json(await controller(c).store(c.req.valid('json')), 201),
  )
  .get('/:id', validate('param', productIdParamSchema), authorize(productPolicy, 'view'), async (c) =>
    c.json(await controller(c).show(c.req.valid('param').id), 200),
  )
  .patch(
    '/:id',
    validate('param', productIdParamSchema),
    validate('json', updateProductRequest.schema),
    authorizeRequest(updateProductRequest),
    async (c) => c.json(await controller(c).update(c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .delete('/:id', validate('param', productIdParamSchema), authorize(productPolicy, 'delete'), async (c) => {
    await controller(c).destroy(c.req.valid('param').id);
    return c.body(null, 204);
  });
