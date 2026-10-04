import { QueueManager } from '@framework/queue';
import { stringOption } from '../args';
import { defineCommand } from '../command';
import { failure, unsupported } from '../errors';
import { table } from '../output';
import { foreground, loadConfigOrFail } from './project';

function queueEnv(options: Readonly<Record<string, string | boolean | undefined>>): Record<string, string> {
  const env: Record<string, string> = {};
  const queue = stringOption(options, 'queue');
  const concurrency = stringOption(options, 'concurrency');
  if (queue) env.QUEUE_NAME = queue;
  if (concurrency) {
    if (!/^\d{1,2}$/.test(concurrency))
      throw failure('INVALID_USAGE', '--concurrency must be a number between 1 and 99');
    env.QUEUE_CONCURRENCY = concurrency;
  }
  return env;
}

const queueOptions = [
  { name: 'queue', type: 'string', placeholder: '<name>', description: 'Queue to consume or inspect' },
  { name: 'concurrency', type: 'string', placeholder: '<n>', description: 'Parallel jobs (workers only)' },
] as const;

export const queueCommands = [
  defineCommand({
    name: 'queue:work',
    group: 'queue',
    status: 'implemented',
    description: 'Consume configured queues in the foreground (graceful SIGTERM/SIGINT drain)',
    options: queueOptions,
    requires: ['Redis (config redis.url)'],
    async run({ options }, context) {
      if (!context.project.tools.worker) {
        throw unsupported(
          '"queue:work" needs a worker entry point',
          'Add a `worker` tool to this project CLI adapter.',
        );
      }
      await loadConfigOrFail(context);
      return foreground([...context.project.tools.worker], context, queueEnv(options));
    },
  }),
  defineCommand({
    name: 'queue:status',
    group: 'queue',
    status: 'implemented',
    description: 'Show job counts per state and adapter health',
    options: [{ name: 'queue', type: 'string', placeholder: '<name>', description: 'Queue to inspect' }],
    requires: ['Redis (config redis.url)'],
    async run({ options }, context) {
      const config = await loadConfigOrFail(context);
      const queueUrl = context.project.queueUrl?.(config);
      if (!queueUrl) {
        throw unsupported(
          '"queue:status" needs a queue configuration',
          'Add a `queueUrl` hook to this project CLI adapter.',
        );
      }
      const manager = new QueueManager({
        url: queueUrl.url,
        prefix: queueUrl.prefix,
        queue: stringOption(options, 'queue') ?? queueUrl.queue,
      });
      try {
        const counts = await manager.counts();
        for (const line of table(
          Object.entries(counts).map(([state, count]) => ({ state, count })),
          ['state', 'count'],
        )) {
          context.print(line);
        }
        return { data: { queue: manager.options.queue, counts } };
      } finally {
        await manager.close();
      }
    },
  }),
];
