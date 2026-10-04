import type { Application } from '@framework/core';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import type { FrameworkEnv } from './context';
import { type ErrorHandlingOptions, installErrorHandling } from './errors/handler';
import { HttpError } from './errors/http-error';
import { type ActorResolver, requestScope } from './middleware/request-scope';

export interface HttpKernelOptions extends ErrorHandlingOptions {
  /** Maximum request body in bytes. Default 1 MiB. */
  readonly maxBodyBytes?: number;
  /** Who is acting for each request; defaults to the anonymous actor. */
  readonly resolveActor?: ActorResolver;
}

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/**
 * Creates the root typed Hono application with the framework's fixed outer
 * order: request id -> body limit -> request scope. Errors are converted by
 * `onError`. Applications then chain native middleware and `.route()` modules
 * onto the returned instance; the result's type is usable by Hono RPC clients.
 */
export function createHttpKernel<TConfig extends object>(
  application: Application<TConfig>,
  options: HttpKernelOptions,
): Hono<FrameworkEnv> {
  const http = new Hono<FrameworkEnv>();
  installErrorHandling(http, options);
  http.use(requestId());
  http.use(
    bodyLimit({
      maxSize: options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
      onError: () => {
        throw new HttpError('PAYLOAD_TOO_LARGE');
      },
    }),
  );
  http.use(requestScope(application, options.resolveActor));
  return http;
}
