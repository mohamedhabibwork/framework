import { type Command, type CommandGroup, defineCommand } from '../command';
import { unsupported } from '../errors';

/**
 * Commands from the specification that are not implemented yet. They are
 * listed (status "planned") so the catalog is honest, and fail with exit 3.
 */
const PLANNED: readonly [string, CommandGroup, string][] = [
  ['build', 'project', "Run the selected runtime's production build pipeline"],
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
  ['make:factory', 'generators', 'Database factory'],
  ['make:seeder', 'generators', 'Named seeder'],
  ['make:policy', 'generators', 'Resource policy'],
  ['make:middleware', 'generators', 'Native typed Hono middleware'],
  ['make:provider', 'generators', 'Provider lifecycle factory'],
  ['make:guard', 'generators', 'Authentication guard implementation'],
  ['make:user-provider', 'generators', 'Principal lookup implementation'],
  ['make:event', 'generators', 'Typed event contract'],
  ['make:listener', 'generators', 'Event listener with optional job dispatch'],
  ['make:job', 'generators', 'Validated versioned job payload and handler'],
  ['make:mail', 'generators', 'Message builder and email template'],
  ['make:notification', 'generators', 'Notification with explicit channels'],
  ['make:command', 'generators', 'Application CLI command'],
  ['make:schedule', 'generators', 'Explicit scheduled task registration'],
  ['make:test', 'generators', 'Meaningful test scaffold'],
  ['make:integration', 'generators', 'Optional lifecycle adapter'],
  ['db:seed', 'database', 'Run explicitly registered seeders'],
  ['db:rollback', 'database', 'Run authored reverse migrations'],
  ['db:fresh', 'database', 'Drop and recreate the application schema'],
  ['queue:failed', 'queue', 'Paginated failed-job metadata'],
  ['queue:retry', 'queue', 'Retry a failed job'],
  ['queue:retry-all', 'queue', 'Replay failed jobs in a queue'],
  ['queue:forget', 'queue', 'Delete a failed-job record'],
  ['queue:prune', 'queue', 'Remove retained terminal jobs'],
  ['queue:pause', 'queue', 'Pause consumption'],
  ['queue:resume', 'queue', 'Resume consumption'],
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
