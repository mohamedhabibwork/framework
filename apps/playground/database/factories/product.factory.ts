import type { CreateProductInput } from '../../app/modules/products';

let sequence = 0;

/** Schema-aware fixtures for products: one valid builder plus named invalid payloads. */
export const productFactory = {
  valid(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
    sequence += 1;
    return { name: `name ${sequence}`, price: `${sequence}.25`, ...overrides };
  },
  invalid: {
    missingRequired: {},
    wrongTypes: { name: 42, price: 10.5 },
    refinementViolations: { name: '   ', price: '1.234' },
    forbiddenFields: { name: 'name x', price: '1.00', id: '00000000-0000-4000-8000-000000000000' },
  },
} as const;
