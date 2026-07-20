import { Global, Module } from '@nestjs/common';
import { LocalDiskStorage } from './local-disk.storage';
import { STORAGE_PROVIDER } from './storage-provider';

@Global()
@Module({
  providers: [LocalDiskStorage, { provide: STORAGE_PROVIDER, useExisting: LocalDiskStorage }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
