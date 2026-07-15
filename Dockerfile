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
# Build the admin SPA (its own package + lockfile) into web/admin/dist.
RUN pnpm --dir web/admin install --frozen-lockfile \
  && pnpm --dir web/admin build

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/authentication/views ./src/authentication/views
# Static admin SPA served same-origin at /admin (see admin-static.options.ts).
COPY --from=build /app/web/admin/dist ./web/admin/dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
