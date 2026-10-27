import type { JobList } from '@framework/queue';

/**
 * The application's job handlers, run by `bun run worker`
 * (or `bun run cli -- queue:work`). Each job declares a versioned, validated
 * payload and an idempotent handler; add jobs with `defineJob`.
 */
export const jobs: JobList = [];
