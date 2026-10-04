import { installGracefulShutdown } from '@framework/core';
import { EVENT_BUS } from '@framework/events';
import { JobWorker, QueueManager } from '@framework/queue';
import { WORKFLOW_MANAGER, WorkflowEngine } from '@framework/workflow';
import { jobs } from '../app/jobs';
import { createApplication } from '../bootstrap/app';
import { loadAppConfig } from '../config';

const config = await loadAppConfig();
const application = await createApplication(config).boot();

const queue = new QueueManager({ url: config.redis.url, prefix: config.queue.prefix, queue: config.queue.name });

// Durable workflows ride the same queue through internal unit/advance jobs;
// their definitions merge into the single consumer so nothing is orphaned.
const engine = new WorkflowEngine(
  application,
  application.container.resolve(WORKFLOW_MANAGER),
  queue,
  application.container.has(EVENT_BUS) ? application.container.resolve(EVENT_BUS) : null,
);
const worker = new JobWorker(queue, application, [...jobs, ...engine.jobs], {
  concurrency: config.queue.concurrency,
  onFailed: (job, error) => console.error(`[worker] job ${job.name} (${job.id ?? '?'}) failed`, error),
});
worker.start();
engine.start();

console.error(`[worker] consuming queue "${config.queue.name}" (concurrency ${config.queue.concurrency})`);

installGracefulShutdown({
  timeoutMs: config.http.shutdownTimeoutMs,
  onShutdown: async () => {
    await engine.close();
    await worker.close();
    await queue.close();
    await application.shutdown();
  },
});
