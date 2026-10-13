import { json, route } from '@/lib/http';
import { deleteAccount, requireUser } from '@/services/auth';

/** Xoá tài khoản từ trong app (App Store và Google Play đều yêu cầu). */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  await deleteAccount(user.id);
  return json({ ok: true });
});
