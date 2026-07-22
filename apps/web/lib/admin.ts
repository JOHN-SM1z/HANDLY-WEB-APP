import type {
  AdminAnalyticsOverviewDto,
  AdminOrderDetailDto,
  AdminOrderListPage,
  AdminPaymentResolveInput,
  AdminSupportLookupDto,
  AdminUserDetailDto,
  AdminUserListPage,
  AuditLogPage,
  FeatureFlagDto,
  FeatureFlagUpsertInput,
  GuaranteeClaimDecisionInput,
  GuaranteeClaimDto,
  OrderStatus,
  PaymentDto,
  ServiceTier,
  VerificationDecisionInput,
  VerificationRecordDto,
} from '@handly/contracts';
import { api } from './api';

function toQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export interface AdminUserListParams {
  cursor?: string;
  phone?: string;
  role?: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  verificationStatus?: string;
  trustTier?: number;
  subscriptionPlan?: 'FREE' | 'PREMIUM';
}

export interface AdminOrderListParams {
  cursor?: string;
  status?: OrderStatus;
  categoryId?: string;
  serviceTier?: ServiceTier;
  /** Beta Blocker Sprint — "every order for this user." */
  customerId?: string;
  masterId?: string;
  dateFrom?: string;
  dateTo?: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
}

export const adminApi = {
  users: {
    list: (params: AdminUserListParams = {}) => api.get<AdminUserListPage>(`/admin/users${toQuery(params)}`),
    detail: (id: string) => api.get<AdminUserDetailDto>(`/admin/users/${id}`),
    suspend: (id: string, reason: string) =>
      api.post<AdminUserDetailDto>(`/admin/users/${id}/suspend`, { reason }, true),
    restore: (id: string) => api.post<AdminUserDetailDto>(`/admin/users/${id}/restore`, undefined, true),
  },
  orders: {
    list: (params: AdminOrderListParams = {}) => api.get<AdminOrderListPage>(`/admin/orders${toQuery(params)}`),
    detail: (id: string) => api.get<AdminOrderDetailDto>(`/admin/orders/${id}`),
  },
  analytics: {
    overview: (params: { dateFrom?: string; dateTo?: string } = {}) =>
      api.get<AdminAnalyticsOverviewDto>(`/admin/analytics/overview${toQuery(params)}`),
  },
  auditLog: {
    list: (params: { cursor?: string; actorId?: string; entityType?: string } = {}) =>
      api.get<AuditLogPage>(`/admin/audit-log${toQuery(params)}`),
  },
  featureFlags: {
    list: () => api.get<FeatureFlagDto[]>('/admin/feature-flags'),
    upsert: (body: FeatureFlagUpsertInput) => api.post<FeatureFlagDto>('/admin/feature-flags', body, true),
  },
  support: {
    lookup: (phone: string) => api.get<AdminSupportLookupDto>(`/admin/support/lookup${toQuery({ phone })}`),
  },
  verifications: {
    list: (status?: string) =>
      api.get<
        Array<{
          id: string;
          masterId: string;
          masterPhone: string;
          status: string;
          note: string | null;
          certifications: Array<{ id: string; url: string; caption: string | null }>;
          createdAt: string;
        }>
      >(`/admin/verifications${toQuery({ status })}`),
    decide: (id: string, body: VerificationDecisionInput) =>
      api.post<VerificationRecordDto>(`/admin/verifications/${id}/decide`, body, true),
  },
  payments: {
    /** Manual resolution foundation (Beta Blocker Sprint) — no real payment-
     * provider reversal, just an audited status change + customer notification. */
    resolve: (id: string, body: AdminPaymentResolveInput) =>
      api.post<PaymentDto>(`/admin/payments/${id}/resolve`, body, true),
  },
  guaranteeClaims: {
    list: (status?: string) =>
      api.get<
        Array<{ id: string; orderId: string; customerPhone: string; reason: string; status: string; createdAt: string }>
      >(`/admin/guarantee-claims${toQuery({ status })}`),
    decide: (id: string, body: GuaranteeClaimDecisionInput) =>
      api.post<GuaranteeClaimDto>(`/admin/guarantee-claims/${id}/decide`, body, true),
  },
};
