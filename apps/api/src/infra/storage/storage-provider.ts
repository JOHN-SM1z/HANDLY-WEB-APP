import type { Readable } from 'node:stream';

/**
 * Media storage abstraction. MVP ships LocalDiskStorage; an S3 provider
 * (presigned uploads) slots in later without touching callers.
 */
export interface SaveOptions {
  mime: string;
  /** File extension including the dot, e.g. ".jpg". */
  ext: string;
}

export interface StorageProvider {
  save(data: Buffer, options: SaveOptions): Promise<{ objectKey: string }>;
  createReadStream(objectKey: string): Readable;
  read(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
