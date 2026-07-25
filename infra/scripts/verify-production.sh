#!/bin/bash
# Production verification script for Handly
# Runs comprehensive checks on deployed system

set -euo pipefail

DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-/opt/handly/docker-compose.prod.yml}"
cd "$(dirname "$DOCKER_COMPOSE_FILE")" || exit 1

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
    local name=$1
    local result=$2
    
    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $name"
        ((CHECKS_FAILED++))
    fi
}

echo "=== Handly Production Verification ==="
echo

# 1. Container Status
echo "1. Docker Containers"
docker-compose -f "$DOCKER_COMPOSE_FILE" ps | tail -n +2 | while read -r line; do
    if echo "$line" | grep -q "healthy"; then
        echo -e "  ${GREEN}✓${NC} $(echo "$line" | awk '{print $1}') (healthy)"
        ((CHECKS_PASSED++))
    elif echo "$line" | grep -q "Up"; then
        echo -e "  ${YELLOW}?${NC} $(echo "$line" | awk '{print $1}') (up but not healthy yet)"
    else
        echo -e "  ${RED}✗${NC} $(echo "$line" | awk '{print $1}') (not running)"
        ((CHECKS_FAILED++))
    fi
done || true

echo

# 2. API Health
echo "2. API Endpoint"
if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
    check "API health check" 0
else
    check "API health check" 1
fi

# 3. HTTPS
echo "3. HTTPS and Certificates"
if curl -sI https://handly.uz 2>/dev/null | grep -q "200\|301\|302"; then
    check "HTTPS connection" 0
else
    check "HTTPS connection" 1
fi

if docker-compose -f "$DOCKER_COMPOSE_FILE" exec nginx certbot certificates 2>/dev/null | grep -q "Valid"; then
    check "SSL certificate valid" 0
else
    check "SSL certificate valid" 1
fi

echo

# 4. Database
echo "4. Database"
if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U handly_prod >/dev/null 2>&1; then
    check "PostgreSQL connectivity" 0
else
    check "PostgreSQL connectivity" 1
fi

DB_SIZE=$(docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U handly_prod -c "SELECT pg_size_pretty(pg_database_size('handly_prod'));" 2>/dev/null | tail -1 | xargs)
echo "  Database size: $DB_SIZE"

echo

# 5. Redis
echo "5. Redis"
if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    check "Redis connectivity" 0
else
    check "Redis connectivity" 1
fi

echo

# 6. Backups
echo "6. Backups"
LATEST_BACKUP=$(find ./backups -name "handly-*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_BACKUP" ]; then
    AGE=$(($(date +%s) - $(stat -f%m "$LATEST_BACKUP" 2>/dev/null || stat -c%Y "$LATEST_BACKUP")))
    if [ "$AGE" -lt 86400 ]; then
        check "Recent backup (< 24 hours)" 0
        echo "  Latest: $(basename "$LATEST_BACKUP") ($(du -h "$LATEST_BACKUP" | cut -f1))"
    else
        check "Recent backup (< 24 hours)" 1
    fi
else
    check "Backup exists" 1
fi

echo

# 7. Environment
echo "7. Environment Configuration"
if [ -f ".env.production" ]; then
    check ".env.production exists" 0
    if grep -q "CLICK_MERCHANT_ID=" .env.production; then
        if grep "CLICK_MERCHANT_ID=" .env.production | grep -qv "CLICK_MERCHANT_ID=$"; then
            check "Click credentials set" 0
        else
            check "Click credentials set" 1
        fi
    fi
else
    check ".env.production exists" 1
fi

echo

# 8. Logs
echo "8. Recent Logs (errors)"
ERROR_COUNT=$(docker-compose -f "$DOCKER_COMPOSE_FILE" logs --since 1h 2>/dev/null | grep -i "error\|fatal\|panic" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    check "No errors in last hour" 0
else
    check "No errors in last hour" 1
    echo "  Found $ERROR_COUNT error(s)"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs --since 1h 2>/dev/null | grep -i "error\|fatal\|panic" | head -5 | sed 's/^/    /'
fi

echo

# 9. Security
echo "9. Security"
if sudo ufw status | grep -q "Status: active"; then
    check "Firewall active" 0
else
    check "Firewall active" 1
fi

if [ -f ".env.production" ]; then
    if [ "$(stat -f%OLp .env.production 2>/dev/null || stat -c%a .env.production)" = "600" ]; then
        check ".env.production permissions (600)" 0
    else
        check ".env.production permissions (600)" 1
    fi
fi

echo

# 10. Performance
echo "10. Performance"
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000 || echo "error")
if [ "$RESPONSE_TIME" != "error" ]; then
    check "Frontend response time" 0
    echo "  Response: ${RESPONSE_TIME}s"
else
    check "Frontend response time" 1
fi

echo

# Summary
echo "=== Summary ==="
TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}/$TOTAL"
if [ "$CHECKS_FAILED" -gt 0 ]; then
    echo -e "Failed: ${RED}$CHECKS_FAILED${NC}/$TOTAL"
    exit 1
else
    echo "All checks passed!"
    exit 0
fi
