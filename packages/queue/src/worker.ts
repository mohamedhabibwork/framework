import {
  type Application,
  EXECUTION_CONTEXT,
  ExecutionContext,
  FrameworkError,
  type JsonValue,
  runWithExecution,
} from '@framework/core';
import { type Job, UnrecoverableError, Worker } from 'bullmq';
import { type AnyJobDefinition, erase, type JobDefinition, type JobEnvelope } from './job';
import type { QueueManager } from './manager';

export interface WorkerOptions {
  readonly concurrency?: number;
  /** Default per-job timeout when a definition has none. */
  readonly timeoutMs?: number;
  readonly onFailed?: (job: { id?: string; name: string }, error: Error) => void;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

// Definitions are heterogeneous; erase them to one runtime shape keyed by name.
// biome-ignore lint/suspicious/noExplicitAny: accepts definitions with any payload/result types
export type JobList = readonly JobDefinition<any, any>[];

/**
 * Consumes the queue. Each job runs in a fresh `job` scope whose execution
 * context carries the dispatcher's actor and correlation id, so audit rows
 * and events written by the job are attributed correctly.
 */
export class JobWorker {
  readonly #jobs = new Map<string, AnyJobDefinition>();
  readonly #worker: Worker<JobEnvelope, JsonValue>;

  constructor(
    private readonly manager: QueueManager,
    private readonly application: Application<object>,
    jobs: JobList,
    private readonly options: WorkerOptions = {},
  ) {
    for (const job of jobs) {
      if (this.#jobs.has(job.name)) throw new FrameworkError('DUPLICATE_JOB', `Job "${job.name}" is registered twice`);
      this.#jobs.set(job.name, erase(job));
    }
    this.#worker = new Worker<JobEnvelope, JsonValue>(manager.queue.name, (job) => this.#process(job), {
      connection: manager.connection,
      prefix: manager.options.prefix,
      concurrency: options.concurrency ?? 4,
      autorun: false,
    });
    this.#worker.on('failed', (job, error) =>
      this.options.onFailed?.({ id: job?.id, name: job?.name ?? 'unknown-job' }, error),
    );
  }

  start(): void {
    void this.#worker.run();
  }

  async #process(job: Job<JobEnvelope, JsonValue>): Promise<JsonValue> {
    const definition = this.#jobs.get(job.name);
    if (!definition) throw new UnrecoverableError(`No handler registered for job "${job.name}"`);
    if (job.data.v !== definition.version) {
      throw new UnrecoverableError(`Job "${job.name}" v${job.data.v} cannot run on handler v${definition.version}`);
    }
    let payload: ReturnType<AnyJobDefinition['parse']>;
    try {
      payload = definition.parse(job.data.payload);
    } catch (error) {
      throw new UnrecoverableError(`Invalid payload: ${error instanceof Error ? error.message : String(error)}`);
    }

    const timeoutMs = definition.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const batchId = job.data.batchId;
    if (batchId) {
      const batchState = await this.manager.batches.state(batchId);
      if (batchState === 'cancelled') {
        throw new UnrecoverableError(`Batch "${batchId}" was cancelled`);
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const scope = this.application.createScope('job');
    const execution = new ExecutionContext('job', job.data.correlationId, job.data.actor);
    scope.override(EXECUTION_CONTEXT, execution);
    try {
      // Ambient execution context for helpers inside the handler's async chain.
      const result = await runWithExecution(execution, () => {
        const run = definition.run(payload, {
          jobId: job.id ?? '',
          attempt: job.attemptsMade + 1,
          scope,
          execution,
          signal: controller.signal,
          progress: (percent) => job.updateProgress(Math.max(0, Math.min(100, Math.round(percent)))),
        });
        const timeout = new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new Error(`Job timed out after ${timeoutMs}ms`)), {
            once: true,
          }),
        );
        return Promise.race([run, timeout]);
      });
      if (batchId) await this.manager.recordBatchTerminal(batchId, false, job.id ?? '');
      return result;
    } catch (error) {
      // Only the final attempt counts as a terminal batch failure; BullMQ retries the rest.
      const totalAttempts = definition.attempts ?? 3;
      const willRetry = job.attemptsMade + 1 < totalAttempts;
      if (batchId && !willRetry) await this.manager.recordBatchTerminal(batchId, true, job.id ?? '');
      throw error;
    } finally {
      clearTimeout(timer);
      await scope.dispose();
    }
  }

  /** Stops taking jobs and waits for active ones (bounded by the caller's shutdown deadline). */
  close(): Promise<void> {
    return this.#worker.close();
  }
}
