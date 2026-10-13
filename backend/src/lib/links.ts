import type { Platform } from '@/db/schema';

export type ProductRef = { platform: Platform; shopId: string; itemId: string; canonicalUrl: string };

export const PlatformName: Record<Platform, string> = {
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiktok: 'TikTok Shop',
};

export const INVALID_LINK =
  'Không tìm thấy link Shopee, Lazada hoặc TikTok Shop. Bạn mở sản phẩm trong app sàn, bấm Chia sẻ → Sao chép liên kết rồi dán lại.';

const HOSTS: Record<Platform, string[]> = {
  shopee: ['shopee.vn', 'shp.ee', 'shope.ee'],
  lazada: ['lazada.vn', 'lzd.co'],
  tiktok: ['tiktok.com'],
};

/** Host thuộc (hoặc là subdomain của) một trong các domain sàn. */
export function platformOfHost(host: string): Platform | null {
  const h = host.toLowerCase();
  for (const [platform, domains] of Object.entries(HOSTS) as [Platform, string[]][]) {
    if (domains.some((d) => h === d || h.endsWith(`.${d}`))) return platform;
  }
  return null;
}

export function detectPlatform(url: string): Platform | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return platformOfHost(u.hostname);
  } catch {
    return null;
  }
}

/** Lấy link sàn đầu tiên trong đoạn chữ chia sẻ (app sàn thường kèm tên và giá sản phẩm). */
export function extractProductLink(text: string): { url: string; platform: Platform } | null {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[).,!?]+$/, '');
    const platform = detectPlatform(url);
    if (platform) return { url, platform };
  }
  return null;
}

/**
 * Đọc mã sản phẩm từ URL đầy đủ (sau khi đã resolve short link). Trả null nếu URL không phải trang sản phẩm.
 * Các dạng URL lấy từ link thực tế của sàn; dạng mới phát sinh thì thêm vào đây kèm test.
 */
export function parseProductUrl(url: string): ProductRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const platform = platformOfHost(u.hostname);
  const path = decodeURIComponent(u.pathname);

  if (platform === 'shopee') {
    // https://shopee.vn/product/88201234/23456789012
    const direct = path.match(/\/product\/(\d+)\/(\d+)/);
    // https://shopee.vn/Tai-nghe-Bluetooth-i.88201234.23456789012
    const slug = path.match(/-i\.(\d+)\.(\d+)/);
    const m = direct ?? slug;
    if (!m) return null;
    const [, shopId, itemId] = m;
    return { platform, shopId: shopId!, itemId: itemId!, canonicalUrl: `https://shopee.vn/product/${shopId}/${itemId}` };
  }

  if (platform === 'lazada') {
    // https://www.lazada.vn/products/noi-chien-khong-dau-i2345678901-s12345678901.html
    const m = path.match(/-i(\d+)(?:-s\d+)?\.html/);
    if (!m) return null;
    return { platform, shopId: '', itemId: m[1]!, canonicalUrl: `https://www.lazada.vn/products/i${m[1]}.html` };
  }

  if (platform === 'tiktok') {
    // https://shop.tiktok.com/view/product/1729384756102938475 hoặc .../product/1729384756102938475
    const m = path.match(/\/product\/(\d{10,})/);
    if (!m) return null;
    return { platform, shopId: '', itemId: m[1]!, canonicalUrl: `https://shop.tiktok.com/view/product/${m[1]}` };
  }

  return null;
}
