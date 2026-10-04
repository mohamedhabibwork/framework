import type { MiddlewareDescription, RouteInfo } from '@framework/http';
import type { Operation } from '@framework/openapi';

/** Project-relative locations used by generators and operational commands. */
export interface ProjectPaths {
  readonly modules: string;
  readonly schemaDir: string;
  readonly schemaIndex: string;
  readonly factories: string;
  readonly migrations: string;
  readonly apiRoutes: string;
  readonly providers: string;
  readonly openapi: string;
  /** Module exporting the application's `AppConfig` type. */
  readonly config: string;
  /** Module exporting `createTestContext()` for endpoint tests. */
  readonly testSupport: string;
}

/** External executables delegated to; the CLI never re-implements them. */
export interface ProjectTools {
  readonly typecheck: readonly string[];
  readonly test: readonly string[];
  readonly lint: readonly string[];
  readonly format: readonly string[];
  readonly drizzleKit: readonly string[];
  readonly dev: readonly string[];
  readonly serve: readonly string[];
  /** Queue worker entry point; enables `queue:work`. */
  readonly worker?: readonly string[];
  /** Scheduler process entry point; enables `schedule:work`. */
  readonly scheduler?: readonly string[];
}

/** Queue coordinates derived from the project's configuration. */
export interface QueueTarget {
  readonly url: string;
  readonly prefix: string;
  readonly queue?: string;
}

/**
 * Application-local hooks. Everything that needs the application's own code
 * goes through here, so the framework CLI never guesses project structure
 * from the shell's working directory.
 */
export interface ProjectAdapter {
  readonly name: string;
  readonly root: string;
  readonly frameworkVersion: string;
  readonly apiPrefix: string;
  readonly paths: ProjectPaths;
  readonly tools: ProjectTools;
  /** Env file holding TEST_DATABASE_URL for verification runs (absolute path). */
  readonly testEnvFile?: string;
  loadConfig(envFile?: string): Promise<unknown>;
  databaseUrl(config: unknown): string;
  /** Queue connection for queue commands; omitting it disables them (exit 3). */
  queueUrl?(config: unknown): QueueTarget;
  /** Route table of the composed HTTP app; must not open connections. */
  routes(config: unknown): Promise<readonly RouteInfo[]>;
  providers(): readonly string[];
  middleware(): readonly MiddlewareDescription[];
  openapi(): { readonly operations: readonly Operation[]; build(version?: string): object };
}

export const defineProject = (project: ProjectAdapter): ProjectAdapter => project;
