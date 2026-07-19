import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../infra/config/app-config';
import { MockTaxProvider } from './mock-tax.provider';
import { SoliqTaxProvider } from './soliq-tax.provider';
import { TAX_PROVIDER } from './tax-provider';

@Global()
@Module({
  providers: [
    MockTaxProvider,
    SoliqTaxProvider,
    {
      provide: TAX_PROVIDER,
      inject: [AppConfig, MockTaxProvider, SoliqTaxProvider],
      useFactory: (config: AppConfig, mock: MockTaxProvider, soliq: SoliqTaxProvider) =>
        config.env.TAX_PROVIDER === 'soliq' ? soliq : mock,
    },
  ],
  exports: [TAX_PROVIDER],
})
export class TaxModule {}
