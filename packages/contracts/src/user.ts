import { z } from 'zod';

// ── Customer ──
export const customerProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  avatarUrl: z.string().url().optional(),
});
export type CustomerProfileUpdate = z.infer<typeof customerProfileUpdateSchema>;

export const addressCreateSchema = z.object({
  label: z.string().trim().min(1).max(60),
  addressText: z.string().trim().min(3).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().default(false),
});
export type AddressCreate = z.infer<typeof addressCreateSchema>;

// ── Master ──
/**
 * PINFL (JShShIR) is the 14-digit Uzbek personal identifier. Stored encrypted at rest.
 * `isSelfEmployed` drives the 1% tax withholding recorded per eligible payment (M4).
 */
export const masterProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  avatarUrl: z.string().url().optional(),
  experienceYears: z.number().int().min(0).max(70),
  bio: z.string().trim().max(1000).optional(),
  skills: z.array(z.string().uuid()).max(20).default([]),
  serviceAreas: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        centerLat: z.number().min(-90).max(90),
        centerLng: z.number().min(-180).max(180),
        radiusM: z.number().int().min(500).max(50000),
      }),
    )
    .max(10)
    .default([]),
  pinfl: z
    .string()
    .regex(/^\d{14}$/, "PINFL 14 ta raqamdan iborat bo'lishi kerak")
    .optional(),
  isSelfEmployed: z.boolean().default(false),
});
export type MasterProfileUpdate = z.infer<typeof masterProfileUpdateSchema>;

export interface MasterProfileDto {
  fullName: string | null;
  avatarUrl: string | null;
  experienceYears: number;
  bio: string | null;
  verificationStatus: VerificationStatus;
  trustTier: number;
  ratingAvg: number;
  jobsDone: number;
  /** Real-time presence (M3) — the master's own working-hours declaration. */
  isOnline: boolean;
  onlineSince: string | null;
  isSelfEmployed: boolean;
  pinflSet: boolean;
  skills: Array<{ categoryId: string; slug: string; nameUz: string; nameRu: string }>;
  serviceAreas: Array<{ id: string; label: string; centerLat: number; centerLng: number; radiusM: number }>;
  media: Array<{
    id: string;
    kind: 'CERTIFICATION' | 'PORTFOLIO';
    objectKey: string;
    caption: string | null;
    adminApproved: boolean;
  }>;
}

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export const verificationStatusSchema = z.enum([
  VerificationStatus.UNVERIFIED,
  VerificationStatus.PENDING,
  VerificationStatus.VERIFIED,
  VerificationStatus.REJECTED,
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
