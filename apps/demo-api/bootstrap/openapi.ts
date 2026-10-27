import { dataOperations } from '@framework/crud';
import { generateOpenApiDocument, type Operation } from '@framework/openapi';
import { productOperations } from '../app/modules/products/openapi';

/** Documented API operations. Generators append module operation lists below the marker. */
export const operations: readonly Operation[] = [
  // @framework:openapi-operations
  ...productOperations,
  ...dataOperations({ mount: '/api/v1/data' }),
];

/** Session auth is a cookie; API clients authenticate with Bearer tokens. */
const securitySchemes = {
  sessionCookie: { type: 'apiKey', in: 'cookie', name: 'fw_session' },
  bearerAuth: { type: 'http', scheme: 'bearer' },
} as const;

export function buildOpenApiDocument(version = '1.0.0') {
  return generateOpenApiDocument({ title: 'DemoApiTest API', version, operations, securitySchemes });
}
