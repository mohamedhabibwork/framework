import type { Listener } from '@framework/presets';

export type { Listener };

/**
 * A listener reacts to one event channel. `apiPreset` subscribes
 * every entry below the marker when the application boots. Delivery is
 * at-least-once: keep handlers idempotent. Add listeners with `make:listener`.
 */
export const listeners: Listener[] = [
  // @framework:listeners
];
