import { defineProvider } from '@framework/core';
import { EVENT_BUS } from '@framework/events';
import type { AppConfig } from '../../config';
import { listeners } from './index';

/**
 * Subscribes every registered listener to the event bus at boot. Handlers
 * release with the bus itself, which the events provider closes.
 */
export const listenersProvider = defineProvider<AppConfig>({
  name: 'listeners',
  dependsOn: ['events'],
  register() {},
  async boot({ container }) {
    const bus = container.resolve(EVENT_BUS);
    for (const listener of listeners) await bus.subscribe(listener.channel, listener.handle);
  },
});
