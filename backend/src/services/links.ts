import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { db, schema } from '@/db';
import type { Platform } from '@/db/schema';
import { userCashback } from '@/lib/cashback';
import { newClickId } from '@/lib/crypto';
import { HttpError } from '@/lib/http';
import { extractProductLink, INVALID_LINK, type ProductRef } from '@/lib/links';
import { resolveProductLink } from '@/lib/resolve-link';
import { getAdapter } from '@/platforms';
import type { ProductInfo } from '@/platforms/types';
import type { AuthUser } from './auth';

const { products, clicks } = schema;

const PRODUCT_CACHE_MS = 6 * 3_600_000;
const REUSE_CLICK_MS = 24 * 3_600_000;
const LINKS_PER_MINUTE_PER_USER = 10;
const LINKS_PER_MINUTE_PER_IP = 30;
/** Người chưa đăng nhập: ước tính theo tỉ lệ chia mặc định. */
const DEFAULT_SHARE_BPS = 7000;

export type LinkPreview = {
  clickId: string;
  platform: Platform;
  originalUrl: string;
  product: { title: string; imageUrl: string | null; price: number | null };
  estimatedCashback: number | null;
};

type Product = typeof products.$inferSelect;

/** POST /api/links: resolve link, lấy thông tin sản phẩm, tạo click có link affiliate. */
export async function createLinkPreview(
  rawText: string,
  ctx: { user: AuthUser | null; ipHash: string | null; userAgent: string | null },
): Promise<LinkPreview> {
  const extracted = extractProductLink(rawText);
  if (!extracted) throw new HttpError(422, INVALID_LINK);

  await enforceRateLimit(ctx.user?.id ?? null, ctx.ipHash);

  const adapter = getAdapter(extracted.platform);
  const ref = await resolveProductLink(extracted.url);
  const product = await upsertProduct(ref, () => adapter.getProductInfo(ref));
  const shareBps = ctx.user?.shareBps ?? DEFAULT_SHARE_BPS;

  if (ctx.user) {
    const [recent] = await db()
      .select()
      .from(clicks)
      .where(and(eq(clicks.userId, ctx.user.id), eq(clicks.productId, product.id), gt(clicks.createdAt, new Date(Date.now() - REUSE_CLICK_MS))))
      .orderBy(desc(clicks.createdAt))
      .limit(1);
    if (recent) return toPreview(recent.id, extracted.url, product, shareBps);
  }

  const clickId = newClickId();
  const affiliateUrl = await adapter.createLink(ref, clickId);
  await db().insert(clicks).values({
    id: clickId,
    userId: ctx.user?.id ?? null,
    productId: product.id,
    platform: ref.platform,
    originalUrl: extracted.url,
    affiliateUrl,
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });
  return toPreview(clickId, extracted.url, product, shareBps);
}

/**
 * POST /api/clicks/:id/open: ghi lượt bấm "Mua ngay" và trả link affiliate.
 * Click tạo lúc chưa đăng nhập được gắn cho người dùng ở bước này.
 */
export async function openClick(clickId: string, user: AuthUser): Promise<{ affiliateUrl: string }> {
  const [claimed] = await db()
    .update(clicks)
    .set({ userId: user.id })
    .where(and(eq(clicks.id, clickId), isNull(clicks.userId)))
    .returning({ id: clicks.id });
  const [click] = await db().select().from(clicks).where(eq(clicks.id, clickId));
  if (!click || (!claimed && click.userId !== user.id)) throw new HttpError(404, 'Link đã hết hạn. Bạn dán lại link sản phẩm nhé.');

  await db().update(clicks).set({ redirectedAt: new Date() }).where(and(eq(clicks.id, clickId), isNull(clicks.redirectedAt)));
  return { affiliateUrl: click.affiliateUrl };
}

/** GET /r/:clickId: link chia sẻ ra ngoài app (trình duyệt), ghi lượt bấm rồi 302 sang sàn. */
export async function redirectTarget(clickId: string, ctx: { ipHash: string | null; userAgent: string | null }): Promise<string | null> {
  const [click] = await db()
    .update(clicks)
    .set({ redirectedAt: new Date(), ipHash: ctx.ipHash, userAgent: ctx.userAgent })
    .where(eq(clicks.id, clickId))
    .returning({ affiliateUrl: clicks.affiliateUrl });
  return click?.affiliateUrl ?? null;
}

export async function recentLinks(user: AuthUser) {
  const rows = await db()
    .select({ click: clicks, product: products })
    .from(clicks)
    .innerJoin(products, eq(products.id, clicks.productId))
    .where(eq(clicks.userId, user.id))
    .orderBy(desc(clicks.createdAt))
    .limit(10);
  return rows.map(({ click, product }) => ({
    clickId: click.id,
    platform: click.platform,
    originalUrl: click.originalUrl,
    title: product.title ?? 'Sản phẩm',
    imageUrl: product.imageUrl,
    estimatedCashback: estimate(product, user.shareBps),
    createdAt: click.createdAt.toISOString(),
  }));
}

async function upsertProduct(ref: ProductRef, fetchInfo: () => Promise<ProductInfo>): Promise<Product> {
  const key = and(eq(products.platform, ref.platform), eq(products.shopId, ref.shopId), eq(products.itemId, ref.itemId));
  const [cached] = await db().select().from(products).where(key);
  if (cached?.fetchedAt && Date.now() - cached.fetchedAt.getTime() < PRODUCT_CACHE_MS) return cached;

  // Lỗi lấy thông tin sản phẩm không chặn việc tạo link: preview chỉ thiếu tên/giá/ước tính.
  const info = await fetchInfo().catch((e) => {
    console.warn('[getProductInfo]', e);
    return null;
  });
  const [row] = await db()
    .insert(products)
    .values({ ...ref, ...(info ?? {}), fetchedAt: info ? new Date() : null })
    .onConflictDoUpdate({
      target: [products.platform, products.shopId, products.itemId],
      set: info ? { ...info, canonicalUrl: ref.canonicalUrl, fetchedAt: new Date() } : { canonicalUrl: ref.canonicalUrl },
    })
    .returning();
  return row!;
}

function estimate(product: Product, shareBps: number): number | null {
  if (product.price === null || product.commissionBps === null) return null;
  return userCashback(Math.round((product.price * product.commissionBps) / 10_000), shareBps);
}

function toPreview(clickId: string, originalUrl: string, product: Product, shareBps: number): LinkPreview {
  return {
    clickId,
    platform: product.platform,
    originalUrl,
    product: { title: product.title ?? 'Sản phẩm', imageUrl: product.imageUrl, price: product.price },
    estimatedCashback: estimate(product, shareBps),
  };
}

/** Đếm click trong 1 phút qua trên bảng `clicks` (có index (user_id, created_at) và (ip_hash, created_at)). */
async function enforceRateLimit(userId: string | null, ipHash: string | null) {
  const since = new Date(Date.now() - 60_000);
  const tooMany = new HttpError(429, 'Bạn dán link hơi nhanh. Đợi một chút rồi thử lại nhé.');
  if (userId) {
    const [{ value }] = await db().select({ value: count() }).from(clicks).where(and(eq(clicks.userId, userId), gt(clicks.createdAt, since)));
    if (value! >= LINKS_PER_MINUTE_PER_USER) throw tooMany;
  }
  if (ipHash) {
    const [{ value }] = await db().select({ value: count() }).from(clicks).where(and(eq(clicks.ipHash, ipHash), gt(clicks.createdAt, since)));
    if (value! >= LINKS_PER_MINUTE_PER_IP) throw tooMany;
  }
}
