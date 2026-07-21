import 'reflect-metadata';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { config as loadDotenv } from 'dotenv';
import { AppModule } from './app.module';
import { ProblemExceptionFilter } from './common/http/problem.filter';
import { loadEnv } from './infra/config/env';
import { SocketIoAdapter } from './modules/realtime/socket-io.adapter';

async function bootstrap(): Promise<void> {
  // Load monorepo-root .env first, then a local .env if present.
  loadDotenv({ path: join(process.cwd(), '../../.env') });
  loadDotenv();
  const env = loadEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    limits: {
      // Route-level validation applies the exact per-kind caps (photo vs video).
      fileSize: env.UPLOAD_MAX_VIDEO_MB * 1024 * 1024,
      files: 1,
    },
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemExceptionFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  // Baseline security headers (no new dependency — a handful of static
  // response headers doesn't warrant pulling in @fastify/helmet). CSP/HSTS
  // deliberately left out: CSP needs real tuning against every asset source
  // this app actually uses before it's safe to enable, and HSTS is normally
  // the reverse proxy/CDN's job once TLS terminates there, not the app's.
  app.getHttpAdapter().getInstance().addHook('onSend', (_req, reply, payload, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    done(null, payload);
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app, env.WEB_ORIGIN));
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`Handly API ready on http://localhost:${env.API_PORT}/api/v1`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start Handly API:', err);
  process.exit(1);
});
