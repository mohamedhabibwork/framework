import { type Command, type CommandGroup, defineCommand } from '../command';
import { unsupported } from '../errors';

/**
 * Commands from the specification that are not implemented yet. They are
 * listed (status "planned") so the catalog is honest, and fail with exit 3.
 */
const PLANNED: readonly [string, CommandGroup, string][] = [
  ['integration:list', 'project', 'Show configured adapters, versions and capabilities'],
  ['integration:check', 'project', 'Validate adapter compatibility and optional connectivity'],
  ['make:controller', 'generators', 'Controller, optional CRUD handlers'],
  ['make:request', 'generators', 'Form request importing the canonical Drizzle–Zod schema'],
  ['make:response', 'generators', 'Public response schema and serializer'],
  ['make:dto', 'generators', 'Inferred Zod input/output DTO types'],
  ['make:service', 'generators', 'Business service with explicit dependencies'],
  ['make:repository', 'generators', 'Typed Drizzle repository'],
  ['make:model', 'generators', 'Thin model metadata/serialization'],
  ['make:schema', 'generators', 'Drizzle table definition and schema export'],
  ['make:migration', 'generators', 'Custom SQL migration'],
  ['make:policy', 'generators', 'Resource policy'],
  ['make:middleware', 'generators', 'Native typed Hono middleware'],
  ['make:provider', 'generators', 'Provider lifecycle factory'],
  ['make:guard', 'generators', 'Authentication guard implementation'],
  ['make:user-provider', 'generators', 'Principal lookup implementation'],
  ['make:event', 'generators', 'Typed event contract'],
  ['make:listener', 'generators', 'Event listener with optional job dispatch'],
  ['make:mail', 'generators', 'Message builder and email template'],
  ['make:notification', 'generators', 'Notification with explicit channels'],
  ['make:command', 'generators', 'Application CLI command'],
  ['make:schedule', 'generators', 'Explicit scheduled task registration'],
  ['make:test', 'generators', 'Meaningful test scaffold'],
  ['make:integration', 'generators', 'Optional lifecycle adapter'],
  // Migrations are forward-only by decision (ADR): roll back by authoring a
  // new forward migration, or reset a non-production target with `db:fresh`.
  ['db:rollback', 'database', 'Reverse the last migration (see db:fresh; forward-only by design)'],
  ['cache:prune', 'cache', 'Adapter-supported expiry cleanup'],
  ['storage:link', 'storage', 'Link a configured local public disk'],
  ['storage:prune', 'storage', 'Remove framework-owned temporary uploads'],
];

export const plannedCommands: Command[] = PLANNED.map(([name, group, description]) =>
  defineCommand({
    name,
    group,
    status: 'planned',
    description,
    async run() {
      throw unsupported(
        `"${name}" is planned but not implemented in this release`,
        'See docs/status.md for the delivery phase that introduces it.',
      );
    },
  }),
);
