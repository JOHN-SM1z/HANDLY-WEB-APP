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
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
