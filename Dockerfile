FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build
RUN pnpm --dir web/admin install --frozen-lockfile \
  && pnpm --dir web/admin build

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/admin/dist ./web/admin/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD ["node", "-e", "fetch('http://localhost:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
# Migrates, materializes Better Auth's own tables, and seeds the bootstrap
# admin/client (all idempotent — safe to run on every container start) before
# serving, so `docker compose up` alone is enough on a fresh database.
CMD ["pnpm", "start:prod:full"]
