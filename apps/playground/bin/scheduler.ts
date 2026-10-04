import { installGracefulShutdown } from '@framework/core';
import { JobWorker, QueueManager } from '@framework/queue';
import { Scheduler } from '@framework/scheduler';
import { WORKFLOW_MANAGER } from '@framework/workflow';
import { schedules } from '../app/schedules';
import { createApplication } from '../bootstrap/app';
import { loadAppConfig } from '../config';

const config = await loadAppConfig();
const application = await createApplication(config).boot();

// Schedule fires run on their own queue (BullMQ forbids ':' in names) so the
// regular workers never see them.
const queue = new QueueManager({
  url: config.redis.url,
  prefix: config.queue.prefix,
  queue: `${config.queue.name}-schedules`,
});
const scheduler = new Scheduler(queue, {
  dispatchWorkflow: (name, input, execution) =>
    application.container.resolve(WORKFLOW_MANAGER).dispatch(name, input, execution),
});
await scheduler.sync(schedules);

const concurrency = Number(process.env.SCHEDULE_CONCURRENCY ?? 1);
const worker = new JobWorker(queue, application, [scheduler.fireJob(schedules)], {
  concurrency: Number.isInteger(concurrency) && concurrency >= 1 ? concurrency : 1,
});
worker.start();

console.error(
  `[scheduler] ${schedules.length} timetable(s) synced on queue "${config.queue.name}" (concurrency ${concurrency})`,
);

installGracefulShutdown({
  timeoutMs: config.http.shutdownTimeoutMs,
  onShutdown: async () => {
    await worker.close();
    await queue.close();
    await application.shutdown();
  },
});
