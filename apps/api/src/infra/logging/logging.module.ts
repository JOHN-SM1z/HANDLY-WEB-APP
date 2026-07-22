import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { AuthUser } from '../../common/auth/auth-user';

/**
 * Structured JSON logging (Batch 4). Every request gets a `reqId` — reused
 * from an inbound `x-request-id`/`x-correlation-id` header when a reverse
 * proxy or upstream service already set one, so a single request can be
 * traced across services, otherwise a fresh uuid. `userId` is attached via
 * `customProps`, which pino-http re-evaluates on every log line for a
 * request — by the time any service logs something, `JwtAuthGuard` has
 * already populated `request.user`, so this reflects the real caller
 * without needing request-scoped DI gymnastics. orderId/dispatchId/etc. are
 * passed explicitly at the handful of call sites where they matter (job
 * execution, dispatch, payments, admin mutations) as structured log fields,
 * the standard pino pattern — not force-fit into global context.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => {
          const existing = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
          return (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
        },
        customProps: (req) => {
          const user = (req as unknown as { user?: AuthUser }).user;
          return user ? { userId: user.id } : {};
        },
        // Never let a stray log call leak credentials/secrets/PII — these
        // are the same fields the rest of this codebase already treats as
        // sensitive (see PINFL/passwordHash/token handling elsewhere).
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.passwordHash',
            '*.pinflEncrypted',
            '*.pinfl',
            '*.accessToken',
            '*.refreshToken',
            '*.codeHash',
          ],
          censor: '[REDACTED]',
        },
        // Pretty, human-readable ONLY for local interactive development —
        // every other value (production, test, staging, or an unset/typo'd
        // NODE_ENV) gets plain JSON, matching "logs must be machine-readable."
        // Deliberately not `!== 'production'`: that would also try to load
        // pino-pretty (a devDependency, absent from the production deploy —
        // confirmed by a real container crash on `docker run` with
        // NODE_ENV=development against the Batch 4 production image) for
        // "test"/"staging"/any typo, not just genuine local dev.
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        // Skip request/response noise on the endpoints hit constantly by
        // orchestrators/load balancers/Prometheus — real traffic is still
        // logged in full.
        autoLogging: {
          ignore: (req) =>
            req.url === '/api/v1/health' ||
            req.url === '/api/v1/health/live' ||
            req.url === '/api/v1/health/ready' ||
            req.url === '/api/v1/metrics',
        },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggingModule {}
