import { EVENT_BUS } from '@framework/events';
import { QueueManager, runWorker } from '@framework/queue';
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

runWorker({
  application,
  queue,
  jobs,
  extensions: [engine],
  concurrency: config.queue.concurrency,
  shutdownTimeoutMs: config.http.shutdownTimeoutMs,
});
