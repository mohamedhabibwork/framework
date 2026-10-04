import { FrameworkError } from '@framework/core';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  assertNoCollision,
  type KeyOf,
  type QueryOptions,
  type RepositoryConstructor,
  type SelectOf,
  type TableOf,
} from './core';

/**
 * Replaces the delete strategy: `delete` sets the configured timestamp column
 * to the database clock (`now()`, valid for Date- and string-mode columns)
 * and `restore` clears it. Reads and updates already exclude deleted rows.
 */
export function SoftDeletable<TBase extends RepositoryConstructor>(Base: TBase) {
  assertNoCollision(Base, 'SoftDeletable', ['delete', 'deleteMany', 'restore', 'restoreMany']);

  abstract class SoftDeletableRepository extends Base {
    #deletedAt(): AnyPgColumn {
      const column = this.options.softDeleteColumn;
      if (!column) {
        throw new FrameworkError('SOFT_DELETE_MISCONFIGURED', 'SoftDeletable requires options.softDeleteColumn');
      }
      return column;
    }

    #propertyName(column: AnyPgColumn): string {
      const entry = Object.entries(this.table).find(([, value]) => value === column);
      if (!entry) {
        throw new FrameworkError('SOFT_DELETE_MISCONFIGURED', 'softDeleteColumn is not a column of this table');
      }
      return entry[0];
    }

    async delete(id: KeyOf<TableOf<TBase>>): Promise<boolean> {
      const column = this.#deletedAt();
      return this.write(async () => {
        const before = (await this.before(id)) as SelectOf<TableOf<TBase>> | null;
        const rows = await this.db
          .update(this.table as PgTable)
          .set({ [this.#propertyName(column)]: sql`now()` })
          .where(this.visibleWhere([eq(this.table.id, id)]))
          .returning();
        const after = (rows[0] as SelectOf<TableOf<TBase>> | undefined) ?? null;
        if (after) await this.afterWrite({ action: 'deleted', id, before, after });
        return after !== null;
      });
    }

    /** Bulk soft delete of every visible row matching `query.filters`. */
    async deleteMany(query: QueryOptions = {}): Promise<readonly KeyOf<TableOf<TBase>>[]> {
      const column = this.#deletedAt();
      return this.write(async () => {
        const beforeRows = await this.beforeMany(query);
        const rows = (await this.db
          .update(this.table as PgTable)
          .set({ [this.#propertyName(column)]: sql`now()` })
          .where(this.visibleWhere(query.filters))
          .returning()) as SelectOf<TableOf<TBase>>[];
        const ids: KeyOf<TableOf<TBase>>[] = [];
        for (const after of rows) {
          const id = (after as { id: KeyOf<TableOf<TBase>> }).id;
          ids.push(id);
          await this.afterWrite({ action: 'deleted', id, before: beforeRows.get(id) ?? null, after });
        }
        return ids;
      });
    }

    async restore(id: KeyOf<TableOf<TBase>>): Promise<boolean> {
      const column = this.#deletedAt();
      return this.write(async () => {
        const rows = await this.db
          .update(this.table as PgTable)
          .set({ [this.#propertyName(column)]: null })
          .where(and(...this.scopeConditions(), eq(this.table.id, id), isNotNull(column)))
          .returning();
        const after = (rows[0] as SelectOf<TableOf<TBase>> | undefined) ?? null;
        if (after) await this.afterWrite({ action: 'restored', id, before: null, after });
        return after !== null;
      });
    }

    /** Bulk restore of every soft-deleted row matching `query.filters`. */
    async restoreMany(query: QueryOptions = {}): Promise<readonly KeyOf<TableOf<TBase>>[]> {
      const column = this.#deletedAt();
      return this.write(async () => {
        const rows = (await this.db
          .update(this.table as PgTable)
          .set({ [this.#propertyName(column)]: null })
          .where(and(...this.scopeConditions(), isNotNull(column), ...(query.filters ?? [])))
          .returning()) as SelectOf<TableOf<TBase>>[];
        return rows.map((row) => (row as { id: KeyOf<TableOf<TBase>> }).id);
      });
    }

    /** Bulk soft delete by explicit ids (intersected with the visible scope). */
    async deleteByIds(ids: readonly KeyOf<TableOf<TBase>>[]): Promise<readonly KeyOf<TableOf<TBase>>[]> {
      if (ids.length === 0) return [];
      return this.deleteMany({ filters: [inArray(this.table.id, ids as unknown[])] });
    }
  }
  return SoftDeletableRepository;
}
