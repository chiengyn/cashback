import { HttpError } from '@/lib/http';
import { parseProductUrl, platformOfHost, type ProductRef } from '@/lib/links';

const MAX_HOPS = 5;
const TIMEOUT_MS = 3_000;
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/**
 * Theo redirect của short link (s.shopee.vn, s.lazada.vn, vt.tiktok.com…) tới trang sản phẩm.
 * Chỉ đi tiếp khi host vẫn thuộc domain sàn, để server không bị lợi dụng gọi tới địa chỉ tuỳ ý.
 */
export async function resolveProductLink(url: string, fetchImpl: typeof fetch = fetch): Promise<ProductRef> {
  let current = url;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const parsed = parseProductUrl(current);
    if (parsed) return parsed;
    if (hop === MAX_HOPS) break;

    const host = new URL(current).hostname;
    if (!platformOfHost(host)) break;

    let res: Response;
    try {
      res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': MOBILE_UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new HttpError(502, 'Không mở được link sản phẩm, bạn thử lại sau ít phút.');
    }
    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location) break;
    current = new URL(location, current).toString();
  }
  throw new HttpError(422, 'Link này không phải trang sản phẩm. Bạn mở đúng sản phẩm trong app sàn rồi chia sẻ lại.');
}
