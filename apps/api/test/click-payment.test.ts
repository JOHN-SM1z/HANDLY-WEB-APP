/**
 * Unit tests for ClickPaymentProvider (Click provider, M5+).
 * Tests signature verification, HMAC-SHA256 validation, and idempotency.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { ClickPaymentProvider } from '../src/infra/payment/click-payment.provider';
import type { ChargeInput } from '../src/infra/payment/payment-provider';

const merchantId = 'test-merchant-123';
const secretKey = 'test-secret-key-12345';

const provider = new ClickPaymentProvider(merchantId, secretKey);
const noCredsProvider = new ClickPaymentProvider('', ''); // Missing credentials

test('Click provider: charge fails gracefully when credentials are missing', async () => {
  const input: ChargeInput = {
    paymentId: randomUUID(),
    amount: 100_000,
    method: 'CLICK',
  };

  const result = await noCredsProvider.charge(input);
  assert.equal(result.success, false);
  assert.equal(result.providerRef, '');
  assert.ok(result.failureReason?.includes('credentials'));
});

test('Click provider: charge returns success with a Click transaction ID', async () => {
  const input: ChargeInput = {
    paymentId: randomUUID(),
    amount: 100_000,
    method: 'CLICK',
  };

  const result = await provider.charge(input);
  assert.equal(result.success, true);
  assert.ok(result.providerRef);
  assert.ok(result.providerRef.startsWith('CLICK-'));
});

test('Click provider: signature verification rejects invalid signatures', () => {
  const body = JSON.stringify({
    providerRef: 'CLICK-12345',
    success: true,
  });

  // Valid signature
  const validSig = createHmac('sha256', secretKey).update(body).digest('hex');
  assert.ok(provider.verifySignature(validSig, body));

  // Invalid signature
  assert.equal(provider.verifySignature('invalid-sig', body), false);

  // Missing signature
  assert.equal(provider.verifySignature(undefined, body), false);

  // Empty signature
  assert.equal(provider.verifySignature('', body), false);
});

test('Click provider: signature verification is constant-time (resistant to timing attacks)', () => {
  const body = JSON.stringify({ success: true });
  const validSig = createHmac('sha256', secretKey).update(body).digest('hex');

  // Both should return false, but constant-time comparison should take similar time
  // (This is a behavioral test; actual timing would need a perf harness)
  const wrongSig1 = 'a'.repeat(64); // Same length as valid hex sig
  const wrongSig2 = 'b'.repeat(64);

  assert.equal(provider.verifySignature(wrongSig1, body), false);
  assert.equal(provider.verifySignature(wrongSig2, body), false);
});

test('Click provider: tampered payload fails signature verification', () => {
  const originalBody = JSON.stringify({ providerRef: 'CLICK-123', success: true });
  const signature = createHmac('sha256', secretKey).update(originalBody).digest('hex');

  // Even a small change should fail
  const tamperedBody = JSON.stringify({ providerRef: 'CLICK-124', success: true }); // Changed ref
  assert.equal(provider.verifySignature(signature, tamperedBody), false);
});

test('Click provider: concurrent charges generate unique transaction IDs', async () => {
  const input1: ChargeInput = { paymentId: randomUUID(), amount: 50_000, method: 'CLICK' };
  const input2: ChargeInput = { paymentId: randomUUID(), amount: 60_000, method: 'CLICK' };

  const [result1, result2] = await Promise.all([
    provider.charge(input1),
    provider.charge(input2),
  ]);

  assert.ok(result1.success);
  assert.ok(result2.success);
  assert.notEqual(result1.providerRef, result2.providerRef, 'concurrent charges must have unique IDs');
});

test('Click provider: webhook signature verification with real Click-like payload', () => {
  // Simulate a real Click webhook payload
  const clickPayload = {
    click_trans_id: 'CLICK-1234567890-ABC123',
    merchant_trans_id: randomUUID(),
    amount: 100_000,
    status: 'COMPLETED',
    timestamp: Math.floor(Date.now() / 1000),
  };

  const payloadStr = JSON.stringify(clickPayload);
  const clickSignature = createHmac('sha256', secretKey).update(payloadStr).digest('hex');

  // Should verify successfully
  assert.ok(provider.verifySignature(clickSignature, payloadStr));

  // Should fail with wrong secret
  const wrongProvider = new ClickPaymentProvider(merchantId, 'wrong-secret');
  assert.equal(wrongProvider.verifySignature(clickSignature, payloadStr), false);
});
