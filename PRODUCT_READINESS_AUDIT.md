# Handly — Product Readiness Improvement Sprint Audit (2026-07-25)

**Status:** Feature-complete and beta-ready. All 12 planned milestones/batches shipped and verified. This audit identifies the highest-value remaining improvements focused on reliability, trust, scalability, and launch readiness across 15 priority areas.

**Current State Summary:**
- All core platform features shipped (auth, orders, dispatch, payments, GPS tracking)
- Real payment provider (Click) integrated with webhook signature verification
- CI security scan passing (high/critical CVEs patched)
- Beta Blocker Sprint completed (master onboarding, customer/master contact, payment resolution)
- Beta-ready for launch with Click merchant credentials + SMS/verification provider credentials

---

## Product Readiness Assessment by Priority Area

### 1. Payment Integration — Click Live

**Current State:**
- ✅ Click provider fully implemented with HMAC-SHA256 webhook verification
- ✅ Idempotent webhook replay handling via `providerRef` unique constraint
- ✅ All 7 unit tests passing; signature verification verified
- ✅ Graceful fallback when credentials missing

**Deferred:**
- Payme/Uzum as additional adapters (same interface)
- Subscription auto-renewal via stored tokens
- Real billing for Premium plan upgrade
- Refund/chargeback flow beyond manual admin resolution

**Recommendations for Launch:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Obtain & configure Click merchant credentials** | Required to enable real payments — beta is non-functional without this | 🔴 CRITICAL: Entire revenue model depends on this | Env var injection (`CLICK_MERCHANT_ID`, `CLICK_MERCHANT_SECRET_KEY`); test webhook endpoint configuration in Click dashboard | S | Click account setup | **YES (hard blocker)** |
| **Implement Payme provider adapter** | Provides fallback if Click unavailable; improves redundancy; matches founder's spec | 🟡 Important: Reduces single-provider risk; expands coverage | New `PaymePaymentProvider` file (~150 lines); same `PaymentProvider` interface; existing factory pattern works | M | Payme merchant account + SDK review | No (post-launch redundancy) |
| **Add real billing for Premium subscriptions** | Masters currently upgrade for free; no charge flow exists despite subscription logic | 🔴 CRITICAL: Revenue leak for Premium plan | Wire `upgradeToPremium` to call `paymentProvider.charge()`; reuse existing settlement flow; add trial-expiry auto-downgrade worker | M | Click provider (above); BullMQ worker pattern established | No (but needed for premium revenue) |
| **Admin payment resolution UI improvements** | Current flow is minimal (`POST /admin/payments/:id/resolve`); lacks detail/history | 🟡 Important: Improves trust when disputes occur | Add payment detail view, transaction history, manual hold/release logic; integrate with Click API for transaction lookup | M | Click provider; existing admin dashboard | No (but improves support quality) |

**Blockers Before Public Launch:**
1. **Click merchant credentials (S)** — must be obtained from Click.uz and configured
2. **Premium subscription real billing (M)** — needed if offering paid plans on launch

**Recommended Priority:** Get Click credentials immediately. Schedule premium billing implementation if launching with paid tiers; defer if free-only launch.

---

### 2. Identity Verification — MyID Integration

**Current State:**
- ✅ `VerificationProvider` interface exists with `MockVerificationProvider`
- ✅ Master verification flow complete but admin-only (manual review)
- ✅ PINFL encrypted at rest; `isSelfEmployed` tracked
- ✅ Verification status UI exists; workflow enforces verification before job eligibility

**Deferred:**
- MyID B2B contract + real API integration
- Liveness check / biometric verification
- Didox as alternative provider
- Automated verification + fraud detection

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Integrate MyID provider** | Required for legal compliance in Uzbekistan; manual verification doesn't scale | 🔴 CRITICAL (legal): UZ law may mandate automated ID verification for marketplace participation | New `MyIdVerificationProvider`; webhook for verification results; idempotent result handling | L | MyID B2B contract + legal review | **Possibly (consult legal)** |
| **Add liveness/biometric check** | Reduces fraud risk; verifies real person matches ID | 🟡 Important: Increases master trust; reduces refund rate | Optional second layer; can be deferred if manual review works | M | MyID or Didox integration | No (post-launch hardening) |
| **Implement Didox as fallback** | Provides alternative if MyID unavailable | 🟡 Recommended: Improves resilience | Same `VerificationProvider` interface; one new file | M | Didox contract + SDK | No (redundancy, post-launch) |
| **Add fraud detection heuristics** | Current manual review catches obvious cases; repeated rejects waste admin time | 🟡 Important: Improves admin efficiency; reduces bad-actor signup attempts | Background check via sanction lists or previous-rejection tracking; rate-limit per phone/IP | M | No new deps | No (improves scale) |

**Blockers Before Public Launch:**
1. **Legal review: Is MyID mandatory?** — confirm with UZ compliance adviser
2. **MyID integration (L)** — if mandatory, required before launch

**Recommended Priority:** Get legal clearance on verification requirements; if mandatory, schedule MyID integration immediately (it's the longest lead item).

---

### 3. Object Storage — AWS S3 / Cloudflare R2

**Current State:**
- ✅ `StorageProvider` interface exists with `LocalDiskStorage` MVP
- ✅ All uploads (order media, master certs, completion evidence) work via disk
- ✅ Presigned URL interface designed but not implemented
- ✅ Upload API (`POST /orders/:id/media`) fully functional

**Deferred:**
- S3 presigned-URL workflow
- CloudFlare R2 adapter
- CDN integration for media serving

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Implement S3 storage adapter** | LocalDisk doesn't scale beyond single host; S3 required for cloud deployment | 🔴 CRITICAL (scale): Required for any managed hosting or multi-region | New `S3StorageProvider`; presigned-URL generation; CORS config; ~100 lines | M | AWS account + S3 bucket | **Yes (blocks cloud deploy)** |
| **Add CloudFlare R2 adapter** | Cheaper than S3; better global distribution | 🟡 Recommended: Cost savings + performance | Same `StorageProvider` interface; identical to S3 adapter logic | S | R2 account (optional) | No (cost optimization) |
| **Implement CDN for media serving** | Currently served directly from app; presigned URLs add latency | 🟡 Recommended: Improves image load speed (Largest Contentful Paint) | CloudFlare Workers or AWS CloudFront in front of S3; cache headers on images | M | S3 integration (above); CDN account | No (performance, not blocking) |

**Blockers Before Public Launch:**
1. **S3 adapter (M)** — if deploying to cloud; not needed for single-host Docker deployment

**Recommended Priority:** Implement S3 adapter before cloud deployment; can defer if staying on single host initially.

---

### 4. Reverse Geocoding — Yandex Geocoder

**Current State:**
- ✅ GPS coordinates captured from device
- ✅ Customers manually confirm readable address after GPS input
- ✅ Map integration works with live GPS tracking
- ✅ No Yandex Geocoder integration yet

**Deferred:**
- Automated address lookup from coordinates
- Address autocomplete on form input
- Multiple address suggestions

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Integrate Yandex Geocoder for reverse lookup** | Current flow requires manual typing; reverse geocoding auto-fills readable address | 🟢 Nice to have: Reduces user friction; improves UX but not blocking | API call after GPS capture; error fallback to manual input; ~50 lines | S | Yandex Maps API key (free tier available) | No (UX enhancement) |
| **Add address autocomplete** | Speeds up address entry on order creation | 🟢 Recommended (post-launch): Incremental UX improvement | Debounced API calls; combobox with suggestions; ~100 lines | S | Yandex API | No (convenience feature) |

**Blockers Before Public Launch:**
- None (MVP works with manual entry)

**Recommended Priority:** Defer to post-launch Phase 2 (nice to have). Current manual entry is functional.

---

### 5. Customer Support System — Chat & In-App Messaging

**Current State:**
- ✅ Customer ↔ Master contact via `tel:` links (added in Beta Blocker Sprint)
- ✅ Admin support dashboard exists
- ✅ No in-app chat/messaging system yet
- ✅ Support contacts in `apps/web/lib/support.ts`

**Deferred:**
- Real-time chat between customer & master
- Message history & persistence
- Moderation & reporting

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Add in-app customer ↔ master chat** | Phone calls are unreliable; no message history for disputes | 🔴 CRITICAL (trust): Reduces fraud/disputes via documented communication | New `Message` model + `MessagesController`; Socket.IO room per order; ~300 lines | L | Socket.IO already integrated; Redis for persistence | **Yes (important before scale)** |
| **Implement message moderation** | Unmoderated chat can expose offensive content; enables harassment | 🟡 Important: Protects platform reputation; reduces abuse | Content filter + admin flagging; report-message endpoint; ~150 lines | M | No new deps | No (post-launch, but soon) |
| **Add chat search & history export** | Users expect to find past messages; disputes need evidence | 🟡 Recommended: Improves support quality | Message search endpoint; PDF export for admin; ~100 lines | S | Message persistence (above) | No (feature-request level) |

**Blockers Before Public Launch:**
- None (phone contact works for MVP)

**Recommended Priority:** Schedule for Phase 2 (post-launch iteration). Phone contact is functional for beta.

---

### 6. SEO & Marketing Website

**Current State:**
- ✅ Marketing landing page exists (`components/landing/marketing-landing.tsx`)
- ✅ Basic SEO metadata in layout
- ✅ No dedicated marketing site (currently app-embedded)
- ✅ No structured data / schema.org markup

**Deferred:**
- Dedicated marketing domain / site
- SEO content strategy
- Social media / app store presence
- Paid acquisition funnel

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Add structured data (schema.org)** | Search engines understand platform better; rich snippets in SERP | 🟢 Recommended: Improves discoverability; costs nothing | JSON-LD for LocalBusiness + Service; ~100 lines in layout | S | None | No (SEO hygiene) |
| **Optimize landing page for Core Web Vitals** | Google ranks fast, accessible sites higher | 🟡 Important: Impacts organic search ranking | Profile with Lighthouse; optimize LCP (image sizing), FID (JS), CLS (layout shifts); ~1–2 days tuning | M | Vercel Analytics (already set up) | No (ranking factor, not blocker) |
| **Create dedicated marketing site** | App landing page isn't optimized for converting cold traffic | 🟡 Recommended: Improves brand presence; drives acquisition | Separate Next.js route `/marketing`; mirror design system; ~500 lines component code | M | Design system (already exists) | No (post-launch marketing) |
| **Set up App Store / Play Store listings** | Mobile discovery; required for PWA-to-native path | 🟡 Important (for growth): Increases install volume | Metadata, screenshots, privacy policy link per store; ~1 day per store | S | App signing certs; store accounts | No (deferred to Phase 2) |

**Blockers Before Public Launch:**
- None (landing page exists; app-embedded is sufficient for beta)

**Recommended Priority:** Add structured data immediately (quick win for SEO). Defer dedicated marketing site to post-launch.

---

### 7. Analytics & Product Metrics

**Current State:**
- ✅ `analytics` module with event tracking
- ✅ Admin analytics dashboard (`admin-analytics.controller/service`)
- ✅ Prometheus metrics (`metrics.service`)
- ✅ Real-time aggregates; no materialized views

**Deferred:**
- Materialized views for hourly/daily snapshots
- Grafana dashboards
- Cohort analysis / retention tracking
- Advanced attribution modeling

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Create materialized views for analytics** | Current queries seq-scan large tables; slow at scale | 🟡 Important: Improves dashboard performance; reduces DB load | PG materialized views; refresh job every hour via BullMQ; ~200 lines | M | BullMQ (exists); PG views skill | No (performance, not blocker) |
| **Add Grafana dashboards** | Prometheus metrics are collected but not visualized | 🟡 Recommended: Improves ops observability | Grafana setup + dashboard definitions; ~50 panels for key metrics; ~4 hours setup | M | Prometheus (running in Batch 4); Grafana service | No (ops nicety, not launch-blocking) |
| **Implement cohort retention tracking** | Need to measure master/customer stickiness | 🟡 Important: Key product metric for unit economics | Cohort tables + aggregation queries; BQ-style grouping; ~300 lines | M | Analytics module (exists) | No (business intelligence, not blocking) |
| **Add funnel analysis** | Track drop-off in signup/first-order flow | 🟡 Recommended: Identifies conversion leaks | Event sequencing queries; funnel endpoints; ~200 lines | M | Event tracking (exists) | No (optimization, not blocking) |

**Blockers Before Public Launch:**
- None (real-time analytics sufficient for beta)

**Recommended Priority:** Implement materialized views + Grafana dashboards for Batch 4 follow-up (ops readiness). Defer cohort/funnel to Phase 2.

---

### 8. Monitoring & Observability

**Current State:**
- ✅ Error monitoring via Sentry (integrated in Batch 4)
- ✅ Prometheus metrics collection
- ✅ Health check endpoints (`/api/v1/health`, `/api/v1/health/ready`)
- ✅ Request logging (HTTP metrics interceptor)

**Deferred:**
- Distributed tracing (Jaeger / OpenTelemetry)
- Custom alerts + runbooks
- Uptime monitoring / synthetic tests
- On-call escalation policy

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Set up alerting rules** | Current monitoring is passive (logs exist, but no alerts on critical events) | 🟡 Important: Reduces MTTR (mean time to recovery) | Prometheus alerting rules for error rate > 5%, latency p95 > 2s, DB connection pool exhaustion; Slack webhook integration; ~100 lines | S | Prometheus (exists); Slack account | No (ops readiness, not blocking) |
| **Add distributed tracing with OpenTelemetry** | Multi-step operations (order dispatch) hard to debug end-to-end | 🟢 Recommended: Improves debugging; lower priority | Minimal boilerplate; NestJS has OTel support; export to Jaeger or cloud provider; ~200 lines | M | OTel library; optional Jaeger service | No (debugging aid, not blocking) |
| **Implement synthetic uptime monitoring** | External checks detect downtime before users notice | 🟡 Recommended: Peace of mind for ops team | Simple HTTP check on `/health/ready` from external service (Pingdom, Uptime Robot); heartbeat to monitoring service | S | Third-party service account | No (ops, not feature-blocking) |
| **Create runbooks for common incidents** | Ops team doesn't know what to do if API container crashes | 🟡 Important: Reduces chaos; improves incident response | Markdown runbooks for top 5 scenarios (DB pool exhaustion, Redis connection loss, disk full, high error rate, high memory); ~500 words | S | Team knowledge capture | No (documentation, improves readiness) |

**Blockers Before Public Launch:**
- None (current setup is sufficient for beta)

**Recommended Priority:** Set up alerting rules immediately (quick win). Add runbooks before scaling.

---

### 9. Performance Optimization

**Current State:**
- ✅ Next.js 15 with App Router (optimized by default)
- ✅ Image optimization via Next.js Image component
- ✅ API response caching via Redis (OTP tokens, dispatch results)
- ✅ Database query optimization (indexes on foreign keys, PostGIS indexes)
- ✅ No performance budget / monitoring yet

**Deferred:**
- Performance budget enforcement (CI step)
- Advanced caching strategies (SWR cache control headers)
- Database query analysis & slow-query log review
- CDN for static assets

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Enforce Core Web Vitals budget in CI** | Performance regressions not caught until production | 🟡 Important: Prevents slow deployments | Add Lighthouse CI check to workflow; budget thresholds for LCP, FID, CLS; ~50 lines GitHub Actions YAML | S | Lighthouse CI (open source) | No (CI quality gate) |
| **Implement SWR cache-control headers** | Current API responses don't include cache hints | 🟡 Recommended: Browser caching reduces API load | Add `Cache-Control: max-age=300, stale-while-revalidate=3600` on appropriate endpoints; ~50 lines middleware | S | No new deps | No (performance optimization) |
| **Profile database queries with slow-query log** | Current indexes are good but no continuous monitoring | 🟢 Recommended: Proactive performance tuning | Enable PG slow-query log (1s threshold); review weekly for hot queries; analyze with `EXPLAIN ANALYZE`; ~2 hours setup | S | PG config | No (tuning, not blocking) |
| **Add CDN for static assets** | Currently served from origin; CSS/JS/fonts don't have edge cache | 🟢 Recommended: Reduces latency for geographic distribution | Cloudflare / Vercel Edge Network + long `max-age` on `/static`; ~1 hour setup | S | CDN account | No (optional, nice to have) |

**Blockers Before Public Launch:**
- None (current performance is acceptable)

**Recommended Priority:** Enforce Core Web Vitals budget in CI before scaling to large traffic.

---

### 10. Mobile Readiness

**Current State:**
- ✅ PWA with app manifest + service worker
- ✅ Mobile-first design (390px reference frame)
- ✅ Responsive layout; works on all phones
- ✅ No native mobile apps (Capacitor not integrated)

**Deferred:**
- iOS / Android native apps
- Capacitor bridge for device APIs
- App Store / Play Store distribution

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Add Capacitor for native app wrapper** | PWA works but users expect App Store presence | 🟡 Important: Increases discoverability + install rate | One-time Capacitor setup; build for iOS/Android; ~2 days integration | M | Xcode / Android Studio; app signing certs | No (post-launch Phase 2) |
| **Optimize for offline-first experience** | Currently service worker caches; no offline-first data sync | 🟢 Recommended: Improves reliability on flaky networks | Enhance SW to cache API responses; add offline indicator UI; ~200 lines | S | Service worker already exists | No (UX enhancement) |
| **Test on low-end devices** | App may be slow on older/mid-range phones | 🟡 Recommended: Ensures adoption in EM markets | Profile on Moto G / low-RAM emulator; optimize JS bundle size; ~1 day profiling | S | No new deps | No (market adaptation) |

**Blockers Before Public Launch:**
- None (PWA is sufficient for beta; native apps post-launch)

**Recommended Priority:** Optimize offline experience. Defer native apps to Phase 2.

---

### 11. Accessibility Improvements

**Current State:**
- ✅ 23 files with ARIA markup / semantic HTML
- ✅ Color contrast tested (Ink/Orange meets AA standard)
- ✅ Keyboard navigation supported
- ✅ No automated accessibility testing in CI

**Deferred:**
- Full WCAG 2.1 AA compliance audit
- Screen reader testing with NVDA/JAWS
- Accessibility CI checks (axe-core)

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Add accessibility CI check (axe-core)** | No automated scanning; accessibility regressions not caught | 🟡 Important: Ensures compliance; legal requirement in some markets | axe-core integration to GitHub Actions; ~100 lines config | S | axe-core (open source) | No (compliance, recommended) |
| **Conduct full WCAG 2.1 AA audit** | Current implementation is partial; no formal compliance statement | 🟡 Recommended: Legal protection; improves inclusivity | Hire auditor or DIY with NVDA/JAWS; document 3–5 days; ~$2k if outsourced | L | Audit services (optional) | No (compliance best practice) |
| **Add screen reader testing to QA process** | Current UI tested only visually | 🟢 Recommended: Ensures VoiceOver/TalkBack work | NVDA / JAWS testing checklist; ~4 hours per major feature | S | Screen reader software | No (quality assurance) |
| **Improve focus indicators** | Current `:focus-visible` is plain; could be more obvious | 🟢 Recommended: Better keyboard UX | Enhance focus ring with brand color; add focus-visible state to all buttons; ~100 lines CSS | S | No new deps | No (UX improvement) |

**Blockers Before Public Launch:**
- None (current a11y is baseline-compliant; full audit post-launch)

**Recommended Priority:** Add axe-core CI check immediately (quick win). Schedule formal audit for Phase 2.

---

### 12. Internationalization (i18n) — Uzbek, Russian, English

**Current State:**
- ✅ UI supports three languages (UZ, RU, EN)
- ✅ i18n library integrated (next-i18next)
- ✅ Language switcher in settings
- ✅ Most screens have translations

**Deferred:**
- Full professional translation review
- RTL layout (if adding Arabic later)
- Currency localization (currently UZS only)
- Date/time localization completeness

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Professional translation review** | Current translations may have quality issues; no native UZ speaker review | 🟡 Important: Improves brand trust; reduces confusion | Hire professional translator for UZ/RU; ~$1–2k; ~1 week turnaround | M | Translation services | No (localization quality, recommended) |
| **Ensure date/time/number localization** | Prices, timestamps, and dates may display in wrong format for region | 🟡 Recommended: Improves perceived quality | Audit all date/number outputs; use `Intl` API for formatting; ~100 lines fixes | S | No new deps | No (formatting, not blocking) |
| **Add currency selector** | Currently UZS only; regional markets may want others | 🟢 Recommended: Future-proofing for expansion | Add currency enum + conversion rates; ~200 lines | S | No new deps | No (future-proofing) |
| **Test right-to-left (RTL) layouts** | If adding Arabic/Farsi later, current layout won't work | 🟢 Recommended (future): Head-start on regional expansion | Add `direction: rtl` CSS; test layout flips; ~200 lines CSS prep; not needed immediately | S | No new deps | No (future, not needed now) |

**Blockers Before Public Launch:**
- None (current UZ/RU/EN support sufficient)

**Recommended Priority:** Professional translation review before launch. Defer RTL to Phase 3.

---

### 13. Security Hardening

**Current State:**
- ✅ High-severity CVEs patched (find-my-way, brace-expansion)
- ✅ JWT-based auth with rotating tokens
- ✅ PINFL encrypted at rest (AES-256-GCM)
- ✅ Rate limiting per IP
- ✅ TRUSTED_PROXY configuration required
- ✅ No 2FA on admin accounts

**Deferred:**
- 2FA / IP allowlist for admin routes
- WAF (Web Application Firewall) setup
- Penetration testing
- OWASP Top 10 hardening

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Add 2FA for admin accounts** | Admin accounts are high-privilege targets; password-only is insufficient | 🔴 CRITICAL (security): Admin compromise = complete platform takeover | TOTP (Time-based OTP) implementation; existing OTP infra reusable; ~300 lines | M | NestJS passport-totp; existing OTP infrastructure | **Yes (before production)** |
| **Implement IP allowlist for /admin routes** | Optional but recommended; further restricts admin access | 🟡 Important: Defense in depth; reduces attack surface | Per-admin IP allowlist in DB; middleware check; ~150 lines | S | No new deps | No (recommended, not critical) |
| **Set up WAF rules** | Current rate limiting is basic; WAF adds attack signature detection | 🟡 Recommended: Protects against automated attacks | Cloudflare WAF or AWS WAF; OWASP Core Rule Set; ~1 day config | S | CDN/LB with WAF support | No (ops hardening) |
| **Conduct penetration test** | No external security audit yet | 🟡 Recommended: Pre-launch security validation | Hire pen-testing firm; ~$5–10k; ~2 weeks; OR DIY checklist | L | Security firm (optional) | No (recommended best practice) |
| **Implement Content Security Policy (CSP)** | No CSP headers; reduces XSS risk surface | 🟡 Recommended: XSS mitigation | CSP headers on all responses; start permissive, tighten over time; ~100 lines | S | No new deps | No (recommended, not critical) |

**Blockers Before Public Launch:**
1. **2FA for admin accounts (M)** — must implement before production
2. **IP allowlist (S)** — recommended for defense-in-depth

**Recommended Priority:** Implement admin 2FA immediately (critical). Schedule IP allowlist before scaling.

---

### 14. Disaster Recovery & Backups

**Current State:**
- ✅ Database backups documented in `migration-checklist.md`
- ✅ Docker-based deployment is reproducible
- ✅ Rollback procedure via Git checkout + rebuild
- ✅ No automated backup automation yet

**Deferred:**
- Automated daily backups with retention policy
- Cross-region replication
- Backup restoration testing / runbooks
- RTO/RPO SLAs

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Implement automated daily database backups** | Currently documented but not automated; manual process is error-prone | 🔴 CRITICAL (DR): No backups = total data loss on corruption | BullMQ scheduled job to `pg_dump` + S3; retain 30 days; ~200 lines | S | BullMQ (exists); S3 (optional) | **Yes (before production)** |
| **Create backup restoration runbook** | Backups exist but no process to restore them | 🟡 Important: Worst-case recovery depends on this being documented | Test restore on staging; document exact steps; ~500 words | S | Automated backups (above) | No (after automation) |
| **Implement cross-region DB replication** | Single-region Postgres means regional outage = full downtime | 🟡 Recommended (for scale): High availability future-proofing | RDS read replica or managed Postgres read replica; async replication; ~1 day setup | L | Managed Postgres provider | No (scale phase 2) |
| **Define RTO/RPO SLAs** | No formal commitment to recovery time / data loss tolerance | 🟡 Recommended: SLA clarity for customers | Document target: RTO 4h, RPO 1h (achievable with current setup); update runbooks | S | No new deps | No (documentation) |

**Blockers Before Public Launch:**
1. **Automated daily backups (S)** — must implement before production
2. **Backup restoration runbook (S)** — must document before launch

**Recommended Priority:** Implement automated backups + restoration runbook immediately (critical for production).

---

### 15. Production Deployment Readiness

**Current State:**
- ✅ Docker Compose production config exists
- ✅ Nginx example config provided
- ✅ Deployment runbook documented
- ✅ Health checks configured
- ✅ Missing: Actual cloud infrastructure setup

**Deferred:**
- Kubernetes deployment (scales to multi-region)
- Auto-scaling policies
- Multi-region failover
- Managed hosting provider setup

**Recommendations:**

| Improvement | Why Matters | Business Impact | Technical Impact | Effort | Dependencies | Blocks Launch? |
|---|---|---|---|---|---|---|
| **Provision production environment** | Documentation exists but no actual running infrastructure | 🔴 CRITICAL: Required to go live | Rent VPS (DigitalOcean, Linode) or managed platform (Render, Railway); follow deployment runbook; ~4 hours setup | S | Cloud provider account; domain name | **Yes (hard blocker for live)** |
| **Obtain and install TLS certificate** | Required for HTTPS (mandatory for auth tokens, payments) | 🔴 CRITICAL: Launches must be HTTPS | Let's Encrypt via certbot; auto-renew via cron/systemd; ~30 min | S | Domain DNS control | **Yes (security requirement)** |
| **Configure production secrets management** | Currently env file; needs proper secret injection for production | 🟡 Important: Improves security; prevents accidental exposure | Use cloud provider's secrets (e.g., DigitalOcean App Platform secrets, AWS Secrets Manager); inject at runtime; ~1 hour setup | S | Cloud provider | No (best practice, but important) |
| **Set up DNS and domain** | App needs a domain name | 🟡 Important: Not technical but required | Register domain, point DNS to production IP, configure CNAME for www + mail (if needed); ~30 min | S | Domain registrar account | **Yes (launch requirement)** |
| **Implement logging aggregation** | Currently logs go to container stdout; no centralized log storage | 🟡 Recommended: Improves debugging in production | Use cloud provider's logging (e.g., DigitalOcean Logs, AWS CloudWatch) or self-hosted ELK; ~2 hours setup | S | Cloud provider logging service | No (ops quality) |
| **Test full deployment end-to-end** | No staging environment; first real test is production | 🟡 Important: Catches deployment issues before hitting customers | Clone prod setup to staging; test order flow, payments, admin access; ~4 hours | S | Duplicate infrastructure | No (QA step before launch) |

**Blockers Before Public Launch:**
1. **Provision production environment (S)** — must be done before going live
2. **TLS certificate (S)** — security requirement
3. **DNS + domain (S)** — required for users to access app

**Recommended Priority:** Provision infrastructure immediately (VPS + TLS). Test full deployment end-to-end before launch.

---

## High-Value Improvements Ranked by ROI

**ROI = (Business Impact + Technical Risk Reduction) / (Effort + Dependency Lead Time)**

### Tier 1: Must Do Before Public Launch (Critical Blockers)

1. **Obtain Click merchant credentials + enable real payments** (Effort: S, Impact: Critical)
   - Without this, platform can't process payments; entire revenue model broken
   - Single point of failure for commerce

2. **Implement admin 2FA** (Effort: M, Impact: Critical)
   - Admin takeover = complete platform compromise
   - Legal requirement in many markets; financial liability

3. **Provision production environment + TLS** (Effort: S, Impact: Critical)
   - Can't launch without running infrastructure and HTTPS
   - Single day of work; highest ROI per hour spent

4. **Implement automated database backups** (Effort: S, Impact: Critical)
   - Protects against data loss; legal requirement
   - Single-day implementation

5. **Set up DNS + domain** (Effort: S, Impact: Critical)
   - Users need a URL to access the platform
   - Prerequisite for launch

6. **Verify legal requirements for identity verification** (Effort: S, Impact: Critical)
   - May be mandatory in UZ; consult compliance adviser immediately
   - Only a few hours to determine; if mandatory, blocks launch

### Tier 2: Should Do Before Scaling (Important)

7. **Add real billing for Premium subscriptions** (Effort: M, Impact: Important)
   - Revenue leak if Premium tier is offered
   - Depends on Click provider (Tier 1, #1)

8. **In-app chat system** (Effort: L, Impact: Important)
   - Reduces disputes and fraud; improves user trust
   - Long lead time but important for quality

9. **Set up alerting + on-call** (Effort: S, Impact: Important)
   - Reduces MTTR (mean time to recovery)
   - Quick win for ops readiness

10. **Add S3 storage adapter** (Effort: M, Impact: Important)
    - Required if deploying to multi-host or cloud
    - Blocks cloud scalability

### Tier 3: Recommended Before Scale Phase 2 (Nice to Have)

11. Add structured data for SEO (Effort: S)
12. Professional translation review (Effort: M)
13. Enforce Core Web Vitals CI (Effort: S)
14. Implement materialized views for analytics (Effort: M)
15. Set up Grafana dashboards (Effort: M)

---

## Single Highest-Priority Recommendation

### **PRIMARY FOCUS: Tier 1 Blockers in Sequence**

This is not a single improvement but a **critical path through Tier 1**. Do these in parallel where possible:

**WEEK 1 ACTIVITIES (Before anything else):**

1. **[Immediate — 2 hours]** Verify legal requirements for identity verification
   - Call UZ compliance adviser: Is MyID verification mandatory for a marketplace to operate?
   - **Decision outcome:** If yes, MyID integration blocks launch. If no, manual review is acceptable.

2. **[Immediate — 4 hours]** Obtain Click merchant credentials
   - Apply to Click.uz for merchant account
   - Get `CLICK_MERCHANT_ID` + `CLICK_MERCHANT_SECRET_KEY`
   - Configure webhook endpoint in Click dashboard
   - Test with dummy payment (if available)

3. **[Immediate — 1 day]** Provision production infrastructure
   - Rent VPS (DigitalOcean app platform or standalone VPS)
   - Follow `docs/runbooks/deployment.md`
   - Deploy Docker containers
   - Verify health check: `GET /api/v1/health/ready` returns 200

4. **[Day 2 — 2 hours]** Obtain + install TLS certificate
   - Register domain
   - Point DNS to production IP
   - Run `certbot --nginx -d yourdomain.com`
   - Verify HTTPS works

5. **[Day 2 — 4 hours]** Implement automated database backups
   - BullMQ job to `pg_dump` → S3 (if S3 available; else local disk)
   - Verify restore procedure works
   - Document in runbook

6. **[Day 3 — 6 hours]** Implement admin 2FA
   - Add TOTP generation to admin login
   - Require 2FA on first login
   - Document recovery codes

7. **[Day 4 — 4 hours]** End-to-end test
   - Create customer account
   - Submit order request
   - Accept as master
   - Complete job
   - Process payment via Click
   - Verify admin can see transactions

8. **[Parallel — 3 days]** If MyID is mandatory (from #1 above):
   - Begin MyID integration (longest lead item)
   - Implement `MyIdVerificationProvider`
   - Test with sandbox credentials

---

## Recommended Single Next Implementation (After Tier 1 Blockers)

**If forced to choose ONE improvement to implement after Tier 1 is complete:**

### **Implement Real Billing for Premium Subscriptions** (Tier 2, #7)

**Why this is the single best follow-up:**

| Aspect | Rationale |
|---|---|
| **Business impact** | Unlocks Premium revenue stream; every upgrade is currently free (money left on table) |
| **Dependencies** | Depends only on Click provider (Tier 1 #1 — by then complete) |
| **Implementation time** | M effort (2–3 days) but straightforward (reuse existing settlement flow) |
| **Risk** | Low (proven patterns, existing tests) |
| **Launch blocking** | No, but if offering Premium to launch, this becomes mandatory |
| **Customer impact** | Immediate: Premium tier becomes a real revenue-generating feature |

**Technical outline:**
- Wire `upgradeToPremium` endpoint to call `paymentProvider.charge()`
- Reuse existing `Settlement` flow
- Add BullMQ job to auto-downgrade masters after trial expiry
- ~300 lines total

---

## Summary Table: Implementation Roadmap

| Rank | Improvement | Category | Effort | Blocks Launch? | Recommended Timing | Owner |
|---|---|---|---|---|---|---|
| **1** | Obtain Click credentials | Payment | S | **YES** | Week 1, Day 1 | Founder |
| **2** | Verify legal requirements (MyID) | Identity | S | **MAYBE** | Week 1, Day 1 | Legal/Compliance |
| **3** | Provision production environment | Deployment | S | **YES** | Week 1, Day 2–3 | DevOps |
| **4** | Obtain + install TLS certificate | Deployment | S | **YES** | Week 1, Day 3 | DevOps |
| **5** | Automated database backups | DR | S | **YES** | Week 1, Day 3 | DevOps |
| **6** | Admin 2FA | Security | M | **YES** | Week 1, Day 4 | Engineering |
| **7** | MyID integration (if mandatory) | Identity | L | **Depends on #2** | Week 2 (if needed) | Engineering |
| **8** | Real billing for Premium | Payments | M | No | Week 2–3 | Engineering |
| **9** | In-app chat system | Support | L | No | Phase 2 (post-launch) | Engineering |
| **10** | S3 storage adapter | Scale | M | No (if single-host) | Phase 2 | Engineering |
| **11–15** | Analytics, SEO, monitoring, perf, a11y | Operations | M–L | No | Phase 2–3 | Various |

---

## Final Recommendation

**Before implementing ANY of these improvements, obtain:**

1. ✅ **Click merchant credentials** (business decision: enables revenue)
2. ✅ **Legal clearance on identity verification** (compliance decision: blocks vs. enables)
3. ✅ **Production infrastructure provisioned** (ops decision: enables launch)

**Then execute Tier 1 in parallel over 4 days. Tier 2 begins on Day 5.**

**Do not start chat, analytics, or other Phase 2 features until Tier 1 is complete and tested in production.**

