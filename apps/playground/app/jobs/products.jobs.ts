import { defineExportJob, defineImportJob } from '@framework/crud';
import { PRODUCT_REPOSITORY } from '../modules/products/provider';
import { toProductResponse } from '../modules/products/responses/product.response';
import { createProductSchema } from '../modules/products/schemas';
import { EXPORT_STORE } from '../providers/data.tokens';

/**
 * Queued import/export for the products module. The repository and export
 * store resolve per job scope, so the dispatcher's actor and correlation id
 * carry through to audit rows and progress events. Register these in
 * `app/jobs/index.ts` so `bun run worker` processes them, and list
 * `'products'` in the DataPorter resources for the `/data` routes.
 */
export const productImportJob = defineImportJob({
  resource: 'products',
  repository: PRODUCT_REPOSITORY,
  rowSchema: createProductSchema,
  columns: ['name', 'price'],
});

export const productExportJob = defineExportJob({
  resource: 'products',
  repository: PRODUCT_REPOSITORY,
  columns: ['id', 'name', 'price'],
  serialize: toProductResponse,
  storeToken: EXPORT_STORE,
});
