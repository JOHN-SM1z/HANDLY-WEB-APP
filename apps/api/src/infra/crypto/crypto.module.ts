import { Global, Module } from '@nestjs/common';
import { FieldCrypto } from './field-crypto';

@Global()
@Module({
  providers: [FieldCrypto],
  exports: [FieldCrypto],
})
export class CryptoModule {}
