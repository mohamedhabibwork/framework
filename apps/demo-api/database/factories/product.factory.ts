import type { CreateProductInput } from '../../app/modules/products';

let sequence = 0;

function valid(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  sequence += 1;
  return {
    name: `name ${sequence}`,
    price: sequence,
    ...overrides,
  };
}

/** Fixtures derived from the products schema (types, nullability, refinements). */
export const productFactory = {
  valid,
  invalid: {
    missingRequired: () => {
      const { name: _name, price: _price, ...rest } = valid();
      return rest;
    },
    wrongTypes: () => ({ ...valid(), name: 42, price: 'not-a-number' }),
    refinementViolations: () => ({ ...valid(), name: '   ', price: 1.5 }),
    forbiddenFields: () => ({ ...valid(), id: '00000000-0000-4000-8000-000000000000' }),
  },
} as const;
