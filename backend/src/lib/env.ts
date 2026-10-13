import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  /** Vercel Cron gửi header `Authorization: Bearer $CRON_SECRET`. */
  CRON_SECRET: z.string().min(16),
  /** Dùng để hash IP và mã OTP. */
  AUTH_SECRET: z.string().min(16),
  ADMIN_PASSWORD: z.string().min(8),
  /** `mock`: không gọi API sàn, dùng adapter giả (mặc định khi chạy local). */
  AFFILIATE_MODE: z.enum(['mock', 'live']).default(process.env.NODE_ENV === 'production' ? 'live' : 'mock'),
  SHOPEE_APP_ID: z.string().optional(),
  SHOPEE_SECRET: z.string().optional(),
  /** `console`: in mã OTP ra log, chỉ dùng khi phát triển. */
  SMS_PROVIDER: z.enum(['console']).default('console'),
  /** Sign in with Apple: bundle id của app iOS, dùng làm `aud` khi kiểm tra token và `client_id` khi gọi API Apple. */
  APPLE_BUNDLE_ID: z.string().default('vn.hoantien.app'),
  /** Để đổi authorization code lấy refresh token và thu hồi khi xoá tài khoản. Thiếu thì bỏ qua bước thu hồi. */
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  /** Nội dung file .p8; xuống dòng có thể viết thành \n. */
  APPLE_PRIVATE_KEY: z.string().optional(),
  MIN_WITHDRAWAL: z.coerce.number().int().positive().default(50_000),
  /** Số ngày giữ tiền sau khi đơn hoàn tất (hết hạn đổi trả) rồi mới cho rút. */
  APPROVAL_HOLD_DAYS: z.coerce.number().int().nonnegative().default(30),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Đọc lúc chạy (không phải lúc build) để `next build` không cần secret. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Thiếu hoặc sai biến môi trường: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
