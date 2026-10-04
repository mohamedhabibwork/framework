import { defineProvider } from '@framework/core';
import { DataPorter, LocalExportStore } from '@framework/crud';
import { QUEUE, QueueManager } from '@framework/queue';
import type { AppConfig } from '../../config';
import { productExportJob, productImportJob } from '../jobs/products.jobs';
import { DATA_PORTER, EXPORT_STORE } from './data.tokens';

/**
 * Queued import/export: a BullMQ connection (lazy — connects on first use),
 * the local export artifact store, and the dispatcher behind `/api/v1/data`.
 * Add a module's jobs to the lists below (and its resource name to the
 * `dataOperations` call in `bootstrap/openapi.ts`) to opt it in.
 */
export const dataProvider = defineProvider<AppConfig>({
  name: 'data',
  register({ container, config }) {
    container.singleton(
      QUEUE,
      () =>
        new QueueManager({
          url: config.redis.url,
          prefix: config.queue.prefix,
          queue: config.queue.name,
        }),
      (queue) => queue.close(),
    );
    container.singleton(EXPORT_STORE, () => new LocalExportStore('storage/exports'));
    container.scoped(
      DATA_PORTER,
      (r) =>
        new DataPorter({
          queue: r.resolve(QUEUE),
          store: r.resolve(EXPORT_STORE),
          imports: [productImportJob],
          exports: [productExportJob],
        }),
    );
  },
});
