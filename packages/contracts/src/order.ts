import { z } from 'zod';

// ─────────────── Enums (mirror prisma) ───────────────
export const ServiceTier = {
  SCHEDULED: 'SCHEDULED',
  PRIORITY: 'PRIORITY',
  EMERGENCY: 'EMERGENCY',
} as const;
export const serviceTierSchema = z.enum([
  ServiceTier.SCHEDULED,
  ServiceTier.PRIORITY,
  ServiceTier.EMERGENCY,
]);
export type ServiceTier = z.infer<typeof serviceTierSchema>;

export const Complexity = {
  SIMPLE: 'SIMPLE',
  MEDIUM: 'MEDIUM',
  COMPLEX: 'COMPLEX',
  CRITICAL: 'CRITICAL',
} as const;
export const complexitySchema = z.enum([
  Complexity.SIMPLE,
  Complexity.MEDIUM,
  Complexity.COMPLEX,
  Complexity.CRITICAL,
]);
export type Complexity = z.infer<typeof complexitySchema>;

export const OrderStatus = {
  DRAFT: 'DRAFT',
  PRICED: 'PRICED',
  SEARCHING: 'SEARCHING',
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  CANCELLED_BY_CUSTOMER: 'CANCELLED_BY_CUSTOMER',
  CANCELLED_BY_MASTER: 'CANCELLED_BY_MASTER',
  EXPIRED: 'EXPIRED',
  DISPUTED: 'DISPUTED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

// ─────────────── Service-tier metadata (single source for UI + pricing) ───────────────
/** Multipliers/fees per approved architecture §0.1; integer so'm. */
export const SERVICE_TIER_INFO: Record<
  ServiceTier,
  { multiplier: number; platformFee: number; etaUz: string; labelUz: string }
> = {
  SCHEDULED: {
    multiplier: 1.0,
    platformFee: 0,
    etaUz: 'Tanlangan vaqtdan 30–60 daqiqa ichida',
    labelUz: 'Rejalashtirilgan',
  },
  PRIORITY: {
    multiplier: 1.15,
    platformFee: 15_000,
    etaUz: '15–30 daqiqa ichida',
    labelUz: 'Tezkor',
  },
  EMERGENCY: {
    multiplier: 1.3,
    platformFee: 30_000,
    etaUz: '10–15 daqiqa ichida',
    labelUz: 'Favqulodda',
  },
};

export const COMPLEXITY_INFO: Record<
  Complexity,
  { multiplier: number; labelUz: string }
> = {
  SIMPLE: { multiplier: 0.8, labelUz: 'Oddiy' },
  MEDIUM: { multiplier: 1.0, labelUz: "O'rtacha" },
  COMPLEX: { multiplier: 1.6, labelUz: 'Murakkab' },
  CRITICAL: { multiplier: 2.2, labelUz: 'Jiddiy' },
};

/** Bookable time slots for SCHEDULED orders (per wireframe). */
export const ORDER_TIME_SLOTS = ['09:00', '11:00', '14:00', '16:00'] as const;
/** How many days ahead a SCHEDULED order can be booked. */
export const ORDER_MAX_DAYS_AHEAD = 14;

// ─────────────── Request schemas ───────────────
export const orderCreateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  description: z
    .string()
    .trim()
    .min(5, 'Muammoni kamida 5 ta belgi bilan tasvirlab bering')
    .max(2000),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const orderUpdateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  serviceTier: serviceTierSchema.optional(),
  /** ISO datetime; required at submit for SCHEDULED tier. */
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  addressText: z.string().trim().min(3).max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

export const orderSubmitSchema = z.object({
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Ommaviy oferta shartlariga rozilik shart' }),
  }),
});
export type OrderSubmitInput = z.infer<typeof orderSubmitSchema>;

// ─────────────── Response shapes ───────────────
export interface AiDiagnosisDto {
  issueSummary: string;
  suggestedCategoryId: string | null;
  suggestedCategorySlug: string | null;
  complexity: Complexity;
  confidence: number;
  source: 'claude' | 'mock';
  promptVersion: string;
}

export interface OrderMediaDto {
  id: string;
  kind: 'PHOTO' | 'VIDEO';
  url: string;
  mime: string;
  sizeBytes: number;
}

export interface OrderStatusHistoryDto {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  orderNo: number;
  status: OrderStatus;
  serviceTier: ServiceTier;
  categoryId: string | null;
  categoryName: string | null;
  description: string;
  scheduledAt: string | null;
  addressText: string | null;
  latitude: number | null;
  longitude: number | null;
  complexity: Complexity | null;
  aiDiagnosis: AiDiagnosisDto | null;
  priceMin: number | null;
  priceMax: number | null;
  platformFee: number;
  media: OrderMediaDto[];
  history: OrderStatusHistoryDto[];
  createdAt: string;
  submittedAt: string | null;
}

export interface OrderListPage {
  items: OrderDto[];
  nextCursor: string | null;
}
