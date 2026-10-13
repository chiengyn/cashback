import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { db, schema, type Tx } from '@/db';
import { keyedHash, newOtpCode, newSessionToken, safeEqual, sha256 } from '@/lib/crypto';
import { HttpError } from '@/lib/http';
import { sendSms } from '@/lib/sms';
import { exchangeAuthorizationCode, revokeRefreshToken, verifyIdentityToken } from './apple';

const { users, sessions, otpCodes } = schema;

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_AFTER_MS = 60_000;
const OTP_PER_PHONE_PER_HOUR = 5;
const OTP_PER_IP_PER_HOUR = 10;
const SESSION_TTL_MS = 180 * 86_400_000;

/** "+84 912 345 678" / "0912345678" → "0912345678"; null nếu không phải số di động VN. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s.-]/g, '');
  const local = digits.startsWith('+84') ? `0${digits.slice(3)}` : digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0(3|5|7|8|9)\d{8}$/.test(local) ? local : null;
}

export const otpHash = (phone: string, code: string) => keyedHash(`otp:${phone}:${code}`);

export async function requestOtp(phone: string, ipHash: string | null): Promise<void> {
  const hourAgo = new Date(Date.now() - 3_600_000);
  const [latest] = await db()
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_AFTER_MS) {
    throw new HttpError(429, 'Bạn vừa yêu cầu mã. Đợi 1 phút rồi thử lại.');
  }
  const [{ value: perPhone }] = await db().select({ value: count() }).from(otpCodes).where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, hourAgo)));
  if (perPhone! >= OTP_PER_PHONE_PER_HOUR) throw new HttpError(429, 'Số này đã nhận quá nhiều mã trong 1 giờ. Bạn thử lại sau.');
  if (ipHash) {
    const [{ value: perIp }] = await db().select({ value: count() }).from(otpCodes).where(and(eq(otpCodes.ipHash, ipHash), gt(otpCodes.createdAt, hourAgo)));
    if (perIp! >= OTP_PER_IP_PER_HOUR) throw new HttpError(429, 'Có quá nhiều yêu cầu mã từ mạng của bạn. Bạn thử lại sau.');
  }

  const code = newOtpCode();
  await db().insert(otpCodes).values({ phone, codeHash: otpHash(phone, code), ipHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  await sendSms(phone, `${code} la ma dang nhap HoanTien. Ma het han sau 5 phut. Khong chia se ma nay cho ai.`);
}

export type SignInResult = { token: string; phone: string | null };

/**
 * Kiểm tra mã mới nhất của số điện thoại.
 * - Chưa đăng nhập: tạo user (nếu chưa có) và session.
 * - Đã đăng nhập bằng Apple (`linkTo`): gắn số điện thoại vào tài khoản đó.
 */
export async function verifyOtp(phone: string, code: string, linkTo: AuthUser | null = null): Promise<SignInResult> {
  const [otp] = await db()
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  const invalid = new HttpError(400, 'Mã không đúng hoặc đã hết hạn. Bạn kiểm tra lại hoặc gửi mã mới.');
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

  if (!safeEqual(otp.codeHash, otpHash(phone, code))) {
    await db().update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw invalid;
  }

  return db().transaction(async (tx) => {
    const consumed = await tx
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.consumedAt)))
      .returning({ id: otpCodes.id });
    if (consumed.length === 0) throw invalid;

    if (linkTo) {
      if (linkTo.phone && linkTo.phone !== phone) throw new HttpError(409, 'Tài khoản này đã có số điện thoại khác.');
      const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, phone));
      if (owner && owner.id !== linkTo.id) {
        throw new HttpError(409, 'Số điện thoại này đã gắn với tài khoản khác. Đăng xuất rồi đăng nhập bằng số này.');
      }
      await tx.update(users).set({ phone }).where(eq(users.id, linkTo.id));
      return { token: await createSession(tx, linkTo.id), phone };
    }

    const [user] = await tx
      .insert(users)
      .values({ phone })
      .onConflictDoUpdate({ target: users.phone, set: { phone } })
      .returning({ id: users.id, status: users.status });
    assertActive(user!.status);
    return { token: await createSession(tx, user!.id), phone };
  });
}

/**
 * Sign in with Apple: tài khoản gắn với `sub` của Apple. Tài khoản mới chưa có số điện thoại,
 * phải thêm (qua OTP) trước khi rút tiền để giữ quy tắc một số điện thoại một tài khoản nhận tiền.
 */
export async function signInWithApple(input: { identityToken: string; authorizationCode: string | null }): Promise<SignInResult> {
  const { sub } = await verifyIdentityToken(input.identityToken);
  const refreshToken = input.authorizationCode ? await exchangeAuthorizationCode(input.authorizationCode) : null;

  return db().transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ appleSub: sub, appleRefreshToken: refreshToken })
      .onConflictDoUpdate({ target: users.appleSub, set: refreshToken ? { appleRefreshToken: refreshToken } : { appleSub: sub } })
      .returning({ id: users.id, status: users.status, phone: users.phone });
    assertActive(user!.status);
    return { token: await createSession(tx, user!.id), phone: user!.phone };
  });
}

function assertActive(status: string) {
  if (status !== 'active') throw new HttpError(403, 'Tài khoản này đang bị khoá. Liên hệ hỗ trợ để được giúp.');
}

async function createSession(tx: Tx, userId: string): Promise<string> {
  const token = newSessionToken();
  await tx.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
}

export type AuthUser = { id: string; phone: string | null; shareBps: number };

/** Đọc `Authorization: Bearer <token>`; null nếu không có hoặc token không hợp lệ. */
export async function currentUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;
  const [row] = await db()
    .select({ id: users.id, phone: users.phone, shareBps: users.shareBps })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.status, 'active')));
  return row ?? null;
}

export async function requireUser(req: Request): Promise<AuthUser> {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, 'Bạn cần đăng nhập lại.');
  return user;
}

/**
 * Xoá tài khoản (bắt buộc với App Store / Google Play): bỏ số điện thoại và liên kết Apple, xoá mọi session,
 * rồi thu hồi quyền Sign in with Apple. Đơn và sổ cái được giữ lại để đối soát với sàn;
 * số dư chưa rút không còn được trả. Đăng nhập lại bằng cùng số / cùng Apple ID sẽ tạo tài khoản mới.
 */
export async function deleteAccount(userId: string, revoke: (token: string) => Promise<void> = revokeRefreshToken): Promise<void> {
  const refreshToken = await db().transaction(async (tx) => {
    const [user] = await tx.select({ appleRefreshToken: users.appleRefreshToken }).from(users).where(eq(users.id, userId)).for('update');
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx
      .update(users)
      .set({ phone: null, appleSub: null, appleRefreshToken: null, status: 'deleted', deletedAt: new Date() })
      .where(eq(users.id, userId));
    return user?.appleRefreshToken ?? null;
  });
  if (refreshToken) await revoke(refreshToken);
}
