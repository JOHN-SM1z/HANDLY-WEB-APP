## Production Deployment Checklist

**Timeline**: 4–5 days to live, depending on legal/compliance decisions  
**Target**: Single Ubuntu 22.04 LTS VPS, 4+ CPU, 8GB RAM, 100GB SSD

---

## Pre-Deployment Phase (Day 1)

### Legal & Compliance
- [ ] **Confirm MyID requirement with legal**
  - Is MyID/biometric verification mandatory for Uzbekistan compliance?
  - If YES: Add 3–5 days to timeline for MyID integration
  - If NO: Skip MyID, proceed with manual verification admin tool

- [ ] **Prepare terms of service**
  - User agreements (master & customer)
  - Privacy policy (GDPR-aligned, as per ARCHITECTURE §12)
  - Warranty terms

- [ ] **Currency & taxation**
  - Confirm 1% tax withholding is legally compliant
  - Document settlement process for tax reporting

### Payment Provider Setup
- [ ] **Click merchant account**
  - Register at https://click.uz/
  - Complete business verification
  - Receive merchant credentials (ID + secret key)
  - **Store in password manager; DO NOT commit to git**

- [ ] **SMS provider (Eskiz)**
  - Register at https://notify.eskiz.uz/
  - Create API key
  - Test SMS sending (send test OTP to team phones)

- [ ] **Verify environment variables**
  - Generate JWT secret: `openssl rand -base64 64`
  - Generate DB password: `openssl rand -base64 32`
  - Generate Redis password: `openssl rand -base64 32`
  - Fill `.env.production` with all values

### Domain & DNS
- [ ] **Point domain to VPS IP**
  - DNS A record: `handly.uz → your-vps-ip`
  - Allow 24 hours for propagation
  - Test: `nslookup handly.uz`

---

## Infrastructure Setup Phase (Day 2–3)

### VPS Provisioning
- [ ] **Provision VPS**
  - OS: Ubuntu 22.04 LTS
  - Size: 4+ CPU, 8GB RAM, 100GB SSD
  - Provider: Linode, DigitalOcean, Hetzner, etc.
  - Store IP address and SSH key securely

### System Preparation
- [ ] **SSH access working**
  - `ssh root@your-vps-ip` succeeds
  - Add SSH key to `~/.ssh/authorized_keys`

- [ ] **Run VPS setup script**
  ```bash
  # SSH into VPS
  ssh root@your-vps-ip
  
  # Run provided setup (from PRODUCTION_DEPLOYMENT.md)
  apt update && apt upgrade -y
  apt install -y docker.io docker-compose git curl wget postgresql-client redis-tools certbot
  
  # Add user to docker group
  usermod -aG docker ubuntu  # or your username
  ```

- [ ] **Clone repository**
  ```bash
  cd /opt
  git clone https://github.com/JOHN-SM1z/HANDLY-WEB-APP.git handly
  cd handly
  ```

- [ ] **Configure environment**
  ```bash
  # Copy template and edit with real values
  cp .env.production.template .env.production
  nano .env.production  # Fill in all values
  chmod 600 .env.production
  ```

### SSL Certificate
- [ ] **Request Let's Encrypt certificate**
  - Run certbot with domain validation
  - Certificate stored at `/etc/letsencrypt/live/handly.uz/`
  - Auto-renewal configured (renews 30 days before expiry)

- [ ] **Verify certificate**
  ```bash
  curl -I https://handly.uz
  # Should return 200 OK with Strict-Transport-Security header
  ```

---

## Application Deployment Phase (Day 3–4)

### Docker Build & Startup
- [ ] **Build Docker images**
  ```bash
  docker-compose -f docker-compose.prod.yml build
  ```

- [ ] **Start all services**
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```

- [ ] **Verify all containers running**
  ```bash
  docker-compose -f docker-compose.prod.yml ps
  # All should show "Up"
  ```

### Database Initialization
- [ ] **Run Prisma migrations**
  ```bash
  docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
  ```

- [ ] **Seed initial data (optional)**
  ```bash
  docker-compose -f docker-compose.prod.yml exec api npx prisma db seed
  ```

- [ ] **Verify database**
  ```bash
  docker-compose -f docker-compose.prod.yml exec postgres psql -U handly_prod -d handly_prod -c "SELECT COUNT(*) FROM users"
  ```

### Service Health Checks
- [ ] **API health check**
  ```bash
  curl http://localhost:3001/health
  # Should return 200 OK
  ```

- [ ] **Web health check**
  ```bash
  curl http://localhost:3000
  # Should return HTML
  ```

- [ ] **Redis connectivity**
  ```bash
  docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD ping
  # Should return PONG
  ```

- [ ] **PostgreSQL connectivity**
  ```bash
  docker-compose -f docker-compose.prod.yml exec postgres psql -U handly_prod -d handly_prod -c "SELECT 1"
  # Should return 1
  ```

- [ ] **HTTPS working**
  ```bash
  curl -I https://handly.uz
  # Should return 200 with HSTS header
  ```

### Firewall & Security
- [ ] **Enable UFW firewall**
  ```bash
  ufw enable
  ufw allow 22/tcp   # SSH
  ufw allow 80/tcp   # HTTP
  ufw allow 443/tcp  # HTTPS
  ```

- [ ] **Verify only necessary ports open**
  ```bash
  sudo netstat -tulpn | grep LISTEN
  # Should only see 22, 80, 443
  ```

---

## Operational Setup Phase (Day 4)

### Backups & Disaster Recovery
- [ ] **Configure automated backups**
  ```bash
  chmod +x infra/backup.sh
  sudo crontab -e
  # Add: 2 3 * * * /opt/handly/infra/backup.sh >> /var/log/handly-backup.log 2>&1
  ```

- [ ] **Test backup works**
  ```bash
  /opt/handly/infra/backup.sh
  # Should create files in /opt/handly/backups/
  ```

- [ ] **Backup storage strategy**
  - Keep backups on VPS (7 days)
  - Mirror to cloud storage (AWS S3, B2, etc.) — weekly
  - Document recovery procedure

### Monitoring & Alerts
- [ ] **Sentry (optional)**
  - Create Sentry project
  - Set `SENTRY_DSN` in `.env.production`
  - Restart API container
  - Verify errors appear in Sentry dashboard

- [ ] **Configure health checks**
  ```bash
  chmod +x infra/health-check.sh
  sudo crontab -e
  # Add: 0 12 * * * /opt/handly/infra/health-check.sh >> /var/log/handly-health.log 2>&1
  ```

- [ ] **Log rotation**
  - Logs are already configured with max 50MB per file
  - Verify `/var/log/nginx/` and container logs manageable

### Admin Account & Security
- [ ] **Create admin account**
  - Use admin dashboard or database
  - Email: admin@handly.uz
  - Password: strong, 20+ chars
  - Store in password manager

- [ ] **Enable 2FA for admin**
  - Set up TOTP-based 2FA
  - Store backup codes securely
  - Test 2FA by logging out and back in

- [ ] **Audit logging enabled**
  - All admin actions logged (user suspension, payment resolution, etc.)
  - Logs stored in `audit_logs` table

---

## Testing Phase (Day 4–5)

### End-to-End Payment Flow
- [ ] **Test complete order → payment flow**
  1. Create customer account
  2. Login as master
  3. Create order (as customer)
  4. Complete service (as master)
  5. Pay for order (as customer) — use Click sandbox if available
  6. Verify payment settled
  7. Verify master earnings recorded in ledger

- [ ] **Test payment failure scenarios**
  - Failed payment → order stays in COMPLETED
  - Admin can manually approve/refund

- [ ] **Test webhook handling**
  - Trigger webhook manually via Click dashboard
  - Verify idempotent (sending twice doesn't double-charge)

### User Experience Testing
- [ ] **Sign up flow (customer)**
  - Create account → receive OTP → verify phone
  - Verify email confirmation

- [ ] **Master onboarding**
  - Create account → fill profile
  - Declare skills/service area
  - (Optional) MyID verification if required

- [ ] **Order workflow**
  - Customer creates order
  - Get AI diagnosis
  - Accept quote
  - Master sees offer
  - Complete service
  - Pay for service

### Mobile/Responsive Testing
- [ ] **PWA on mobile**
  - Test on iOS (Safari) and Android (Chrome)
  - Add to home screen works
  - Responsive layout verified

- [ ] **GPS tracking**
  - Master shares location en-route
  - Customer sees real-time location

---

## Post-Launch Phase (Day 5+)

### Go-Live
- [ ] **Announce marketplace live**
  - Social media post
  - Email to beta users
  - Landing page updated

- [ ] **Monitor for 24 hours**
  - Check logs for errors
  - Monitor Sentry dashboard
  - Respond to user support requests

### Immediate Post-Launch Tasks
- [ ] **Phase 2 planning**
  - Real billing for Premium subscriptions
  - In-app chat system
  - Additional payment providers (Payme, Uzum)
  - Advanced analytics

- [ ] **Optional: MyID Integration** (if required)
  - Real identity verification
  - Liveness checks
  - Sync with government ID database

---

## Critical Path Decision Points

### Decision 1: MyID Mandatory?
**Timeline Impact**: +3–5 days if YES

**If YES**:
- [ ] Obtain MyID partner account
- [ ] Implement integration in `verification.service.ts`
- [ ] Add MyID flow to master onboarding UI
- [ ] Test with test ID documents

**If NO**:
- [ ] Keep manual admin verification
- [ ] Document verification requirements

### Decision 2: Premium Subscriptions at Launch?
**Timeline Impact**: +2 days if YES

**If YES**:
- [ ] Implement subscription billing via Click
- [ ] Auto-renewal scheduler (BullMQ)
- [ ] Trial expiry logic

**If NO**:
- [ ] Keep free-only platform
- [ ] Add subscriptions in Phase 2

---

## Emergency Contact Procedures

### If Payment Processing Fails
1. Check Click credentials in `.env.production`
2. Verify webhook signature key matches Click dashboard
3. Check API logs: `docker logs handly-api | grep click`
4. Restart API container: `docker-compose -f docker-compose.prod.yml restart api`
5. Contact Click support if still failing

### If Database Corruption
1. Stop application: `docker-compose -f docker-compose.prod.yml down`
2. Restore from backup: See PRODUCTION_DEPLOYMENT.md
3. Verify data integrity post-restore
4. Restart application: `docker-compose -f docker-compose.prod.yml up -d`

### If SSL Certificate Renewal Fails
1. Check certbot logs: `sudo journalctl -u certbot.timer -n 50`
2. Manual renewal: `sudo certbot renew --force-renewal`
3. Verify certificate: `sudo certbot certificates`
4. Restart Nginx: `docker-compose -f docker-compose.prod.yml restart nginx`

---

## Success Criteria

✅ **All items above completed**  
✅ **HTTPS working (green lock in browser)**  
✅ **Complete payment flow tested successfully**  
✅ **Admin account created with 2FA**  
✅ **Automated backups running**  
✅ **Health checks configured**  
✅ **Team can deploy updates without downtime**  
✅ **Logs being collected and monitored**  

**Platform is live and ready for users.**
