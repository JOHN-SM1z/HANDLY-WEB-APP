import * as Sentry from '@sentry/node';
import type { Env } from '../config/env';

let enabled = false;

/**
 * Error monitoring (Batch 4) — same "assists, never gates" shape as every
 * other external-service integration in this codebase (AiProvider,
 * PushProvider, PaymentProvider): active only when SENTRY_DSN is set,
 * otherwise a complete no-op so dev/test/CI never need real credentials.
 * Sentry's Node SDK auto-instruments unhandled rejections/exceptions once
 * initialized; call this once, first, before anything else boots.
 */
export function initErrorMonitoring(env: Env): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
  });
  enabled = true;
}

/** Report a real error (5xx-class / unexpected) — no-op silently if monitoring isn't configured. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function isErrorMonitoringEnabled(): boolean {
  return enabled;
}
