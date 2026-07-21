import type { ReferralSummaryDto } from '@handly/contracts';
import { api } from './api';

export const referralsApi = {
  getSummary: () => api.get<ReferralSummaryDto>('/me/referrals'),
};
