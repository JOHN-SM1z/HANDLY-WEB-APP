# Handly — Project Guide (CLAUDE.md)

Handly is a **managed marketplace for home services in Uzbekistan** (plumber, electrician, cleaner, AC technician, handyman…). Customers describe a problem (with photos/video for free AI diagnosis), the platform auto-matches **one** verified master, and payment/warranty/incentives flow through the app. Monetization is **master subscriptions only** (no commission except a 1% tax withholding). UI is Uzbek-first (Russian second).

**The architecture is the source of truth: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** Read §0.1 for approved MVP decisions and the tax design. **Brand identity: [docs/BRAND.md](docs/BRAND.md)** (logo — do not redesign) **and [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)** (product usage: placement, colors, type, components). Build milestones in order; do not start a future milestone until the current one is approved.

## Current status

- **Milestone 1 (Foundations + Auth & Profiles): DONE & verified (2026-07-19).**
- **Milestone 2 (Requests, AI diagnosis, pricing): DONE & verified (2026-07-20).**
- Next up is **Milestone 3 (Matching & dispatch, PostGIS, real-time offers)** — do **not** begin until the founder approves.

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
- Design tokens in `packages/ui` (brand blue `#185FA5`, ink `#111418`, warm neutrals) — light + dark, theme-aware.
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
- `components/nav/bottom-nav.tsx` — 5-tab nav (Bosh/Buyurtmalar/+/Bildirishnoma/Profil) per DESIGN_SYSTEM §5; `/profile` (moved from the old `/home`) and `/notifications` (placeholder) fill out the remaining tabs.

## Conventions & decisions

- **Validation:** one Zod schema per shape in `packages/contracts`, used by BOTH the API (`ZodValidationPipe`) and the web (react-hook-form / client checks). Add new shapes there.
- **Money:** integer so'm, never floats. Wallet is an append-only ledger (design in ARCHITECTURE §3.2); withdrawable **earnings** and frozen **credits** (cashback) are separate wallet kinds.
- **The 1% is a tax withholding, not commission.** Confirm the legal obligation with a UZ tax adviser before wiring it into settlement (M4). PINFL is stored encrypted; never log or return it in plaintext (`pinflSet: boolean` is exposed, not the value).
- **Data residency (legal):** UZ law requires citizens' personal data on in-country servers; the primary production DB must be hosted in Uzbekistan. Minimize/disclose foreign sub-processors (Claude, FCM).
- **AI assists, never gates** — every AI feature (from M2 on) needs a deterministic fallback.
- **Matching (M3):** sequential auto-dispatch — filter eligible masters, score, weighted-random pick among the top-N closest, offer one at a time; Premium gets the first cascade round. Customers never see a list.

## Milestone boundaries (deliberately deferred)

- **PostGIS/geo:** orders store lat/lng as `Decimal`. PostGIS `geography` + GIST indexes + radius dispatch arrive in **M3**, along with actual matching (M2's `SEARCHING` status is a terminal placeholder — no master ever gets offered the order yet).
- **Reverse geocoding:** no Yandex Geocoder integration yet — customers confirm/type the readable address themselves after using GPS for coordinates.
- **Media uploads:** local disk (`LocalDiskStorage`); the S3 presign/upload pipeline is a later milestone. Same for master certifications/portfolio (M1, still `objectKey`-only).
- **MyID / Didox / real SMS / payments / rules engine / trust tiers / warranty / admin dashboard / subscriptions:** all later milestones per the roadmap. Interfaces (SmsProvider, VerificationProvider, TaxProvider, PaymentProvider, AiProvider, StorageProvider) exist so they slot in without rework.
- **CI/CD, ESLint config:** still not set up (`next.config` skips lint during build).
- **Known test-environment quirk (not an app bug):** the sandboxed preview-browser tool used for manual verification blocks PATCH/PUT/DELETE at its network layer (GET/POST pass through) and drops the session on a full page reload — confirmed via direct `fetch`/`XMLHttpRequest` probing and via curl parity (identical requests succeed instantly outside that sandbox). Real browsers are unaffected. If future UI verification in that same tool hits an unexplained `net::ERR_FAILED` specifically on a non-GET/POST request, check this before assuming a regression.

## Key env vars

`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `FIELD_ENCRYPTION_KEY`, `SMS_PROVIDER` (`mock`|`eskiz`) + `ESKIZ_*`, `TAX_PROVIDER` (`mock`|`soliq`) + `TAX_WITHHOLDING_RATE`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`, **`AI_PROVIDER`** (`mock`|`claude`) + `ANTHROPIC_API_KEY` + `AI_MODEL` + `AI_TIMEOUT_MS`, **`UPLOAD_DIR`** + `UPLOAD_MAX_PHOTO_MB` + `UPLOAD_MAX_VIDEO_MB` + `ORDER_MAX_MEDIA`. See `.env.example`.
