import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppConfig } from '../src/infra/config/app-config';
import { MockTaxProvider } from '../src/modules/tax/mock-tax.provider';

const config = { env: { TAX_WITHHOLDING_RATE: 0.01 } } as AppConfig;

test('MockTaxProvider withholds 1% and computes the net', () => {
  const provider = new MockTaxProvider(config);
  const result = provider.computeWithholding(100_000);
  assert.equal(result.rate, 0.01);
  assert.equal(result.taxAmount, 1_000);
  assert.equal(result.netAmount, 99_000);
  assert.equal(result.grossAmount, 100_000);
});

test('MockTaxProvider rounds the withheld amount', () => {
  const provider = new MockTaxProvider(config);
  const result = provider.computeWithholding(99_999);
  assert.equal(result.taxAmount, 1_000); // 999.99 -> 1000
  assert.equal(result.netAmount, 98_999);
});
