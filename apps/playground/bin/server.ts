import { installGracefulShutdown, redact } from '@framework/core';
import { createApplication } from '../bootstrap/app';
import { createHttp } from '../bootstrap/http';
import { loadAppConfig } from '../config';

const config = await loadAppConfig();
const application = await createApplication(config).boot();
const http = createHttp(application);

const server = Bun.serve({ hostname: config.http.host, port: config.http.port, fetch: http.fetch });
console.error(`[server] listening on http://${server.hostname}:${server.port}`, redact({ app: config.app }));

installGracefulShutdown({
  timeoutMs: config.http.shutdownTimeoutMs,
  onShutdown: async () => {
    await server.stop();
    await application.shutdown();
  },
});
