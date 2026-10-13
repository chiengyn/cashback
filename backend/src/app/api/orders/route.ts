import { json, route } from '@/lib/http';
import { requireUser } from '@/services/auth';
import { listOrders } from '@/services/wallet';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json(await listOrders(user));
});
