# Handly Web — production image (Batch 4).
#
# Built from the monorepo root: docker build -f apps/web/Dockerfile .
# Uses Next.js `output: 'standalone'` (next.config.mjs) — traces only the
# node_modules this app actually needs rather than shipping the whole
# monorepo's node_modules tree.
#
# Node 22: the pinned packageManager (pnpm@11.14.0) requires Node >=22.13 to
# run at all — see apps/api/Dockerfile's header comment for the exact error.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @handly/contracts build
RUN pnpm --filter @handly/web build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S handly && adduser -S handly -G handly
WORKDIR /app
# Standalone output preserves the monorepo-relative path (apps/web/...).
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
RUN chown -R handly:handly /app
USER handly
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
