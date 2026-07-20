const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: FieldError[];

  constructor(status: number, message: string, errors?: FieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

// Access token lives in memory only (never localStorage); refresh token is an httpOnly cookie.
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

// GET/PATCH/DELETE are naturally idempotent, so a pure network-layer failure
// (no response reached at all — a dropped mobile connection, a proxy hiccup)
// is safe to retry once transparently. POST is left alone: since a network
// failure means we can't tell whether the server saw the request, blindly
// retrying a create could double it — the caller's UI action stays retryable
// by the user instead.
const RETRYABLE_METHODS = new Set(['GET', 'PATCH', 'DELETE']);

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, credentials: 'include', body });
  } catch (networkErr) {
    if (!RETRYABLE_METHODS.has(method)) throw networkErr;
    await new Promise((r) => setTimeout(r, 400));
    res = await fetch(`${BASE_URL}${path}`, { method, headers, credentials: 'include', body });
  }

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (data.detail as string) || (data.title as string) || 'Kutilmagan xatolik yuz berdi';
    throw new ApiError(res.status, message, data.errors as FieldError[] | undefined);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { auth }),
  post: <T>(path: string, body?: unknown, auth = false) =>
    request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body, auth }),
  del: <T>(path: string, auth = true) => request<T>(path, { method: 'DELETE', auth }),
};
