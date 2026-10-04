import { Creatable, Deletable, Readable, RepositoryCore, Updatable } from '@framework/database';
import type { products } from '../../../../database/schema/products';

/** Typed Drizzle repository composed from CRUD mixins. */
export class ProductRepository extends Deletable(Updatable(Creatable(Readable(RepositoryCore<typeof products>)))) {}
