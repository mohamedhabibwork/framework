import { denyAll, type ResourcePolicy } from '@framework/http';

/**
 * Resource definition declares `access: public` for the five CRUD abilities;
 * every other ability keeps the deny-all default.
 */
export const productPolicy: ResourcePolicy = {
  ...denyAll,
  viewAny: () => true,
  view: () => true,
  create: () => true,
  update: () => true,
  delete: () => true,
};
