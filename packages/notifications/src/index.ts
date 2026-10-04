// Public API of @framework/notifications.
// Convention: every interface/type lives in `./types`, every constant in
// `./constants`; runtime values (classes, functions, schemas) stay in their modules.
export { NOTIFICATION_STORE, NOTIFICATIONS, SMS_PLANNED } from './constants';
export { defineNotification } from './definition';
export {
  databaseContentSchema,
  emailContentSchema,
  notificationEnvelopeSchema,
  parseDatabaseContent,
  parseEmailContent,
  parseNotificationEnvelope,
  toNotificationFieldErrors,
} from './envelope';
export {
  NotificationChannelError,
  NotificationDefinitionError,
  NotificationDeliveryError,
  NotificationStoreError,
  NotificationUnknownError,
  NotificationValidationError,
} from './errors';
export {
  defineNotificationJob,
  NOTIFICATION_JOB_NAME,
  NOTIFICATION_JOB_VERSION,
  notificationJobPayloadSchema,
} from './job';
export { InMemoryNotificationStore } from './memory-store';
export { createNotificationsProvider } from './provider';
export { NotificationsService } from './service';
// Grouped conventions: every type in ./types, every constant in ./constants.
// (`NotificationsService` is a class value exported from ./service above; its
// type is re-exported there, so it is not repeated in this group.)
export type {
  AnyNotificationDefinition,
  ChannelStatus,
  DatabaseChannelStore,
  DatabaseContent,
  DeliveryState,
  DeliveryStatus,
  EmailContent,
  NotificationChannel,
  NotificationDefinition,
  NotificationEnvelope,
  NotificationFieldError,
  NotificationJobOptions,
  NotificationJobPayload,
  NotificationJobResult,
  NotificationRecordInput,
  NotificationsProviderOptions,
  NotificationsServiceOptions,
  SendQueuedOptions,
} from './types';
