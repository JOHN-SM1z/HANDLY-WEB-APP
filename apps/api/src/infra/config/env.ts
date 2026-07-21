import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(8, 'JWT_ACCESS_SECRET must be at least 8 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  FIELD_ENCRYPTION_KEY: z.string().min(16, 'FIELD_ENCRYPTION_KEY must be at least 16 chars'),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(180),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(45),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_DAILY_CAP_PER_PHONE: z.coerce.number().int().positive().default(10),

  // Login brute-force protection — same Redis counter pattern as OTP above.
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),

  SMS_PROVIDER: z.enum(['mock', 'eskiz']).default('mock'),
  ESKIZ_EMAIL: z.string().default(''),
  ESKIZ_PASSWORD: z.string().default(''),
  ESKIZ_BASE_URL: z.string().default('https://notify.eskiz.uz/api'),
  ESKIZ_FROM: z.string().default('4546'),

  TAX_PROVIDER: z.enum(['mock', 'soliq']).default('mock'),
  TAX_WITHHOLDING_RATE: z.coerce.number().min(0).max(1).default(0.01),

  // AI diagnosis (M2). "mock" needs no key; "claude" requires ANTHROPIC_API_KEY.
  AI_PROVIDER: z.enum(['mock', 'claude']).default('mock'),
  ANTHROPIC_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('claude-opus-4-8'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),

  // Media uploads (local disk in dev; S3 provider slots in later).
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_PHOTO_MB: z.coerce.number().positive().default(10),
  UPLOAD_MAX_VIDEO_MB: z.coerce.number().positive().default(50),
  ORDER_MAX_MEDIA: z.coerce.number().int().positive().default(5),

  // Push notifications (M3). "mock" logs to console, needs no creds; "fcm"
  // requires the service-account vars below (falls back to mock if unset).
  PUSH_PROVIDER: z.enum(['mock', 'fcm']).default('mock'),
  FCM_PROJECT_ID: z.string().default(''),
  FCM_CLIENT_EMAIL: z.string().default(''),
  FCM_PRIVATE_KEY: z.string().default(''),

  // Dispatch / matching (M3) — plain typed config for now; the clean swap-in
  // point for a future hot-reloadable rules engine (§9.5) is this one object.
  // Eligibility radius is each master's own ServiceArea.radiusM (how far they
  // said they'd travel) — DISPATCH_RADIUS_EXPANSION_FACTOR widens that
  // per-master radius for the one retry when the pool comes back empty
  // (§9.2.5 "radius expands stepwise"), it isn't an absolute distance itself.
  DISPATCH_TOP_N: z.coerce.number().int().positive().default(5),
  DISPATCH_RADIUS_EXPANSION_FACTOR: z.coerce.number().positive().default(2),
  DISPATCH_OFFER_TTL_SCHEDULED_SECONDS: z.coerce.number().int().positive().default(600),
  DISPATCH_OFFER_TTL_PRIORITY_SECONDS: z.coerce.number().int().positive().default(120),
  DISPATCH_OFFER_TTL_EMERGENCY_SECONDS: z.coerce.number().int().positive().default(60),

  // Payments (M5). Only "mock" is implemented — CLICK/PAYME/UZUM need real
  // merchant credentials that don't exist yet; the enum + PaymentProvider
  // interface exist so a real rail slots in without touching callers.
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
});

export type Env = z.infer<typeof envSchema>;

// The exact placeholder values shipped in .env.example — safe for local dev,
// never safe in production. Anyone who forgets to change them ships a
// forgeable JWT secret / a guessable field-encryption key.
const KNOWN_DEV_PLACEHOLDERS = new Set([
  'dev-access-secret-change-me',
  'dev-32-byte-key-change-me-please!',
]);

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (KNOWN_DEV_PLACEHOLDERS.has(env.JWT_ACCESS_SECRET) || env.JWT_ACCESS_SECRET.length < 32) {
      problems.push('JWT_ACCESS_SECRET must be a real, unique secret of at least 32 characters in production');
    }
    if (KNOWN_DEV_PLACEHOLDERS.has(env.FIELD_ENCRYPTION_KEY) || env.FIELD_ENCRYPTION_KEY.length < 32) {
      problems.push('FIELD_ENCRYPTION_KEY must be a real, unique key of at least 32 characters in production');
    }
    if (problems.length > 0) {
      throw new Error(`Refusing to start in production with unsafe secrets:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    }
  }
  return env;
}
