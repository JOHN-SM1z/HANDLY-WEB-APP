## Private Beta Launch Checklist — Handly Marketplace

This checklist covers all steps required to launch Handly for private beta testing. Follow in order. Expected duration: 5-7 days.

---

## Phase 1: Pre-Launch Preparation (Days 1-2)

### Legal and Compliance

- [ ] **Uzbekistan business registration**
  - Company registered and operational
  - Tax ID (INN) obtained
  - Business address confirmed

- [ ] **Terms of Service and Privacy Policy**
  - [ ] Reviewed by legal counsel
  - [ ] Published on website
  - [ ] Accepted by users before account creation

- [ ] **Click payment provider**
  - [ ] Applied for merchant account
  - [ ] Received merchant credentials (CLICK_MERCHANT_ID, CLICK_MERCHANT_SECRET_KEY)
  - [ ] Whitelist callback URL in Click dashboard (https://handly.uz/api/v1/payments/webhook)
  - [ ] Test payment successful in Click sandbox (if available)

- [ ] **SMS provider (Eskiz)**
  - [ ] Account created
  - [ ] API key obtained
  - [ ] From number assigned (typically 4546)

- [ ] **Verification provider (MyID)**
  - [ ] Determine: Is real MyID verification required for beta?
  - [ ] If yes: Contact MyID support for integration setup
  - [ ] If no: Confirm manual admin verification is acceptable

### Domain and Infrastructure

- [ ] **Domain name**
  - [ ] Purchased and verified
  - [ ] DNS A record pointing to VPS IP
  - [ ] DNS propagation verified (`dig handly.uz`)

- [ ] **VPS provisioning**
  - [ ] VPS ordered (Ubuntu 22.04 LTS, 4+ CPU, 8GB+ RAM, 100GB SSD)
  - [ ] Root password and IP address obtained
  - [ ] SSH access verified
  - [ ] Firewall provider (digital ocean, Linode, etc.) account set up with backups enabled

- [ ] **Backup storage** (optional but recommended)
  - [ ] S3 bucket or equivalent created
  - [ ] Access credentials obtained
  - [ ] Retention policy set (30 days minimum)

### Team Preparation

- [ ] **Admin access assigned**
  - [ ] Admin user created in dev environment
  - [ ] Admin credentials securely shared
  - [ ] Admin user can log in and access dashboard

- [ ] **On-call support**
  - [ ] Primary on-call engineer assigned
  - [ ] Backup assigned
  - [ ] Contact information documented in OPERATIONS_RUNBOOK.md
  - [ ] Incident communication protocol defined

- [ ] **Beta tester recruitment**
  - [ ] 10-50 beta testers identified
  - [ ] Contact information collected
  - [ ] Beta testing agreement signed (optional)
  - [ ] Timezone spread confirmed (test from different times)

---

## Phase 2: Production Deployment (Day 3)

### VPS Setup and Security

- [ ] **Initial VPS hardening**
  ```bash
  # SSH into VPS and run:
  sudo apt update && sudo apt upgrade -y
  sudo ufw enable
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  ```

- [ ] **Docker and dependencies installed**
  ```bash
  sudo apt install -y docker.io docker-compose git curl certbot
  ```

- [ ] **Clone and configure**
  ```bash
  cd /opt
  sudo git clone https://github.com/JOHN-SM1z/HANDLY-WEB-APP.git handly
  sudo chown -R deploy:deploy /opt/handly
  cd /opt/handly
  ```

- [ ] **Environment configuration**
  - [ ] Copy `.env.production.template` to `.env.production`
  - [ ] Fill in all required values:
    - [ ] DOMAIN (handly.uz)
    - [ ] DB credentials (generate with `openssl rand -base64 32`)
    - [ ] REDIS_PASSWORD (generate)
    - [ ] CLICK_MERCHANT_ID (from Click)
    - [ ] CLICK_MERCHANT_SECRET_KEY (from Click)
    - [ ] ESKIZ_API_KEY (from Eskiz)
    - [ ] JWT_SECRET (generate with `openssl rand -base64 64`)
    - [ ] CORS_ORIGIN (https://handly.uz)
  - [ ] File permissions set: `chmod 600 .env.production`
  - [ ] `.env.production` added to .gitignore
  - [ ] No credentials in git history

### SSL Certificate Setup

- [ ] **Let's Encrypt certificate obtained**
  ```bash
  docker-compose -f docker-compose.prod.yml exec nginx \
    certbot certonly --non-interactive --agree-tos \
    -m admin@handly.uz \
    -d handly.uz \
    -d www.handly.uz \
    --webroot --webroot-path /var/www/certbot
  ```

- [ ] **Certificate auto-renewal verified**
  ```bash
  docker-compose -f docker-compose.prod.yml exec nginx \
    certbot renew --dry-run
  ```

- [ ] **HTTPS connection verified**
  ```bash
  curl -I https://handly.uz
  # Should return 200 OK
  ```

### Application Deployment

- [ ] **Docker images built**
  ```bash
  docker-compose -f docker-compose.prod.yml build
  ```

- [ ] **Services started**
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```

- [ ] **All services healthy**
  ```bash
  docker-compose -f docker-compose.prod.yml ps
  # All should show "Up (healthy)"
  ```

- [ ] **Health check endpoints responding**
  ```bash
  curl https://handly.uz/api/v1/health
  # Should return: {"status":"ok","db":"connected","redis":"connected"}
  ```

- [ ] **Database migrations run**
  ```bash
  docker-compose -f docker-compose.prod.yml exec api npm run db:migrate
  ```

- [ ] **Database seeded with categories**
  ```bash
  docker-compose -f docker-compose.prod.yml exec api npm run db:seed:prod
  ```

---

## Phase 3: Configuration and Testing (Day 4)

### Admin Setup

- [ ] **Admin account created**
  - [ ] Logged in to admin dashboard
  - [ ] Admin phone number verified via OTP
  - [ ] Admin name and email configured

- [ ] **Admin 2FA enabled** (optional but recommended)
  - [ ] 2FA code generated and saved offline
  - [ ] Test login with 2FA code

### Backup and Disaster Recovery

- [ ] **Backup script tested**
  ```bash
  /opt/handly/infra/scripts/backup.sh /opt/handly/backups
  # Should complete successfully
  ```

- [ ] **Backup cron job configured**
  ```bash
  # Add to crontab (3 AM daily)
  0 3 * * * /opt/handly/infra/scripts/backup.sh /opt/handly/backups
  ```

- [ ] **Restore procedure tested**
  - [ ] Latest backup identified
  - [ ] Restore verified on separate database (or test VPS)
  - [ ] Data integrity confirmed after restore

- [ ] **Off-site backup storage configured** (optional)
  - [ ] Automated backup upload to S3 or equivalent
  - [ ] Retention policy set

### Testing User Journeys

#### Customer Journey

- [ ] **Signup**
  - [ ] Can create account with phone number
  - [ ] OTP received via SMS
  - [ ] Account created successfully

- [ ] **Create Order**
  - [ ] Can select service category
  - [ ] Can describe problem
  - [ ] Can upload photos/video
  - [ ] AI diagnosis displays
  - [ ] Can confirm price and book

- [ ] **Payment**
  - [ ] Can initiate Click payment
  - [ ] Click payment gateway loads
  - [ ] Test payment successful (test card if available)
  - [ ] Order marked as PAID
  - [ ] Master receives notification

- [ ] **Order execution**
  - [ ] Master accepts offer
  - [ ] Live GPS tracking works (if both on same network)
  - [ ] Master updates to IN_PROGRESS
  - [ ] Can upload completion evidence
  - [ ] Can confirm completion

#### Master Journey

- [ ] **Signup**
  - [ ] Can create account
  - [ ] OTP received
  - [ ] Can declare skills/service area
  - [ ] Can set service availability

- [ ] **Receive Orders**
  - [ ] Receives push notification of offer
  - [ ] Can accept/decline
  - [ ] Live GPS tracking works
  - [ ] Can update job status
  - [ ] Can upload completion evidence

- [ ] **Earnings**
  - [ ] Earnings dashboard displays
  - [ ] Can view order history
  - [ ] Payment settled after customer confirmation

#### Admin Journey

- [ ] **Dashboard**
  - [ ] Can see total users, orders, revenue
  - [ ] Can view recent orders
  - [ ] Can view admin audit log

- [ ] **User management**
  - [ ] Can view all users
  - [ ] Can view user details
  - [ ] Can disable user if needed
  - [ ] Can view user verification status

- [ ] **Payment resolution**
  - [ ] Can see failed/disputed payments
  - [ ] Can manually resolve if needed
  - [ ] Can view settlement history

### Performance and Load Testing

- [ ] **Response times acceptable**
  - [ ] Homepage loads in < 2 seconds
  - [ ] API endpoints respond in < 500ms
  - [ ] Database queries optimized (no slow queries in logs)

- [ ] **Basic load test** (optional)
  - [ ] Simulate 10 concurrent users
  - [ ] No errors or timeouts
  - [ ] CPU < 50%, RAM < 70%

### Mobile and Responsive Design

- [ ] **Mobile web (PWA) tested**
  - [ ] Responsive on phone viewport
  - [ ] Can install as app (iOS/Android)
  - [ ] Works offline (cached assets)

- [ ] **Tablet tested**
  - [ ] Layout responsive
  - [ ] Forms usable

---

## Phase 4: Security and Compliance Verification (Day 4-5)

### Security Checklist

- [ ] **Firewall configured correctly**
  ```bash
  sudo ufw status verbose
  # Should allow: 22, 80, 443 only
  ```

- [ ] **SSH hardened**
  - [ ] Root login disabled
  - [ ] Password auth disabled
  - [ ] Key-based auth only
  - [ ] Test login with key

- [ ] **Fail2ban active**
  ```bash
  sudo systemctl status fail2ban
  # Should show: active (running)
  ```

- [ ] **TLS strength verified**
  ```bash
  curl -I https://handly.uz | grep -i "x-frame\|hsts"
  # Should show security headers
  ```

- [ ] **Database not externally accessible**
  ```bash
  # From another machine, try to connect (should fail)
  psql -h handly.uz -U handly_prod
  # Should timeout (port 5432 blocked)
  ```

- [ ] **Redis not externally accessible**
  ```bash
  redis-cli -h handly.uz ping
  # Should timeout (port 6379 blocked)
  ```

### Privacy and Compliance

- [ ] **GDPR compliance reviewed** (if applicable)
  - [ ] User data collection documented
  - [ ] Consent obtained for each use
  - [ ] Data deletion procedures in place

- [ ] **PII encryption verified**
  - [ ] Phone numbers hashed or encrypted
  - [ ] Passwords hashed with argon2
  - [ ] Payment tokens never stored

- [ ] **Audit logging enabled**
  - [ ] Admin actions logged
  - [ ] Payment transactions logged
  - [ ] User account changes logged

---

## Phase 5: Monitoring and Alerting Setup (Day 5)

### Logging

- [ ] **Log aggregation working**
  ```bash
  docker-compose -f docker-compose.prod.yml logs -f api
  # Should show real-time logs
  ```

- [ ] **Old logs rotated**
  - [ ] Check: `docker volume inspect handly-api | grep Mountpoint`
  - [ ] Logs directory is manageable size

### Monitoring (Optional but Recommended)

- [ ] **Uptime monitoring set up**
  - [ ] Health check URL monitored every 5 minutes
  - [ ] Alert configured if down for > 5 minutes

- [ ] **Resource monitoring (optional)**
  - [ ] CPU, RAM, disk usage tracked
  - [ ] Alert if CPU > 80% or disk > 90%

### Backup Verification

- [ ] **Backup running on schedule**
  - [ ] Latest backup file has today's date
  - [ ] Backup file size is reasonable (> 10MB)

- [ ] **Restore test successful**
  - [ ] Backup restored to test environment
  - [ ] Data matches production

---

## Phase 6: Private Beta Release (Day 5-6)

### Final Verification

- [ ] **All services healthy**
  ```bash
  docker-compose -f docker-compose.prod.yml ps
  ```

- [ ] **All tests passing**
  ```bash
  cd /opt/handly
  pnpm test
  ```

- [ ] **No error logs in past 1 hour**
  ```bash
  docker-compose -f docker-compose.prod.yml logs --since 1h | grep -i error
  # Should be empty
  ```

- [ ] **Payment flow tested end-to-end**
  - [ ] Create order as customer
  - [ ] Accept as master
  - [ ] Complete and receive payment
  - [ ] Verify Click webhook processed

### Pre-Beta Communication

- [ ] **Admin notified**
  - [ ] Admin credentials sent securely
  - [ ] Admin tutorial provided

- [ ] **Beta testers notified**
  - [ ] Email sent with Handly URL
  - [ ] Instructions provided
  - [ ] Contact info for issues provided
  - [ ] Expected to run for 2 weeks

- [ ] **Support channel set up**
  - [ ] Email monitored (admin@handly.uz)
  - [ ] Response target: < 24 hours
  - [ ] Critical issues: < 2 hours

### Launch

- [ ] **Go/no-go decision made**
  - [ ] Management approved
  - [ ] All blockers resolved
  - [ ] Team ready for support

- [ ] **Beta goes live**
  - [ ] URL shared with first 10 beta testers
  - [ ] Monitor closely for first 24 hours
  - [ ] Be ready for hotfixes

---

## Phase 7: Post-Launch Monitoring (Ongoing)

### Daily (First Week)

- [ ] Check all services healthy
- [ ] Review error logs
- [ ] Verify backups running
- [ ] Monitor for user-reported issues
- [ ] Respond to support requests

### Weekly (Ongoing)

- [ ] Run full health check procedure
- [ ] Review metrics and logs
- [ ] Backup restore test
- [ ] Performance review
- [ ] Security update check

---

## Rollback Plan

If critical issues occur after launch:

### Immediate (first 30 minutes)

1. **Assess severity**
   - Payment failure (critical) → immediate rollback
   - UI bug (low) → wait for fix

2. **If rolling back:**
   ```bash
   # Get last known-good commit
   git log --oneline | head -5
   
   # Checkout previous version
   git checkout <commit-hash>
   
   # Rebuild
   docker-compose -f docker-compose.prod.yml build
   
   # Restart
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Notify users**
   - Email: "We're investigating an issue. Service may be briefly unavailable."
   - ETA: Restore service

### Short-term

- Deploy fix and test in staging
- Re-deploy to production
- Verify all systems normal

---

## Sign-Off

- [ ] **Product Owner**: _________________ Date: _______
- [ ] **CTO/Lead Engineer**: _________________ Date: _______
- [ ] **Operations**: _________________ Date: _______

---

## References

- Production Deployment: `docs/PRODUCTION_DEPLOYMENT.md`
- Security Hardening: `docs/VPS_SECURITY_HARDENING.md`
- Operations Runbook: `docs/OPERATIONS_RUNBOOK.md`
- Architecture: `docs/ARCHITECTURE.md`
- Click Integration: `CLICK_INTEGRATION_COMPLETION.md`
