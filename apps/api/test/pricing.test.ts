import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeQuote } from '../src/modules/orders/pricing';

test('SCHEDULED + MEDIUM applies no multiplier and no platform fee', () => {
  const q = computeQuote({ min: 80_000, max: 160_000 }, 'MEDIUM', 'SCHEDULED');
  assert.equal(q.priceMin, 80_000);
  assert.equal(q.priceMax, 160_000);
  assert.equal(q.platformFee, 0);
});

test('EMERGENCY + CRITICAL stacks multipliers and adds the emergency fee', () => {
  const q = computeQuote({ min: 80_000, max: 160_000 }, 'CRITICAL', 'EMERGENCY');
  // 80000 * 2.2 * 1.3 = 228800 -> floor to 5000 = 225000
  // 160000 * 2.2 * 1.3 = 457600 -> ceil to 5000 = 460000
  assert.equal(q.priceMin, 225_000);
  assert.equal(q.priceMax, 460_000);
  assert.equal(q.platformFee, 30_000);
});

test('SIMPLE complexity never floors below 30 000 so\'m', () => {
  const q = computeQuote({ min: 5_000, max: 10_000 }, 'SIMPLE', 'SCHEDULED');
  assert.equal(q.priceMin, 30_000);
  assert.ok(q.priceMax > q.priceMin);
});

test('priceMax is always strictly greater than priceMin', () => {
  for (const complexity of ['SIMPLE', 'MEDIUM', 'COMPLEX', 'CRITICAL'] as const) {
    for (const tier of ['SCHEDULED', 'PRIORITY', 'EMERGENCY'] as const) {
      const q = computeQuote({ min: 50_000, max: 55_000 }, complexity, tier);
      assert.ok(q.priceMax > q.priceMin, `${complexity}/${tier}: ${q.priceMin}-${q.priceMax}`);
    }
  }
});
