import { defineSchedule } from '@framework/scheduler';

/**
 * Application schedules. The scheduler process (`bin/scheduler.ts`) syncs
 * these timetables onto the queue and consumes their due fires; targets are
 * executed by the regular workers.
 */
export const schedules = [
  defineSchedule({
    name: 'orders-nightly-summary',
    cron: '0 3 * * *',
    overlap: 'skip',
    dispatch: {
      kind: 'workflow',
      workflow: 'order-fulfillment',
      input: () => ({ orderId: `nightly-${new Date().toISOString().slice(0, 10)}` }),
    },
  }),
] as const;
