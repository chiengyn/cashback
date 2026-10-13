import type { Platform } from '@/db/schema';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { PlatformName } from '@/lib/links';
import { MockAdapter } from './mock';
import { ShopeeAdapter } from './shopee';
import type { PlatformAdapter } from './types';

/**
 * Lazada và TikTok Shop chưa có tích hợp thật: cần xác minh API affiliate (Lazada Open Platform)
 * hoặc chọn network trung gian cho TikTok Shop trước (Phase 0 trong tài liệu thiết kế).
 */
class NotConfiguredAdapter implements PlatformAdapter {
  constructor(readonly platform: Platform) {}
  private fail(): never {
    throw new HttpError(503, `Chưa hỗ trợ hoàn tiền cho ${PlatformName[this.platform]}. Bạn thử link Shopee nhé.`);
  }
  async getProductInfo(): Promise<never> {
    this.fail();
  }
  async createLink(): Promise<never> {
    this.fail();
  }
  async fetchConversions() {
    return { conversions: [], complete: true };
  }
}

export function getAdapter(platform: Platform): PlatformAdapter {
  const e = env();
  if (e.AFFILIATE_MODE === 'mock') return new MockAdapter(platform);
  if (platform === 'shopee' && e.SHOPEE_APP_ID && e.SHOPEE_SECRET) {
    return new ShopeeAdapter(e.SHOPEE_APP_ID, e.SHOPEE_SECRET);
  }
  return new NotConfiguredAdapter(platform);
}

/** Các sàn mà cron đồng bộ đơn. */
export function syncedPlatforms(): Platform[] {
  const e = env();
  if (e.AFFILIATE_MODE === 'mock') return ['shopee', 'lazada', 'tiktok'];
  return e.SHOPEE_APP_ID && e.SHOPEE_SECRET ? ['shopee'] : [];
}
