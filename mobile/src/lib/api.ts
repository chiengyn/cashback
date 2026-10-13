/**
 * Client gọi backend Next.js. Không đặt EXPO_PUBLIC_API_URL thì dùng dữ liệu giả trong mock.ts.
 *
 * Endpoint backend cần có:
 *   POST /api/links                 { url } → LinkPreview
 *   POST /api/clicks/:clickId/open  → { affiliateUrl }   (ghi redirected_at)
 *   GET  /api/links/recent          → RecentLink[]
 *   GET  /api/orders                → Order[]
 *   GET  /api/wallet                → Wallet
 *   POST /api/withdrawals           WithdrawalRequest
 *   POST /api/auth/otp              { phone }
 *   POST /api/auth/verify           { phone, code } → { token, phone }  (kèm token Apple: gắn SĐT vào tài khoản)
 *   POST /api/auth/apple            { identityToken, authorizationCode } → { token, phone }
 *   DELETE /api/account
 */
import { mockApi } from '@/lib/mock';
import type { LinkPreview, Order, RecentLink, SignInResult, Wallet, WithdrawalRequest } from '@/lib/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TIMEOUT_MS = 10_000;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data?.message ?? 'Máy chủ đang bận, bạn thử lại sau ít phút.';
      throw new ApiError(message, res.status);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 0);
  } finally {
    clearTimeout(timer);
  }
}

const httpApi = {
  createLink: (url: string) => request<LinkPreview>('POST', '/api/links', { url }),
  openClick: (clickId: string) =>
    request<{ affiliateUrl: string }>('POST', `/api/clicks/${encodeURIComponent(clickId)}/open`),
  recentLinks: () => request<RecentLink[]>('GET', '/api/links/recent'),
  orders: () => request<Order[]>('GET', '/api/orders'),
  wallet: () => request<Wallet>('GET', '/api/wallet'),
  requestWithdrawal: (req: WithdrawalRequest) => request<void>('POST', '/api/withdrawals', req),
  sendOtp: (phone: string) => request<void>('POST', '/api/auth/otp', { phone }),
  verifyOtp: (phone: string, code: string) => request<SignInResult>('POST', '/api/auth/verify', { phone, code }),
  signInWithApple: (identityToken: string, authorizationCode: string | null) =>
    request<SignInResult>('POST', '/api/auth/apple', { identityToken, authorizationCode }),
  deleteAccount: () => request<void>('DELETE', '/api/account'),
};

export const api: typeof httpApi = BASE_URL ? httpApi : mockApi;
export const isMockApi = !BASE_URL;
