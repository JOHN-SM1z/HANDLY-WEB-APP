# Load/stress test findings (Batch 4, 2026-07-22)

Real measurements against a single local API instance (Node 22, 8-core dev
machine, local Postgres/PostGIS + Redis containers — same images as
`infra/docker/docker-compose.yml`), using `autocannon` (`pnpm add -w -D
autocannon`) and a small ad-hoc `socket.io-client` script. Not a substitute
for a real staging-environment load test before launch, but grounds the
production connection-pool guidance below in an actual measurement rather
than a guess, per the "use measurements before optimization" instruction.

## HTTP baseline (no DB): `GET /health/live`

50 concurrent connections, 15s:

| Metric | Value |
|---|---|
| Throughput | ~17,400 req/s avg |
| Latency p50 / p99 | 2 ms / 5 ms |

Establishes the pure Fastify/Node overhead floor — everything below this is
attributable to the database, not the HTTP layer.

## DB-backed read: `GET /categories`

| Concurrency | Throughput | Latency p50 | Latency p99 |
|---|---|---|---|
| 50 | ~4,200 req/s | 11 ms | 24 ms |
| 200 | ~4,900 req/s | 37 ms | 72 ms |

**Bottleneck identified:** throughput barely increased (4.2k → 4.9k, +17%)
while concurrency quadrupled (50 → 200) and p50 latency more than tripled
(11ms → 37ms) — the classic signature of a saturated resource queue, not
genuine linear scaling. Root cause: Prisma's default `connection_limit` is
`num_physical_cpus * 2 + 1` (17 on this 8-core box) when left unset, which
`DATABASE_URL` does in `.env`/`.env.example`. At 200 concurrent DB-querying
requests, most are queued waiting for one of ~17 pool connections rather than
the database or Node itself being the limit.

**Fix applied:** `.env.production.example`'s `DATABASE_URL` now documents
`connection_limit=10&pool_timeout=20` explicitly, with a comment tying the
number to `(connection_limit × running instances) < Postgres max_connections`
— a deliberately-set, horizontally-scalable cap instead of an
unconfigured-and-forgotten default. In production this endpoint also carries
`cache-control: public, max-age=60` (Batch 3) — a fronting CDN/reverse proxy
honoring that header removes most of this load before it ever reaches the
API, softening the real-world impact further.

## Socket.IO: 150 concurrent JWT-authenticated connections

| Metric | Value |
|---|---|
| Successful connections | 150 / 150 |
| Connect time p50 / p99 / max | 54 ms / 66 ms / 76 ms |
| `socketio_connections` gauge | Matched the real count exactly (150, then 0 after disconnect) |

No failures, no meaningful degradation observed at this scale. Confirms the
Batch 4 `socketio_connections` metric (`infra/metrics/metrics.service.ts`)
is accurate, not just present.

## Heaviest endpoint: `GET /admin/analytics/overview`

30 concurrent connections, 10s (admin-only, low-traffic-by-design surface):

| Metric | Value |
|---|---|
| Throughput | ~408 req/s avg |
| Latency p50 / p99 | 54 ms / 519 ms |

Expected to be the slowest endpoint in the system — it composes ~10 separate
aggregate queries (order counts by status, revenue sums, average
response/completion time, verification/subscription/referral distributions;
see "What Batch 3 shipped" in `CLAUDE.md`). Acceptable as-is: this is an
internal admin dashboard, not customer-facing, and real usage is a handful of
admins loading a page occasionally — not sustained concurrent hits. Flagged
as a candidate for a short server-side cache (e.g. 30–60s) if admin usage
ever grows past occasional dashboard loads, not done now per "measurements
before optimization" (no evidence yet that this is a real bottleneck at
actual usage levels).

## Real bug found via this pass (fixed)

Reading `/metrics` after the admin-analytics load test showed
`db_query_duration_seconds{model="respondedat", action="select"}` — a
mislabeled metric. Root cause: `parseQueryTarget()`
(`infra/prisma/prisma.service.ts`) used a naive regex to find a query's
`FROM` clause, which matched the `FROM` inside
`EXTRACT(EPOCH FROM "respondedAt" - "offeredAt")` (part of EXTRACT's own
syntax, not a table reference) before ever reaching the real
`FROM order_dispatches`. Fixed by stripping `EXTRACT(...)` calls before
running the FROM-detection regex; the two affected queries now correctly
label as `model="unknown"` (they aggregate across a join, which this
best-effort parser was never meant to fully resolve) instead of a wrong
table name. Regression test: `test/prisma-query-target.test.ts`. This only
affected metric label accuracy, never application behavior or correctness.

## Not load-tested this pass (documented, not silently skipped)

- **Concurrent dispatch cascades and concurrent payment `initiate()` under
  real parallel HTTP load** — these are already covered by dedicated
  correctness-under-concurrency tests (`dispatch-integration.test.ts`,
  `payments-integration.test.ts`: exactly-one-winner races), which prove
  *correctness*, not *throughput*. A full concurrent-dispatch throughput test
  needs many simultaneously-online master fixtures and is a good candidate
  for a dedicated staging-environment load test closer to launch, not
  reproduced here.
- **Multi-instance/horizontal scaling** — everything above is a single API
  process. The connection-pool math above assumes more than one instance;
  actually running two+ instances behind a load balancer to confirm has not
  been done (no reverse proxy/orchestrator is set up in this environment).
