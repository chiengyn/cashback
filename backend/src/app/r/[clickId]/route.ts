import { CLICK_ID_PATTERN } from '@/lib/crypto';
import { ipHash, userAgent } from '@/lib/request-info';
import { redirectTarget } from '@/services/links';

/** Link chia sẻ ra ngoài app (mở bằng trình duyệt). App mobile không dùng route này. */
export async function GET(req: Request, { params }: { params: Promise<{ clickId: string }> }) {
  const { clickId } = await params;
  const target = CLICK_ID_PATTERN.test(clickId) ? await redirectTarget(clickId, { ipHash: ipHash(req), userAgent: userAgent(req) }) : null;
  return Response.redirect(target ?? new URL('/', req.url).toString(), 302);
}
