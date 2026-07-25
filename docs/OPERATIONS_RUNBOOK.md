## Operations Runbook — Handly Production

This runbook covers day-to-day operations, troubleshooting, and incident response for Handly on a single VPS.

---

## Daily Operations

### 1. Health Checks

Every 24 hours, verify all services are healthy:

```bash
# SSH to VPS
ssh -i ~/.ssh/handly-prod-key deploy@handly.uz

# Check container status
docker-compose -f /opt/handly/docker-compose.prod.yml ps

# Expected output:
# handly-postgres       Up (healthy)
# handly-redis          Up (healthy)
# handly-api            Up (healthy)
# handly-web            Up (healthy)
# handly-nginx          Up (healthy)

# If any service is NOT healthy, investigate
docker-compose -f /opt/handly/docker-compose.prod.yml logs <service-name>
```

### 2. Backup Verification

Backups run nightly via cron. Verify the latest backup exists:

```bash
# Check backup directory
ls -lh /opt/handly/backups/ | tail -5

# Latest backup should be from today
# Example:
# -rw-r--r-- 1 deploy deploy 45M Dec 19 03:00 handly-20241219T030000Z.dump
```

### 3. Log Review

Review error logs for any issues:

```bash
# View API logs (last 100 lines)
docker-compose -f /opt/handly/docker-compose.prod.yml logs api | tail -100

# View Nginx logs (last 100 lines)
docker-compose -f /opt/handly/docker-compose.prod.yml logs nginx | tail -100

# Search for errors
docker-compose -f /opt/handly/docker-compose.prod.yml logs api | grep -i error
```

---

## Common Issues and Fixes

### Issue: Service restarting unexpectedly

**Symptoms**: Container is shown as "Up" but repeatedly crashes

**Investigation**:
```bash
docker-compose -f /opt/handly/docker-compose.prod.yml logs api | grep -i "fatal\|panic\|error"
```

**Common causes**:
1. Out of memory — increase VPS RAM or check for memory leaks
2. Database connection lost — check PostgreSQL health
3. Redis connection lost — check Redis health
4. Environment variable missing — verify `.env.production`

**Fix**:
```bash
# Restart the service
docker-compose -f /opt/handly/docker-compose.prod.yml restart api

# Or restart everything
docker-compose -f /opt/handly/docker-compose.prod.yml down
docker-compose -f /opt/handly/docker-compose.prod.yml up -d
```

### Issue: HTTPS certificate expiration warning

**Symptoms**: Browser warning about certificate expiration, Nginx logs show cert errors

**Investigation**:
```bash
docker-compose -f /opt/handly/docker-compose.prod.yml exec nginx certbot certificates
```

**Fix**:
```bash
# Let's Encrypt auto-renewal should handle this, but force renewal if needed
docker-compose -f /opt/handly/docker-compose.prod.yml exec nginx certbot renew --force-renewal
```

### Issue: Payment webhooks not processing

**Symptoms**: Customers report payment failures, no errors in logs

**Investigation**:
```bash
# Check if webhook endpoint is accessible
curl -i https://handly.uz/api/v1/payments/webhook

# Should return 405 Method Not Allowed (POST required)

# Check API logs for webhook errors
docker-compose -f /opt/handly/docker-compose.prod.yml logs api | grep webhook
```

**Fix**:
```bash
# Verify Click credentials are set
grep CLICK_MERCHANT /opt/handly/.env.production

# If empty, update credentials and restart
nano /opt/handly/.env.production
docker-compose -f /opt/handly/docker-compose.prod.yml restart api
```

### Issue: Database disk space full

**Symptoms**: Database write errors, orders fail to create

**Investigation**:
```bash
# Check disk space
df -h /

# Check database size
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database ORDER BY pg_database_size DESC;"
```

**Fix**:
```bash
# Increase VPS disk (if hosting allows)
# Or delete old backups
rm /opt/handly/backups/handly-202411*.dump
```

---

## Scaling and Performance

### Monitor resource usage

```bash
# CPU and memory usage
docker stats

# Disk I/O
iostat -x 1

# Network traffic
nethogs

# PostgreSQL query performance
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### When to scale

Single VPS capacity limits:
- **~1,000 active users** with 4 CPU / 8GB RAM
- **~5,000 daily orders** before database optimization needed
- **~100MB/day** backup size (30-day retention = 3GB)

If approaching limits:
1. Upgrade VPS (add CPU/RAM)
2. Implement database read replicas
3. Separate API and web services to different VPS
4. Add Redis cluster for caching

### Database vacuum and maintenance

```bash
# Run weekly maintenance
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "VACUUM ANALYZE;"

# Add to cron (run Sundays at 2 AM):
# 0 2 * * 0 docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "VACUUM ANALYZE;"
```

---

## Monitoring and Alerting (Optional)

### Set up monitoring via uptime service

```bash
# Manual uptime check (run every 5 minutes via cron)
curl -f https://handly.uz/api/v1/health || echo "API DOWN" | mail -s "Handly API Down" admin@handly.uz
```

### Real-time monitoring with Prometheus (advanced)

Handly API already exposes metrics. Set up Prometheus for detailed monitoring:

```bash
# Prometheus scrapes http://localhost:3001/metrics (if METRICS_ENABLED=true)
# Store in time-series DB for trending and alerts
```

---

## Disaster Recovery

### Complete data loss scenario

If the VPS is destroyed and data must be recovered:

```bash
# 1. Provision new VPS (same specs)
# 2. Clone Handly repository
# 3. Copy .env.production from secure backup
# 4. Download latest database backup from secure storage (S3/backup service)
# 5. Restore backup
./infra/scripts/restore.sh /path/to/backup.dump

# 6. Start services
docker-compose -f /opt/handly/docker-compose.prod.yml up -d

# 7. Verify all services are healthy
docker-compose -f /opt/handly/docker-compose.prod.yml ps
```

### Single service failure

```bash
# If API is down but database is fine
docker-compose -f /opt/handly/docker-compose.prod.yml restart api

# If database is corrupted
# Stop API to prevent further writes
docker-compose -f /opt/handly/docker-compose.prod.yml stop api

# Restore from latest backup
./infra/scripts/restore.sh /path/to/backup.dump

# Restart API
docker-compose -f /opt/handly/docker-compose.prod.yml start api
```

---

## Security Incident Response

### Suspicious activity detected

```bash
# 1. Check access logs for unusual patterns
docker-compose -f /opt/handly/docker-compose.prod.yml logs nginx | grep "POST\|DELETE\|suspicious"

# 2. Check failed login attempts
docker-compose -f /opt/handly/docker-compose.prod.yml logs api | grep "authentication failed"

# 3. Check database for unauthorized changes
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;"

# 4. Review admin activity
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50;"
```

### Potential breach

```bash
# 1. Take database backup immediately
./infra/scripts/backup.sh /opt/handly/backups

# 2. Rotate all secrets
nano /opt/handly/.env.production
# - Generate new JWT_SECRET
# - Rotate Click credentials (contact Click support)
# - Rotate Eskiz API key

# 3. Restart services with new secrets
docker-compose -f /opt/handly/docker-compose.prod.yml down
docker-compose -f /opt/handly/docker-compose.prod.yml up -d

# 4. Review all recent transactions
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -c "SELECT * FROM payments WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC;"

# 5. Notify affected customers of suspicious payments
```

---

## Maintenance Window Procedure

### Planned downtime (e.g., database migration)

```bash
# 1. Notify users (display maintenance banner)
# 2. Stop accepting new orders (feature flag or UI notice)

# 3. Stop services gracefully
docker-compose -f /opt/handly/docker-compose.prod.yml stop

# 4. Perform maintenance
docker-compose -f /opt/handly/docker-compose.prod.yml exec postgres psql -U handly_prod -f migration.sql

# 5. Start services
docker-compose -f /opt/handly/docker-compose.prod.yml up -d

# 6. Verify health checks pass
docker-compose -f /opt/handly/docker-compose.prod.yml ps

# 7. Remove maintenance notice
```

### Zero-downtime deployment (future)

Current deployment requires brief downtime. For zero-downtime:
1. Run new version alongside old version
2. Drain connections from old version
3. Migrate database in background
4. Switch traffic to new version
5. Remove old version

---

## Communication Plan

### Incident severity levels

**Severity 1 (Critical)**: Service completely down, customers cannot use app
- Response: Immediate
- Communication: Email + SMS to affected users
- Status page: Update every 15 minutes

**Severity 2 (High)**: Service degraded, features unavailable
- Response: Within 30 minutes
- Communication: Email notification
- Status page: Update every 30 minutes

**Severity 3 (Medium)**: Minor issue, workaround available
- Response: Within 4 hours
- Communication: Optional notification
- Status page: Update after resolution

**Severity 4 (Low)**: No user impact, internal issue
- Response: Next business day
- Communication: None
- Status page: No update

### Escalation contact

- On-call engineer: [Contact info]
- Manager backup: [Contact info]
- Click support: support@click.uz
- AWS/hosting support: [Support ticket URL]

---

## Checklists

### Weekly

- [ ] Check container health status
- [ ] Verify latest backup file exists
- [ ] Review error logs
- [ ] Monitor disk space usage
- [ ] Check certificate expiration date

### Monthly

- [ ] Run database VACUUM ANALYZE
- [ ] Review and clean old backups
- [ ] Test restore procedure with one backup
- [ ] Update OS patches (run `sudo apt upgrade`)
- [ ] Review security settings (SSH, firewall)

### Quarterly

- [ ] Full disaster recovery drill (restore to new VPS)
- [ ] Performance review and optimization
- [ ] Security audit and penetration testing
- [ ] Capacity planning review

---

## References

- Backup and restore procedures: `docs/runbooks/backup-restore.md`
- Security hardening: `docs/VPS_SECURITY_HARDENING.md`
- Deployment guide: `docs/PRODUCTION_DEPLOYMENT.md`
- Architecture: `docs/ARCHITECTURE.md`
