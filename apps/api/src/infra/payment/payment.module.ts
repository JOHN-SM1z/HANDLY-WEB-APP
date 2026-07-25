import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { MockPaymentProvider } from './mock-payment.provider';
import { ClickPaymentProvider } from './click-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider';

@Global()
@Module({
  providers: [
    MockPaymentProvider,
    ClickPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [AppConfig, MockPaymentProvider, ClickPaymentProvider],
      // Factory conditionally selects payment rail based on PAYMENT_PROVIDER env var.
      // Same pattern as TaxModule/PushModule — adding a new provider is a one-line branch.
      useFactory: (
        config: AppConfig,
        mock: MockPaymentProvider,
        click: ClickPaymentProvider,
      ) => {
        switch (config.env.PAYMENT_PROVIDER) {
          case 'click':
            return click;
          case 'mock':
          default:
            return mock;
        }
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
