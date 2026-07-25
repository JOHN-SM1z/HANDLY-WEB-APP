## Launch Blockers Analysis — Handly Marketplace

This document categorizes all remaining work into items that must be resolved before private beta, before public launch, or can be deferred to post-launch phases.

---

## Private Beta Blockers (Must fix before Day 5)

### 1. Click Payment Provider Credentials

**Status**: Blocking payment functionality  
**Action Required**: Obtain from Click.uz merchant account setup  
**Effort**: 1-2 hours (administrative)  
**Dependency**: External (Click business team)  
**Risk**: Medium (Click may require documentation)

**What it blocks**: Any real payments. Without this, marketplace cannot generate revenue.

**Verification**:
```bash
# Check if credentials are set
grep CLICK_MERCHANT /opt/handly/.env.production
# Both should have values (not empty)

# Test Click connectivity
curl -X POST https://api.click.uz/api/merchant/pay/login \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$CLICK_MERCHANT_ID\"}"
# Should return a valid response (not "invalid merchant")
```

---

### 2. SMS Provider Credentials (Eskiz)

**Status**: Blocking OTP delivery  
**Action Required**: Obtain API key from Eskiz.uz  
**Effort**: 30 minutes (administrative)  
**Dependency**: External (Eskiz business team)  
**Risk**: Low

**What it blocks**: Users cannot receive OTP codes for signup/login. Currently mocked (codes print to logs).

**Workaround for beta**: Can use mock SMS provider for internal testing. Real SMS can be enabled later.

**Verification**:
```bash
# Test Eskiz connectivity (if credentials provided)
curl -X POST https://notify.eskiz.uz/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ESKIZ_EMAIL\", \"password\": \"$ESKIZ_PASSWORD\"}"
```

---

### 3. Legal: Terms of Service and Privacy Policy

**Status**: Required before users can sign up  
**Action Required**: Write and have reviewed by legal counsel  
**Effort**: 2-4 hours (with lawyer review)  
**Dependency**: Legal review (external)  
**Risk**: Medium (legal liability if insufficient)

**What it blocks**: Cannot launch without these. Users must accept T&S before creating account.

**Verification**:
- [ ] T&S drafted in Uzbek/Russian
- [ ] Privacy policy drafted
- [ ] Legal counsel reviewed
- [ ] Published on website
- [ ] Users see and accept before signup

---

### 4. Admin Account Created

**Status**: Admin functionality non-critical for beta, but useful for testing  
**Action Required**: Create admin user in production database  
**Effort**: 10 minutes  
**Dependency**: None

**What it blocks**: Admin dashboard cannot be accessed. Useful for manual order resolution and user management during beta.

**Verification**:
```bash
docker-compose -f docker-compose.prod.yml exec api npm run seed:admin -- admin@handly.uz +998912345678
# Should create admin account with given credentials
```

---

### 5. Production Database Backups Verified

**Status**: Essential for disaster recovery  
**Action Required**: Run backup script and verify restore works  
**Effort**: 30 minutes  
**Dependency**: None

**What it blocks**: Data loss. Without verified backups, any database issue results in permanent data loss.

**Verification**:
```bash
# Run backup
/opt/handly/infra/scripts/backup.sh /opt/handly/backups

# Verify file exists
ls -lh /opt/handly/backups/ | grep "handly-.*dump"

# Test restore on separate database (or test VPS)
/opt/handly/infra/scripts/restore.sh /opt/handly/backups/handly-latest.dump
```

---

## Public Launch Blockers (Must fix before Day 30+)

### 1. Real Verification Provider (MyID or similar)

**Status**: Currently manual admin review only  
**Action Required**: Contact MyID for B2B integration or approve manual verification for MVP  
**Effort**: 3-5 days (if integrating MyID) or 0 days (if manual is acceptable)  
**Dependency**: External (MyID)  
**Risk**: Medium (B2B contract negotiation)

**What it blocks**: Masters cannot be automatically verified. Manual verification works but doesn't scale.

**Decision point**: 
- **Keep manual verification**: Acceptable for beta/launch if order volume is low (< 100 orders/day)
- **Integrate MyID**: Required before scaling to 1000+ daily orders

**Verification** (if manual):
```bash
# Admin can verify users in dashboard
# Check: is verification UI present?
curl https://handly.uz/admin/users
# Should show "verify" button on master profiles
```

---

### 2. Real S3 Storage Provider

**Status**: Currently using LocalDisk only  
**Action Required**: Implement S3 adapter (or equivalent: DigitalOcean Spaces, MinIO)  
**Effort**: 2-3 days  
**Dependency**: External (AWS/DigitalOcean account)  
**Risk**: Low

**What it blocks**: Cannot scale to multiple servers. All media stored on single VPS disk.

**Workaround**: Acceptable for single-VPS private beta. Must implement before multi-server deployment.

**Implementation**:
```typescript
// Replace LocalDiskStorage with S3Storage in infra/storage/storage.module.ts
// Or add feature flag to support both simultaneously
```

---

### 3. Real In-Country Database Hosting (Uzbekistan)

**Status**: Can be deployed anywhere initially  
**Action Required**: Migrate to Uzbekistan-based PostgreSQL provider  
**Effort**: 1-2 days  
**Dependency**: External (UZ hosting provider)  
**Risk**: High (regulatory compliance, provider availability)

**What it blocks**: ARCHITECTURE §0.1 & §12.1 mandate UZ data residency for citizen PII. Currently can be deployed to any VPS.

**Decision point**:
- **For private beta**: Deploy anywhere (Linode US/EU) for easier setup
- **For public launch**: Must move to UZ hosting to comply with residency law

**Legal requirement**: Verify with Uzbekistan telecom regulator (UZTELECOM) if mandatory.

---

### 4. SMS Delivery at Scale

**Status**: Currently Eskiz only  
**Action Required**: Add failover SMS provider (Play Mobile)  
**Effort**: 2 days  
**Dependency**: External (Play Mobile account)  
**Risk**: Low

**What it blocks**: If Eskiz is down, users cannot receive OTP. Failover not implemented.

**Workaround**: Acceptable for beta (if Eskiz is reliable). Implement before public launch.

---

### 5. Payment Reconciliation (Click statement matching)

**Status**: Not implemented  
**Action Required**: Create automated daily reconciliation job  
**Effort**: 3 days  
**Dependency**: Click API documentation for statement retrieval  
**Risk**: Medium

**What it blocks**: Cannot detect payment discrepancies automatically. Mismatches must be found manually.

**Workaround**: Manual weekly reconciliation acceptable for beta (< 100 orders/day). Automate before 1000 orders/day.

---

### 6. Admin 2FA (Two-Factor Authentication)

**Status**: Admin accounts use password only  
**Action Required**: Implement TOTP or backup codes for admin accounts  
**Effort**: 2 days  
**Dependency**: None

**What it blocks**: Admin account compromise is high-impact. 2FA significantly reduces risk.

**Workaround**: Acceptable for beta if team is small and SSH access is restricted. Required before public launch.

---

### 7. Automated Database Restore Verification

**Status**: Restore procedure documented but not automated  
**Action Required**: Add weekly automated restore test to non-production database  
**Effort**: 1 day  
**Dependency**: Test database setup  
**Risk**: Low

**What it blocks**: Cannot confidently recover data. Backups might be corrupted without testing.

**Workaround**: Manual weekly restore tests acceptable for beta. Automate before public launch.

---

## Nice-to-Have (Post-Launch, Not Blocking)

### 1. Premium Subscription Billing

**Status**: Schema ready, UI exists, payment not integrated  
**Action Required**: Wire Click payment to subscription upgrade flow  
**Effort**: 2-3 days  
**Dependency**: Click provider (done)  
**Risk**: Low

**What it blocks**: Masters cannot be charged for Premium subscription. Revenue-generating feature deferred.

**Workaround**: Make Premium free during beta. Implement billing in Phase 2.

---

### 2. In-App Chat/Messaging

**Status**: Not implemented  
**Action Required**: Build real-time messaging system  
**Effort**: 5-7 days  
**Dependency**: Socket.IO (already in API)  
**Risk**: Medium (moderation/storage design)

**What it blocks**: Customer/master communication is phone-only. No in-app message history.

**Workaround**: Phone contact works. Implement chat in Phase 2 post-launch.

---

### 3. Reverse Geocoding (Address autocomplete)

**Status**: Manual address entry only  
**Action Required**: Integrate Yandex Geocoder  
**Effort**: 1-2 days  
**Dependency**: Yandex API  
**Risk**: Low

**What it blocks**: Minor UX friction. Address entry requires manual typing.

**Workaround**: Acceptable for beta. Implement after launch.

---

### 4. Advanced Analytics & Dashboards

**Status**: Real-time queries work, no materialized views  
**Action Required**: Create materialized views for trending data  
**Effort**: 3-5 days  
**Dependency**: PostgreSQL administration  
**Risk**: Low

**What it blocks**: Analytics at scale (1000+ daily orders) would be slow. Currently fast enough.

**Workaround**: Acceptable for beta. Optimize before 10x scale.

---

### 5. Additional Payment Providers (Payme, Uzum)

**Status**: Click provider done, others not started  
**Action Required**: Implement Payme and Uzum providers  
**Effort**: 3-5 days each  
**Dependency**: Provider documentation  
**Risk**: Low

**What it blocks**: Customers can only pay via Click. Alternative payment methods unavailable.

**Workaround**: Click is dominant in Tashkent. Implement others in Phase 2.

---

### 6. Native Mobile Apps

**Status**: PWA only  
**Action Required**: Package with Capacitor or React Native  
**Effort**: 3-5 days  
**Dependency**: App Store/Play Store dev accounts  
**Risk**: Medium (store approval timelines)

**What it blocks**: No native apps. PWA works but less discoverable.

**Workaround**: PWA works well for beta. Build native apps in Phase 2.

---

### 7. Kafka/Event Streaming

**Status**: Domain events trigger synchronously  
**Action Required**: Add async event processing with Kafka  
**Effort**: 5-7 days  
**Dependency**: Kafka infrastructure  
**Risk**: Medium (operational complexity)

**What it blocks**: All events are synchronous. Scales to maybe 1000 daily orders.

**Workaround**: Synchronous is fine for beta. Implement queuing before 10k orders/day.

---

## Blockers Summary

### By Timeline

| Timeline | Blocker | Status |
|----------|---------|--------|
| **Before Private Beta (Days 1-5)** | Click credentials | Action required |
| | T&S and Privacy Policy | Action required |
| | Admin account | Action required |
| | Backup verification | Action required |
| **Before Public Launch (Days 5-30)** | Verification provider decision | Action required |
| | SMS failover (optional) | Nice-to-have |
| | Admin 2FA | Recommended |
| | In-country database (legal requirement) | TBD |
| | Payment reconciliation | Recommended |
| **Post-Launch (Phase 2+)** | Premium subscription billing | Deferred |
| | In-app chat | Deferred |
| | Advanced analytics | Deferred |
| | Additional payment providers | Deferred |
| | Native mobile apps | Deferred |

---

## Critical Path to Revenue

1. **Day 1**: Get Click credentials
2. **Days 2-3**: Deploy to production VPS
3. **Day 4**: Test end-to-end payment flow
4. **Day 5**: Launch private beta
5. **Day 30**: Public launch (verification provider resolved)
6. **Day 60**: Premium billing enabled (Phase 2)

---

## Deferred Decision: Manual vs. Automated Verification

**Question**: Should masters be verified via MyID integration or manual admin review?

**Manual Admin Review** (MVP for beta/launch):
- Pros: Simple, fast to implement, works for small volume
- Cons: Doesn't scale, admin workload increases

**MyID Integration** (Scales):
- Pros: Automated, instant verification, scales to any volume
- Cons: B2B contract required, 3-5 day implementation, regulatory uncertainty

**Recommendation**: Start with manual review for private beta (< 50 masters). If volume grows and MyID becomes necessary, implement in Week 2-3 of beta.

---

## References

- Production Deployment: `docs/PRODUCTION_DEPLOYMENT.md`
- Architecture Decisions: `docs/ARCHITECTURE.md` §0.1
- Operations Runbook: `docs/OPERATIONS_RUNBOOK.md`
- Private Beta Checklist: `PRIVATE_BETA_LAUNCH_CHECKLIST.md`
