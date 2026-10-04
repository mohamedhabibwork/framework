/**
 * Every interface and type alias of `@framework/notifications` in one place.
 * Runtime values (classes, tokens, functions, schemas) live in their modules.
 */
import type { ExecutionContext, JsonObject } from '@framework/core';
import type { Mailer } from '@framework/mail';
import type { JobDefinition, QueueManager } from '@framework/queue';
import type { z } from 'zod/v4';

// -- Channels ------------------------------------------------------------------

/**
 * Delivery channels. SMS is planned but deliberately not implemented (see
 * `SMS_PLANNED`); nothing is ever delivered to a channel the notification did
 * not declare (spec §8).
 */
export type NotificationChannel = 'email' | 'database';

// -- Built content ---------------------------------------------------------------

/** Content the `toEmail` builder produces for the email channel; at least one body is required. */
export type EmailContent = {
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
};

/** Content the `toDatabase` builder produces for the database channel. */
export type DatabaseContent = {
  readonly title: string;
  readonly body: string;
};

// -- Envelope ------------------------------------------------------------------

/**
 * The validated, serializable notification envelope — the only shape that
 * crosses process boundaries (inline send uses it directly, queued delivery
 * embeds it in the job payload). `to` must be a valid email address when the
 * email channel is selected; database-only recipients may be any identifier.
 */
export type NotificationEnvelope = {
  readonly name: string;
  readonly channels: readonly NotificationChannel[];
  readonly to: string;
  readonly payload: JsonObject;
};

// -- Delivery status --------------------------------------------------------------

/** Lifecycle of one channel of one notification: `pending -> delivered | failed`. */
export type DeliveryState = 'pending' | 'delivered' | 'failed';

/** Per-channel delivery status of one notification record. */
export interface ChannelStatus {
  readonly channel: NotificationChannel;
  readonly state: DeliveryState;
  /** Transport-provided delivery id (sent message id) when delivered. */
  readonly reference?: string;
  /** Failure message when failed. */
  readonly error?: string;
  /** ISO timestamp of the last transition. */
  readonly updatedAt?: string;
}

/** The delivery status contract: what `NotificationsService.status(id)` and the store return. */
export interface DeliveryStatus {
  readonly id: string;
  readonly name: string;
  readonly recipient: string;
  readonly channels: readonly ChannelStatus[];
  /** ISO timestamp of record creation. */
  readonly createdAt: string;
}

// -- Store ---------------------------------------------------------------------

/** One notification record the store persists — the application's own schema decides the table shape. */
export interface NotificationRecordInput {
  readonly name: string;
  readonly recipient: string;
  readonly channels: readonly NotificationChannel[];
  readonly payload: JsonObject;
  /** Built email content; present when the email channel was selected. */
  readonly email?: EmailContent;
  /** Built database content; present when the database channel was selected. */
  readonly database?: DatabaseContent;
}

/**
 * The application-implemented seam behind the database channel AND the
 * delivery-status ledger. The framework does NOT own a table: `store`
 * persists the record in the application's own schema and seeds pending
 * status per declared channel, `markDelivered`/`markFailed` transition one
 * channel, and `status` reads a record back. Retry contracts ride the queue
 * (`@framework/queue`); the store only records outcomes.
 */
export interface DatabaseChannelStore {
  /** Persist one notification record, seeding `pending` per channel; returns its id. */
  store(record: NotificationRecordInput): Promise<{ id: string }>;
  /** Marks one channel delivered, optionally with the transport's delivery id. */
  markDelivered(id: string, channel: NotificationChannel, reference?: string): Promise<void>;
  /** Marks one channel failed with the error message that caused it. */
  markFailed(id: string, channel: NotificationChannel, message: string): Promise<void>;
  /** The delivery status of one record, or null when unknown. */
  status(id: string): Promise<DeliveryStatus | null>;
}

// -- Definitions ------------------------------------------------------------------

/** Per-field validation error (422-style); mirrors `@framework/mail`'s `MailFieldError`. */
export interface NotificationFieldError {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

/**
 * An app-defined notification: which channels it may ever use, how to
 * validate its payload, and one content builder per declared channel.
 * Channel selection happens per send via the envelope; a builder must exist
 * for every declared channel (checked by `defineNotification`).
 */
export interface NotificationDefinition<TPayload extends JsonObject = JsonObject> {
  readonly name: string;
  /** Every channel this notification may be delivered through, ever. */
  readonly channels: readonly NotificationChannel[];
  /** Validates the envelope payload before any builder runs. */
  readonly payload: z.ZodType<TPayload>;
  /** Required when `channels` includes `email`. */
  toEmail?(payload: TPayload): EmailContent;
  /** Required when `channels` includes `database`. */
  toDatabase?(payload: TPayload): DatabaseContent;
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous definitions erased to one runtime shape (same pattern as queue's JobList)
export type AnyNotificationDefinition = NotificationDefinition<any>;

// -- Queued delivery ---------------------------------------------------------------

/** Versioned, validated payload of the built-in delivery job (see ./job). */
export type NotificationJobPayload = {
  readonly recordId: string;
  readonly envelope: NotificationEnvelope;
  readonly email?: EmailContent;
  readonly database?: DatabaseContent;
};

/** JSON-safe result of the built-in delivery job. */
export type NotificationJobResult = {
  readonly recordId: string;
  readonly channels: readonly { readonly channel: NotificationChannel; readonly state: DeliveryState }[];
};

export interface NotificationJobOptions {
  readonly name?: string;
  readonly version?: number;
  /** Attempts before the job is parked as failed (default 3). */
  readonly attempts?: number;
  /** Backoff between attempts in ms (default 5000). */
  readonly backoffMs?: number;
}

// -- Service / provider options ------------------------------------------------

export interface NotificationsServiceOptions {
  readonly mailer: Mailer;
  readonly store: DatabaseChannelStore;
  readonly queue: QueueManager;
  /** Registered app notifications; looked up by envelope `name`. */
  readonly definitions?: readonly AnyNotificationDefinition[];
  /** The queue job `sendQueued` dispatches; defaults to `defineNotificationJob()`. */
  readonly job?: JobDefinition<NotificationJobPayload, NotificationJobResult>;
}

export interface NotificationsProviderOptions {
  readonly definitions?: readonly AnyNotificationDefinition[];
  readonly job?: JobDefinition<NotificationJobPayload, NotificationJobResult>;
}

export interface SendQueuedOptions {
  /** Overrides the ambient execution context for actor/correlation attribution on the queue job. */
  readonly execution?: ExecutionContext;
  readonly delayMs?: number;
  /** Overrides the job definition's attempt count for this dispatch. */
  readonly attempts?: number;
}

import type { NotificationsService } from './service';

/** The `NotificationsService` class (see ./service) is both implementation and public contract. */
export type { NotificationsService };
