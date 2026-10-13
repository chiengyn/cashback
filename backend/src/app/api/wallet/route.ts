import { json, route } from '@/lib/http';
import { requireUser } from '@/services/auth';
import { getWallet } from '@/services/wallet';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json(await getWallet(user));
});
