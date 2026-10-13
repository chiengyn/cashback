import { z } from 'zod';

import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/services/auth';
import { requestWithdrawal } from '@/services/wallet';

const Body = z.object({
  amount: z.number().int('Số tiền phải là số nguyên.').positive('Số tiền phải lớn hơn 0.'),
  bankName: z.string().trim().min(2, 'Bạn chưa nhập tên ngân hàng.').max(100),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Số tài khoản chỉ gồm 6–20 chữ số.'),
  accountName: z.string().trim().min(2, 'Bạn chưa nhập tên chủ tài khoản.').max(100).transform((s) => s.toUpperCase()),
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  await requestWithdrawal(user, await readJson(req, Body));
  return json({ ok: true }, 201);
});
