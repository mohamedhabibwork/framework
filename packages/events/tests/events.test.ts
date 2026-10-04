import { afterAll, describe, expect, test } from 'bun:test';
import { ExecutionContext } from '@framework/core';
import { Hono } from 'hono';
import {
  createDomainEvent,
  type DomainEvent,
  MemoryEventBus,
  RealtimeHub,
  RedisEventBus,
  realtimeRoutes,
  type ServerMessage,
  websocket,
} from '../src';

const context = new ExecutionContext('test', 'corr-9', { id: 'u-9', type: 'user' });
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is not set; run `bun run db:up` and see .env.test.example');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('MemoryEventBus', () => {
  test('delivers to channel subscribers, isolates failing handlers, supports unsubscribe', async () => {
    const bus = new MemoryEventBus(() => {});
    const seen: string[] = [];
    await bus.subscribe('orders', () => {
      throw new Error('broken listener');
    });
    const off = await bus.subscribe('orders', (event) => void seen.push(event.type));
    await bus.publish(createDomainEvent('orders', 'created', { id: 1 }, context));
    await off();
    await bus.publish(createDomainEvent('orders', 'updated', { id: 1 }, context));
    expect(seen).toEqual(['orders.created']);
  });
});

describe('RedisEventBus (real Redis)', () => {
  const prefix = `test-${crypto.randomUUID()}`;
  const a = new RedisEventBus({ url: redisUrl, prefix });
  const b = new RedisEventBus({ url: redisUrl, prefix });
  const invalid: string[] = [];
  const c = new RedisEventBus({ url: redisUrl, prefix, onInvalidMessage: (channel) => void invalid.push(channel) });

  afterAll(async () => {
    await Promise.all([a.close(), b.close(), c.close()]);
  });

  test('fans out events across bus instances with actor and correlation id', async () => {
    const received = deferred<DomainEvent>();
    await b.subscribe('products', (event) => received.resolve(event));
    await Bun.sleep(50);
    await a.publish(createDomainEvent('products', 'created', { id: 'p1', name: 'x' }, context));
    const event = await received.promise;
    expect(event).toMatchObject({ type: 'products.created', channel: 'products', correlationId: 'corr-9' });
    expect(event.actor).toEqual({ id: 'u-9', type: 'user' });
  });

  test('rejects malformed messages instead of delivering them', async () => {
    const delivered: DomainEvent[] = [];
    await c.subscribe('raw', (event) => void delivered.push(event));
    await Bun.sleep(50);
    const raw = new Bun.RedisClient(redisUrl);
    await raw.publish(`${prefix}:events:raw`, '{"not":"an event"}');
    raw.close();
    await Bun.sleep(100);
    expect(delivered).toHaveLength(0);
    expect(invalid).toEqual(['raw']);
  });
});

describe('Realtime WebSocket', () => {
  test('subscribers receive published events; forbidden channels are refused', async () => {
    const bus = new MemoryEventBus();
    const hub = new RealtimeHub(bus);
    const app = new Hono().route('/ws', realtimeRoutes({ hub, channels: ['products'] }));
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: app.fetch, websocket });
    const messages: ServerMessage[] = [];
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    const next = () =>
      new Promise<ServerMessage>((resolve) =>
        socket.addEventListener('message', (m) => resolve(JSON.parse(String(m.data)) as ServerMessage), { once: true }),
      );
    try {
      await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
      socket.send(JSON.stringify({ action: 'subscribe', channel: 'secrets' }));
      messages.push(await next());
      socket.send(JSON.stringify({ action: 'subscribe', channel: 'products' }));
      messages.push(await next());
      expect(hub.listeners('products')).toBe(1);
      const event = next();
      await bus.publish(createDomainEvent('products', 'deleted', { id: 'p1' }, context));
      messages.push(await event);
      socket.send('not json');
      messages.push(await next());

      expect(messages.map((m) => m.type)).toEqual(['error', 'subscribed', 'event', 'error']);
      expect(messages[2]).toMatchObject({ type: 'event', event: { type: 'products.deleted' } });
    } finally {
      socket.close();
      await Bun.sleep(50);
      expect(hub.listeners('products')).toBe(0);
      await server.stop(true);
    }
  });
});
