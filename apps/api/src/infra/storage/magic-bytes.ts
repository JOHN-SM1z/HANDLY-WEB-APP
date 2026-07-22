/**
 * Verifies an upload's real file signature matches its declared MIME type,
 * instead of trusting the client-supplied multipart Content-Type outright
 * (a client can label arbitrary bytes "image/jpeg"). Deliberately hand-rolled
 * rather than a dependency: the accepted format list is small and fixed
 * (see PHOTO_MIMES/VIDEO_MIMES in orders.service.ts), and every format here
 * has a short, stable magic-byte signature.
 *
 * This is defense-in-depth on top of the existing MIME allow-list + the
 * global `X-Content-Type-Options: nosniff` header (main.ts) — nosniff alone
 * already stops a browser from reinterpreting a mislabeled file as HTML/JS
 * when it's served back with its declared type, but this closes the gap for
 * any future code path that might trust `file.mime` for something other
 * than an HTTP response header (e.g. a native app, a CDN that re-sniffs).
 */
export function matchesMagicBytes(buffer: Buffer, mime: string): boolean {
  const check = SIGNATURES[mime];
  if (!check) return true; // no signature defined for this mime — nothing to check against
  return check(buffer);
}

function bytesEqual(buffer: Buffer, offset: number, expected: number[]): boolean {
  if (buffer.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (buffer[offset + i] !== expected[i]) return false;
  }
  return true;
}

/** ISO Base Media File Format container check (MP4/MOV/HEIC all share it): a
 * 4-byte box size followed by the ASCII box type "ftyp" at offset 4. This
 * doesn't validate the exact brand (heic vs mp4 vs mov), only that the file
 * is genuinely a well-formed ISO-BMFF container — which is already enough to
 * reject arbitrary text/HTML/script content, the actual threat being guarded
 * against here. */
function isIsoBmff(buffer: Buffer): boolean {
  return bytesEqual(buffer, 4, [0x66, 0x74, 0x79, 0x70]); // "ftyp"
}

const SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': (b) => bytesEqual(b, 0, [0xff, 0xd8, 0xff]),
  'image/png': (b) => bytesEqual(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (b) => bytesEqual(b, 0, [0x47, 0x49, 0x46, 0x38]), // "GIF8"
  'image/webp': (b) => bytesEqual(b, 0, [0x52, 0x49, 0x46, 0x46]) && bytesEqual(b, 8, [0x57, 0x45, 0x42, 0x50]), // "RIFF"...."WEBP"
  'image/heic': isIsoBmff,
  'video/mp4': isIsoBmff,
  'video/quicktime': isIsoBmff,
  'video/webm': (b) => bytesEqual(b, 0, [0x1a, 0x45, 0xdf, 0xa3]), // EBML header
};
