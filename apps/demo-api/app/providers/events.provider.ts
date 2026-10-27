import { defineProvider, EXECUTION_CONTEXT, token } from '@framework/core';
import { EVENT_BUS, MemoryEventBus, RedisEventBus, WebsocketGateway } from '@framework/events';
import { resolve } from '@framework/http';
import type { AppConfig } from '../../config';

export const WEBSOCKET_GATEWAY = token<WebsocketGateway>('events.websocket-gateway');

/**
 * In-process events by default; Redis pub/sub for cross-instance fan-out
 * (config `events.driver`). The WebSocket gateway serves `/ws`: private
 * `user.<id>` channels for authenticated actors and presence broadcasts.
 */
export const eventsProvider = defineProvider<AppConfig>({
  name: 'events',
  register({ container, config }) {
    container.singleton(
      EVENT_BUS,
      () =>
        config.events.driver === 'redis'
          ? new RedisEventBus({ url: config.redis.url, prefix: config.app.name })
          : new MemoryEventBus(),
      (bus) => bus.close(),
    );
    container.singleton(
      WEBSOCKET_GATEWAY,
      (r) =>
        new WebsocketGateway({
          bus: r.resolve(EVENT_BUS),
          authenticate: (c) => resolve(c, EXECUTION_CONTEXT).actor,
          channels: ['events'],
          presence: true,
        }),
      (gateway) => gateway.close(),
    );
  },
});
