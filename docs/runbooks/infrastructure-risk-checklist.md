# Infrastructure risk checklist (living document)

Started 2026-07-22, after Batch 4 (Launch Readiness) shipped. This is the
ongoing infrastructure-risk tracker requested alongside beta prep / growth
work — **not** a re-audit trigger. Items marked **Done** were verified live
during Batch 4 (or an earlier audit) and should not be rebuilt or
re-investigated unless there is concrete evidence of a regression (a real
incident, a failed health check, a metric that stops making sense). The
**open items** below are the actual living backlog — update this file as
they're closed or as new risks surface during beta.

**Priority tiers** (per founder instruction):
- **P1 — Required before beta**
- **P2 — Required before public launch**
- **P3 — Required only after significant scale**

---

## Observability

| Item | State | Risk if unaddressed | Priority |
|---|---|---|---|
| Structured logging | **Done** (pino, Batch 4) | — | P1 ✅ |
| Error monitoring (Sentry) | **Done, code-complete** — a no-op until `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` is actually set in the production environment | Beta errors go unseen until someone reports them manually | **P1 — set the real DSN before beta traffic starts** (this is a one-line env-var step, not a build task; see `docs/runbooks/deployment.md` §8) |
| Metrics collection | **Done** (`/metrics`, Prometheus format) | — | P1 ✅ |
| Operational dashboards | **Open** — `/metrics` exists as "a foundation for dashboards" per Batch 4's own scope, but no actual Grafana/hosted dashboard was built | During beta, nobody has a single place to *see* trends (error rate, latency, queue depth over time) — you'd be reading raw metric text or logs | **P2** — stand up a basic Grafana (or a hosted equivalent) reading `/metrics` before public launch; beta can run on manual spot-checks + logs given the founder-scale team |
| Alerting | **Open** — no PagerDuty/alert rules exist anywhere | A real outage (API down, DB unreachable, disk full) could go unnoticed until a user complains | **P2** — at minimum, wire `/health/ready` to an uptime-check service (e.g. a free-tier UptimeRobot/Better Uptime ping) with SMS/email alert before public launch. Full PagerDuty-style on-call escalation is **P3**, appropriate once there's a team to page. |

## Reliability

| Item | State | Risk if unaddressed | Priority |
|---|---|---|---|
| Health-check endpoints | **Done** (`/health/live`, `/health/ready`) | — | P1 ✅ |
| Docker/container health probes | **Done** (`HEALTHCHECK` in both Dockerfiles + compose) | — | P1 ✅ |
| Database backups | **Done** — scripts exist (`infra/scripts/backup.sh`) | Scripts existing ≠ scheduled. **Nothing currently runs `backup.sh` automatically** — it must be wired into a cron job (or managed-Postgres provider's own backup feature) at actual deploy time | **P1 — schedule it before beta**, not just before launch: beta is exactly when you have real customer/master data worth losing |
| Restore verification | **Done, documented** (`docs/runbooks/backup-restore.md`) — the *procedure* has been exercised once against a scratch container during Batch 4, not against real beta data | A backup nobody has restored is unverified by definition | **P2** — do one real restore drill against an actual beta-data backup before public launch |
| Disaster recovery procedures | **Done** (`docs/runbooks/deployment.md`) | — | P1 ✅ |
| Queue failure recovery | **Done** (BullMQ retry/backoff + idempotent `handleOfferExpiry`, verified via a real `SIGKILL` test in the M3 audit) | — | P1 ✅ |

## Deployment

| Item | State | Risk if unaddressed | Priority |
|---|---|---|---|
| CI/CD pipeline | **Done** (GitHub Actions: lint/typecheck/test/build/audit/CodeQL) | — | P1 ✅ |
| Automated testing pipeline | **Done** (169 backend tests, runs in CI against real Postgres/Redis) | — | P1 ✅ |
| Production deployment checklist | **Done** (`docs/runbooks/deployment.md` §8) | — | P1 ✅ |
| Rollback strategy | **Done, documented** (image-swap based, git-tag driven) — not yet exercised against a real production incident | A documented-but-never-tried rollback can still surprise you the first time | **P2** — do one practice rollback in staging before public launch |
| Environment configuration management | **Done** at the template level (`.env.production.example`) — real secrets are still managed as plain env vars, no secrets-manager (Vault/Doppler/SOPS) wired up | Fine for one founder/small team; becomes a real risk once more than one or two people touch production secrets | **P2 for a real secrets manager** if the team grows before public launch; **P1 is already satisfied** by the current manual process at beta scale |

## Security

| Item | State | Risk if unaddressed | Priority |
|---|---|---|---|
| Dependency vulnerability scanning | **Done** (`pnpm audit --audit-level=high` in CI; 0 known vulnerabilities as of 2026-07-22) | — | P1 ✅ |
| Secret scanning | **Done** (gitleaks in CI) | — | P1 ✅ |
| Authentication hardening | **Done** (login brute-force lockout, rotating refresh tokens, placeholder-secret production guard) | — | P1 ✅ |
| Environment hardening | **Done** (`TRUSTED_PROXY`, loopback-only container ports, security headers, CSP) | — | P1 ✅ |
| Rate-limit monitoring | **Open** — the limiter itself works (verified live), but nobody is watching *how often* it actually trips in production | A misconfigured `RATE_LIMIT_MAX` could silently throttle real users, or a real attack could go unnoticed as "just some 429s" | **P2** — add a dashboard panel / alert on sustained 429 rates once the dashboard (above) exists |
| Security headers | **Done** (CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS via nginx) | — | P1 ✅ |
| File upload security | **Done** (magic-byte validation on top of the mime allow-list + nosniff) | — | P1 ✅ |

## Performance

| Item | State | Risk if unaddressed | Priority |
|---|---|---|---|
| Performance profiling | **Partial** — `db_query_duration_seconds`/`http_request_duration_seconds` exist, but no deep CPU/flame-graph profiling has been done | Not a beta risk at expected traffic; matters once a specific endpoint is suspected slow under real load | **P3** |
| Load testing | **Done** (single-instance `autocannon` baseline, `docs/runbooks/load-test-findings.md`) | — | P1 ✅ for beta scale |
| Stress testing | **Partial** — found the connection-pool ceiling at 200 concurrent connections, but no long-duration soak test | A slow leak (memory, connection handles) wouldn't show up in a 15-second burst test | **P2** — a multi-hour soak test before public launch |
| Database optimization | **Done** (indexes verified via `EXPLAIN ANALYZE` across M3/Batch3/Batch4) | — | P1 ✅ |
| Connection pool review | **Done, documented** — `connection_limit`/`pool_timeout` guidance in `.env.production.example`, informed by a real measured bottleneck | The actual production value still needs to be *set* at deploy time based on real instance count | **P1 — set the real value at deploy**, not a build task |
| Caching strategy | **Partial** — only `GET /categories` has a `cache-control` header; no Redis-backed response cache or CDN for static assets | Not a beta risk at expected traffic (dozens–hundreds of users); would matter if the master/order list endpoints became hot under real growth | **P3** |

## Operations

| Item | State | Risk if unaddressed | Priority |
|---|---|---|---|
| Database maintenance procedures | **Done** (`docs/runbooks/migration-checklist.md`) | — | P1 ✅ |
| Monitoring ownership | **Open** — no named on-call/owner for alerts (an organizational decision, not something to build) | An alert nobody owns is the same as no alert | **P2** — assign an owner (even if it's just the founder) before public launch, once real alerting (above) exists |
| Incident response documentation | **Partial** — `deployment.md` covers the *mechanics* of rollback/DR, but there's no formal severity/communication/postmortem process | A real incident during beta would be handled ad hoc, which is workable at small scale but risky at public-launch scale | **P2** — write a short incident-response runbook (severity levels, who to notify, postmortem template) before public launch |
| Production runbooks | **Done** (`deployment.md`, `backup-restore.md`, `migration-checklist.md`, `load-test-findings.md`) | — | P1 ✅ |

---

## Summary: what's actually open right now

Everything marked **P1 ✅** is done and verified — no action needed unless
something regresses. The real open backlog, in priority order:

**Before beta traffic starts (do these, they're small):**
1. Set a real `SENTRY_DSN` in the production environment (Observability)
2. Schedule `infra/scripts/backup.sh` via cron / confirm managed-Postgres backups are on (Reliability)
3. Set the real `connection_limit` in production `DATABASE_URL` based on actual instance count (Performance)

**Before public launch (larger, but still bounded):**
4. Stand up a basic dashboard reading `/metrics` (Observability)
5. Wire `/health/ready` to an uptime-check + alert service (Observability)
6. Run one real backup-restore drill against actual beta data (Reliability)
7. Practice one rollback in staging (Deployment)
8. Add a rate-limit (429) monitoring panel/alert (Security)
9. Run a multi-hour soak/stress test (Performance)
10. Assign monitoring ownership + write a short incident-response runbook (Operations)

**Only after significant scale (do not build speculatively now):**
11. Deep performance profiling
12. Redis-backed response caching / CDN for static assets
13. Secrets-manager migration (Vault/Doppler/SOPS) if the team grows
14. Multi-instance horizontal load testing
