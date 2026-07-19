import type {
  AuthResult,
  LoginInput,
  OtpChallenge,
  OtpRequestInput,
  OtpVerifyInput,
  PasswordResetInput,
  RegisterInput,
} from '@handly/contracts';
import { api } from './api';

/** Login returns a full session, or an OTP challenge for unverified accounts. */
export type LoginResponse = AuthResult | (OtpChallenge & { needsVerification: true });

export const authApi = {
  register: (body: RegisterInput) => api.post<OtpChallenge>('/auth/register', body),
  login: (body: LoginInput) => api.post<LoginResponse>('/auth/login', body),
  verifyOtp: (body: OtpVerifyInput) => api.post<AuthResult>('/auth/otp/verify', body),
  requestOtp: (body: OtpRequestInput) => api.post<OtpChallenge>('/auth/otp/request', body),
  refresh: () => api.post<AuthResult>('/auth/refresh'),
  logout: () => api.post<{ success: true }>('/auth/logout'),
  requestReset: (phone: string) =>
    api.post<OtpChallenge>('/auth/password/request-reset', { phone }),
  resetPassword: (body: PasswordResetInput) =>
    api.post<{ success: true }>('/auth/password/reset', body),
};

export function isAuthResult(res: LoginResponse): res is AuthResult {
  return 'tokens' in res;
}
