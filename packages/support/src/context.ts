import { currentExecution } from '@framework/core';

/** The acting identity of the current request/job (anonymous outside one). */
export function currentActor() {
  return currentExecution().actor;
}

/** Correlation id of the current request/job (or `'standalone'` outside one). */
export function correlationId(): string {
  return currentExecution().correlationId;
}

/** Full execution context of the current scope: kind, actor, correlation id. */
export function execution() {
  return currentExecution();
}
