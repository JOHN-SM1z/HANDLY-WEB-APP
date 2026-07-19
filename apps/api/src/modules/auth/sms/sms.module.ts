import { Module } from '@nestjs/common';
import { AppConfig } from '../../../infra/config/app-config';
import { EskizSmsProvider } from './eskiz-sms.provider';
import { MockSmsProvider } from './mock-sms.provider';
import { SMS_PROVIDER } from './sms-provider';

@Module({
  providers: [
    MockSmsProvider,
    EskizSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [AppConfig, MockSmsProvider, EskizSmsProvider],
      useFactory: (config: AppConfig, mock: MockSmsProvider, eskiz: EskizSmsProvider) =>
        config.env.SMS_PROVIDER === 'eskiz' ? eskiz : mock,
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
