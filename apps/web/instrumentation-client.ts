import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side error monitoring (Batch 4). Gated on
 * NEXT_PUBLIC_SENTRY_DSN (must be NEXT_PUBLIC_ to reach the client bundle);
 * unset in dev/test/CI is a complete no-op — no external credentials needed.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}
