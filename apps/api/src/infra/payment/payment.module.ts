import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { MockPaymentProvider } from './mock-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider';

@Global()
@Module({
  providers: [
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [AppConfig, MockPaymentProvider],
      // Only "mock" exists today — same factory shape as TaxModule/PushModule
      // so adding a real rail later is a one-line branch, not a rewrite.
      useFactory: (_config: AppConfig, mock: MockPaymentProvider) => mock,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
