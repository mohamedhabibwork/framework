/**
 * Constants of `@framework/notifications`: dependency-injection tokens and the
 * SMS planning note.
 */
import { token } from '@framework/core';
import type { DatabaseChannelStore, NotificationsService } from './types';

/** The notifications service (inline + queued delivery, status reads). */
export const NOTIFICATIONS = token<NotificationsService>('notifications.service');

/**
 * The application-owned notification store (database channel rows + delivery
 * status). The framework deliberately does NOT bind it: applications bind
 * their own `DatabaseChannelStore` implementation; resolving `NOTIFICATIONS`
 * without it fails with `NOTIFICATION_STORE_UNBOUND`.
 */
export const NOTIFICATION_STORE = token<DatabaseChannelStore>('notifications.store');

/**
 * SMS_PLANNED — the SMS channel is deliberately not implemented. Spec §8
 * requires real-transport integration tests to prove provider behavior, so a
 * real SMS dependency has to be chosen first; none is bundled. The envelope
 * schema rejects any channel outside `email` | `database` until then.
 */
export const SMS_PLANNED =
  'notifications: the SMS channel is not implemented — planned until an SMS dependency is chosen; channels are `email` and `database` only' as const;
