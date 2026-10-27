import type { DomainEvent } from '@framework/events';

/**
 * A listener reacts to one event channel. The listeners provider subscribes
 * every entry below the marker when the application boots. Delivery is
 * at-least-once: keep handlers idempotent. Add listeners with `make:listener`.
 */
export interface Listener {
  readonly name: string;
  readonly channel: string;
  readonly handle: (event: DomainEvent) => void | Promise<void>;
}

export const listeners: Listener[] = [
  // @framework:listeners
];
