## Production Deployment Guide — Single VPS

This guide covers deploying Handly marketplace on a single VPS with Docker Compose, Nginx, SSL, automated backups, and monitoring.

**Target**: Ubuntu 22.04 LTS or newer, 4+ CPU, 8GB+ RAM, 100GB SSD

---

## Prerequisites

### 1. DNS Setup

Point your domain to the VPS IP:
```
handly.uz A 1.2.3.4  # Your VPS IP
```

Allow 24 hours for propagation.

### 2. VPS Preparation

```bash
# SSH into VPS
ssh root@1.2.3.4

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
  docker.io \
  docker-compose \
  git \
  curl \
  wget \
  unzip \
  postgresql-client \
  redis-tools \
  certbot \
  python3-certbot-nginx

# Add user to docker group
sudo usermod -aG docker $USER

# Restart docker
sudo systemctl restart docker
```

### 3. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/JOHN-SM1z/HANDLY-WEB-APP.git handly
sudo chown -R $USER:$USER /opt/handly
cd /opt/handly
```

---

## Environment Configuration

### 1. Create `.env.production`

```bash
cd /opt/handly

cat > .env.production << 'EOF'
# Core
NODE_ENV=production
LOG_LEVEL=info
DOMAIN=handly.uz

# Database
DB_USER=handly_prod
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME=handly_prod

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32)

# Click Payment
PAYMENT_PROVIDER=click
CLICK_MERCHANT_ID=YOUR_CLICK_MERCHANT_ID
CLICK_MERCHANT_SECRET_KEY=YOUR_CLICK_SECRET_KEY
CLICK_API_BASE=https://api.click.uz/api/merchant

# SMS (Eskiz)
SMS_PROVIDER=eskiz
ESKIZ_API_BASE=https://notify.eskiz.uz/api
ESKIZ_API_KEY=YOUR_ESKIZ_API_KEY
ESKIZ_FROM_NUMBER=4546

# Auth
JWT_SECRET=$(openssl rand -base64 64)
JWT_EXPIRY=7d

# CORS
CORS_ORIGIN=https://handly.uz

# Monitoring
SENTRY_DSN=YOUR_SENTRY_DSN

# Feature flags
FEATURE_GPS_TRACKING=true
FEATURE_WARRANTY=true

# Next.js
NEXT_PUBLIC_API_BASE=https://api.handly.uz
NEXT_PUBLIC_APP_NAME=Handly
EOF

# Secure permissions
chmod 600 .env.production
```

### 2. Verify Environment Variables

```bash
source .env.production

# Check required secrets are set
echo "CLICK_MERCHANT_ID: $CLICK_MERCHANT_ID"
echo "CLICK_MERCHANT_SECRET_KEY: ${CLICK_MERCHANT_SECRET_KEY:0:10}***"
echo "JWT_SECRET: ${JWT_SECRET:0:10}***"
```

---

## SSL Certificate Setup

### 1. Initial Certificate (Let's Encrypt)

```bash
# Create Nginx config without SSL first
sudo mkdir -p /etc/nginx/conf.d

# Create temporary config
cat > /tmp/nginx-certbot.conf << 'EOF'
server {
    listen 80;
    server_name handly.uz;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
EOF

# Start Nginx for certificate validation
sudo docker run --rm -d \
  -p 80:80 \
  -v /var/www/certbot:/var/www/certbot:rw \
  -v /tmp/nginx-certbot.conf:/etc/nginx/conf.d/default.conf:ro \
  --name nginx-certbot \
  nginx:alpine

# Request certificate
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d handly.uz \
  --email admin@handly.uz \
  --agree-tos \
  --non-interactive

# Stop temporary Nginx
sudo docker stop nginx-certbot

# Verify certificate
sudo ls -la /etc/letsencrypt/live/handly.uz/
```

### 2. Automatic Certificate Renewal

```bash
# Create renewal timer
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

---

## Docker Compose Deployment

### 1. Build and Start Services

```bash
cd /opt/handly

# Load environment
source .env.production

# Build custom images (API and web)
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify containers are running
docker-compose -f docker-compose.prod.yml ps
```

### 2. Initialize Database

```bash
# Run Prisma migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Seed initial data (optional admin user, categories, etc.)
docker-compose -f docker-compose.prod.yml exec api npx prisma db seed
```

### 3. Health Checks

```bash
# Check API health
curl http://localhost:3001/health

# Check web health
curl http://localhost:3000

# Check Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD ping

# Check PostgreSQL
docker-compose -f docker-compose.prod.yml exec postgres psql -U $DB_USER -d $DB_NAME -c "SELECT 1"
```

---

## Nginx Configuration

### 1. Update Domain in Nginx Config

The Docker Compose automatically substitutes `${DOMAIN}` from your `.env.production`.

### 2. Verify SSL Configuration

```bash
# Test SSL certificate
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload Nginx (if changes were made)
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 3. Verify HTTPS

```bash
# Test from your machine
curl -I https://handly.uz

# Should return 200 OK with HSTS header
```

---

## Automated Backups

### 1. Create Backup Script

```bash
sudo mkdir -p /opt/handly/backups

cat > /opt/handly/infra/backup.sh << 'EOF'
#!/bin/bash

set -e

BACKUP_DIR="/opt/handly/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/handly_db_$DATE.sql.gz"

cd /opt/handly

# Load environment
source .env.production

# Backup PostgreSQL
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"

# Backup Redis
docker-compose -f docker-compose.prod.yml exec -T redis redis-cli -a $REDIS_PASSWORD --rdb /tmp/dump.rdb
docker-compose -f docker-compose.prod.yml cp redis:/tmp/dump.rdb "$BACKUP_DIR/handly_redis_$DATE.rdb"

# Keep only last 30 days
find $BACKUP_DIR -name "handly_db_*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "handly_redis_*.rdb" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /opt/handly/infra/backup.sh

# Test backup
/opt/handly/infra/backup.sh
```

### 2. Schedule Daily Backups

```bash
# Add to crontab
sudo crontab -e

# Add this line:
# 2 3 * * * /opt/handly/infra/backup.sh >> /var/log/handly-backup.log 2>&1
```

---

## Monitoring & Logging

### 1. Container Logs

```bash
# Follow API logs
docker-compose -f docker-compose.prod.yml logs -f api

# View errors only
docker logs handly-api | grep -i error

# Export logs to file
docker-compose -f docker-compose.prod.yml logs api > /tmp/api-logs.txt
```

### 2. System Monitoring

```bash
# Check disk usage
df -h /

# Check memory
free -h

# Check container resource usage
docker stats

# Check Nginx stats
curl http://localhost/nginx_status
```

### 3. Sentry Integration (Optional)

If `SENTRY_DSN` is set in `.env.production`, all errors are automatically tracked in Sentry:
- Visit https://sentry.io/organizations/your-org/
- Create a project for Handly
- Set `SENTRY_DSN` in environment
- Restart API container

---

## Maintenance

### 1. Regular Health Checks

```bash
# Create monitoring script
cat > /opt/handly/infra/health-check.sh << 'EOF'
#!/bin/bash

# Check all services
services=("api" "web" "postgres" "redis" "nginx")

for service in "${services[@]}"; do
  status=$(docker-compose -f docker-compose.prod.yml ps | grep $service | awk '{print $NF}')
  if [ "$status" != "Up" ]; then
    echo "ALERT: $service is not running"
  fi
done

# Check disk space
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
  echo "ALERT: Disk usage is above 80%"
fi

# Check database connection
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U handly_prod -d handly_prod -c "SELECT 1" > /dev/null 2>&1 || echo "ALERT: Database connection failed"
EOF

chmod +x /opt/handly/infra/health-check.sh

# Run daily
sudo crontab -e
# Add: 0 12 * * * /opt/handly/infra/health-check.sh >> /var/log/handly-health.log 2>&1
```

### 2. Updating Application

```bash
cd /opt/handly

# Pull latest code
git pull origin main

# Rebuild containers
docker-compose -f docker-compose.prod.yml build

# Stop current containers
docker-compose -f docker-compose.prod.yml down

# Start updated containers
docker-compose -f docker-compose.prod.yml up -d

# Run migrations (if any)
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Verify health
curl -I https://handly.uz
```

### 3. Database Maintenance

```bash
# Analyze query performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U handly_prod -d handly_prod << 'EOF'
ANALYZE;
REINDEX DATABASE handly_prod;
VACUUM FULL;
EOF

# Check database size
docker-compose -f docker-compose.prod.yml exec postgres psql -U handly_prod -d handly_prod -c "SELECT pg_size_pretty(pg_database_size('handly_prod'))"
```

---

## Troubleshooting

### Container Fails to Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Common issues:
# - Database not ready: Wait 10 seconds and retry
# - Port already in use: Check `sudo netstat -tulpn | grep 3001`
# - Env vars missing: Verify `.env.production` is sourced
```

### Payment Webhook Not Receiving

```bash
# Verify webhook URL is accessible
curl -v https://handly.uz/payments/webhook

# Check Nginx is forwarding headers correctly
docker-compose -f docker-compose.prod.yml exec nginx nginx -T

# Check API logs for webhook errors
docker-compose -f docker-compose.prod.yml logs api | grep webhook
```

### SSL Certificate Errors

```bash
# Verify certificate is valid
sudo openssl x509 -in /etc/letsencrypt/live/handly.uz/fullchain.pem -text -noout

# Check certificate expiry
sudo certbot certificates

# Manual renewal (if auto-renewal fails)
sudo certbot renew --force-renewal
```

---

## Post-Launch Checklist

- [ ] Domain points to VPS IP
- [ ] SSL certificate installed and auto-renewal working
- [ ] All containers running and healthy
- [ ] Database backups running on schedule
- [ ] Payment provider (Click) credentials configured
- [ ] Email/SMS sending working (test with admin panel)
- [ ] Monitoring/alerts configured (Sentry, health checks)
- [ ] Access logs being collected
- [ ] Admin 2FA enabled
- [ ] First test transaction completed successfully

---

## Disaster Recovery

### 1. Restore from Backup

```bash
cd /opt/handly
source .env.production

# Stop application
docker-compose -f docker-compose.prod.yml down

# Restore database
gunzip -c backups/handly_db_20240725_030000.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U $DB_USER $DB_NAME

# Restore Redis
docker-compose -f docker-compose.prod.yml cp backups/handly_redis_20240725_030000.rdb redis:/tmp/dump.rdb
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD BGREWRITEAOF

# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Failover Strategy

For single VPS:
1. Keep automated backups (AWS S3, B2, etc.)
2. Document all configuration in `.env.production`
3. Maintain git repository with all changes
4. Consider secondary VPS for hot standby (future)

---

## Support & Documentation

- **Runbooks**: See `docs/runbooks/`
- **Architecture**: See `docs/ARCHITECTURE.md`
- **Monitoring**: Sentry dashboard + container logs
- **Backups**: `/opt/handly/backups/` (keep synced to external storage)

---

**Deployment completed successfully. Application is now live at https://handly.uz**
