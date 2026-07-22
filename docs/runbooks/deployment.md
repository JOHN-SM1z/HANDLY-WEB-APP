# Deployment & disaster recovery (Batch 4)

Reference runbook for a single-host production deployment (`infra/docker/
docker-compose.prod.yml` + `infra/nginx/handly.conf.example`) — the scale
this app is built for at launch, per CLAUDE.md's "Batch 4 — Launch
Readiness" scope. Not a Kubernetes/multi-region runbook; that's a later
scaling milestone, not this one.

## 1. First deployment

1. Provision a host with Docker + Docker Compose, and a managed Postgres
   (PostGIS-enabled) + managed Redis if not running them on the same box —
   see `.env.production.example`'s comments on `connection_limit` and Redis
   persistence if self-hosting Redis.
2. Copy `.env.production.example` to `.env.production`, fill in every
   `CHANGE_ME` (see that file's own inline comments — JWT/encryption keys via
   `openssl rand -base64 …`, real SMS/AI/push credentials as applicable),
   and load it through your secrets manager rather than committing it.
3. Point `DATABASE_URL` at the real Postgres instance. Run migrations
   *before* starting the app containers, following
   `docs/runbooks/migration-checklist.md`:
   ```bash
   DATABASE_URL=... pnpm --filter @handly/api exec prisma migrate deploy
   ```
4. `docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build`
5. Confirm both containers are healthy: `docker compose ps` (healthcheck
   status), then `curl https://yourdomain.example/api/v1/health/ready`.
6. Put nginx (or your LB) in front using `infra/nginx/handly.conf.example`
   as a starting point — see §3 (TLS) and §4 (reverse proxy) below.
7. Run the seed script once (`pnpm db:seed`) if this is a fresh database —
   creates the 6 service categories + dev admin. **Change the seeded admin
   password immediately in production** (`+998900000000` / `admin12345` is a
   known, publicly-documented dev credential — never leave it active outside
   local dev).

## 2. Redeploying (rollback-safe)

Both `Dockerfile`s produce a single self-contained image per app
(`pnpm deploy --prod --legacy` for the API, Next `output: 'standalone'` for
web) — a redeploy is "build a new image, swap the container," not an
in-place file sync, which is what makes rollback simple:

```bash
# Deploy a new version
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build api web

# Roll back: re-tag/rebuild from the previous known-good commit and re-run
# the same command — restart: always + the healthcheck means a container
# that fails to become healthy never gets traffic in the first place if
# you're running behind a proxy that checks health before routing (nginx
# passive health checks, or add an external check before flipping DNS/LB).
git checkout <previous-good-sha>
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build api web
```

**Database migrations are the one non-trivial rollback risk** — code can
roll back instantly, but a destructive migration (dropped column, changed
type) cannot be un-applied by rolling back the app image alone. This is
exactly why `docs/runbooks/migration-checklist.md` exists — follow it for
every migration, especially "backup before migrate" and the additive-first
discipline it documents.

`app.enableShutdownHooks()` (`main.ts`) means `docker stop`/a rolling
restart runs every module's `onModuleDestroy` — the Prisma pool, the BullMQ
worker/queue Redis connections, and the Socket.IO server all close cleanly
on `SIGTERM` rather than being killed mid-request. The default Compose
`stop_grace_period` (10s) is enough for this app's current job types.

## 3. TLS

Not handled by the app itself — terminate TLS at the reverse proxy
(`infra/nginx/handly.conf.example`) or your cloud LB. Simplest path for a
single host: `certbot --nginx -d yourdomain.example` (Let's Encrypt).
`main.ts` deliberately does not set HSTS itself (see its own comment) —
the example nginx config sets it once TLS is confirmed terminating there.
Never serve the app over plain HTTP in production: JWT bearer tokens, the
refresh cookie, and encrypted PINFL payloads all assume a TLS transport.

## 3.5. Trusted proxy configuration (verify before launch)

`TRUSTED_PROXY` (`infra/config/env.ts`, default `'loopback'`) controls which
hop Fastify's `req.ip` trusts an `X-Forwarded-For` value from — this drives
both the per-IP rate limiter's key and `Session.ip`. Found during Batch 4's
final security audit: the app previously used an unconditional `trustProxy:
true`, which trusts every hop and makes `req.ip` spoofable via a
client-supplied `X-Forwarded-For` header (nginx's
`$proxy_add_x_forwarded_for` *appends* to whatever arrives, it doesn't
replace it). **`'loopback'` is only correct if the reverse proxy reaches the
app over true loopback** (e.g. nginx on the same host, not containerized,
connecting to a port published on `127.0.0.1`). If nginx/your LB instead
reaches this container over a Docker bridge network, set `TRUSTED_PROXY` to
that bridge's real subnet — check `docker network inspect
<network-name>` for the actual CIDR — otherwise every request will appear to
come from the bridge gateway (safe, but useless for rate-limiting) or, if
mis-set too permissively, remain spoofable. Verify this against your actual
topology; don't assume the default is correct for your setup.

## 4. Reverse proxy

Use `infra/nginx/handly.conf.example` as the starting point. Three things
it does that are easy to miss if hand-rolling a different proxy config:

- **WebSocket upgrade** for `/api/v1/ws/` (Socket.IO) — needs the
  `Upgrade`/`Connection: upgrade` headers forwarded and a long
  `proxy_read_timeout` (long-lived connections, not request/response).
- **`client_max_body_size`** raised above the default (60m here, above the
  50MB `UPLOAD_MAX_VIDEO_MB` default) — otherwise the proxy itself 413s
  large uploads before the app's own limit ever applies.
- **`/api/v1/metrics` and `/api/v1/health/ready` are IP-allowlisted**, not
  publicly proxied — both leak internal detail (dependency versions,
  queue depth, DB connectivity) that shouldn't be public. `/health/live`
  is deliberately *not* restricted — it's the one orchestrators/uptime
  checks need to hit from anywhere.

This nginx config assumes it runs **on the same host** as the containers,
reaching them at `127.0.0.1:3001`/`127.0.0.1:3000` — matching
`docker-compose.prod.yml`, which binds both ports to `127.0.0.1` rather than
`0.0.0.0` (found during Batch 4's final security audit: publishing on every
interface would let anyone reach the API/web directly, bypassing nginx's TLS
termination and the `/metrics`/`/health/ready` IP-allowlist entirely). If
nginx instead runs on a *different* host or as a separate container, update
both the upstream addresses here **and** the port bindings in
`docker-compose.prod.yml` to match your real network path — don't just
change one side.

## 5. Redis recovery

Redis holds: OTP/login rate-limit counters, the global rate-limit counters
(Batch 4), BullMQ's dispatch-offer-expiry queue, and session refresh-token
lookups go through Postgres (not Redis) — so Redis loss is **not** a
data-loss event for anything durable, only for in-flight timers/counters.

- **Redis process crash/restart:** `RedisService` (`infra/redis/redis.service.ts`)
  uses ioredis's default reconnection strategy — the app reconnects
  automatically, no restart needed. Confirmed live during the M3 audit
  (see CLAUDE.md's Socket.IO reconnection note — same underlying resilience
  pattern).
- **Redis data loss (e.g. ungraceful crash before an AOF fsync):** the dev
  compose file enables `--appendonly yes --appendfsync everysec` (fixed
  during the M3 audit after a real `SIGKILL` test lost a pending
  offer-expiry job) — carry the same flags into whatever managed/self-hosted
  Redis you run in production. **Impact of a lost `offer-expiry` job:** the
  affected `OrderDispatch` row stays `OFFERED` past its `expiresAt` with no
  self-healing sweep (a known, accepted limitation — see CLAUDE.md's M3
  audit notes). Manual recovery: query for `OrderDispatch` rows `WHERE
  status = 'OFFERED' AND "expiresAt" < now()` and manually trigger
  `DispatchService.handleOfferExpiry` (or restart the affected order's
  dispatch) — a good candidate for a periodic reconciliation worker in a
  future batch, not built here.
- **Rate-limit counters lost:** self-healing by design — a lost counter
  just means a client gets a fresh window; no correctness impact, at most a
  brief permissive gap.

## 6. PostgreSQL recovery

Full procedure: `docs/runbooks/backup-restore.md` (backup schedule, restore
verification against a scratch container, monthly-verification cadence).
Quick reference:

```bash
# Restore from the latest automated dump
infra/scripts/restore.sh <path-to-dump.dump>
```

**PostGIS-specific caveat** (already hit twice in this project's migration
history — see `docs/runbooks/migration-checklist.md`): a restore target
must have the `postgis` extension available before restoring, and the
`orders.location`/`service_areas.centerPoint` generated columns + their GIST
indexes should be spot-checked post-restore (`\d orders`, confirm
`orders_location_gist` is present) — `pg_restore` recreates them correctly
from a `-Fc` dump, but this is the one thing worth a manual glance before
declaring a restore fully healthy.

## 7. Worker (BullMQ) recovery

The dispatch worker (`modules/dispatch/dispatch.worker.ts`) is an in-process
BullMQ `Worker`, not a separate deployable — it starts and stops with the
API container itself. There is currently no standalone worker process to
recover independently.

- **Worker crash within a healthy API process:** BullMQ jobs have
  `attempts: 3` with exponential backoff (added in Batch 3 after finding
  `defaultJobOptions` had none) — a transient failure retries automatically;
  `handleOfferExpiry`'s status-guarded `updateMany` makes a retry safe
  (idempotent). There's no separate worker health check to monitor — the
  `/health/ready` queue check (`GET /health/ready`, `health.controller.ts`)
  covers it, since the worker lives in the same process.
- **API container restart (deploy, crash, OOM):** in-flight delayed jobs
  survive in Redis (see §5) and resume processing once the new container's
  worker attaches to the same queue — no manual intervention needed for a
  normal restart.
- **Stuck/duplicate offers after an abnormal event:** query
  `OrderDispatch` rows in `OFFERED` status past their `expiresAt` (same
  query as the Redis-recovery case above) as the manual detection method
  until a dedicated reconciliation sweep exists.

## 8. Production configuration checklist

Before flipping traffic to a new production deployment, confirm:

- [ ] `NODE_ENV=production` (enables `loadEnv()`'s placeholder-secret guard —
      the app refuses to boot with a dev JWT/encryption secret or one under
      32 chars; see `infra/config/env.ts`)
- [ ] `JWT_ACCESS_SECRET` / `FIELD_ENCRYPTION_KEY` are freshly generated,
      not copied from `.env.example` or `.env.production.example`
- [ ] `SMS_PROVIDER=eskiz` with real credentials (not `mock`) — the seed
      admin's OTP and every real user's OTP depend on this
- [ ] `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` set (error monitoring is a
      no-op otherwise — silently, by design, so this is easy to forget)
- [ ] `DATABASE_URL` includes `connection_limit`/`pool_timeout` tuned to your
      actual instance count (see load-test-findings.md §DB-backed read)
- [ ] `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` point at the real production
      domains (CORS, the refresh cookie, and the web app's CSP `connect-src`
      all derive from these — see `apps/web/next.config.mjs`)
- [ ] TLS is live end-to-end (§3) before any real user registers — JWTs and
      the refresh cookie must never cross plain HTTP
- [ ] `TRUSTED_PROXY` matches your real proxy topology, not left at the
      `'loopback'` default without verifying it (§3.5) — a wrong value here
      makes `req.ip` spoofable, undermining the per-IP rate limiter
- [ ] `/metrics` and `/health/ready` are not publicly reachable (§4)
- [ ] Redis has AOF persistence enabled if self-hosted (§5)
- [ ] The seeded dev admin's password has been changed (§1, step 7)
- [ ] A backup has been taken and a restore verified at least once against
      this exact production database before go-live
      (`docs/runbooks/backup-restore.md`)
