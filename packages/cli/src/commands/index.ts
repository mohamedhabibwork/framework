import type { Command } from '../command';
import { authCommands } from './auth';
import { createCommands } from './create';
import { databaseCommands } from './database';
import { generatorCommands } from './generators';
import { openapiCommands } from './openapi';
import { plannedCommands } from './planned';
import { projectCommands } from './project';
import { queueCommands } from './queue';
import { schedulerCommands } from './scheduler';
import { toolingCommands } from './tooling';
import { workflowCommands } from './workflow';

export const frameworkCommands: readonly Command[] = [
  ...projectCommands,
  ...createCommands,
  ...authCommands,
  ...generatorCommands,
  ...databaseCommands,
  ...queueCommands,
  ...workflowCommands,
  ...schedulerCommands,
  ...openapiCommands,
  ...toolingCommands,
  ...plannedCommands,
];
