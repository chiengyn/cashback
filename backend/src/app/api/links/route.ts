import { z } from 'zod';

import { json, readJson, route } from '@/lib/http';
import { ipHash, userAgent } from '@/lib/request-info';
import { currentUser } from '@/services/auth';
import { createLinkPreview } from '@/services/links';

const Body = z.object({ url: z.string().trim().min(1, 'Bạn chưa dán link.').max(2000) });

/** Người chưa đăng nhập vẫn xem trước được; click được gắn cho họ khi bấm "Mua ngay". */
export const POST = route(async (req) => {
  const { url } = await readJson(req, Body);
  const user = await currentUser(req);
  return json(await createLinkPreview(url, { user, ipHash: ipHash(req), userAgent: userAgent(req) }));
});
