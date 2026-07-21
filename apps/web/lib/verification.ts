import type { VerificationRecordDto, VerificationRequestSubmitInput } from '@handly/contracts';
import { api } from './api';

export const verificationApi = {
  getMine: () => api.get<VerificationRecordDto | null>('/me/master/verification'),
  submit: (body: VerificationRequestSubmitInput = {}) =>
    api.post<VerificationRecordDto>('/me/master/verification', body, true),
};
