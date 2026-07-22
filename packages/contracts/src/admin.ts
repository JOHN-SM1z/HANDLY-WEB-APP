import { z } from 'zod';
import { OrderStatus, ServiceTier } from './order';
import { Role } from './auth';
import { verificationStatusSchema } from './user';
import { guaranteeClaimStatusSchema } from './guarantee';
import { subscriptionPlanSchema } from './subscription';

// ─────────────── Enums (mirror prisma) ───────────────
export const UserStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
} as const;
export const userStatusSchema = z.enum([
  UserStatus.PENDING,
  UserStatus.ACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.BANNED,
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

// ─────────────── Query filters (GET params). Every admin list/filter endpoint
// runs its full @Query() object through ZodValidationPipe — same mechanism
// @Body() uses — rather than the older unvalidated `@Query('x') x?: string`
// shape a couple of pre-Batch-3 GET endpoints use. ───────────────
export const adminUserListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum([Role.CUSTOMER, Role.MASTER, Role.ADMIN]).optional(),
  status: userStatusSchema.optional(),
  verificationStatus: verificationStatusSchema.optional(),
  trustTier: z.coerce.number().int().min(0).max(3).optional(),
  subscriptionPlan: subscriptionPlanSchema.optional(),
});
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const adminOrderListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  categoryId: z.string().uuid().optional(),
  serviceTier: z.nativeEnum(ServiceTier).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  // Geographic filter — same constant-radius pre-filter shape as dispatch-eligibility.ts.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusM: z.coerce.number().int().min(100).max(200_000).optional(),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

export const adminAnalyticsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;

export const adminAuditLogQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  entityType: z.string().trim().max(60).optional(),
});
export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;

export const adminSupportLookupQuerySchema = z.object({
  phone: z.string().trim().min(4).max(20),
});
export type AdminSupportLookupQuery = z.infer<typeof adminSupportLookupQuerySchema>;

export const adminVerificationListQuerySchema = z.object({
  status: verificationStatusSchema.optional(),
});
export type AdminVerificationListQuery = z.infer<typeof adminVerificationListQuerySchema>;

export const adminGuaranteeClaimListQuerySchema = z.object({
  status: guaranteeClaimStatusSchema.optional(),
});
export type AdminGuaranteeClaimListQuery = z.infer<typeof adminGuaranteeClaimListQuerySchema>;

// ─────────────── Mutations ───────────────
export const adminUserSuspendSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type AdminUserSuspendInput = z.infer<typeof adminUserSuspendSchema>;

export const featureFlagUpsertSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_.-]+$/, 'Faqat kichik harflar, raqamlar, "_", "-", "." belgilariga ruxsat'),
  enabled: z.boolean(),
  description: z.string().trim().max(300).optional(),
});
export type FeatureFlagUpsertInput = z.infer<typeof featureFlagUpsertSchema>;

// ─────────────── Response shapes ───────────────
export interface AdminUserListItemDto {
  id: string;
  phone: string;
  role: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  status: UserStatus;
  fullName: string | null;
  createdAt: string;
  // Master-only fields, null for customers/admins.
  verificationStatus: string | null;
  trustTier: number | null;
  ratingAvg: number | null;
  jobsDone: number | null;
  subscriptionPlan: 'FREE' | 'PREMIUM' | null;
}

export interface AdminUserListPage {
  items: AdminUserListItemDto[];
  nextCursor: string | null;
}

export interface AdminUserDetailDto extends AdminUserListItemDto {
  ordersCount: number;
  penaltyPoints: number | null;
}

export interface AdminOrderListItemDto {
  id: string;
  orderNo: number;
  status: string;
  serviceTier: string;
  categoryNameUz: string | null;
  customerPhone: string;
  masterPhone: string | null;
  priceMin: number | null;
  priceMax: number | null;
  finalAmount: number | null;
  createdAt: string;
}

export interface AdminOrderListPage {
  items: AdminOrderListItemDto[];
  nextCursor: string | null;
}

export interface AdminOrderDetailDto extends AdminOrderListItemDto {
  description: string;
  addressText: string | null;
  statusHistory: Array<{
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    note: string | null;
    createdAt: string;
  }>;
  dispatches: Array<{ masterId: string; status: string; distanceM: number; offeredAt: string }>;
  payments: Array<{ id: string; method: string; status: string; amount: number; createdAt: string }>;
}

export interface AdminAnalyticsOverviewDto {
  ordersCreated: number;
  ordersCompleted: number;
  ordersCancelled: number;
  activeMasters: number;
  activeCustomers: number;
  revenueTotal: number;
  avgResponseTimeSeconds: number | null;
  avgCompletionTimeSeconds: number | null;
  customerSatisfactionAvg: number | null;
  verificationStats: { unverified: number; pending: number; verified: number; rejected: number };
  subscriptionStats: { free: number; premium: number; trial: number };
  cashbackStats: { totalAmount: number; recordCount: number };
  referralStats: { pending: number; active: number; rewarded: number };
}

export interface AuditLogEntryDto {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntryDto[];
  nextCursor: string | null;
}

export interface FeatureFlagDto {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
}

export interface AdminSupportLookupDto {
  user: AdminUserDetailDto;
  payments: Array<{ id: string; orderId: string; method: string; status: string; amount: number; createdAt: string }>;
  penalties: { items: Array<{ eventType: string; severity: string; points: number; createdAt: string }>; activePoints: number } | null;
  referrals: {
    referralCode: string;
    totalReferred: number;
    totalRewarded: number;
    totalCashbackEarned: number;
  } | null;
}
