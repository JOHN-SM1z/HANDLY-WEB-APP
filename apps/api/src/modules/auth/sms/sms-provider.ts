/**
 * SMS abstraction. MVP ships a mock (logs codes) and an Eskiz adapter, chosen by
 * SMS_PROVIDER. Swapping to Play Mobile later means adding one class — nothing else changes.
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
  sendSms(phone: string, message: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
