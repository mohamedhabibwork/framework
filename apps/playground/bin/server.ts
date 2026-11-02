import { websocket } from '@framework/events';
import { runServer } from '@framework/http';
import { createApplication, createHttp } from '../bootstrap/app';
import { loadAppConfig } from '../config';

const config = await loadAppConfig();
const application = await createApplication(config).boot();

// Drains in-flight requests on SIGTERM/SIGINT, then shuts the application down.
await runServer({
  application,
  fetch: createHttp(application).fetch,
  hostname: config.http.host,
  port: config.http.port,
  websocket,
  shutdownTimeoutMs: config.http.shutdownTimeoutMs,
});
