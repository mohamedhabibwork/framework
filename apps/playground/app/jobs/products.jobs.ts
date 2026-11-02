import { EXPORT_STORE } from '@framework/presets';
import { defineExportJob, defineImportJob } from '@framework/crud';
import { createProductSchema, productsModule } from '../modules/products';

/**
 * Queued import/export for the products module. The repository and export
 * store resolve per job scope, so the dispatcher's actor and correlation id
 * carry through to audit rows and progress events. Register these in
 * `app/jobs/index.ts` so `bun run worker` processes them, and list
 * `'products'` in the DataPorter resources for the `/data` routes.
 */
export const productImportJob = defineImportJob({
  resource: 'products',
  repository: productsModule.tokens.repository,
  rowSchema: createProductSchema,
  columns: ['name', 'price'],
});

export const productExportJob = defineExportJob({
  resource: 'products',
  repository: productsModule.tokens.repository,
  columns: ['id', 'name', 'price'],
  serialize: productsModule.toResponse,
  storeToken: EXPORT_STORE,
});
