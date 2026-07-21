import { z } from 'zod';
import { uzPhoneSchema } from './phone';

export const Role = {
  CUSTOMER: 'CUSTOMER',
  MASTER: 'MASTER',
  ADMIN: 'ADMIN',
} as const;
export const roleSchema = z.enum([Role.CUSTOMER, Role.MASTER, Role.ADMIN]);
export type Role = z.infer<typeof roleSchema>;

/** Only self-service roles may be chosen at registration; ADMIN is provisioned internally. */
export const signupRoleSchema = z.enum([Role.CUSTOMER, Role.MASTER]);

export const OtpPurpose = {
  SIGNUP: 'SIGNUP',
  LOGIN: 'LOGIN',
  RESET: 'RESET',
} as const;
export const otpPurposeSchema = z.enum([OtpPurpose.SIGNUP, OtpPurpose.LOGIN, OtpPurpose.RESET]);
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;

export const localeSchema = z.enum(['uz', 'ru']).default('uz');

const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak")
  .max(128);

export const registerSchema = z.object({
  phone: uzPhoneSchema,
  password: passwordSchema,
  role: signupRoleSchema.default(Role.CUSTOMER),
  locale: localeSchema,
  /** Optional referrer's own User.referralCode (Batch 2 growth foundation). */
  referredByCode: z.string().trim().min(1).max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phone: uzPhoneSchema,
  password: z.string().min(1, 'Parol kiriting'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const otpRequestSchema = z.object({
  phone: uzPhoneSchema,
  purpose: otpPurposeSchema,
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: uzPhoneSchema,
  code: z.string().regex(/^\d{6}$/, "Kod 6 ta raqamdan iborat bo'lishi kerak"),
  purpose: otpPurposeSchema,
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const passwordResetSchema = z.object({
  phone: uzPhoneSchema,
  code: z.string().regex(/^\d{6}$/),
  newPassword: passwordSchema,
});
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

// ── Response shapes (shared so the web client is fully typed) ──
export interface AuthTokens {
  accessToken: string;
  /** Refresh token is also set as an httpOnly cookie; returned here for non-browser clients. */
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: string;
  phone: string;
  role: Role;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  locale: 'uz' | 'ru';
  verificationStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface AuthResult {
  user: SessionUser;
  tokens: AuthTokens;
}

export interface OtpChallenge {
  otpSent: true;
  phone: string;
  /** seconds until the code may be resent */
  resendIn: number;
}
