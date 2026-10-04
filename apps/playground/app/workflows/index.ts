import { defineProvider } from '@framework/core';
import { WORKFLOW_MANAGER } from '@framework/workflow';
import type { AppConfig } from '../../config';
import { orderFulfillment } from './order-fulfillment.workflow';

/** Every workflow definition of the application, registered on boot. */
export const workflows = [orderFulfillment] as const;

/** Registers the definitions on the engine (server dispatches, workers execute). */
export const workflowsProvider = defineProvider<AppConfig>({
  name: 'workflows',
  register() {
    // Registration happens in `boot`, after the workflow provider bound the manager.
  },
  boot(context) {
    context.container.resolve(WORKFLOW_MANAGER).register(...workflows);
  },
});
