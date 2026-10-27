# Multi-stage build: dependencies install and typecheck run in cached
# layers; the runtime image carries only production dependencies and source.
FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
# Fail the image build on a broken tree before it ships.
RUN bunx tsc -p tsconfig.json

FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/bin bin
COPY --from=build /app/bootstrap bootstrap
COPY --from=build /app/app app
COPY --from=build /app/routes routes
COPY --from=build /app/config config
COPY --from=build /app/database database
# Non-root runtime user.
USER bun
CMD ["bun", "run", "bin/server.ts"]
