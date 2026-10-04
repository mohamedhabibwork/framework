import type { JobList } from '@framework/queue';
import { productExportJob, productImportJob } from './products.jobs';

/**
 * The application's job handlers, run by `bun run bin/worker.ts`
 * (or `bun run cli -- queue:work`). Each job declares a versioned, validated
 * payload and an idempotent handler; add jobs with `defineJob`.
 */
export const jobs: JobList = [productImportJob, productExportJob];
