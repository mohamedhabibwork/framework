import { defineProvider } from '@framework/core';
import { MAILER } from '@framework/mail';
import {
  InMemoryNotificationStore,
  NOTIFICATION_STORE,
  NOTIFICATIONS,
  NotificationsService,
} from '@framework/notifications';
import { QUEUE } from '@framework/queue';
import type { AppConfig } from '../../config';
import { notificationDeliveryJob } from '../jobs';
import { notifications } from '../notifications';

/**
 * Notifications service (`NOTIFICATIONS`) backed by `MAILER`, `QUEUE`,
 * `NOTIFICATION_STORE` (seeded with `InMemoryNotificationStore` by default),
 * and any notifykit `push`/`messaging` providers declared in
 * `config.notifications.providers`.
 */
export const notificationsProvider = defineProvider<AppConfig>({
  name: 'notifications',
  dependsOn: ['mail', 'data'],
  register({ container, config }) {
    if (!container.has(NOTIFICATION_STORE)) {
      container.singleton(NOTIFICATION_STORE, () => new InMemoryNotificationStore());
    }
    container.singleton(
      NOTIFICATIONS,
      (r) =>
        new NotificationsService({
          mailer: r.resolve(MAILER),
          queue: r.resolve(QUEUE),
          store: r.resolve(NOTIFICATION_STORE),
          definitions: notifications,
          job: notificationDeliveryJob,
          ...(config.notifications.providers ? { providers: config.notifications.providers } : {}),
        }),
    );
  },
});
