export type Platform = 'shopee' | 'lazada' | 'tiktok';

export const PlatformName: Record<Platform, string> = {
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiktok: 'TikTok Shop',
};

const PLATFORM_HOSTS: { platform: Platform; pattern: RegExp }[] = [
  { platform: 'shopee', pattern: /(^|\.)shopee\.vn$|(^|\.)shp\.ee$/ },
  { platform: 'lazada', pattern: /(^|\.)lazada\.vn$|(^|\.)lzd\.co$/ },
  { platform: 'tiktok', pattern: /(^|\.)tiktok\.com$/ },
];

export const INVALID_LINK =
  'Không tìm thấy link Shopee, Lazada hoặc TikTok Shop. Bạn mở sản phẩm trong app sàn, bấm Chia sẻ → Sao chép liên kết rồi dán lại vào đây.';

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;

export function detectPlatform(url: string): Platform | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PLATFORM_HOSTS.find(({ pattern }) => pattern.test(host))?.platform ?? null;
}

/**
 * Link chia sẻ từ app sàn thường kèm chữ, ví dụ
 * "Xem Tai nghe Bluetooth giá ₫450.000 tại Shopee! https://s.shopee.vn/6AbCdEf123".
 * Trả về link đầu tiên thuộc một trong ba sàn, hoặc null.
 */
export function extractProductLink(text: string): { url: string; platform: Platform } | null {
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const url = match[0].replace(/[).,!?]+$/, '');
    const platform = detectPlatform(url);
    if (platform) return { url, platform };
  }
  return null;
}
