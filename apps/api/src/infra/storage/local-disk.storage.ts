import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { AppConfig } from '../config/app-config';
import type { SaveOptions, StorageProvider } from './storage-provider';

@Injectable()
export class LocalDiskStorage implements StorageProvider {
  private readonly logger = new Logger('LocalDiskStorage');
  private readonly root: string;

  constructor(config: AppConfig) {
    this.root = resolve(process.cwd(), config.env.UPLOAD_DIR);
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
      this.logger.log(`Created upload dir ${this.root}`);
    }
  }

  /** objectKey is always a generated basename — never caller input — so no traversal. */
  private pathFor(objectKey: string): string {
    return join(this.root, basename(objectKey));
  }

  async save(data: Buffer, options: SaveOptions): Promise<{ objectKey: string }> {
    const objectKey = `${randomUUID()}${options.ext}`;
    await writeFile(this.pathFor(objectKey), data);
    return { objectKey };
  }

  createReadStream(objectKey: string): Readable {
    const path = this.pathFor(objectKey);
    if (!existsSync(path)) throw new NotFoundException('Fayl topilmadi');
    return createReadStream(path);
  }

  async read(objectKey: string): Promise<Buffer> {
    const path = this.pathFor(objectKey);
    if (!existsSync(path)) throw new NotFoundException('Fayl topilmadi');
    return readFile(path);
  }

  async delete(objectKey: string): Promise<void> {
    await unlink(this.pathFor(objectKey)).catch(() => undefined);
  }
}
