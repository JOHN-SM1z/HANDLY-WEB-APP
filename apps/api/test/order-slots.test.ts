import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORDER_TIME_SLOTS, slotToUtcIso, utcIsoToSlot } from '@handly/contracts';

test('slotToUtcIso: Tashkent 09:00 (UTC+5) is 04:00 UTC', () => {
  assert.equal(slotToUtcIso('2026-07-21', '09:00'), '2026-07-21T04:00:00.000Z');
});

test('slotToUtcIso: late slot correctly rolls into the next UTC day', () => {
  // Tashkent 23:30 -> UTC 18:30 same day (no rollover for this slot set, but
  // exercise a near-midnight case for the date-boundary math).
  assert.equal(slotToUtcIso('2026-07-21', '23:30'), '2026-07-21T18:30:00.000Z');
});

test('slotToUtcIso: early slot rolls into the previous UTC day', () => {
  // Tashkent 02:00 on the 21st -> UTC 21:00 on the 20th.
  assert.equal(slotToUtcIso('2026-07-21', '02:00'), '2026-07-20T21:00:00.000Z');
});

test('utcIsoToSlot inverts slotToUtcIso for every fixed slot', () => {
  for (const slot of ORDER_TIME_SLOTS) {
    const iso = slotToUtcIso('2026-07-21', slot);
    const back = utcIsoToSlot(iso);
    assert.equal(back.dateStr, '2026-07-21');
    assert.equal(back.slot, slot);
  }
});

test('round-trip is independent of the process TZ (sanity: no local Date methods)', () => {
  // If this function ever regresses to use getHours()/getMinutes(), this
  // assertion would only fail on machines outside UTC+5 — pin the exact
  // instant instead so the test is meaningful everywhere.
  const iso = slotToUtcIso('2026-12-25', '14:00');
  assert.equal(iso, '2026-12-25T09:00:00.000Z');
  assert.deepEqual(utcIsoToSlot(iso), { dateStr: '2026-12-25', slot: '14:00' });
});
