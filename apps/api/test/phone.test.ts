import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUzPhone } from '@handly/contracts';

test('normalizes common Uzbek phone formats to E.164', () => {
  assert.equal(normalizeUzPhone('+998 90 123 45 67'), '+998901234567');
  assert.equal(normalizeUzPhone('998901234567'), '+998901234567');
  assert.equal(normalizeUzPhone('901234567'), '+998901234567');
  assert.equal(normalizeUzPhone('+998-90-123-45-67'), '+998901234567');
});

test('rejects invalid phone numbers', () => {
  assert.equal(normalizeUzPhone('12345'), null);
  assert.equal(normalizeUzPhone('+7 900 000 00 00'), null);
  assert.equal(normalizeUzPhone(''), null);
});
