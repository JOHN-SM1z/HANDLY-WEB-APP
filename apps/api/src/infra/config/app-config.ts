import { Global, Module } from '@nestjs/common';
import { type Env, loadEnv } from './env';

/**
 * Typed, validated configuration. `env` is parsed once at startup;
 * a bad/missing variable fails fast with a readable message.
 */
export class AppConfig {
  constructor(readonly env: Env) {}

  get isProd(): boolean {
    return this.env.NODE_ENV === 'production';
  }
  get isDev(): boolean {
    return this.env.NODE_ENV === 'development';
  }
}

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => new AppConfig(loadEnv()),
    },
  ],
  exports: [AppConfig],
})
export class AppConfigModule {}
