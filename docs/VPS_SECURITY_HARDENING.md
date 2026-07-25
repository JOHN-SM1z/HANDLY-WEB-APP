## VPS Security Hardening Guide — Handly Production

This guide covers security best practices for deploying Handly on a single Ubuntu VPS.

---

## 1. Firewall Configuration (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (critical — do this first)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny everything else by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Verify rules
sudo ufw status verbose
```

**Note**: If SSH fails, the VPS becomes inaccessible. The Docker Compose setup only exposes ports 80, 443, and 3001 (API, for optional direct access). Never expose PostgreSQL (5432) or Redis (6379) externally.

---

## 2. SSH Hardening

### Disable root login and password auth

```bash
sudo nano /etc/ssh/sshd_config

# Set these values:
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 3
MaxSessions 5
ClientAliveInterval 300
ClientAliveCountMax 2
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

### Set up key-based SSH access

```bash
# On your local machine
ssh-keygen -t ed25519 -C "handly-prod-key"

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/handly-prod-key.pub deploy@vps-ip

# Test login
ssh -i ~/.ssh/handly-prod-key deploy@vps-ip
```

---

## 3. System Updates and Patches

```bash
# Enable automatic security updates
sudo apt install -y unattended-upgrades apt-listchanges
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Verify automatic updates are enabled
sudo systemctl status unattended-upgrades

# Manual update check
sudo apt update
sudo apt upgrade -y
```

---

## 4. Fail2ban (Brute-force Protection)

```bash
# Install
sudo apt install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit to protect against brute-force
sudo nano /etc/fail2ban/jail.local

# Key settings:
# bantime = 3600  (1 hour ban)
# findtime = 600  (10 minute window)
# maxretry = 5    (5 attempts allowed)

# Enable and start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
```

---

## 5. Container Security

### Non-root users in containers

Verify that all Docker images use non-root users:

```bash
# Check API container
docker inspect handly-api | grep -i user

# Check web container
docker inspect handly-web | grep -i user
```

Both should run as non-root (e.g., `1001` for NestJS, same for Next.js).

### Docker daemon security

```bash
# Restrict docker socket access
sudo usermod -aG docker deploy  # Only authorized users

# Verify no rogue volumes mounted
docker inspect handly-postgres | grep Mounts
```

---

## 6. TLS/SSL Certificate Management

### Let's Encrypt Setup (in Docker Compose)

Certificates are stored in `/etc/letsencrypt/live/{DOMAIN}/` inside the Nginx container.

```bash
# Manual renewal check
docker-compose -f docker-compose.prod.yml exec nginx certbot renew --dry-run

# Automatic renewal via cron (runs inside container, already configured in Nginx Dockerfile)
docker-compose -f docker-compose.prod.yml logs nginx | grep certbot
```

### Certificate Expiration Monitoring

```bash
# Add to monitoring script (check monthly)
echo "Checking certificate expiration..."
docker-compose -f docker-compose.prod.yml exec nginx certbot certificates
```

---

## 7. Network Security

### Internal network isolation

Docker Compose uses a private network (`handly-network`). Services communicate internally:
- API talks to PostgreSQL/Redis via container names
- Nginx proxies to API/web containers
- No external service-to-service communication

### Port exposure

Only expose:
- 80/tcp (HTTP → HTTPS redirect)
- 443/tcp (HTTPS, all traffic)
- Optionally 3001 for direct API access (debug only, should be blocked in production)

Verify no extra ports are exposed:
```bash
docker-compose -f docker-compose.prod.yml config | grep ports
```

---

## 8. Database Security

### PostgreSQL

- User: `handly_prod` (non-superuser)
- Password: Random 32-byte generated in `.env.production`
- Listen: 127.0.0.1:5432 only (Docker Compose internal)
- No external access

```bash
# Verify postgres user has no login role
docker-compose -f docker-compose.prod.yml exec postgres psql -U handly_prod -c "SELECT usename, usecanlogin FROM pg_user WHERE usename = 'postgres';"
```

### Redis

- Password: Random 32-byte generated in `.env.production`
- Listen: 127.0.0.1:6379 only (Docker Compose internal)
- Persistence: AOF + RDB (controlled by Docker volume)

```bash
# Verify auth is required
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
# Should return "(error) NOAUTH Authentication required"

# Verify with auth
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a "${REDIS_PASSWORD}" ping
# Should return "PONG"
```

---

## 9. Application Security Headers

All configured in `infra/nginx/nginx.prod.conf`:

```nginx
# HSTS (HTTP Strict Transport Security)
Strict-Transport-Security: max-age=31536000; includeSubDomains

# Prevent MIME type sniffing
X-Content-Type-Options: nosniff

# Prevent clickjacking
X-Frame-Options: SAMEORIGIN

# Enable XSS protection
X-XSS-Protection: 1; mode=block

# Referrer policy
Referrer-Policy: no-referrer-when-downgrade

# Permissions policy (disable sensitive features)
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## 10. Log Management

### Log rotation

Docker logs are rotated automatically (configured in `docker-compose.prod.yml`):

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"  # Keep 30MB total per service
```

### Centralized logging (optional)

For production, consider:
- ELK stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch / Stackdriver (if on AWS/GCP)

For now, logs are available via:
```bash
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f nginx
```

---

## 11. Secrets Management

### Environment variables

Stored in `.env.production` (not version-controlled):

```bash
# Never commit this file
echo ".env.production" >> .gitignore

# Restrict file permissions
chmod 600 .env.production

# Verify only root/deploy can read
ls -la .env.production
```

### Rotating secrets

For each secret, update and restart services:

```bash
# Update .env.production
nano .env.production

# Restart containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

---

## 12. Monitoring and Alerts

### Health checks

Every service has a health check. Verify they're passing:

```bash
docker-compose -f docker-compose.prod.yml ps

# All should show "Up (healthy)"
```

### Resource limits (optional)

To prevent a service from consuming all resources:

```yaml
# In docker-compose.prod.yml, add to each service:
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 2G
```

---

## 13. Incident Response

### Service restart

If a service fails:
```bash
docker-compose -f docker-compose.prod.yml restart api
docker-compose -f docker-compose.prod.yml restart nginx
```

### Full stack restart

```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database recovery

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore from backup (see docs/runbooks/backup-restore.md)
infra/scripts/restore.sh /path/to/backup.dump

# Restart
docker-compose -f docker-compose.prod.yml up -d
```

---

## 14. Compliance Checklist

- [ ] Firewall enabled with SSH, HTTP, HTTPS only
- [ ] SSH key-based auth, root login disabled
- [ ] Automatic security updates enabled
- [ ] Fail2ban protecting against brute-force
- [ ] TLS certificates installed and auto-renewing
- [ ] Database credentials randomized
- [ ] Redis password set
- [ ] JWT secret randomized
- [ ] `.env.production` file permissions: 600
- [ ] Logs rotated and monitored
- [ ] Health checks passing
- [ ] Backups tested (restore verified)
- [ ] Incident response tested

---

## References

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Let's Encrypt Best Practices](https://letsencrypt.org/docs/rate-limits/)
