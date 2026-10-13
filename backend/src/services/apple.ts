/**
 * Sign in with Apple.
 * - Kiểm tra identity token (JWT RS256) bằng khoá công khai tại https://appleid.apple.com/auth/keys.
 * - Đổi authorization code lấy refresh token, và thu hồi token đó khi người dùng xoá tài khoản:
 *   Apple yêu cầu app có Sign in with Apple gọi /auth/revoke khi xoá tài khoản.
 *   `client_secret` là JWT ES256 ký bằng khoá .p8 (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY).
 */
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose';

import { env } from '@/lib/env';
import { HttpError } from '@/lib/http';

const APPLE = 'https://appleid.apple.com';

let remoteJwks: JWTVerifyGetKey | null = null;
const appleJwks = () => (remoteJwks ??= createRemoteJWKSet(new URL(`${APPLE}/auth/keys`)));

/** Trả `sub` (mã người dùng Apple, cố định theo team của nhà phát triển). */
export async function verifyIdentityToken(identityToken: string, getKey: JWTVerifyGetKey = appleJwks()): Promise<{ sub: string }> {
  try {
    const { payload } = await jwtVerify(identityToken, getKey, { issuer: APPLE, audience: env().APPLE_BUNDLE_ID });
    if (!payload.sub) throw new Error('missing sub');
    return { sub: payload.sub };
  } catch (e) {
    console.warn('[apple.verifyIdentityToken]', e);
    throw new HttpError(401, 'Đăng nhập Apple không thành công. Bạn thử lại nhé.');
  }
}

function clientConfig() {
  const { APPLE_TEAM_ID: teamId, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: key, APPLE_BUNDLE_ID: clientId } = env();
  return teamId && keyId && key ? { teamId, keyId, key: key.replace(/\\n/g, '\n'), clientId } : null;
}

async function clientSecret(cfg: NonNullable<ReturnType<typeof clientConfig>>): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setSubject(cfg.clientId)
    .setAudience(APPLE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(await importPKCS8(cfg.key, 'ES256'));
}

/**
 * Đổi authorization code (chỉ dùng được một lần, hết hạn sau vài phút) lấy refresh token.
 * Lỗi không chặn đăng nhập; khi đó chỉ không thu hồi được token lúc xoá tài khoản.
 */
export async function exchangeAuthorizationCode(code: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const cfg = clientConfig();
  if (!cfg) {
    console.warn('[apple] Thiếu APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY: bỏ qua đổi authorization code');
    return null;
  }
  try {
    const res = await fetchImpl(`${APPLE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: await clientSecret(cfg), code, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { refresh_token?: string; error?: string } | null;
    if (!res.ok || !body?.refresh_token) throw new Error(`Apple /auth/token ${res.status}: ${body?.error ?? 'no refresh_token'}`);
    return body.refresh_token;
  } catch (e) {
    console.error('[apple.exchangeAuthorizationCode]', e);
    return null;
  }
}

/** Thu hồi quyền Sign in with Apple khi xoá tài khoản. Lỗi được log, không chặn việc xoá. */
export async function revokeRefreshToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const cfg = clientConfig();
  if (!cfg) {
    console.warn('[apple] Thiếu cấu hình khoá Apple: không thu hồi được token khi xoá tài khoản');
    return;
  }
  try {
    const res = await fetchImpl(`${APPLE}/auth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: await clientSecret(cfg),
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Apple /auth/revoke ${res.status}`);
  } catch (e) {
    console.error('[apple.revokeRefreshToken]', e);
  }
}
