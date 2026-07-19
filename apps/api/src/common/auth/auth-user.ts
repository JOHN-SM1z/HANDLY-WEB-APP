import type { Role } from '@handly/contracts';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** JWT access-token claims. */
export interface JwtPayload {
  sub: string;
  role: Role;
  status: UserStatus;
  verificationStatus?: VerificationStatus;
}

/** Shape attached to the request after JwtAuthGuard succeeds. */
export interface AuthUser {
  id: string;
  role: Role;
  status: UserStatus;
  verificationStatus?: VerificationStatus;
}
