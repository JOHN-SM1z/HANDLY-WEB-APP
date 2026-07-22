import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import { config as loadDotenv } from 'dotenv';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ProblemExceptionFilter } from './common/http/problem.filter';
import { loadEnv } from './infra/config/env';
import { initErrorMonitoring } from './infra/monitoring/error-monitoring';
import { RedisService } from './infra/redis/redis.service';
import { SocketIoAdapter } from './modules/realtime/socket-io.adapter';

async function bootstrap(): Promise<void> {
  // Load monorepo-root .env first, then a local .env if present.
  loadDotenv({ path: join(process.cwd(), '../../.env') });
  loadDotenv();
  const env = loadEnv();
  initErrorMonitoring(env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // See TRUSTED_PROXY's own comment in infra/config/env.ts — must match
    // your real deployment topology. Left as the unconditional `true` this
    // shipped with through M1–Batch3, `req.ip` (used for both the Batch 4
    // per-IP rate limiter's key and Session.ip in token.service.ts) would be
    // spoofable via a client-supplied X-Forwarded-For header — found during
    // Batch 4's final security audit.
    new FastifyAdapter({ trustProxy: env.TRUSTED_PROXY }),
    // Buffer Nest's own bootstrap logs until the pino logger below takes
    // over, so nothing is lost/duplicated between the two loggers.
    { bufferLogs: true },
  );
  const logger = app.get(Logger);
  app.useLogger(logger);

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    limits: {
      // Route-level validation applies the exact per-kind caps (photo vs video).
      fileSize: env.UPLOAD_MAX_VIDEO_MB * 1024 * 1024,
      files: 1,
    },
  });
  // Volumetric/DoS backstop on every route, Redis-backed so the counter is
  // shared across multiple API instances (not per-process). This sits on top
  // of — not instead of — the stricter, purpose-built OTP/login Redis
  // counters already in auth.service.ts/otp.service.ts.
  const redis = app.get(RedisService);
  await app.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis: redis.client,
    nameSpace: 'rl:',
    // Health/metrics are polled frequently by orchestrators/scrapers, not by
    // untrusted clients — exempt them so a tight scrape interval never trips it.
    allowList: (req) =>
      req.url === '/api/v1/health' || req.url === '/api/v1/health/live' ||
      req.url === '/api/v1/health/ready' || req.url === '/api/v1/metrics',
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemExceptionFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  // Baseline security headers (no new dependency — a handful of static
  // response headers doesn't warrant pulling in @fastify/helmet). HSTS is
  // deliberately left out — that's normally the reverse proxy/CDN's job once
  // TLS terminates there, not the app's (see infra/nginx/handly.conf.example).
  // CSP here is safe to be maximally strict ('none' across the board): this
  // API only ever returns JSON or a media binary stream, never HTML — unlike
  // apps/web (a real page-serving app whose CSP needs tuning against actual
  // script/style/connect sources), so there's no legitimate content this
  // would break. Its value is defense-in-depth for GET /media/:id: if a
  // future bug ever served a file with an HTML content-type, this still
  // blocks any embedded script from executing.
  app.getHttpAdapter().getInstance().addHook('onSend', (_req, reply, payload, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    done(null, payload);
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app, env.WEB_ORIGIN));
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`Handly API ready on http://localhost:${env.API_PORT}/api/v1`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Failed to start Handly API:', err);
  process.exit(1);
});
