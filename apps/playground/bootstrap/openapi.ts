import { dataOperations } from '@framework/crud';
import { generateOpenApiDocument, type Operation } from '@framework/openapi';
import { authOperations } from '../app/auth/openapi';
import { productOperations } from '../app/modules/products/openapi';

/** Documented API operations. Generators append module operation lists below the marker. */
export const operations: readonly Operation[] = [
  // @framework:openapi-operations
  ...authOperations,
  ...productOperations,
  ...dataOperations({ mount: '/api/v1/data', resources: ['products'] }),
];

/** Session auth is a cookie; API clients authenticate with Bearer tokens. */
const securitySchemes = {
  sessionCookie: {
    type: 'apiKey',
    in: 'cookie',
    name: 'fw_session',
    description: 'Session cookie issued by /auth/login',
  },
  bearerAuth: { type: 'http', scheme: 'bearer', description: 'Personal API token (`fw_pat_…`)' },
} as const;

export function buildOpenApiDocument(version = '1.0.0') {
  return generateOpenApiDocument({ title: 'Playground API', version, operations, securitySchemes });
}
