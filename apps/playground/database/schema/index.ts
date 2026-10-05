// Canonical Drizzle schema exports. Generators append below the marker.
// @framework:schema-exports

// Framework-owned tables re-exported so Drizzle Kit migrates them with the
// app's tables. Relative source path: drizzle-kit's CJS loader cannot resolve
// workspace package exports; published apps import `@framework/*`.
export {
  accountTokens,
  apiTokens,
  sessions,
  totpRecoveryCodes,
  users,
} from '../../../../packages/auth/src/schema/tables';
export { workflowNodes, workflowRuns } from '../../../../packages/workflow/src/schema';
export * from './products';
