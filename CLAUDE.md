# Handly — Project Guide (CLAUDE.md)

Handly is a **managed marketplace for home services in Uzbekistan** (plumber, electrician, cleaner, AC technician, handyman…). Customers describe a problem (with photos/video for free AI diagnosis), the platform auto-matches **one** verified master, and payment/warranty/incentives flow through the app. Monetization is **master subscriptions only** (no commission except a 1% tax withholding). UI is Uzbek-first (Russian second).

**The architecture is the source of truth: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** Read §0.1 for approved MVP decisions and the tax design. **Brand identity: [docs/design/BRAND.md](docs/design/BRAND.md)** (logo — do not redesign) **and [docs/design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md)** (product usage: placement, colors, type, components) — ink/orange checkmark-H identity, final as of 2026-07-21; the old `docs/BRAND.md`/`docs/DESIGN_SYSTEM.md` (blue dot mark) are superseded stubs kept only so old links don't break. Build milestones in order; do not start a future milestone until the current one is approved.

## Current status

- **Milestone 1 (Foundations + Auth & Profiles): DONE & verified (2026-07-19).**
- **Milestone 2 (Requests, AI diagnosis, pricing): DONE & verified (2026-07-20).**
- **Design system rebrand (ink/orange checkmark-H, per docs/design/): DONE (2026-07-21).** Cross-cutting UI pass, not a numbered milestone — see "What the design-system implementation shipped" below.
- **Milestone 3 (Matching & dispatch, PostGIS, real-time offers): DONE & verified (2026-07-21).**
- Next up is **Milestone 4** — do **not** begin until the founder approves.

## Monorepo layout (pnpm workspaces + Turborepo)

```
apps/
  api/        NestJS (Fastify) modular monolith — the backend
  web/        Next.js 15 (App Router) PWA — customer/master/admin frontend
packages/
  contracts/  Zod schemas + inferred types shared by web & api (build to dist)
  ui/         Design tokens (from the wireframe palette) + Tailwind preset
  config/     Shared tsconfig base
infra/docker/ docker-compose.yml (Postgres+PostGIS, Redis)
docs/         ARCHITECTURE.md
```

**Module rule:** each API module owns its tables; cross-module access goes through the owning service or domain events — never raw table access. This keeps future service extraction cheap.

## Tech stack

TypeScript everywhere · NestJS 11 (Fastify, no Passport — custom JWT guard) · Prisma 6 + PostgreSQL · Redis (ioredis) for OTP rate-limiting · argon2 (passwords + OTP hashing) · Next.js 15 + React 19 + Tailwind 3 · TanStack Query + Zustand · Zod (shared validation).

## Running locally

**Prereqs:** Node ≥ 20, pnpm. Database via **Docker Compose** (the approved dev setup).

```bash
pnpm install                 # installs deps; postinstall generates the Prisma client
cp .env.example .env         # single ROOT env file (dev defaults already filled in)
pnpm docker:up               # Postgres + Redis via Docker Compose (needs Docker running)
pnpm db:migrate              # applies migrations (Prisma reads the root .env via dotenv-cli)
pnpm db:seed                 # 6 service categories + dev admin
pnpm dev                     # turbo builds contracts, then runs api :3001 + web :3000
```

There is a single `.env` at the repo **root** — the API loads it at runtime, and the
`db:*` scripts load it for Prisma (via `dotenv -e ../../.env`). Do not create a separate
`apps/api/.env`.

- API base URL: `http://localhost:3001/api/v1` · Web: `http://localhost:3000`
- Health check: `GET /api/v1/health` → `{ status, db, redis }`
- **Dev admin (seed):** `+998900000000` / `admin12345`
- **SMS in dev:** `SMS_PROVIDER=mock` prints the OTP to the API log (search `📱 OTP for`). Set `SMS_PROVIDER=eskiz` + Eskiz creds for real SMS.

> Docker Desktop was not installable non-interactively (its installer needs `sudo`). Milestone 1 was verified against a temporary local Postgres/Redis on the same ports. To use the approved Docker path: install Docker Desktop (needs your password), then `pnpm docker:up && pnpm db:migrate && pnpm db:seed`. Both use `localhost:5432` / `localhost:6379`, so don't run Docker and a local Postgres/Redis at the same time.

## Common commands

```bash
pnpm build            # turbo build all (contracts → ui → api → web)
pnpm typecheck        # tsc across the workspace
pnpm --filter @handly/api test        # node:test unit tests
pnpm --filter @handly/api start:dev   # API only, watch mode
pnpm db:studio        # Prisma Studio
```

## What Milestone 1 shipped

**API (`apps/api`)**
- Auth: `POST /auth/register|login|otp/verify|otp/request|refresh|logout|password/request-reset|password/reset`. Phone + password with mandatory SMS OTP; **rotating single-use refresh tokens** in an httpOnly cookie (`handly_rt`), access JWT (15m) in memory.
- Global guards: `JwtAuthGuard` (Bearer, opt out with `@Public()`) then `RolesGuard` (`@Roles(...)`).
- Users/profiles: `GET /me`, `PATCH /me/customer`, `me/master` (skills, experience, bio, service areas, certifications/portfolio metadata, **PINFL encrypted**, `isSelfEmployed`), `me/addresses`.
- Catalog: `GET /categories` (public).
- `TaxProvider` interface + `MockTaxProvider` (+ `SoliqTaxProvider` stub) — computes/records the 1% withholding. **Not wired into any payment flow yet** (that's M4).
- Infra: typed env validation (Zod), Prisma, Redis, AES-256-GCM field crypto, RFC 9457 (`problem+json`) error filter, `ZodValidationPipe`.

**Web (`apps/web`)**
- Screens: `/login`, `/register` (Mijoz/Usta role), `/verify` (6-box OTP, resend countdown), `/forgot`, `/home` (guarded).
- API client (`lib/api.ts`), Zustand session store (access token in memory, silent-refresh bootstrap), TanStack Query, UI kit in `components/ui`.
- Design tokens in `packages/ui` (brand accent, ink `#111418`, warm neutrals) — light + dark, theme-aware. **Brand accent is now orange `#F26A1B`** per the 2026-07-21 rebrand (was blue `#185FA5` at M1 ship time) — see below.
- Support contacts: single source `apps/web/lib/support.ts` (`SUPPORT_PHONES`) rendered via `<SupportContacts />` as tappable `tel:` links — auth footer + `/help` today; Admin settings (M5) must read the same constant.

## What Milestone 2 shipped

**API (`apps/api/src/modules/orders`, `ai`)**
- Orders: `POST /orders` (draft), `PATCH /orders/:id`, `POST /orders/:id/media` (multipart, `@fastify/multipart`), `DELETE /orders/:id/media/:mediaId`, `POST /orders/:id/diagnose`, `POST /orders/:id/submit` (requires `consent:true`), `POST /orders/:id/cancel`, `GET /orders` (cursor-paginated), `GET /orders/:id`. Public `GET /media/:id` streams uploaded files (unguessable-uuid trust model, same as a presigned URL).
- State machine (`order-state.ts`): `DRAFT → PRICED → SEARCHING`, editing a `PRICED` order's category/description/tier drops it back to `DRAFT` (must re-diagnose); cancel allowed from `DRAFT`/`PRICED`/`SEARCHING`. Enforced server-side only — the frontend's cancel-button visibility is a UI affordance, not the authority.
- Pricing (`pricing.ts`): deterministic — category base band × complexity multiplier × service-tier multiplier, rounded to 5 000 so'm, floored at 30 000. **The AI never sets price directly**, only complexity.
- AI diagnosis (`ai/`): `AiService` picks `ClaudeAiProvider` (vision + `messages.parse` structured output, model from `AI_MODEL` env) when `AI_PROVIDER=claude` + a key is set, and **always falls back to `MockAiProvider`** (deterministic uz/ru keyword heuristic) on any failure or when unconfigured — AI assists, never gates, per architecture.
- Storage (`infra/storage`): `StorageProvider` interface + `LocalDiskStorage` (dev). S3 provider slots in later without touching callers.
- Service tiers: `SCHEDULED` (free, fixed slots `09:00/11:00/14:00/16:00`, ≤14 days ahead), `PRIORITY` (+15 000 so'm), `EMERGENCY` (+30 000 so'm) — metadata in `packages/contracts/src/order.ts` (`SERVICE_TIER_INFO`).
- **Timezone correctness:** Uzbekistan is a fixed UTC+5 offset (no DST). Slot math (`slotToUtcIso`/`utcIsoToSlot` in contracts) uses `Date.UTC()`/`getUTC*()` exclusively — never local `Date` methods — so scheduling is correct regardless of the server's or browser's own system timezone. Covered by dedicated round-trip unit tests.

**Web (`apps/web/app/orders`, `components/order`)**
- `/orders/new` — 3-step wizard (category + description + media + GPS/address → service tier + date/slot → AI quote + consent + submit), state persisted to `sessionStorage` (`lib/wizard-store.ts`) so a refresh resumes at the right step; the order itself stays server-authoritative.
- `/orders` — list with status badges + price range. `/orders/[id]` — full detail: media, AI diagnosis, price, status timeline, conditional cancel/resume actions.
- `/home` redesigned: real category grid (`GET /categories`), tap-through to the wizard pre-selecting that category.
- `components/nav/bottom-nav.tsx` — 5-tab nav (Bosh/Buyurtmalar/+/Bildirishnoma/Profil); `/profile` (moved from the old `/home`) and `/notifications` (placeholder) fill out the remaining tabs.

## What the design-system implementation shipped (2026-07-21)

Cross-cutting UI pass implementing the approved design handoff — not a numbered milestone; no backend or functional changes, M1/M2 behavior preserved throughout.

- **Source of truth relocated:** `docs/design/` (BRAND.md, DESIGN_SYSTEM.md, `components/COMPONENTS.md`, `tokens/handly-tokens.css`, `logos/`, `screens/*.dc.html` reference screens, `exports/`) is now canonical, copied in from the design handoff per its own manifest. The old root `docs/BRAND.md`/`docs/DESIGN_SYSTEM.md` are now 3-line stub pointers (kept only so existing links don't 404).
- **Rebrand:** logo mark changed from an ink tile + dot-in-H to a bare two-tone mark — ink "H" whose crossbar rises into an **orange checkmark** (`#F26A1B`) — per `docs/design/BRAND.md`, which explicitly marks this final ("do not revert to blue"). Updated `packages/ui/src/tokens.css` (brand ramp + all `--color-primary*`/`--color-focus`/`--color-info*` slots), `components/ui/logo.tsx`, `app/icon.svg`. **Dark-theme brand values aren't specified upstream** (the handoff's token sheet is light-only) — retinted here by re-applying the same light→dark derivation the previous blue ramp used (one step lighter for `-hover`, dark desaturated for `-soft`, etc.), so dark mode keeps working; flag to design if they want to specify these explicitly later.
- **Nav kept at 5 tabs:** the reference screens show a 4-tab nav (Home/Bookings/Chats/Profile, no center button) — but that drops the only visible way to reach `/orders/new` and the Notifications tab, with nothing shown to replace either. Kept the current 5-tab structure (incl. the center "+" create button) and just re-skinned colors/icons, rather than regressing that navigation path. No "Chats" tab/feature was added (no chat backend exists).
- **New components:** `Chip` and `Rating` in `components/ui/badge.tsx`; `components/master/` (`OnlineToggle`, `RouteTimeline`, `BookingRequestCard`, `WeekEarningsChart`) for the new Master Dashboard screen.
- **New screen — Landing (`/`):** logged-out root is now a real marketing page (`components/landing/marketing-landing.tsx`) per `Handly Landing.dc.html` — hero, real `GET /categories` service grid (real names + `basePriceMin`, not fabricated), how-it-works, trust panel, masters CTA, footer. Logged-in users still redirect straight to `/home` as before.
- **New screen — Master Dashboard (`/master`):** static/presentational recreation of `Handly Master Dashboard.dc.html` (online toggle, incoming-request accept/decline with countdown, route timeline, weekly earnings chart). **All data and interactions are local demo state only — no backend wiring** (matching/dispatch is M3, earnings ledger is M4+, neither exists yet). Reachable via a "Usta paneli" link on `/profile`, shown only for `role === 'MASTER'`. Treat as a visual preview, not a functional dashboard, until the relevant backend milestones land.
- **`/home` re-skinned, not re-built:** kept the real, working sections (search bar, category grid, greeting) restyled to the new palette/icons; did **not** add the reference's fabricated "active booking tracker" (hardcoded master/ETA), "top masters nearby" list, or promo banner, since Handly has no live-matching, master-ranking, or promo system yet and faking that data in a production screen would be misleading.

## What Milestone 3 shipped

**API — new modules (`apps/api/src/modules/dispatch`, `notifications`, `realtime`; `infra/push`, `infra/queue`)**
- **Dispatch engine (`modules/dispatch`):** `DispatchService.startDispatch(orderId)` runs right after `OrdersService.submit()` sets `SEARCHING` (fire-and-forget from the caller's perspective — a slow/failed cascade never fails the customer's submit request). Eligibility (`dispatch-eligibility.ts`) is one indexed raw-SQL query — not N+1 — filtering by category skill, the master's own `ServiceArea.radiusM` via `ST_DWithin` (PostGIS), `verificationStatus = VERIFIED`, `isOnline`, `trustTier` (`requiredTierForComplexity`: SIMPLE→0/MEDIUM→1/COMPLEX→2/CRITICAL→3), **not already working another `ASSIGNED` order**, no `BUSY`/`BOOKED` `AvailabilitySlot` for today, and not already offered this specific order. Scoring (`dispatch-scoring.ts`): `0.5×distance + 0.35×rating + 0.15×jobsDone`, weighted-random pick among the top-N closest (`DISPATCH_TOP_N`, default 5) — not a strict "closest always wins," per the approved sequential-dispatch design. One offer at a time; on decline or expiry, `cascadeNext` re-runs eligibility (excluding already-offered masters) and offers the next candidate; if the pool is exhausted, the radius widens once (`DISPATCH_RADIUS_EXPANSION_FACTOR`, default 2×) before the order terminally becomes `EXPIRED`.
- **Accept is the one truly race-sensitive write:** `acceptOffer` runs inside `prisma.$transaction` with `SELECT ... FOR UPDATE` on the order row first, so a concurrent accept on a *different* dispatch for the same order blocks until the winner commits, then correctly sees the order is no longer `SEARCHING` and is rejected with `409`. All other `OFFERED` dispatches for that order flip to `WITHDRAWN` in the same transaction. `OrderDispatch` has `@@unique([orderId, masterId])` (a master can never be double-offered the same order) and BullMQ jobs use deterministic `jobId`s (`offer-expiry-<dispatchId>`) so retried/duplicate enqueues can't create duplicate timers.
- **Background jobs (`infra/queue`):** one BullMQ queue (`dispatch`) on its own Redis connection (`maxRetriesPerRequest: null`, BullMQ's hard requirement — the shared `RedisService` connection caps retries for OTP rate-limiting, which is wrong for a queue). `DispatchWorker` processes `offer-expiry` jobs, calling the same idempotent `handleOfferExpiry` the decline path can also trigger indirectly (an `updateMany` status-guard means a second call on an already-resolved dispatch is a safe no-op).
- **Real-time (`modules/realtime`):** Socket.IO gateway at `/ws`, JWT-authenticated on handshake (reuses the same verification `JwtAuthGuard` does — no duplicated logic), joins a `user:${userId}` room. `DispatchService` calls `RealtimeGateway.emitToUser(...)` directly (no event bus exists anywhere in the API; introducing one for a single use case would be new architecture, not reuse). Events: `offer:received` (master), `order:updated` (customer + master, on assign/expire).
- **Notifications (`modules/notifications`):** `createRecord(tx, ...)` (transactional DB write, always inside the same transaction as the state change it announces) vs. `deliver(notification)` (best-effort push + socket, fire-and-forget after commit) vs. `notify(...)` (convenience wrapper for non-transactional call sites). `GET /notifications` (cursor-paginated, same pattern as `GET /orders`), `GET /notifications/unread-count`, `PATCH /notifications/:id/read`.
- **Push abstraction (`infra/push`):** `PushProvider` interface, `MockPushProvider` (console-logs, dev default), `FcmPushProvider` (`firebase-admin`, real send when `PUSH_PROVIDER=fcm` + all three `FCM_*` vars are set) — same "assists, never blocks" fallback shape as `AiService`. **Not yet wired to real device tokens** (no push-token registration endpoint exists yet — that's whenever the mobile/PWA push-permission flow is built); today it only ever exercises the mock path in practice.
- **New endpoints on the existing `master.controller.ts`:** `PATCH /me/master/availability {isOnline}`, `GET /me/master/offers/current`, `POST /me/master/offers/:id/accept`, `POST /me/master/offers/:id/decline`, `GET /me/master/current-job`.
- **`order-state.ts`:** `SEARCHING` now also transitions to `ASSIGNED` (dispatch success) and `EXPIRED` (pool exhausted); new `ASSIGNED → CANCELLED_BY_CUSTOMER` (customer can still back out post-match — no execution/payment has happened yet, that's M4).
- **PostGIS is live:** `orders.location` and `service_areas.centerPoint` are Postgres **generated columns** (`GENERATED ALWAYS AS (...) STORED`, `geography(Point,4326)`), auto-derived from the existing decimal lat/lng — modeled in `schema.prisma` as `Unsupported("geography(Point, 4326)")?` so Prisma knows the columns exist but never writes them. GIST indexes on both. The migration adds `CREATE EXTENSION IF NOT EXISTS postgis;` itself (needed for Prisma's shadow DB, which doesn't have it enabled by default even though the real dev DB does).

**Web**
- **`/master` is now real** (was a static demo, explicitly labeled as such): `useQuery`/`useMutation` against the endpoints above, `useSocketEvent('offer:received' | 'order:updated', ...)` (new `lib/socket.ts`, a thin `socket.io-client` singleton) updating query cache directly, real countdown from `offer.expiresAt`. Removed the fabricated "340k today / 3–5 jobs / 98% acceptance" stat strip and the `WeekEarningsChart` usage (no earnings ledger exists before M4) — replaced with the master's real `ratingAvg`/`jobsDone`. `RouteTimeline` now shows the one real current `ASSIGNED` job, or an honest empty state.
- **`/orders/[id]`:** subscribes to `order:updated` and refetches live; new "assigned master" card (name, verified check, rating) when `status === 'ASSIGNED'`; `EXPIRED` gets its own status message.
- **`/notifications`:** real list + mark-as-read-on-tap (was a placeholder).
- **Bottom nav:** real unread-count badge on the Bildirishnoma tab, live-updated via socket (replaces the old fake badge that only existed in the static master-dashboard nav).

**Real bugs found and fixed during M3's own verification pass** (not tooling quirks — see "Known issues" below for those):
- **BullMQ custom job IDs can't contain `:`.** The first `offerExpiryJobId`/`cascadeNextJobId` implementation built IDs like `` `offer-expiry:${dispatchId}` `` — BullMQ rejects any custom `jobId` containing a colon (it's BullMQ's own internal key delimiter) with `Error: Custom Id cannot contain :`. Because the cascade call is fire-and-forget from `OrdersService.submit()`, this exception was swallowed by the `.catch()` logger and never surfaced as a request failure — every single dispatch offer silently got **no expiry timer at all** (offers would sit `OFFERED` forever; `handleOfferExpiry`/cascade-on-timeout never ran). Confirmed via an empty `bull:dispatch:delayed` Redis set after a real dispatch. Fixed by switching both ID helpers to `-` (`apps/api/src/infra/queue/queue.constants.ts`); re-verified by watching a real offer both get its delayed job enqueued in Redis *and* fire exactly on schedule (dispatch flipped `OFFERED → EXPIRED` 34ms after `expiresAt`). If any future job type adds a custom `jobId`, keep it colon-free.
- **Eligibility didn't exclude masters already working an active job.** `findEligibleCandidates` checked `isOnline`/verification/trust-tier/today's `AvailabilitySlot`, but nothing excluded a master who already had a different order `ASSIGNED` to them — so a master mid-job could still be offered (and accept) a second, unrelated job, breaking the "one master, one job at a time" premise the whole sequential-dispatch design assumes. Confirmed live (a busy master received a fresh offer for an unrelated order) before being fixed. Fixed with a `NOT EXISTS (SELECT 1 FROM orders WHERE "masterId" = mp."userId" AND status = 'ASSIGNED')` predicate in `dispatch-eligibility.ts`, plus a dedicated regression test (`dispatch-integration.test.ts`: "excludes a master currently working another ASSIGNED job").

**Post-ship production-readiness audit (2026-07-21, before M3 approval)** — five areas verified with live evidence, not just code review; two more real issues found and fixed:
- **Concurrency (verified, no fix needed):** two real HTTP `accept` requests fired truly concurrently (backgrounded shell jobs) against two competing `OFFERED` dispatches for the same order — exactly one returned `201`, the other `409`, and the loser's dispatch row was cleanly `WITHDRAWN` (not left dangling). Confirms the `SELECT ... FOR UPDATE` transaction in `DispatchService.acceptOffer` serializes correctly under real concurrent load, not just in the existing DB-transaction unit test.
- **Queue resilience — real gap found and fixed.** Redis's dev image only did periodic RDB snapshots (`save 3600 1 300 100 60 10000`, no AOF) — confirmed a `SIGKILL`'d Redis container **lost** a pending offer-expiry BullMQ job created after the last snapshot, leaving its `OrderDispatch` stuck `OFFERED` past `expiresAt` forever (no self-healing exists for this). A *graceful* restart survived fine (Redis saves on `SIGTERM` when save points are configured) and the app auto-reconnects either way (ioredis's default retry strategy) — it's specifically the ungraceful-crash case that lost data. Fixed by enabling AOF (`--appendonly yes --appendfsync everysec`) in `infra/docker/docker-compose.yml`; re-ran the identical `SIGKILL` test and the job now survives and fires exactly on schedule. **Residual, accepted limitation:** there's still no periodic reconciliation sweep for the (now much rarer) case of a lost job — a good candidate for M4+ hardening, not built here since it's a new job type/design decision, not a config fix.
- **Socket.IO reconnection (verified, no fix needed):** forced a real disconnect (killed the API process) while a customer's order-detail page was open; the client auto-reconnected with a fresh session **twice in a row** with zero page action (Socket.IO's default `reconnection: true`, and `lib/socket.ts`'s `auth` callback re-evaluates the access token on every attempt). The server's `handleConnection` re-verifies the JWT and rejoins `user:{id}` on every new connection by construction (no reconnect-specific code needed). A subsequent real `accept` still pushed `order:updated` to the page live, no refresh.
- **Database performance — real gap found and fixed.** `EXPLAIN ANALYZE` against a synthetic 5,000-master dataset (scattered across Uzbekistan's real geographic extent, not just clustered near Tashkent — a tight scatter box hides this) showed the GIST index on `service_areas.centerPoint` was **never used** — Postgres seq-scanned every service area on every dispatch call. Root cause: `ST_DWithin(sa."centerPoint", o."location", sa."radiusM" * multiplier)` has a **per-row** radius (`sa.radiusM` is a column), and PostGIS can only drive a GIST index scan off a *constant* radius. Fixed by adding a constant-radius `ST_DWithin(..., 50_000 * multiplier)` pre-filter alongside the existing exact check (`dispatch-eligibility.ts`) — `50_000` mirrors the Zod-validated max `ServiceArea.radiusM` (`packages/contracts/src/user.ts`). Re-verified: the GIST index is now used (`Index Scan using service_areas_center_point_gist`), ~4× fewer buffer reads at 5,000 rows, and the real (non-benchmark) code path still returns the correct nearest real candidate. This gap would only have worsened as the real master count grew — buffer cost scaled with *total* masters before the fix, with *nearby* masters after.
- **API/contracts consistency (verified, no fix needed):** every M3 endpoint, request/response DTO, and Socket.IO event name cross-checked field-by-field between `packages/contracts`, the NestJS controllers, and every `apps/web/lib/*.ts` caller — all matched exactly, no orphaned frontend calls to non-existent routes. Minor, non-blocking note: `OrderUpdatedEvent`, `DispatchStatus`, `dispatchStatusSchema`, and `notificationTypeSchema` are exported but not currently imported anywhere (the two socket call sites use inline types instead; the status/type schemas have no user-input validation call site yet) — left as-is since they're harmless and consistent with this milestone's "leave extension points for later" pattern, not deleted per "don't modify unless blocking."

**Deliberately scoped down vs. the full ARCHITECTURE.md §9 vision** (all additive/extensible, not corners cut): no hot-reloadable rules engine (plain typed constants in `env.ts` instead — swapping to a real rule-config lookup later is a one-file change); no dynamic trust-tier recompute worker (`trustTier` stays admin/seed-set until M4+'s completed-job data exists to drive it); no Premium-first cascade round (no subscriptions exist yet — scoring has no Premium bit to check); no `EN_ROUTE`/`IN_PROGRESS`/`COMPLETED`/live GPS tracking (`ASSIGNED` is the new terminal status; job execution and payment are M4). `OrderDispatch.countedAsLead` **is** included and correctly set to `true` on accept, per "leave clean extension points" — nothing reads it yet, but M5's lead-quota system will read a field that was already being populated correctly.

## Conventions & decisions

- **Validation:** one Zod schema per shape in `packages/contracts`, used by BOTH the API (`ZodValidationPipe`) and the web (react-hook-form / client checks). Add new shapes there.
- **Money:** integer so'm, never floats. Wallet is an append-only ledger (design in ARCHITECTURE §3.2); withdrawable **earnings** and frozen **credits** (cashback) are separate wallet kinds.
- **The 1% is a tax withholding, not commission.** Confirm the legal obligation with a UZ tax adviser before wiring it into settlement (M4). PINFL is stored encrypted; never log or return it in plaintext (`pinflSet: boolean` is exposed, not the value).
- **Data residency (legal):** UZ law requires citizens' personal data on in-country servers; the primary production DB must be hosted in Uzbekistan. Minimize/disclose foreign sub-processors (Claude, FCM).
- **AI assists, never gates** — every AI feature (from M2 on) needs a deterministic fallback.
- **Matching (M3, shipped):** sequential auto-dispatch — filter eligible masters, score, weighted-random pick among the top-N closest, offer one at a time, cascade on decline/timeout. Customers never see a list. No Premium-first cascade round yet (no subscriptions exist) — see "What Milestone 3 shipped" below.

## Milestone boundaries (deliberately deferred)

- **Reverse geocoding:** no Yandex Geocoder integration yet — customers confirm/type the readable address themselves after using GPS for coordinates.
- **Media uploads:** local disk (`LocalDiskStorage`); the S3 presign/upload pipeline is a later milestone. Same for master certifications/portfolio (M1, still `objectKey`-only).
- **MyID / Didox / real SMS / payments / rules engine / trust tiers (recompute) / warranty / admin dashboard / subscriptions:** all later milestones per the roadmap. Interfaces (SmsProvider, VerificationProvider, TaxProvider, PaymentProvider, AiProvider, StorageProvider) exist so they slot in without rework.
- **CI/CD, ESLint config:** still not set up (`next.config` skips lint during build).
- **Job execution/payment (`EN_ROUTE`/`IN_PROGRESS`/`COMPLETED`), live GPS en-route tracking, earnings/wallet ledger, push-token registration (real FCM device tokens):** M4+. M3's `ASSIGNED` is the current terminal dispatch status — `/master`'s "Bajarildi deb belgilash" (mark complete) button is still presentational, matching the rest of the milestone boundary.

## Known issues

Tooling/environment quirks hit during manual verification — none are application defects. Documented so future verification passes don't misdiagnose them as regressions.

- **Sandboxed preview-browser blocks non-GET/POST requests:** the `mcp__Claude_Browser__*` preview tool (not real Chrome) blocks PATCH/PUT/DELETE at its network layer — GET/POST pass through fine. Confirmed via `read_network_requests` (`net::ERR_FAILED` on the PATCH call) and via curl parity (identical requests succeed instantly outside the sandbox). Work around by driving state-changing steps via curl and verifying rendering/GET/POST-only actions in the browser. Real browsers are unaffected.
- **Same sandbox's session cookie is unreliable across a full page reload:** across two verification passes, a `location.reload()`/F5 in that sandbox sometimes dropped the session (bounced to `/login`) and sometimes didn't — confirmed via a direct `fetch('/auth/refresh', {credentials:'include'})` immediately before/after a reload, which succeeds right up to the reload event either way. This points to the sandbox's proxy/context intermittently clearing cookies on navigation, not the app's session logic. Real browsers are unaffected.
- **Same sandbox can't drive native file pickers:** clicking a file-input control (order media upload) opens an OS-level file dialog this tool has no way to interact with (it lacks a `file_upload`-style capability, unlike the `claude-in-chrome` extension's `file_upload` tool). Media upload can't be exercised via a real UI click here — verify it instead with a direct multipart curl against `POST /orders/:id/media`.
- **Possible React StrictMode double-fire on `/auth/refresh` in dev:** manual verification occasionally saw two back-to-back `POST /auth/refresh` calls on a single page load, one `200` and one `400`. Likely React 18 StrictMode's dev-only double-invoke of the silent-refresh bootstrap effect racing against the rotating single-use refresh token — the first call rotates the cookie, the second (using the now-stale token) is rejected. One call has always succeeded and no user-visible failure has been observed, and StrictMode's double-invoke doesn't happen in production builds. Not yet root-caused with certainty — worth a look at the session bootstrap effect in `apps/web` if it's ever seen alongside an actual visible login/session failure.
- **`next dev`'s cache can go stale after a long run of rapid file edits:** during the 2026-07-21 design-system pass, `apps/web`'s dev server started serving a 404 for its own CSS bundle (`/_next/static/css/app/layout.css`) and every page rendered as unstyled raw HTML with a `500` on the page request — after dozens of edits to `tokens.css` and shared components in one sitting. `pnpm typecheck`/`pnpm build` were clean throughout (proving the code was fine), so this was dev-server-state corruption, not a bug. Fixed by `rm -rf apps/web/.next` + restarting `pnpm dev`. If a running dev server ever starts 404ing its own CSS or 500ing on a page it previously served fine, restart it before assuming a regression.
- **The preview-browser screenshot tool can render a blank frame that doesn't reflect real page state:** after a JS-triggered `window.scrollTo()`, a screenshot occasionally came back solid blank (page-background-colored), even on a second attempt. `document.elementFromPoint()` + `getBoundingClientRect()` on the same page at the same scroll position showed the real content correctly laid out with no gaps — so this is a capture/rasterization timing quirk in the tool, not a real rendering bug. Don't conclude "content is missing/broken" from a single blank screenshot after scrolling — verify with `get_page_text` or direct DOM measurement first.
- **`pkill -f "nest start"` does not match the actual `nest start --watch` process** — its real command line is `.../@nestjs/cli/bin/nest.js start --watch`, and `-f` matches the substring literally, so `"nest start"` never matches (there's a `.js ` between `nest` and `start`, not a space). Killing dev servers with that pattern leaves the parent `nest.js` process (and the `dist/main` child it manages) running, so a fresh `pnpm dev` collides on port 3001 (`EADDRINUSE`) with a stale instance still handling requests — this happened three times in one session and, once, produced a genuinely confusing false lead (a real dispatch bug looked at first like it might be caused by testing against a stale/duplicate process, since `ps aux` showed 3 overlapping `nest.js start --watch` instances at once). Correct patterns: `pkill -9 -f "nest\.js"` and `pkill -9 -f "apps/api/dist/main"`, plus `lsof -ti :3000 :3001 | xargs -r kill -9` as a belt-and-suspenders check — then confirm with `ps aux | grep -iE "nest\.js|next dev|turbo run dev|dist/main"` showing nothing before relaunching.

## Key env vars

`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `FIELD_ENCRYPTION_KEY`, `SMS_PROVIDER` (`mock`|`eskiz`) + `ESKIZ_*`, `TAX_PROVIDER` (`mock`|`soliq`) + `TAX_WITHHOLDING_RATE`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, **`AI_PROVIDER`** (`mock`|`claude`) + `ANTHROPIC_API_KEY` + `AI_MODEL` + `AI_TIMEOUT_MS`, **`UPLOAD_DIR`** + `UPLOAD_MAX_PHOTO_MB` + `UPLOAD_MAX_VIDEO_MB` + `ORDER_MAX_MEDIA`, **`PUSH_PROVIDER`** (`mock`|`fcm`) + `FCM_PROJECT_ID` + `FCM_CLIENT_EMAIL` + `FCM_PRIVATE_KEY`, **`DISPATCH_TOP_N`** + `DISPATCH_RADIUS_EXPANSION_FACTOR` + `DISPATCH_OFFER_TTL_SCHEDULED_SECONDS` + `DISPATCH_OFFER_TTL_PRIORITY_SECONDS` + `DISPATCH_OFFER_TTL_EMERGENCY_SECONDS`. See `.env.example`.
