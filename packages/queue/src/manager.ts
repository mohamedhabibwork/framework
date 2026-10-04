import { type ExecutionContext, FrameworkError, type JsonObject, type JsonValue, token } from '@framework/core';
import { randomUUID } from 'node:crypto';
import { type ConnectionOptions, type Job, Queue } from 'bullmq';
import Redis, { type RedisOptions } from 'ioredis';
import { z } from 'zod/v4';
import { BatchRegistry, type BatchCompletionJob, type BatchRecord, type BatchState } from './batch';
import type { JobDefinition, JobEnvelope } from './job';

export type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export interface JobStatus {
  readonly id: string;
  readonly name: string;
  readonly state: JobState;
  readonly progress: number;
  readonly attempts: number;
  readonly result: JsonValue;
  readonly failedReason: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
}

/** JSON schema of {@link JobStatus} (OpenAPI documentation of status endpoints). */
export const jobStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']),
  progress: z.number().min(0).max(100),
  attempts: z.number().int().min(0),
  result: z.lazy(() =>
    z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)]),
  ),
  failedReason: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)]),
);

export interface QueueOptions {
  readonly url: string;
  /** Redis key prefix so several apps can share one Redis. */
  readonly prefix: string;
  readonly queue?: string;
  /** Completed/failed jobs kept for inspection (bounded). */
  readonly keepCompleted?: number;
  readonly keepFailed?: number;
}

export interface DispatchOptions {
  readonly jobId?: string;
  readonly delayMs?: number;
  /** Overrides the definition's attempt count for this dispatch. */
  readonly attempts?: number;
}

export interface BatchDispatchOptions {
  /** Deduplicates concurrent dispatches of the same logical batch. Generated when omitted. */
  readonly batchId?: string;
  /** Job dispatched once every job of the batch reached a terminal state. Must be registered on workers. */
  readonly onComplete?: BatchCompletionJob;
  /** Bookkeeping retention in seconds (default 7 days). */
  readonly ttlSeconds?: number;
}

export type { BatchRecord, BatchState };

/** Result summary of a finished or in-flight batch. */
export interface BatchStatus {
  readonly id: string;
  readonly state: BatchState;
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly createdAt: string | null;
  readonly finishedAt: string | null;
}

/** Default bookkeeping retention: one week. */
export const DEFAULT_BATCH_TTL_SECONDS = 7 * 24 * 60 * 60;

export function redisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };
}

const STATES: readonly JobState[] = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];

async function toStatus(job: Job<JobEnvelope, JsonValue>): Promise<JobStatus | null> {
  const state = await job.getState();
  const known =
    STATES.find((s) => s === state) ?? (state === 'prioritized' || state === 'waiting-children' ? 'waiting' : null);
  if (!known || !job.id) return null;
  return {
    id: job.id,
    name: job.name,
    state: known,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    attempts: job.attemptsMade,
    result: job.returnvalue ?? null,
    failedReason: job.failedReason ?? null,
    createdAt: new Date(job.timestamp).toISOString(),
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
  };
}

/** Dispatches validated jobs and inspects them. Workers run in a separate process. */
export class QueueManager {
  readonly queue: Queue<JobEnvelope, JsonValue>;
  readonly connection: ConnectionOptions;
  /** Dedicated bookkeeping connection for batch state (full Redis command surface). */
  readonly redis: Redis;
  readonly batches: BatchRegistry;

  constructor(readonly options: QueueOptions) {
    this.connection = redisConnection(options.url);
    this.queue = new Queue<JobEnvelope, JsonValue>(options.queue ?? 'default', {
      connection: this.connection,
      prefix: options.prefix,
    });
    this.redis = new Redis({ ...this.connection, maxRetriesPerRequest: null, lazyConnect: false } as RedisOptions);
    this.batches = new BatchRegistry(this.redis, options.prefix);
  }

  /**
   * Validates the payload before enqueueing (invalid payloads never reach
   * Redis). The idempotency key, if defined, becomes the job id so duplicate
   * dispatches collapse into one job.
   */
  async dispatch<TPayload extends JsonObject, TResult extends JsonValue>(
    definition: JobDefinition<TPayload, TResult>,
    payload: TPayload,
    context: ExecutionContext,
    options: DispatchOptions = {},
  ): Promise<{ readonly id: string }> {
    const result = definition.payload.safeParse(payload);
    if (!result.success) {
      throw new FrameworkError(
        'JOB_PAYLOAD_INVALID',
        `Invalid payload for job "${definition.name}": ${result.error.message}`,
      );
    }
    return this.#enqueue(definition, result.data, context, options);
  }

  /**
   * Fans out one job per payload and tracks them as a single batch. All
   * payloads are validated before anything reaches Redis. When the last job
   * reaches a terminal state, the (optional) completion job is dispatched.
   */
  async dispatchBatch<TPayload extends JsonObject, TResult extends JsonValue>(
    definition: JobDefinition<TPayload, TResult>,
    payloads: readonly TPayload[],
    context: ExecutionContext,
    options: BatchDispatchOptions = {},
  ): Promise<{ readonly batchId: string; readonly jobIds: readonly string[] }> {
    if (payloads.length === 0) {
      throw new FrameworkError('BATCH_EMPTY', `Batch for job "${definition.name}" has no payloads`);
    }
    const validated: TPayload[] = payloads.map((payload) => {
      const result = definition.payload.safeParse(payload);
      if (!result.success) {
        throw new FrameworkError(
          'JOB_PAYLOAD_INVALID',
          `Invalid payload for job "${definition.name}": ${result.error.message}`,
        );
      }
      return result.data;
    });
    const batchId = options.batchId ?? randomUUID();
    const created = await this.batches.create(
      batchId,
      validated.length,
      options.onComplete ? JSON.stringify(options.onComplete) : null,
      options.ttlSeconds ?? DEFAULT_BATCH_TTL_SECONDS,
    );
    if (!created) {
      throw new FrameworkError('BATCH_EXISTS', `Batch "${batchId}" already exists`);
    }
    const jobIds: string[] = [];
    for (const payload of validated) {
      const { id } = await this.#enqueue(definition, payload, context, { batchId });
      jobIds.push(id);
    }
    return { batchId, jobIds };
  }

  async #enqueue<TPayload extends JsonObject, TResult extends JsonValue>(
    definition: JobDefinition<TPayload, TResult>,
    payload: TPayload,
    context: ExecutionContext,
    options: DispatchOptions & { readonly batchId?: string },
  ): Promise<{ readonly id: string }> {
    const jobId = options.jobId ?? definition.idempotencyKey?.(payload);
    const envelope: JobEnvelope = {
      v: definition.version,
      payload,
      actor: context.actor,
      correlationId: context.correlationId,
      ...(options.batchId ? { batchId: options.batchId } : {}),
    };
    const job = await this.queue.add(definition.name, envelope, {
      ...(jobId ? { jobId } : {}),
      ...(options.delayMs ? { delay: options.delayMs } : {}),
      attempts: options.attempts ?? definition.attempts ?? 3,
      backoff: { type: 'exponential', delay: definition.backoffMs ?? 1_000 },
      removeOnComplete: { count: this.options.keepCompleted ?? 1_000 },
      removeOnFail: { count: this.options.keepFailed ?? 5_000 },
    });
    if (!job.id) throw new FrameworkError('JOB_DISPATCH_FAILED', `Queue did not assign an id to "${definition.name}"`);
    return { id: job.id };
  }

  async batchStatus(batchId: string): Promise<BatchStatus | null> {
    const record = await this.batches.get(batchId);
    return record ? { ...record } : null;
  }

  async batchFailures(batchId: string, limit = 50): Promise<JobStatus[]> {
    const ids = await this.batches.failedIds(batchId, limit);
    return (await Promise.all(ids.map(async (id) => (await this.status(id)) ?? null))).filter(
      (s): s is JobStatus => s !== null,
    );
  }

  /** Marks a running batch cancelled; pending jobs fail fast with an unrecoverable error. */
  async cancelBatch(batchId: string): Promise<boolean> {
    return this.batches.cancel(batchId);
  }

  /**
   * Records one terminal job of a batch and, when it was the last, dispatches
   * the stored completion job. Called by the worker, not by producers.
   */
  async recordBatchTerminal(batchId: string, failed: boolean, jobId: string): Promise<void> {
    const finished = await this.batches.recordTerminal(batchId, failed, jobId);
    if (!finished) return;
    const onComplete = await this.batches.takeOnComplete(batchId);
    if (!onComplete) return;
    const parsed = JSON.parse(onComplete) as BatchCompletionJob;
    await this.queue.add(
      parsed.name,
      { v: parsed.version, payload: parsed.payload, actor: { id: null, type: 'system' }, correlationId: batchId },
      {
        jobId: `batch-${batchId}-complete`,
        attempts: parsed.attempts ?? 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { count: this.options.keepCompleted ?? 1_000 },
        removeOnFail: { count: this.options.keepFailed ?? 5_000 },
      },
    );
  }

  async status(id: string): Promise<JobStatus | null> {
    const job = await this.queue.getJob(id);
    return job ? toStatus(job) : null;
  }

  async failed(limit = 50, offset = 0): Promise<JobStatus[]> {
    const jobs = await this.queue.getFailed(offset, offset + limit - 1);
    return (await Promise.all(jobs.map(toStatus))).filter((s): s is JobStatus => s !== null);
  }

  /** Re-queues a failed job; payload (and thus idempotency) is unchanged. */
  async retry(id: string): Promise<boolean> {
    const job = await this.queue.getJob(id);
    if (!job || (await job.getState()) !== 'failed') return false;
    await job.retry('failed');
    return true;
  }

  async counts(): Promise<Readonly<Record<string, number>>> {
    return this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  }

  pause(): Promise<void> {
    return this.queue.pause();
  }

  resume(): Promise<void> {
    return this.queue.resume();
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }
}

export const QUEUE = token<QueueManager>('queue.manager');
