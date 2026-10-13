import { z } from 'zod';

import { HttpError, json, readJson, route } from '@/lib/http';
import { currentUser, normalizePhone, verifyOtp } from '@/services/auth';

const Body = z.object({ phone: z.string().max(20), code: z.string().regex(/^\d{6}$/, 'Mã OTP gồm 6 chữ số.') });

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, 'Số điện thoại chưa đúng. Ví dụ: 0912345678.');
  // Gửi kèm token của tài khoản Apple thì số điện thoại được gắn vào tài khoản đó.
  return json(await verifyOtp(phone, body.code, await currentUser(req)));
});
