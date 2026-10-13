/**
 * Adapter giả cho môi trường phát triển (AFFILIATE_MODE=mock): không gọi API sàn.
 * - Link affiliate = link sản phẩm gốc kèm ?sub_id=<click_id>.
 * - Mỗi click đã bấm "Mua ngay" sinh ra một đơn giả; đơn "hoàn tất" 2 phút sau khi bấm.
 * Đủ để chạy trọn luồng dán link → đơn → ví → rút tiền ở local.
 */
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';

import { db, schema } from '@/db';
import type { Platform } from '@/db/schema';
import type { ProductRef } from '@/lib/links';
import type {
  FetchConversionsInput,
  FetchConversionsResult,
  PlatformAdapter,
  PlatformConversion,
  ProductInfo,
} from './types';

const SAMPLES: Record<Platform, { title: string; price: number; commissionBps: number }> = {
  shopee: { title: 'Tai nghe Bluetooth chống ồn chủ động', price: 450_000, commissionBps: 600 },
  lazada: { title: 'Nồi chiên không dầu 5L', price: 1_290_000, commissionBps: 400 },
  tiktok: { title: 'Áo khoác gió nam nữ chống nước', price: 259_000, commissionBps: 1000 },
};

export const MOCK_COMPLETE_AFTER_MS = 2 * 60_000;

export class MockAdapter implements PlatformAdapter {
  constructor(readonly platform: Platform) {}

  async getProductInfo(): Promise<ProductInfo> {
    const s = SAMPLES[this.platform];
    return { title: s.title, imageUrl: null, price: s.price, commissionBps: s.commissionBps };
  }

  async createLink(ref: ProductRef, clickId: string): Promise<string> {
    const url = new URL(ref.canonicalUrl);
    url.searchParams.set('sub_id', clickId);
    return url.toString();
  }

  async fetchConversions({ mode, from, to }: FetchConversionsInput): Promise<FetchConversionsResult> {
    const s = SAMPLES[this.platform];
    // Thời điểm bấm "Mua ngay" được coi là lúc đặt hàng; đơn hoàn tất sau MOCK_COMPLETE_AFTER_MS.
    const windowStart = mode === 'complete' ? new Date(from.getTime() - MOCK_COMPLETE_AFTER_MS) : from;
    const rows = await db()
      .select({ clickId: schema.clicks.id, redirectedAt: schema.clicks.redirectedAt, itemId: schema.products.itemId, title: schema.products.title })
      .from(schema.clicks)
      .innerJoin(schema.products, eq(schema.products.id, schema.clicks.productId))
      .where(
        and(
          eq(schema.clicks.platform, this.platform),
          isNotNull(schema.clicks.redirectedAt),
          gte(schema.clicks.redirectedAt, windowStart),
          lte(schema.clicks.redirectedAt, to),
        ),
      );

    const now = Date.now();
    const conversions: PlatformConversion[] = rows.map((row) => {
      const purchasedAt = row.redirectedAt!;
      const completedAt = new Date(purchasedAt.getTime() + MOCK_COMPLETE_AFTER_MS);
      const completed = completedAt.getTime() <= now;
      return {
        orderId: `MOCK-${row.clickId}`,
        itemId: row.itemId,
        clickId: row.clickId,
        itemName: row.title,
        imageUrl: null,
        orderAmount: s.price,
        commission: Math.round((s.price * s.commissionBps) / 10_000),
        platformStatus: completed ? 'completed' : 'pending',
        purchasedAt,
        completedAt: completed ? completedAt : null,
        raw: { mock: true },
      };
    });
    return { conversions, complete: true };
  }
}
