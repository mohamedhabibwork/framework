import { defineAction, defineStage, defineWorkflow, parallel } from '@framework/workflow';
import { z } from 'zod/v4';

/**
 * Demo workflow: reserve stock inline, fan out payment + shipment (the
 * payment runs as its own queue job), then notify. The payment compensates
 * (refund) when a later stage fails.
 */
const reserveStock = defineAction({
  name: 'reserve-stock',
  run: async (state) => {
    console.error(`[workflow] reserving stock for order ${String(state.orderId)}`);
    return { reserved: true };
  },
});

const chargeCard = defineAction({
  name: 'charge-card',
  via: 'queue',
  input: z.object({ orderId: z.string() }),
  run: async (input) => {
    console.error(`[workflow] charging card for order ${input.orderId}`);
    return { chargeId: `ch_${input.orderId}` };
  },
  compensate: async (state) => {
    console.error(`[workflow] refunding ${String(state.chargeId)}`);
  },
});

const createShipment = defineAction({
  name: 'create-shipment',
  run: async (state) => ({ shipmentId: `sh_${String(state.orderId)}` }),
});

const notify = defineAction({
  name: 'notify',
  when: (state) => typeof state.chargeId === 'string',
  run: async () => ({ notified: true }),
});

export const orderFulfillment = defineWorkflow({
  name: 'order-fulfillment',
  version: 1,
  input: z.object({ orderId: z.string().min(1) }),
  onFailure: 'compensate',
  stages: [
    defineStage({ name: 'stock', actions: [reserveStock] }),
    defineStage({ name: 'fulfill', actions: parallel([chargeCard, createShipment]) }),
    defineStage({ name: 'notify', actions: [notify] }),
  ],
});
