# Phase 2: Payment Validation

Verification of payment processing with real Click integration.

## Prerequisites

- [ ] Phase 1 deployment verification complete and signed off
- [ ] Docker Compose stack running on production VPS
- [ ] All services healthy (API, database, Redis, Nginx)
- [ ] Credentials available: CLICK_MERCHANT_ID, CLICK_MERCHANT_SECRET_KEY
- [ ] OR decision made to defer payment until after beta (skip to verification only mode)

## Option A: Real Payment Integration (if Click credentials available)

### Step 1: Verify Click Credentials Configuration

```bash
ssh user@vps

# Check environment variables are set
grep CLICK /opt/handly/.env.production

# Verify they're loaded in container
docker-compose -f /opt/handly/docker-compose.prod.yml exec api \
  sh -c 'echo PAYMENT_PROVIDER=$PAYMENT_PROVIDER && echo CLICK_MERCHANT_ID=${CLICK_MERCHANT_ID:0:5}...'
```

**Verification:**
- [ ] PAYMENT_PROVIDER=click (not "mock")
- [ ] CLICK_MERCHANT_ID is present and non-empty
- [ ] CLICK_MERCHANT_SECRET_KEY is present and non-empty

### Step 2: Test Payment Provider Abstraction

```bash
# SSH into API container
docker-compose exec api sh

# Run provider tests
npm test -- --testPathPattern=click

# Exit container
exit
```

**Verification:**
- [ ] 7/7 Click provider unit tests pass
- [ ] Signature verification tests pass
- [ ] No security warnings
- [ ] No timeout issues

### Step 3: Create Test Master Account

Using the web application:

1. Navigate to https://api.handly.uz
2. Click "Register as Master"
3. Fill in form:
   - Name: "Test Master"
   - Phone: "+998 91 123 4567" (or any valid number)
   - Service category: Pick any (e.g., "Plumbing")
4. Set password
5. Complete verification (can use mock SMS)

**Verification:**
- [ ] Account created successfully
- [ ] Can log in with credentials
- [ ] Master profile accessible
- [ ] Service area displayed

### Step 4: Create Test Customer Account

1. Click "Register as Customer"
2. Fill in form:
   - Name: "Test Customer"
   - Phone: "+998 90 987 6543"
3. Set password
4. Skip verification (can do later)

**Verification:**
- [ ] Account created successfully
- [ ] Can log in with credentials
- [ ] Customer profile accessible

### Step 5: Create Test Order (Customer)

As customer:

1. Navigate to home page
2. Click "Book a Service"
3. Select service category (same as master's category)
4. Fill in details:
   - Description: "Test kitchen repair"
   - Location: Pick on map or enter address
   - Budget: 100,000 UZS
5. Submit order

**Verification:**
- [ ] Order created with status CREATED
- [ ] Order ID appears in history
- [ ] Order visible in API logs

### Step 6: Accept Order (Master)

As master:

1. Log in to app
2. Check "Offers" or "Available Orders"
3. Find test customer's order
4. Click "Accept"

**Verification:**
- [ ] Order status changes to ASSIGNED
- [ ] Master sees order in "Active Orders"
- [ ] Estimated price calculated
- [ ] Real-time notification received (if WebSocket working)

### Step 7: Start Work (Master)

As master:

1. Open assigned order
2. Click "En Route" or similar
3. Confirm location

**Verification:**
- [ ] Order status changes to EN_ROUTE
- [ ] GPS location updated if available
- [ ] Customer sees real-time tracking

### Step 8: Complete Order (Master)

As master:

1. Click "Job Complete"
2. Enter final price: 95,000 UZS (within budget)
3. Optionally upload completion photo
4. Submit

**Verification:**
- [ ] Order status changes to COMPLETED
- [ ] Final price shown to customer
- [ ] Completion evidence visible
- [ ] Ready for payment

### Step 9: Initiate Payment (Customer)

As customer:

1. View completed order
2. Click "Confirm & Pay"
3. Review price: 95,000 UZS
4. Click "Proceed to Payment"

**Verification:**
- [ ] Payment screen appears
- [ ] Amount correctly shown
- [ ] No errors in API logs
- [ ] Order status changes to PROCESSING

### Step 10: Verify Click Payment Flow

**Option A: Mock Payment (for testing)**

If credentials unavailable, use mock provider:

```bash
# In .env.production, set:
# PAYMENT_PROVIDER=mock

# This will simulate payment instantly
```

**Option B: Real Click Payment (with credentials)**

If credentials available:

1. On payment screen, click "Pay via Click"
2. You may be redirected to Click's payment page
3. Complete payment (may be test payment if using Click sandbox)
4. Return to app

**Verification:**
- [ ] Payment initiated without errors
- [ ] API logs show no payment errors
- [ ] No database connection issues
- [ ] Payment webhook endpoint accessible at /payments/webhook

### Step 11: Verify Payment Settlement

After payment attempt (success or failure):

```bash
# SSH into VPS
ssh user@vps

# Check payment record in database
docker-compose exec postgres psql -U handly -d handly -c \
  "SELECT id, status, amount, provider_ref FROM payments ORDER BY created_at DESC LIMIT 1;"

# Check order status
docker-compose exec postgres psql -U handly -d handly -c \
  "SELECT id, status FROM orders ORDER BY created_at DESC LIMIT 1;"
```

**Verification:**
- [ ] Payment record exists in database
- [ ] Payment status is appropriate (SUCCEEDED or FAILED, not PROCESSING)
- [ ] Provider reference ID recorded (for Click integration)
- [ ] Order status updated to CLOSED (if payment succeeded)

### Step 12: Verify Master Earnings

```bash
# Check master earnings
docker-compose exec postgres psql -U handly -d handly -c \
  "SELECT id, master_id, type, amount FROM ledger_entries \
   WHERE master_id = (SELECT id FROM users WHERE name='Test Master') \
   ORDER BY created_at DESC LIMIT 5;"
```

**Verification:**
- [ ] ORDER_EARNING entry exists (paid amount to master)
- [ ] TAX_WITHHOLD entry exists (1% tax deducted)
- [ ] Correct amounts calculated
- [ ] Warranty period set (if applicable)

### Step 13: Test Payment Webhook (if Click provider)

If using real Click credentials:

```bash
# Simulate webhook from Click
curl -X POST https://api.handly.uz/payments/webhook \
  -H "X-Click-Signature: HMAC-SHA256=test" \
  -H "Content-Type: application/json" \
  -d '{
    "providerRef": "test-transaction-id",
    "success": true,
    "failureReason": null
  }'

# Expected: 200 OK with {"received": true}
```

**Verification:**
- [ ] Webhook endpoint returns 200 OK
- [ ] Invalid signature rejected with 401
- [ ] Valid signature accepted
- [ ] Payment idempotency: calling twice doesn't double-charge

### Step 14: Test Failed Payment Recovery

Create another order and simulate payment failure:

1. Create order as before (Steps 5-8)
2. On payment page, simulate failure or use mock to fail
3. Check database: payment should be FAILED
4. Order should remain in COMPLETED state (not CLOSED)
5. Customer can retry payment

**Verification:**
- [ ] Failed payment recorded
- [ ] Master not paid yet
- [ ] Order can be retried
- [ ] No data corruption or orphaned records

### Step 15: Verify Webhook Signature Verification

Test that Click webhook signatures are properly validated:

```bash
# Valid signature test
BODY='{"providerRef":"123","success":true}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$CLICK_SECRET" | cut -d' ' -f2)

curl -X POST https://api.handly.uz/payments/webhook \
  -H "X-Click-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d "$BODY"

# Should return 200 OK

# Invalid signature test
curl -X POST https://api.handly.uz/payments/webhook \
  -H "X-Click-Signature: invalid" \
  -H "Content-Type: application/json" \
  -d "$BODY"

# Should return 401 Unauthorized
```

**Verification:**
- [ ] Valid signatures accepted
- [ ] Invalid signatures rejected
- [ ] Signature verification constant-time (no timing attacks)
- [ ] Malformed signatures rejected

## Option B: Verify Payment Abstraction Only (if no Click credentials)

If Click credentials are not yet available, verify the abstraction is ready:

### Abstraction Verification

```bash
# Check that payment provider interface exists
docker-compose exec api npm list | grep -i payment

# Verify mock provider works
docker-compose exec api npm test -- --testPathPattern=mock-payment

# Verify Click provider code exists
docker-compose exec api ls -la src/infra/payment/click-payment.provider.ts

# Verify environment configuration supports Click
docker-compose exec api grep -r "PAYMENT_PROVIDER" src/
```

**Verification:**
- [ ] Mock provider fully functional and tested
- [ ] Click provider code exists and is complete
- [ ] Environment variables configured for Click
- [ ] Provider factory pattern implemented correctly
- [ ] Zero impact on PaymentsService callers

### Documentation Verification

- [ ] Click integration documented in CLAUDE.md
- [ ] Environment variables documented in .env.production.template
- [ ] Webhook endpoint documented in ARCHITECTURE.md
- [ ] Clear instructions provided for enabling Click when credentials available

**Verification:**
- [ ] All integration details documented
- [ ] No ambiguity about which credentials are needed
- [ ] Clear statement: "Ready for Click credentials at any time without code changes"

---

## Phase 2 Sign-Off Checklist

```
Payment Integration:
- [ ] Provider configured (Click or Mock as appropriate)
- [ ] No errors in API logs
- [ ] Database updates correctly after payments
- [ ] Master earnings calculated correctly
- [ ] Tax withholding applied (1%)
- [ ] Warranty period set correctly
- [ ] Webhook signature verification working (if Click)
- [ ] Idempotent payment processing (if Click)
- [ ] Failed payment recovery working
- [ ] Order status transitions correct
- [ ] No orphaned payment records
- [ ] Settlement complete and verified

Status: [ ] PASS / [ ] FAIL

If FAIL, document blockers. If payment credentials unavailable, document exactly
what's needed and confirm Click provider is ready for immediate activation.
```

---

**Once Phase 2 is complete and signed off, proceed to Phase 3: Production Verification.**
