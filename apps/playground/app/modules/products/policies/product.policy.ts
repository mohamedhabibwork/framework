import { denyAll, type ResourcePolicy } from '@framework/http';

/**
 * Resource definition declares `access: public` for the five CRUD abilities;
 * every other ability keeps the deny-all default. Switch abilities to
 * principal checks once authentication (Phase 3) protects this resource.
 */
export const productPolicy: ResourcePolicy = {
  ...denyAll,
  viewAny: () => true,
  view: () => true,
  create: () => true,
  update: () => true,
  delete: () => true,
  audit: () => true,
  bulkDelete: () => true,
  bulkCreate: () => true,
};
