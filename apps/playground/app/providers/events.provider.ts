import { defineProvider, EXECUTION_CONTEXT, token } from '@framework/core';
import { EVENT_BUS, MemoryEventBus, RealtimeHub, RedisEventBus, WebsocketGateway } from '@framework/events';
import { resolve } from '@framework/http';
import type { AppConfig } from '../../config';

export const REALTIME_HUB = token<RealtimeHub>('events.realtime-hub');

/** Authenticated WebSocket gateway served at `/ws` (user channels + presence). */
export const WEBSOCKET_GATEWAY = token<WebsocketGateway>('events.websocket-gateway');

/**
 * In-process events by default; Redis pub/sub for cross-instance fan-out
 * (config `events.driver`). The realtime hub multiplexes WebSocket
 * subscribers onto the bus and is closed with the application.
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
      REALTIME_HUB,
      (r) => new RealtimeHub(r.resolve(EVENT_BUS)),
      (hub) => hub.close(),
    );
    container.singleton(
      WEBSOCKET_GATEWAY,
      (r) =>
        new WebsocketGateway({
          bus: r.resolve(EVENT_BUS),
          // The request scope's actor (anonymous until Phase 3 auth lands).
          authenticate: (c) => resolve(c, EXECUTION_CONTEXT).actor,
          channels: ['events'],
          // Workflow run progress streams on `workflow` (aggregate) and
          // `workflow.run.<runId>` channels (Phase 3 auth will tighten this).
          authorize: (_c, channel) => channel === 'workflow' || /^workflow\.run\.[0-9a-f-]+$/.test(channel),
          presence: true,
        }),
      (gateway) => gateway.close(),
    );
  },
});
