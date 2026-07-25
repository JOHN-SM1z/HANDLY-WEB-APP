# Handly — Next Priority Recommendation

**Date:** 2026-07-25  
**Context:** Product Readiness Improvement Sprint  
**All milestones complete.** Recommendations focus exclusively on launch readiness, reliability, security, and trust.

---

## Current State

✅ Feature-complete: All 12 milestones + Click payment provider shipped  
✅ Beta-ready: One master onboarding blocker fixed; all secondary gaps resolved  
✅ Code quality: CI passes; security audit clean  
✅ **Missing:** Production infrastructure, real payment processor credentials, admin security, backup automation

---

## Recommendation: Execute Tier 1 Critical Path in Sequence

**There is no single "next" improvement.** Instead, execute these 6 blocking items in strict sequence over 4 days. They form the critical path to launch. Do them in parallel only where noted.

---

## Tier 1 Critical Path (Do in Order)

### **Day 1: Morning — Obtain Click Merchant Credentials** ⚡
**Effort:** 2 hours (mostly waiting for approval)  
**Owner:** Founder / Business Lead  
**Blocking:** YES (everything downstream depends on this)  
**Why:** Without Click credentials, platform can't process real payments. The entire MVP is non-functional without this.

**Steps:**
1. Go to Click.uz (https://click.uz)
2. Apply for merchant account (requires business registration, bank account)
3. Receive `CLICK_MERCHANT_ID` + `CLICK_MERCHANT_SECRET_KEY`
4. Configure webhook endpoint in Click dashboard to your production domain
5. Save credentials securely (not in Git)

**Dependency chain:** Nothing else can proceed without this. Parallel: Legal review (#2) and VPS provisioning (#3).

---

### **Day 1: Morning (Parallel) — Verify Legal Requirements for Identity Verification** 📋
**Effort:** 2 hours  
**Owner:** Legal / Compliance  
**Blocking:** CONDITIONAL (depends on answer)  
**Why:** UZ law may mandate automated ID verification for a marketplace. This determines if MyID integration is required or optional.

**Steps:**
1. Consult with UZ tax/compliance adviser
2. Question: *"Is a home-services marketplace in Uzbekistan required to perform automated identity verification (KYC) for service providers?"*
3. If **YES:** MyID integration becomes Tier 1 blocking (3–5 day project starting Day 2)
4. If **NO:** Manual admin verification is acceptable; defer to Phase 2

**Dependency chain:** Determines if MyID integration is Day 2–6 blocker.

---

### **Day 2–3: Provision Production Environment** 🖥️
**Effort:** 1 day (mostly setup + waiting for DNS propagation)  
**Owner:** DevOps / Engineering  
**Blocking:** YES (can't deploy without this)  
**Why:** Can't launch without running infrastructure.

**Steps:**
1. Rent VPS from DigitalOcean, Linode, or similar (~$10–30/mo for single host)
2. Follow `docs/runbooks/deployment.md` § 1 exactly
3. Copy `.env.production.example` → `.env.production`, fill in every `CHANGE_ME` value
4. Run database migrations: `DATABASE_URL=... pnpm --filter @handly/api exec prisma migrate deploy`
5. Deploy: `docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build`
6. Verify health: `curl https://<yourip>/api/v1/health/ready` → should return `{"status": "ok"}`

**Dependency chain:** Requires Click credentials (#1) for `PAYMENT_PROVIDER` env. Required for TLS (#4) and backups (#5).

---

### **Day 3: Install TLS Certificate** 🔒
**Effort:** 2 hours  
**Owner:** DevOps  
**Blocking:** YES (security requirement)  
**Why:** JWT tokens, payment webhooks, and all auth require HTTPS. No production deployment should ever be HTTP.

**Steps:**
1. Register domain (GoDaddy, Namecheap, etc.)
2. Point DNS A record to your VPS IP
3. Wait for propagation (5–30 min)
4. SSH into VPS: `ssh root@<yourip>`
5. Run: `certbot --nginx -d yourdomain.com` (Let's Encrypt)
6. Verify: `https://yourdomain.com/` loads (may get 503 initially; API loads at `/api/v1/health/ready`)
7. Verify in nginx config that `restart: always` works

**Dependency chain:** Requires VPS (#3) to be running.

---

### **Day 3: Afternoon — Implement Automated Database Backups** 💾
**Effort:** 4 hours  
**Owner:** DevOps / Engineering  
**Blocking:** YES (legal/business requirement)  
**Why:** Without backups, data corruption = total loss. This is a legal liability and business risk.

**Steps:**
1. Create BullMQ job in `apps/api/src/jobs/backup.job.ts`:
   - Run daily at 2 AM UTC
   - Execute `pg_dump` to file
   - Upload to S3 (if available) or keep on disk with 30-day rotation
   - Log success/failure

2. Verify restore procedure works:
   - Download backup
   - Restore to test DB: `psql -U postgres test_db < backup.sql`
   - Confirm tables + data present

3. Document in `docs/runbooks/disaster-recovery.md`:
   - Backup location and schedule
   - Restore procedure (exact commands)
   - Verify after each backup runs

**Dependency chain:** Requires VPS (#3) with production DB running.

---

### **Day 4: Implement Admin 2FA** 🔐
**Effort:** 6 hours  
**Owner:** Engineering  
**Blocking:** YES (security)  
**Why:** Admin accounts are high-privilege targets. Password-only is insufficient for production.

**Steps:**
1. Add TOTP (Time-based OTP) library to API (`npm install speakeasy` or similar)
2. Update admin login flow:
   - After password verification, prompt for TOTP
   - User scans QR code in authenticator app (Google Authenticator, Authy, etc.)
   - Backend validates 6-digit code
3. Add recovery codes (10 single-use codes printed once, stored securely)
4. Require 2FA on next admin login
5. Test locally before deploying

**Dependency chain:** None; can be done in parallel with backups.

---

### **Day 4–5 (If MyID is Mandatory):** Implement MyID Integration 🆔
**Effort:** 3–5 days  
**Owner:** Engineering  
**Blocking:** CONDITIONAL (from #2 above)  
**Why:** UZ law may require it; if mandatory, this blocks launch.

**Steps:**
1. Sign MyID B2B contract with Uzbek government
2. Implement `MyIdVerificationProvider` similar to `ClickPaymentProvider`:
   - Call MyID API to initiate verification
   - Handle webhook with verification result
   - Update master `verification_status` in DB
3. Add UI flow to capture selfie + ID upload
4. Test with sandbox credentials
5. Deploy and validate with real ID (1–2 master test accounts)

**Dependency chain:** Requires legal decision (#2). Highest risk due to B2B contract negotiation.

---

### **Day 5 (Optional): End-to-End Test** ✅
**Effort:** 4 hours  
**Owner:** QA / Engineering  
**Blocking:** YES (verification that everything works)  
**Why:** This is the final check before opening to real users.

**Steps:**
1. Create test customer account (phone: +998900000001)
2. Submit order request (e.g., "Plumber needed tomorrow")
3. Confirm as master (phone: +998900000000, which is the seeded admin)
4. Accept job offer
5. Mark job COMPLETED
6. Process payment via Click (use test card from Click docs)
7. Verify master earnings ledger updated
8. Verify admin can see transaction in dashboard

**Dependency chain:** Requires all above items (#1–6) complete.

---

## Timeline Visualization

```
Day 1
  Morning:   Get Click credentials (#1)
  Morning:   Legal review on MyID (#2, parallel)
  Afternoon: Start VPS provisioning (#3)

Day 2–3
  Continue:  VPS + Docker deployment (#3)
  Install:   TLS certificate (#4)
  Evening:   Backups automation (#5)

Day 4
  Implement: Admin 2FA (#6, parallel with backups)
  
Day 5
  IF MyID mandatory: Start MyID integration (#7, 3+ days ongoing)
  OTHERWISE:         E2E test (#8)

Day 6–7
  MyID integration continues (if needed)

Day 8
  Final E2E test (#8) once MyID complete
  OR production launch if MyID not needed
```

---

## Decision Points for User

Before engineering starts, clarify:

1. **Which payment provider should be set as production default?**
   - ✅ Click (recommended — already integrated)
   - ❌ Payme / Uzum (not yet integrated; defer to post-launch)

2. **Is MyID verification mandatory in UZ?**
   - ✅ Confirm with legal ASAP (blocks if yes)

3. **Will you offer Premium subscriptions at launch?**
   - If YES: Add to Tier 2 (real billing for Premium, ~2 days post-launch)
   - If NO: Defer to Phase 2

4. **What is your target launch date?**
   - Critical path: 4–8 days (depending on MyID)

5. **What is your production hosting preference?**
   - Single VPS: 1 day to set up (recommended for launch)
   - Managed platform (Vercel, Render): Modify Dockerfile, ~1 day config
   - Kubernetes: Not recommended for initial launch

---

## Success Criteria

After Tier 1 is complete:

- [ ] Click credentials obtained and configured; test payment succeeds
- [ ] Legal confirmed on MyID (and integration complete if required)
- [ ] Production domain has valid TLS certificate; HTTPS works
- [ ] Automated backups running; restoration tested
- [ ] Admin account requires 2FA; recovery codes issued
- [ ] End-to-end test passes: customer order → master assignment → completion → payment
- [ ] Health check endpoint responding (`/api/v1/health/ready`)
- [ ] Sentry error monitoring working in production
- [ ] Support contacts updated to production phone/email

---

## What NOT to Do Before Launch

❌ In-app chat system (Phase 2 feature; not launch-blocking)  
❌ Advanced analytics / Grafana dashboards (nice-to-have; can add later)  
❌ Penetration testing (do after launch when stakes are lower)  
❌ Multiple payment providers (Click is sufficient for MVP)  
❌ Native mobile apps (PWA works for launch; Capacitor post-launch)  
❌ SEO optimization / dedicated marketing site (landing page exists; optimize post-launch)  
❌ Multi-region deployment (single host is approved MVP scope)  

**Focus: Production readiness, not feature expansion.**

---

## Bottom Line

**The recommendation is not a single feature, but a 4-day critical path to launch:**

1. Get Click credentials (2h)
2. Check if MyID is mandatory (2h)
3. Deploy to production (1 day)
4. Install TLS (2h)
5. Add backups (4h)
6. Add admin 2FA (6h)
7. (Optional) MyID integration (3–5 days if mandatory)

**All of these are operational, not product features.** They're blocking because they're security, compliance, and infrastructure — not because the product is incomplete.

**After Day 5, the platform is live and revenue-generating.** Everything else (chat, analytics, Payme integration, etc.) is Phase 2 post-launch optimization.

**Start with #1 and #2 today. Deploy on Day 3.**
