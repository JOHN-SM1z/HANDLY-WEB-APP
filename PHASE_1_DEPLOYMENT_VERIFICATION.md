# Phase 1: Production Deployment Verification

Systematic verification of Docker Compose deployment on Ubuntu VPS.

## Prerequisites Checklist

- [ ] Ubuntu 22.04 LTS server provisioned (4+ CPU, 8GB RAM, 100GB SSD)
- [ ] SSH access configured with key-based authentication
- [ ] Domain name registered and DNS pointing to VPS IP
- [ ] All credentials prepared:
  - DATABASE_PASSWORD (strong, 32+ chars, saved securely)
  - REDIS_PASSWORD (strong, 32+ chars, saved securely)
  - JWT_SECRET (strong, 64+ chars, saved securely)
  - CLICK_MERCHANT_ID (from Click.uz)
  - CLICK_MERCHANT_SECRET_KEY (from Click.uz)
  - ESKIZ_API_KEY (from Eskiz.uz, or skip for mock)
  - NEXT_PUBLIC_API_BASE (e.g., https://api.handly.uz)
  - DOMAIN (e.g., handly.uz)
  - CORS_ORIGIN (should be https://handly.uz)

## Step 1: VPS System Configuration

SSH into the VPS and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version && docker-compose --version

# Add current user to docker group
sudo usermod -aG docker $USER && newgrp docker

# Verify docker works without sudo
docker ps
```

**Verification Steps:**

- [ ] System updated successfully
- [ ] Docker installed and running (`docker ps` returns empty list)
- [ ] Docker Compose installed and functional
- [ ] Current user can run docker commands without sudo

## Step 2: Clone Repository and Setup

```bash
# Clone repository (or pull if already cloned)
git clone https://github.com/JOHN-SM1z/HANDLY-WEB-APP.git /opt/handly
cd /opt/handly

# Checkout production branch
git checkout main  # or specify version tag

# Create .env.production file with all credentials
# Use .env.production.template as reference
cp .env.production.template .env.production

# Edit and populate all required environment variables
nano .env.production  # or use your preferred editor
```

**Verification Steps:**

- [ ] Repository cloned to /opt/handly
- [ ] .env.production file created with ALL required variables
- [ ] No placeholder values remain (all credentials filled in)
- [ ] Credentials are correct (can verify by checking first few chars if needed)

## Step 3: Pre-Deployment Build Verification

```bash
# Verify docker-compose.prod.yml is valid
docker-compose -f docker-compose.prod.yml config > /dev/null && echo "Config OK"

# Build images (this will take 5-10 minutes first time)
docker-compose -f docker-compose.prod.yml build --no-cache

# Verify build succeeded
docker images | grep -E "handly-|postgres|redis|nginx"
```

**Verification Steps:**

- [ ] Docker Compose config validates without errors
- [ ] Docker build completes without errors
- [ ] All required images exist (handly-api, handly-web, postgres:16, redis:7, nginx:alpine)
- [ ] No build warnings about security issues

## Step 4: Deploy to Production

```bash
# Create volumes and networks
docker-compose -f docker-compose.prod.yml up -d

# Wait 30 seconds for services to initialize
sleep 30

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs to check for startup errors
docker-compose -f docker-compose.prod.yml logs postgres
docker-compose -f docker-compose.prod.yml logs redis
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs web
docker-compose -f docker-compose.prod.yml logs nginx
```

**Verification Steps:**

- [ ] `docker-compose ps` shows all services in "Up" state
- [ ] PostgreSQL healthy: `docker-compose exec postgres pg_isready -U handly` returns "accepting connections"
- [ ] Redis healthy: `docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping` returns "PONG"
- [ ] API container logs show no startup errors
- [ ] Web container logs show no startup errors
- [ ] Nginx container logs show no startup errors

## Step 5: Database Initialization

```bash
# Run database migrations
docker-compose -f docker-compose.prod.yml exec api npm run prisma:migrate:deploy

# Verify database initialized
docker-compose -f docker-compose.prod.yml exec postgres psql -U handly -d handly -c "\dt"
```

**Verification Steps:**

- [ ] Prisma migrations run successfully
- [ ] `\dt` shows all expected tables (users, orders, payments, etc.)
- [ ] At least 20+ tables exist

## Step 6: API Health Check

```bash
# Test API health endpoint (should work without auth)
curl http://localhost:3001/health

# Expected response: {"status":"ok"} or similar

# Test API is reachable from host
curl -i http://localhost:3001/health
```

**Verification Steps:**

- [ ] `GET /health` returns 200 OK
- [ ] Response contains "ok" or "healthy"
- [ ] Response time < 1 second

## Step 7: Nginx / Reverse Proxy Check

```bash
# Check Nginx is running
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Test proxy to API
curl -i http://localhost/api/health  # via Nginx

# Test proxy to web
curl -i http://localhost/  # should return HTML, not 502/503
```

**Verification Steps:**

- [ ] `nginx -t` returns "syntax is ok"
- [ ] `GET /api/health` returns 200 OK (via Nginx proxy)
- [ ] `GET /` returns 200 OK with HTML content (not 502 Bad Gateway)
- [ ] Response time < 2 seconds

## Step 8: HTTPS / Let's Encrypt Setup

```bash
# Check if Let's Encrypt certificates exist
ls -la /etc/letsencrypt/live/$DOMAIN/

# If certificates don't exist, create them manually
docker run --rm -it -v /opt/handly/letsencrypt_data:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d $DOMAIN -d www.$DOMAIN \
  --email admin@$DOMAIN \
  --agree-tos -n

# Verify certificates were created
docker-compose -f docker-compose.prod.yml exec nginx ls -la /etc/letsencrypt/live/$DOMAIN/

# Test HTTPS (may show cert errors if domain not pointing here yet)
curl -k https://localhost  # -k = ignore cert errors
```

**Verification Steps:**

- [ ] Certificate files exist: fullchain.pem and privkey.pem
- [ ] Certificate expires in future (not expired)
- [ ] Nginx loads certificates without errors
- [ ] HTTPS port 443 is listening

## Step 9: Domain Configuration

Once domain DNS is pointing to this VPS:

```bash
# Test with actual domain
curl https://$DOMAIN/api/health -v

# Verify SSL certificate is valid
openssl s_client -connect $DOMAIN:443 -tls1_2

# Check certificate details
openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -text -noout
```

**Verification Steps:**

- [ ] `GET https://$DOMAIN/api/health` returns 200 OK
- [ ] HTTPS certificate shows as valid (no warnings in browser)
- [ ] Certificate matches domain name
- [ ] Certificate is NOT self-signed

## Step 10: Container Restart Policies

```bash
# Stop all containers
docker-compose -f docker-compose.prod.yml down

# Verify all containers stopped
docker ps

# Start all containers again
docker-compose -f docker-compose.prod.yml up -d

# Verify all containers are back up
docker-compose -f docker-compose.prod.yml ps
```

**Verification Steps:**

- [ ] All containers stopped cleanly (no errors in logs)
- [ ] All containers restart automatically and reach "Up" state
- [ ] No orphaned containers remain

## Step 11: Automatic Startup on Reboot

```bash
# Create systemd service to auto-start Docker Compose
sudo tee /etc/systemd/system/docker-compose-handly.service > /dev/null <<EOF
[Unit]
Description=Handly Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/handly
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
User=$USER

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable docker-compose-handly.service

# Test it works
sudo systemctl start docker-compose-handly.service
docker-compose -f docker-compose.prod.yml ps
```

**Verification Steps:**

- [ ] Systemd service created and enabled
- [ ] Service starts all containers
- [ ] Service status is "enabled"

## Step 12: Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (critical!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verify rules
sudo ufw status

# Deny all inbound by default
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

**Verification Steps:**

- [ ] Firewall is enabled
- [ ] SSH (22), HTTP (80), HTTPS (443) are allowed
- [ ] All other ports are denied
- [ ] SSH access still works (don't lock yourself out!)

## Step 13: Log Rotation

```bash
# Create log rotation config
sudo tee /etc/logrotate.d/handly > /dev/null <<EOF
/opt/handly/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  missingok
  create 0644 root root
  sharedscripts
}
EOF

# Test log rotation
sudo logrotate -f /etc/logrotate.d/handly
```

**Verification Steps:**

- [ ] Log rotation config created
- [ ] Old logs are compressed and archived
- [ ] Latest logs remain uncompressed

## Step 14: Container Health Checks

```bash
# All containers should have health status
docker-compose -f docker-compose.prod.yml ps

# Get detailed health info
docker inspect handly-postgres --format='{{.State.Health.Status}}'
docker inspect handly-redis --format='{{.State.Health.Status}}'
docker inspect handly-api --format='{{.State.Health.Status}}'
docker inspect handly-web --format='{{.State.Health.Status}}'
```

**Verification Steps:**

- [ ] All containers show "healthy" or "Up" status
- [ ] No containers show "unhealthy"
- [ ] No containers show "restarting"

## Step 15: Monitoring Configuration

```bash
# Install monitoring (optional but recommended)
# Option 1: CloudFlare (free)
# Option 2: Sentry (for error tracking)
# Option 3: Datadog (paid)
# Option 4: New Relic (paid)

# Verify Sentry endpoint if configured
curl -X POST https://your-sentry-endpoint/api/1/transaction/ \
  -H "Content-Type: application/json" \
  -d '{"transaction":"test"}'
```

**Verification Steps:**

- [ ] Monitoring service connected (if configured)
- [ ] Errors are being captured (if Sentry configured)

## Phase 1 Sign-Off Checklist

```
Docker Compose Deployment:
- [ ] All containers running and healthy
- [ ] PostgreSQL initialized with schema
- [ ] Redis functional
- [ ] API health check responding
- [ ] Nginx reverse proxy working
- [ ] HTTPS certificates active and valid
- [ ] Domain configured correctly
- [ ] Firewall enabled and allowing only necessary ports
- [ ] Automatic startup configured
- [ ] Log rotation configured
- [ ] Container restart policies verified
- [ ] No critical errors in logs

Status: [ ] PASS / [ ] FAIL

If FAIL, document all issues and blockers before proceeding to Phase 2.
```

## Troubleshooting

### Container stuck in "restarting" state

```bash
# Check logs
docker-compose logs handly-api

# Restart container
docker-compose restart api

# If still failing, check if port is in use
sudo lsof -i :3001
```

### PostgreSQL won't start

```bash
# Check database files aren't corrupted
docker-compose exec postgres pg_isready -U handly

# If failed, reinitialize
docker-compose down -v  # WARNING: This deletes data!
docker-compose up -d postgres
docker-compose exec postgres psql -U handly -d handly -f /docker-entrypoint-initdb.d/init.sql
```

### Nginx can't read certificates

```bash
# Check certificate file permissions
ls -la /opt/handly/letsencrypt_data/live/$DOMAIN/

# Should be readable by all users
sudo chmod 644 /opt/handly/letsencrypt_data/live/$DOMAIN/fullchain.pem
sudo chmod 644 /opt/handly/letsencrypt_data/live/$DOMAIN/privkey.pem
```

### API can't connect to database

```bash
# Test connection manually
docker-compose exec api psql $DATABASE_URL -c "SELECT 1"

# If fails, verify DATABASE_URL is correct in .env.production
# Format: postgresql://username:password@hostname:5432/dbname
```

---

**Once Phase 1 is complete and signed off, proceed to Phase 2: Payment Validation.**
