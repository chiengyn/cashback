import { z } from 'zod';

import { HttpError, json, readJson, route } from '@/lib/http';
import { ipHash } from '@/lib/request-info';
import { normalizePhone, requestOtp } from '@/services/auth';

const Body = z.object({ phone: z.string().max(20) });

export const POST = route(async (req) => {
  const phone = normalizePhone((await readJson(req, Body)).phone);
  if (!phone) throw new HttpError(400, 'Số điện thoại chưa đúng. Ví dụ: 0912345678.');
  await requestOtp(phone, ipHash(req));
  return json({ ok: true });
});
