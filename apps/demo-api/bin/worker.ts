import { installGracefulShutdown } from '@framework/core';
import { JobWorker, QueueManager } from '@framework/queue';
import { jobs } from '../app/jobs';
import { createApplication } from '../bootstrap/app';
import { loadAppConfig } from '../config';

const config = await loadAppConfig();
const application = await createApplication(config).boot();

const queue = new QueueManager({ url: config.redis.url, prefix: config.queue.prefix, queue: config.queue.name });
const worker = new JobWorker(queue, application, jobs, {
  concurrency: config.queue.concurrency,
  onFailed: (job, error) => console.error(`[worker] job ${job.name} (${job.id ?? '?'}) failed`, error),
});
worker.start();
console.error(`[worker] consuming queue "${config.queue.name}" (concurrency ${config.queue.concurrency})`);

installGracefulShutdown({
  timeoutMs: config.http.shutdownTimeoutMs,
  onShutdown: async () => {
    await worker.close();
    await queue.close();
    await application.shutdown();
  },
});
