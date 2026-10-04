import type { JsonObject, JsonValue } from '@framework/core';
import type { Page, PageMeta, PageRequest, QueryOptions } from '@framework/database';

/** Primary keys the CRUD layer supports (single-column, string or number). */
export type EntityId = string | number;

/** Every entity driven through the generic CRUD layers carries its id. */
export interface ResourceEntity<TId extends EntityId = EntityId> {
  readonly id: TId;
}

export type { Page, PageMeta, PageRequest, QueryOptions };

/** Serialized page shape returned by controllers (`items` + `meta`). */
export type PageResponse<T> = {
  readonly items: readonly T[];
  readonly meta: PageMeta;
};

/**
 * What the generic service needs from a repository. Repositories composed
 * from the framework mixins (`Readable`, `Creatable`, `Updatable`,
 * `Deletable`/`SoftDeletable`) satisfy this structurally; `restore` and
 * `batches` exist only on some compositions and are therefore optional.
 */
export interface CrudRepository<
  TEntity extends ResourceEntity,
  TCreate extends JsonObject,
  TUpdate extends Partial<TCreate> = Partial<TCreate>,
> {
  findById(id: TEntity['id']): Promise<TEntity | null>;
  paginate(request: PageRequest, query?: QueryOptions): Promise<Page<TEntity>>;
  create(values: TCreate): Promise<TEntity>;
  createMany(values: readonly TCreate[]): Promise<TEntity[]>;
  update(id: TEntity['id'], changes: TUpdate): Promise<TEntity | null>;
  delete(id: TEntity['id']): Promise<boolean>;
  restore?(id: TEntity['id']): Promise<boolean>;
  batches?(size: number, query?: QueryOptions): AsyncGenerator<readonly TEntity[], void, undefined>;
}

/** Rows accepted by the CSV/JSON import pipeline. */
export type ImportRow = JsonObject;
export type ExportRow = JsonObject;
export type JsonRecord = Record<string, JsonValue>;
