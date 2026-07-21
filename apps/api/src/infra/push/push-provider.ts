/**
 * Push notification abstraction (M3). MVP ships MockPushProvider; a real FCM
 * provider slots in later without touching callers — same shape as
 * StorageProvider/TaxProvider/AiProvider.
 */
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  send(deviceTokens: string[], payload: PushPayload): Promise<void>;
}
