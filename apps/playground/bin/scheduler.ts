import { QueueManager } from '@framework/queue';
import { runScheduler } from '@framework/scheduler';
import { WORKFLOW_MANAGER } from '@framework/workflow';
import { schedules } from '../app/schedules';
import { createApplication } from '../bootstrap/app';
import { loadAppConfig } from '../config';

const config = await loadAppConfig();
const application = await createApplication(config).boot();

const concurrency = Number(process.env.SCHEDULE_CONCURRENCY ?? 1);

await runScheduler({
  application,
  // Schedule fires run on their own queue (BullMQ forbids ':' in names) so the
  // regular workers never see them.
  queue: new QueueManager({
    url: config.redis.url,
    prefix: config.queue.prefix,
    queue: `${config.queue.name}-schedules`,
  }),
  schedules,
  dispatchWorkflow: (name, input, execution) =>
    application.container.resolve(WORKFLOW_MANAGER).dispatch(name, input, execution),
  concurrency: Number.isInteger(concurrency) && concurrency >= 1 ? concurrency : 1,
  shutdownTimeoutMs: config.http.shutdownTimeoutMs,
});
