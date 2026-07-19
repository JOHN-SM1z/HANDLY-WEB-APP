import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../config/app-config';

/**
 * AES-256-GCM field encryption for sensitive columns (PINFL, MyID payloads).
 * The configured secret is hashed to a 32-byte key; output is base64(iv|tag|ciphertext).
 */
@Injectable()
export class FieldCrypto {
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    this.key = createHash('sha256').update(config.env.FIELD_ENCRYPTION_KEY).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  /** Mask all but the last `visible` characters, for display. */
  mask(plain: string, visible = 4): string {
    if (plain.length <= visible) return plain;
    return `${'*'.repeat(plain.length - visible)}${plain.slice(-visible)}`;
  }
}
