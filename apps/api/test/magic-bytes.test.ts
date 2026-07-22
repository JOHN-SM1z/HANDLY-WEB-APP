import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesMagicBytes } from '../src/infra/storage/magic-bytes';

test('accepts a real JPEG signature declared as image/jpeg', () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(matchesMagicBytes(buf, 'image/jpeg'), true);
});

test('accepts a real PNG signature declared as image/png', () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.equal(matchesMagicBytes(buf, 'image/png'), true);
});

test('accepts a real WEBP signature (RIFF....WEBP) declared as image/webp', () => {
  const buf = Buffer.concat([
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // size (unchecked)
    Buffer.from([0x57, 0x45, 0x42, 0x50]), // WEBP
  ]);
  assert.equal(matchesMagicBytes(buf, 'image/webp'), true);
});

test('accepts a real ISO-BMFF container (ftyp box) declared as video/mp4', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  assert.equal(matchesMagicBytes(buf, 'video/mp4'), true);
});

test('accepts a real WEBM signature (EBML header) declared as video/webm', () => {
  const buf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00]);
  assert.equal(matchesMagicBytes(buf, 'video/webm'), true);
});

test('rejects an HTML/script payload mislabeled as image/jpeg', () => {
  const buf = Buffer.from('<script>alert(1)</script>', 'utf8');
  assert.equal(matchesMagicBytes(buf, 'image/jpeg'), false);
});

test('rejects a PNG mislabeled as image/webp (cross-format spoof)', () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(matchesMagicBytes(buf, 'image/webp'), false);
});

test('rejects a truncated/empty buffer', () => {
  assert.equal(matchesMagicBytes(Buffer.alloc(0), 'image/jpeg'), false);
  assert.equal(matchesMagicBytes(Buffer.from([0xff]), 'image/jpeg'), false);
});

test('an unrecognized mime with no signature entry is not falsely rejected', () => {
  // matchesMagicBytes is only ever called after the PHOTO_MIMES/VIDEO_MIMES
  // allow-list check in orders.service.ts, so this mime would never reach it
  // in practice — verifying the fallback is permissive (not a silent reject)
  // in case a new mime is added to the allow-list without a signature yet.
  assert.equal(matchesMagicBytes(Buffer.from('anything'), 'image/heic-nonexistent'), true);
});
