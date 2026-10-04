import { ANONYMOUS_ACTOR, ExecutionContext, type JsonObject } from '@framework/core';
import type { Page, PageRequest, QueryOptions, TransactionContext } from '@framework/database';
import { createDomainEvent, type EventBus } from '@framework/events';
import { badRequest, notFound } from '@framework/http';
import type { CrudRepository, EntityId, ResourceEntity } from './contracts';

/**
 * The shared request context every service receives — the same instance its
 * repositories hold, so controller -> service -> repository see one actor and
 * one transaction chain. `transactions` is optional so plain services run
 * without infrastructure; `DataContext` from `@framework/database` satisfies
 * this structurally.
 */
export interface ServiceContext {
  readonly execution: ExecutionContext;
  readonly transactions?: TransactionContext;
}

/** Context used when none is injected (scripts, tests, standalone use). */
export const DEFAULT_SERVICE_CONTEXT: ServiceContext = {
  execution: new ExecutionContext('command', 'standalone', ANONYMOUS_ACTOR),
};

export interface ResourceServiceOptions<TEntity extends ResourceEntity> {
  /**
   * Event channel (usually the resource name). Entity events
   * (`<channel>.created|updated|deleted|restored|imported`) are published
   * after every write when `channel`, `bus` and `serialize` are provided.
   */
  readonly channel?: string;
  readonly bus?: EventBus;
  /** Projects an entity onto its public JSON shape for event payloads. */
  readonly serialize?: (entity: TEntity) => JsonObject;
  /** Error thrown when an id has no visible row (default: 404 NOT_FOUND). */
  readonly missing?: (id: EntityId) => Error;
}

export interface ImportSummary {
  readonly created: number;
}

/**
 * Generic service base over a CRUD repository: lifecycle hooks around every
 * operation, optional entity events after the write committed, transaction
 * orchestration through the shared context, and a shared not-found
 * translation. Subclasses override hooks or methods to add business rules;
 * the defaults run as-is.
 *
 * The repository owns its own transactions and audit rows; hooks here run
 * outside the repository's transaction, so they observe committed state —
 * use {@link transaction} to run several writes atomically.
 */
export class ResourceService<
  TEntity extends ResourceEntity,
  TCreate extends JsonObject,
  TUpdate extends Partial<TCreate> = Partial<TCreate>,
> {
  constructor(
    protected readonly repository: CrudRepository<TEntity, TCreate, TUpdate>,
    /** Shared actor + transaction scope; defaults when omitted, injected per scope in apps. */
    protected readonly context: ServiceContext = DEFAULT_SERVICE_CONTEXT,
    protected readonly options: ResourceServiceOptions<TEntity> = {},
  ) {}

  /** The acting identity and correlation id of the current scope. */
  protected get execution(): ExecutionContext {
    return this.context.execution;
  }

  /**
   * Runs `work` atomically: joins the scope's open transaction or opens one.
   * Without a transaction context (standalone use) `work` simply runs.
   */
  protected transaction<T>(work: () => Promise<T>): Promise<T> {
    return this.context.transactions ? this.context.transactions.transaction(work) : work();
  }

  list(request: PageRequest, query: QueryOptions = {}): Promise<Page<TEntity>> {
    return this.repository.paginate(request, query);
  }

  async get(id: TEntity['id']): Promise<TEntity> {
    return (await this.repository.findById(id)) ?? this.#missing(id);
  }

  async create(input: TCreate): Promise<TEntity> {
    const values = await this.beforeCreate(input);
    const entity = await this.repository.create(values);
    await this.afterCreate(entity);
    await this.#publish('created', entity);
    return entity;
  }

  async update(id: TEntity['id'], changes: TUpdate): Promise<TEntity> {
    const applied = await this.beforeUpdate(id, changes);
    const entity = (await this.repository.update(id, applied)) ?? this.#missing(id);
    await this.afterUpdate(entity);
    await this.#publish('updated', entity);
    return entity;
  }

  async delete(id: TEntity['id']): Promise<void> {
    const entity = await this.get(id);
    await this.beforeDelete(id);
    if (!(await this.repository.delete(id))) this.#missing(id);
    await this.afterDelete(id);
    await this.#publish('deleted', entity);
  }

  async restore(id: TEntity['id']): Promise<TEntity> {
    if (!this.repository.restore) throw badRequest('This resource does not support restore');
    await this.beforeRestore(id);
    if (!(await this.repository.restore(id))) this.#missing(id);
    const entity = await this.get(id);
    await this.afterRestore(entity);
    await this.#publish('restored', entity);
    return entity;
  }

  /** Bulk insert used by the import pipeline; publishes one event per row. */
  async import(rows: readonly TCreate[]): Promise<ImportSummary> {
    const values = await this.beforeImport(rows);
    if (values.length === 0) return { created: 0 };
    const entities = await this.transaction(() => this.repository.createMany(values));
    await this.afterImport(entities);
    for (const entity of entities) await this.#publish('imported', entity);
    return { created: entities.length };
  }

  // -- Lifecycle hooks (override in subclasses; defaults are no-ops)

  protected beforeCreate(input: TCreate): Promise<TCreate> | TCreate {
    return input;
  }

  protected afterCreate(_entity: TEntity): Promise<void> | void {}

  protected beforeUpdate(_id: TEntity['id'], changes: TUpdate): Promise<TUpdate> | TUpdate {
    return changes;
  }

  protected afterUpdate(_entity: TEntity): Promise<void> | void {}

  protected beforeDelete(_id: TEntity['id']): Promise<void> | void {}

  protected afterDelete(_id: TEntity['id']): Promise<void> | void {}

  protected beforeRestore(_id: TEntity['id']): Promise<void> | void {}

  protected afterRestore(_entity: TEntity): Promise<void> | void {}

  protected beforeImport(rows: readonly TCreate[]): Promise<readonly TCreate[]> | readonly TCreate[] {
    return rows;
  }

  protected afterImport(_entities: readonly TEntity[]): Promise<void> | void {}

  #missing(id: EntityId): never {
    throw this.options.missing ? this.options.missing(id) : notFound(`Resource ${String(id)} not found`);
  }

  async #publish(verb: string, entity: TEntity): Promise<void> {
    const { bus, channel, serialize } = this.options;
    if (!bus || !channel || !serialize) return;
    await bus.publish(createDomainEvent(channel, verb, serialize(entity), this.context.execution));
  }
}
