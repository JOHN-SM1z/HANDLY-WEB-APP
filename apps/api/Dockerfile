# Handly API — production image (Batch 4).
#
# Built from the monorepo root: docker build -f apps/api/Dockerfile .
# Uses `pnpm deploy` (pnpm's monorepo-aware packaging command) to produce a
# self-contained, real-files (no cross-package symlinks) production folder —
# avoids the broken-symlink failure mode a naive `COPY node_modules` between
# build stages hits with pnpm's workspace: linking.
#
# Node 22, not the repo's engines.node>=20 minimum: the pinned packageManager
# (pnpm@11.14.0, package.json) itself requires Node >=22.13 to run at all —
# confirmed by a real build failure on node:20-alpine (`ERR_UNKNOWN_BUILTIN_
# MODULE: node:sqlite`, pnpm 11's own dependency on a Node 22-only builtin).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @handly/contracts build
RUN pnpm --filter @handly/api build
# --legacy: pnpm v10+'s default "injected workspace packages" deploy mode
# needs inject-workspace-packages=true set repo-wide (a bigger change to how
# every workspace:* dependency resolves, not worth it just for this one
# Docker step) — --legacy is pnpm's own documented escape hatch for exactly
# this case.
RUN pnpm --filter @handly/api deploy --prod --legacy /out/api
# `pnpm deploy`'s own fresh install re-runs the api package's postinstall
# (`prisma generate`), but `prisma` itself is a devDependency — excluded from
# a --prod deploy — so that second generate attempt has no local `prisma`
# binary and silently falls back to a throwaway registry-fetched copy that
# writes nowhere useful; /out/api's @prisma/client is left as Prisma's
# built-in stub ("did not initialize yet"), confirmed by a real container run
# and inspecting the stub's actual file content. Fix: reuse the client this
# same stage's earlier `pnpm --filter @handly/api build` already generated
# correctly (via the full workspace install's real `prisma` devDependency),
# copying it over the stub instead of trying to regenerate a second time.
RUN set -eux; \
  SRC=$(find /repo/node_modules/.pnpm -maxdepth 1 -iname '@prisma+client@*' -print -quit)/node_modules/.prisma/client; \
  DEST=$(find /out/api/node_modules/.pnpm -maxdepth 1 -iname '@prisma+client@*' -print -quit)/node_modules/.prisma/client; \
  test -d "$SRC"; \
  rm -rf "$DEST"; \
  cp -r "$SRC" "$DEST"

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S handly && adduser -S handly -G handly
WORKDIR /app
COPY --from=build /out/api ./
# UPLOAD_DIR default ("./uploads", relative to process.cwd() = /app) — the
# LocalDiskStorage dev provider; a real deployment should mount a volume here
# or switch to an S3 StorageProvider (see docs/runbooks/deployment.md).
RUN mkdir -p uploads && chown -R handly:handly /app
USER handly
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main.js"]
