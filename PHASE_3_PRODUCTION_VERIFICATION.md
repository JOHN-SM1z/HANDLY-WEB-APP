# Phase 3: Complete Production Verification

Comprehensive end-to-end verification in production environment. Do NOT assume anything works.

## Prerequisites

- [ ] Phase 1 & 2 complete and signed off
- [ ] Docker Compose running on production VPS
- [ ] All services healthy
- [ ] Domain accessible via HTTPS
- [ ] Backups tested

## Part A: Customer Journey (Complete Order Lifecycle)

### A1: Customer Registration & Verification

**Real browser testing required.**

1. Navigate to https://domain.uz
2. Click "Register as Customer"
3. Enter phone number
4. Receive SMS OTP (or use mock)
5. Enter OTP
6. Set password
7. Complete registration

**Verify:**
- [ ] Registration page loads without 404 or 500 errors
- [ ] Form validation working (required fields show errors)
- [ ] OTP delivery works (or mock SMS used)
- [ ] Password strength validation enforced
- [ ] Account created in database
- [ ] Can immediately log in with new credentials
- [ ] Profile shows customer details
- [ ] No console JavaScript errors
- [ ] Page load time < 3 seconds

### A2: Customer Home Page & Search

1. Log in as customer
2. Navigate to home page
3. Search for a service category
4. View available masters

**Verify:**
- [ ] Home page loads
- [ ] Services list displayed
- [ ] Search filtering works
- [ ] Masters show ratings/reviews (or placeholder)
- [ ] No N+1 database queries (check API logs)
- [ ] Response time < 2 seconds
- [ ] Pagination works if many results

### A3: Create Order

1. Click "Book a Service"
2. Select category
3. Fill form:
   - Description: "My kitchen sink is broken"
   - Location: Pick on map or enter address
   - Budget: 200,000 UZS
   - Urgency: Standard
4. Review details
5. Confirm and create

**Verify:**
- [ ] Form renders without errors
- [ ] Map picker works (if available)
- [ ] Address autocomplete works (or manual entry)
- [ ] Budget validation enforces minimum/maximum
- [ ] Form submission succeeds
- [ ] Order created with CREATED status
- [ ] Order ID returned and saved
- [ ] Order visible in customer's order history
- [ ] Database record created with correct data

### A4: Track Dispatch

1. Wait for masters to be notified
2. Master accepts order
3. Order status changes to ASSIGNED in real-time

**Verify:**
- [ ] Real-time update received (via Socket.IO or page refresh)
- [ ] Order status updated without page reload
- [ ] Master details shown
- [ ] Contact options available
- [ ] Price estimate shown
- [ ] No errors in browser console

### A5: Track Master Location (En Route)

1. Master accepts and starts traveling
2. Customer sees "Master is en route" status
3. Live GPS tracking updates (if enabled)

**Verify:**
- [ ] Status updates to EN_ROUTE
- [ ] GPS coordinates update in real-time (5-second intervals or less)
- [ ] Map shows master's location
- [ ] Distance/ETA calculated correctly
- [ ] WebSocket connection stable (no disconnects)
- [ ] Performance: battery drain acceptable on mobile

### A6: Track In Progress

1. Master arrives and starts work
2. Status changes to IN_PROGRESS
3. Customer receives notification

**Verify:**
- [ ] Status updates immediately
- [ ] Notification sent to customer app
- [ ] Work timer running (if visible)
- [ ] Customer can cancel with penalty (if before completion)

### A7: Review & Accept Completion

1. Master completes work and uploads photo/evidence
2. Status changes to COMPLETED
3. Final price shown: 180,000 UZS (within budget)
4. Customer must confirm

**Verify:**
- [ ] Completion evidence visible (photo, notes, etc.)
- [ ] Final price shown and matches master's quote
- [ ] Price within customer's budget
- [ ] Customer can request revision (if applicable)
- [ ] Customer can confirm completion
- [ ] No automatic payment without confirmation

### A8: Payment

1. Customer clicks "Confirm & Pay"
2. Payment method selection shown
3. Click payment initiated
4. Payment processed

**Verify:**
- [ ] Payment method options shown
- [ ] Click payment integration working
- [ ] Secure payment form (no JS errors)
- [ ] Payment status updates
- [ ] Order moves to CLOSED status
- [ ] Master paid and notified
- [ ] Customer receives receipt

### A9: Warranty & Support

1. Customer can file warranty claim if needed
2. Claim details submitted
3. Claim status tracked

**Verify:**
- [ ] Warranty claim form accessible
- [ ] Claim created in database
- [ ] Master and admin notified
- [ ] Claim status updates available
- [ ] Communication channel works (if applicable)

---

## Part B: Master Journey (Service Delivery)

### B1: Master Registration & Verification

1. Register as master
2. Complete profile:
   - Service category
   - Service area
   - Years of experience
   - Rate/pricing
3. Submit for verification

**Verify:**
- [ ] Registration form loads
- [ ] All required fields validated
- [ ] Service area map selector works
- [ ] Profile saved to database
- [ ] Admin can see pending verification

### B2: Master Onboarding

1. Master completes profile
2. Chooses service area(s)
3. Sets hourly rate or job-based pricing
4. Uploads ID/credentials

**Verify:**
- [ ] Profile form completes without errors
- [ ] Service area saved correctly
- [ ] Pricing rules applied
- [ ] Credentials stored securely (encrypted if applicable)
- [ ] Master can edit profile anytime

### B3: View Available Orders

1. Master logs in
2. Sees "Available Orders" or "Nearby Orders"
3. Can filter by category, distance, price

**Verify:**
- [ ] Orders list shows correct category
- [ ] Distance calculated correctly from service area
- [ ] Price range shown
- [ ] Order details sufficient to decide
- [ ] Pagination works if many orders
- [ ] No performance issues (< 2 sec load time)

### B4: Accept Order

1. Master clicks "Accept" on order
2. Order assigned to master
3. Master receives notification

**Verify:**
- [ ] Order status changes to ASSIGNED
- [ ] Master cannot accept same order twice
- [ ] Other masters see order is taken
- [ ] Master receives notification
- [ ] Order contact details available

### B5: Navigate to Location

1. Master opens order
2. Clicks "Start Navigation" or similar
3. Gets directions to customer location

**Verify:**
- [ ] Location shown on map
- [ ] Navigation app opens (if implemented)
- [ ] Address clear and correct
- [ ] Master can contact customer

### B6: Arrive & Start Work

1. Master arrives and clicks "Arrived"
2. Status changes to EN_ROUTE or IN_PROGRESS
3. GPS location captured

**Verify:**
- [ ] Status updates correctly
- [ ] GPS coordinates recorded
- [ ] Customer notified
- [ ] Work timer can start (if time-based)
- [ ] Master can log work details/notes

### B7: Complete Work

1. Master takes completion photo
2. Enters final price (95,000 UZS, within budget band)
3. Adds notes if needed
4. Submits completion

**Verify:**
- [ ] Photo upload works
- [ ] File size validated (not too large)
- [ ] Final price within allowed range
- [ ] Notes saved to database
- [ ] Status changes to COMPLETED
- [ ] Customer notified immediately

### B8: Receive Payment & Notification

1. Customer confirms payment
2. Payment processed
3. Master receives earnings notification

**Verify:**
- [ ] Master can see order is paid
- [ ] Earnings appear in master's earnings history
- [ ] Tax withholding (1%) deducted correctly
- [ ] Master's wallet/account updated
- [ ] Withdrawal/payment options available (Phase 2+)

### B9: Rating & Review

1. After payment, master can request customer review
2. Customer can rate service (1-5 stars)
3. Master's rating updated

**Verify:**
- [ ] Rating form appears after completion
- [ ] Rating stored in database
- [ ] Master's average rating updated
- [ ] Ratings visible on master's profile
- [ ] No duplicate ratings from same customer

---

## Part C: Admin Dashboard Functionality

### C1: Admin Login

1. Admin user logs in with elevated privileges
2. Sees admin dashboard

**Verify:**
- [ ] Admin login page works
- [ ] Credentials verified
- [ ] Session created
- [ ] Admin dashboard accessible
- [ ] Non-admin users blocked from dashboard

### C2: User Management

1. Admin views all users (customers, masters)
2. Can suspend/deactivate accounts
3. Can view user details

**Verify:**
- [ ] User list loads with pagination
- [ ] Search filters work
- [ ] User details accessible
- [ ] Admin actions logged
- [ ] Performance acceptable with many users

### C3: Order Management

1. Admin views all orders
2. Can manually assign orders
3. Can cancel/adjust orders
4. Can manually settle payments

**Verify:**
- [ ] Order list shows all orders
- [ ] Status filters work
- [ ] Date range filter works
- [ ] Admin can force close orders if stuck
- [ ] Actions logged with timestamps

### C4: Payment Management

1. Admin views payment transactions
2. Can manually resolve failed payments
3. Can view payment history

**Verify:**
- [ ] Payment list shows correct amounts
- [ ] Status indicators clear
- [ ] Failed payments visible
- [ ] Manual resolution tool works
- [ ] No admin can accidentally double-charge

### C5: Analytics & Reporting

1. Admin views dashboard metrics:
   - Total orders
   - Revenue
   - Active users
   - Completion rate
2. Can generate reports

**Verify:**
- [ ] Metrics load correctly
- [ ] Numbers make sense (not obviously wrong)
- [ ] Historical data available
- [ ] Reports generate without errors

### C6: Support Tickets / Disputes

1. Admin views support tickets
2. Can assign to self or team
3. Can resolve issues
4. Can issue refunds if needed

**Verify:**
- [ ] Ticket system functional
- [ ] Communication thread works
- [ ] Resolution options available
- [ ] Refund processing works

---

## Part D: Real-Time Features

### D1: Socket.IO / WebSocket Connectivity

Test from two browsers simultaneously:

1. Open browser 1: Master location
2. Open browser 2: Customer tracking order
3. Master moves (simulate GPS update)
4. Browser 2 updates in real-time (no refresh)

**Verify:**
- [ ] WebSocket connection established (check Network tab)
- [ ] No polling fallback to HTTP (indicates WebSocket failure)
- [ ] Real-time updates arrive within 1 second
- [ ] No data loss or delayed updates
- [ ] Can handle multiple concurrent connections

### D2: Notifications

Test notification delivery:

1. Create order as customer
2. Log in as master in another window
3. Accept order
4. Verify customer receives notification

**Verify:**
- [ ] In-app notification appears
- [ ] Browser notification (if enabled)
- [ ] SMS notification (if Eskiz working)
- [ ] Email notification (if configured)
- [ ] Notification shows correct details
- [ ] User can act on notification

### D3: Real-Time Order Status Updates

1. Create order
2. Master accepts
3. Watch status change real-time in customer's view

**Verify:**
- [ ] Status updates without page refresh
- [ ] No lag or delay
- [ ] Icon/visual changes match status
- [ ] Stable connection (no reconnects)

---

## Part E: System Components

### E1: Database Performance

```bash
ssh user@vps

# Check database size
docker-compose exec postgres psql -U handly -d handly \
  -c "SELECT sum(pg_total_relation_size(schemaname||'.'||tablename))::text FROM pg_tables;"

# Check slow queries (if logging enabled)
docker-compose exec postgres psql -U handly -d handly \
  -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check connection pool usage
docker-compose exec postgres psql -U handly -d handly \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

**Verify:**
- [ ] Database size reasonable (< 500GB for startup)
- [ ] No runaway queries
- [ ] Connection count within limits
- [ ] Query times acceptable (< 1 second for most)

### E2: Redis Cache

```bash
# Check Redis connection
docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Check memory usage
docker-compose exec redis redis-cli -a $REDIS_PASSWORD info memory

# Check hit/miss ratio
docker-compose exec redis redis-cli -a $REDIS_PASSWORD info stats
```

**Verify:**
- [ ] Redis responding
- [ ] Memory usage reasonable
- [ ] Cache hit ratio > 50% (if caching working)
- [ ] No memory errors

### E3: API Performance

From browser or curl:

```bash
# Measure API response times
time curl https://domain.uz/api/orders

# Check for N+1 queries or excessive load
curl -H "X-Debug: true" https://domain.uz/api/orders  # if debug header supported
```

**Verify:**
- [ ] API response time < 500ms for simple queries
- [ ] No obvious N+1 queries
- [ ] Caching working efficiently
- [ ] Rate limiting not blocking legitimate traffic

### E4: Background Jobs

Check if recurring tasks execute properly:

```bash
# Check background job queue (if BullMQ)
docker-compose exec api npm run jobs:status  # or similar

# Check cron jobs
crontab -l
```

**Verify:**
- [ ] Background jobs executing on schedule
- [ ] No stuck jobs
- [ ] Error handling working
- [ ] Retry logic functioning

### E5: File Uploads

Test media upload:

1. As master, complete an order and upload completion photo
2. Photo appears in customer's order view
3. Photo is accessible via API

```bash
# Check upload directory
docker-compose exec api ls -lah /uploads/

# Verify file permissions
docker-compose exec api stat /uploads/order_*.jpg
```

**Verify:**
- [ ] Files uploaded successfully
- [ ] File size limits enforced
- [ ] File type validation working
- [ ] Permissions allow reading
- [ ] Files accessible via API

### E6: Backup & Restore Procedures

```bash
# Verify backup script runs
/opt/handly/infra/scripts/backup.sh

# Check backup files exist
ls -lah /backups/

# Test restore (non-destructively)
docker-compose exec postgres psql -U handly -d handly -c \
  "BEGIN; -- test transaction won't commit"

# Verify backups are recent (< 24 hours old)
find /backups -type f -mtime -1
```

**Verify:**
- [ ] Backup script runs without errors
- [ ] Backup files exist and have recent timestamps
- [ ] Backup size reasonable (not 0 or huge)
- [ ] Restore procedure documented and tested

---

## Part F: Security Verification

### F1: HTTPS / TLS

```bash
# Check certificate validity
openssl s_client -connect domain.uz:443 -tls1_2

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/domain.uz/fullchain.pem -text -noout | grep -A 2 "Not After"
```

**Verify:**
- [ ] Certificate valid and not expired
- [ ] Certificate matches domain
- [ ] TLS 1.2 or 1.3 enforced
- [ ] No weak ciphers
- [ ] HSTS header present

### F2: Authentication & Sessions

1. Log in as customer
2. Open developer console (Network tab)
3. Check for JWT token or session cookie
4. Verify token in localStorage/cookie

**Verify:**
- [ ] JWT token present and correctly formatted
- [ ] Token contains correct user ID
- [ ] Token has expiry set
- [ ] SessionCookie httpOnly flag set (if using cookies)
- [ ] CSRF token present if needed

### F3: Password Security

1. During registration, test password validation:
   - Too short (< 8 chars) - rejected
   - No special characters - accepted or optional
   - Common passwords - may be rejected
2. Password stored hashed in database (not plain text)

```bash
# Check password hash in database
docker-compose exec postgres psql -U handly -d handly \
  -c "SELECT phone, password FROM users LIMIT 1;" | head -1
```

**Verify:**
- [ ] Password hashed (not plaintext)
- [ ] Hash appears to be bcrypt or similar (starts with $2a$ or $2b$)
- [ ] Validation rules enforced

### F4: SQL Injection Prevention

Try injecting SQL in search/filter fields:

1. Search for masters: `" OR "1"="1`
2. Filter by category: `'; DROP TABLE orders; --`

**Verify:**
- [ ] No SQL errors returned
- [ ] Input treated as literal string
- [ ] Database unaffected
- [ ] Parameterized queries confirmed in code

### F5: XSS Prevention

Try injecting JavaScript:

1. In order description: `<script>alert('XSS')</script>`
2. In master review: `<img src=x onerror=alert('XSS')>`

**Verify:**
- [ ] No JavaScript alert appears
- [ ] Input stored safely
- [ ] Output properly escaped in HTML
- [ ] No XSS vulnerabilities

### F6: CSRF Protection

Check for CSRF tokens:

```bash
# View page source for CSRF token
curl https://domain.uz/api/orders | grep -i csrf
```

**Verify:**
- [ ] CSRF tokens present in forms (if using cookies for auth)
- [ ] Tokens unique per session/request
- [ ] Server validates tokens
- [ ] POST/PUT/DELETE require valid token

---

## Part G: Mobile Responsiveness

Using browser developer tools:

1. Set viewport to iPhone 12 (390x844)
2. Test customer journey
3. Test master journey

**Verify:**
- [ ] All pages render without horizontal scrolling
- [ ] Touch targets are >= 44x44px
- [ ] Forms are easy to fill on mobile
- [ ] Maps are usable on mobile
- [ ] No layout broken
- [ ] Performance acceptable on slow 3G

---

## Part H: Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Verify:**
- [ ] App works on all modern browsers
- [ ] No console errors
- [ ] Features work consistently
- [ ] Styling renders correctly
- [ ] Storage (localStorage) works

---

## Part I: Error Handling & Edge Cases

### I1: Network Failures

1. Start placing an order
2. Turn off network while form submitting
3. Resume network

**Verify:**
- [ ] Error message appears (not blank screen)
- [ ] User can retry
- [ ] No duplicate data created
- [ ] State consistent

### I2: Service Unavailability

1. Stop API container
2. Try to access app
3. Restart API

**Verify:**
- [ ] User sees "Service unavailable" message
- [ ] Retries work once service restored
- [ ] No data corruption

### I3: Database Failure

1. Stop PostgreSQL container
2. Try to perform any operation
3. Restart PostgreSQL

**Verify:**
- [ ] Appropriate error message shown
- [ ] No crash or 500 errors
- [ ] Recovery works when service restored

### I4: Payment Timeout

Simulate slow payment processing:

1. Initiate payment
2. Simulate 30 second response time
3. Order should not be charged twice

**Verify:**
- [ ] Payment completes eventually
- [ ] No duplicate charges
- [ ] Order status correct

---

## Phase 3 Sign-Off Checklist

```
Production Verification Complete:

Customer Journey:
- [ ] Registration works
- [ ] Service search works
- [ ] Order creation works
- [ ] Real-time tracking works
- [ ] Payment works
- [ ] Order completion works
- [ ] No console errors
- [ ] No database errors
- [ ] Responsive design works

Master Journey:
- [ ] Registration works
- [ ] Profile setup works
- [ ] Order acceptance works
- [ ] Location updates work
- [ ] Completion works
- [ ] Payment received works

Admin:
- [ ] Dashboard accessible
- [ ] User management works
- [ ] Order management works
- [ ] Payment management works
- [ ] Analytics visible

Real-Time:
- [ ] WebSocket connected
- [ ] Notifications received
- [ ] Status updates real-time
- [ ] No connection drops

System:
- [ ] Database responsive
- [ ] Redis caching working
- [ ] API performance acceptable
- [ ] Backups tested
- [ ] No security vulnerabilities
- [ ] HTTPS active
- [ ] Error handling graceful

Status: [ ] PASS / [ ] FAIL

List all critical issues found:
1. 
2.
3.

List all non-critical issues to fix in Phase 4:
1.
2.
3.
```

---

**Once Phase 3 is complete and signed off, proceed to Phase 4: Private Beta Readiness.**
