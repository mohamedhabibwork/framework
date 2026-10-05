import type { Command } from '../command';
import { authCommands } from './auth';
import { createCommands } from './create';
import { databaseCommands } from './database';
import { generatorCommands } from './generators';
import { infrastructureCommands } from './infrastructure';
import { openapiCommands } from './openapi';
import { plannedCommands } from './planned';
import { projectCommands } from './project';
import { queueCommands } from './queue';
import { schedulerCommands } from './scheduler';
import { simpleGeneratorCommands } from './simple-generators';
import { toolingCommands } from './tooling';
import { workflowCommands } from './workflow';

export const frameworkCommands: readonly Command[] = [
  ...projectCommands,
  ...createCommands,
  ...authCommands,
  ...generatorCommands,
  ...simpleGeneratorCommands,
  ...databaseCommands,
  ...queueCommands,
  ...infrastructureCommands,
  ...workflowCommands,
  ...schedulerCommands,
  ...openapiCommands,
  ...toolingCommands,
  ...plannedCommands,
];
