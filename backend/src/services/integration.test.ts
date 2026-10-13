/**
 * Chạy trên Postgres thật. Bật bằng TEST_DATABASE_URL, ví dụ:
 *   docker run -d --name hoantien-pg-test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hoantien -p 55432:5432 postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/hoantien npm test
 */
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db, schema } from '@/db';
import { newSessionToken, sha256 } from '@/lib/crypto';
import { MockAdapter } from '@/platforms/mock';
import type { AuthUser } from './auth';
import { applyConversion, balanceOf } from './conversions';
import { acquireLock, releaseLock } from './cron-lock';
import { createLinkPreview, openClick } from './links';
import { syncPlatform } from './sync-orders';
import { markWithdrawalPaid, rejectWithdrawal, requestWithdrawal } from './wallet';

const enabled = !!process.env.TEST_DATABASE_URL;
const PRODUCT_URL = 'https://shopee.vn/Tai-nghe-i.88201234.23456789012';
const opts = () => ({ now: new Date(), deadline: Date.now() + 60_000, holdDays: 30 });

async function createUser(phone = '0912345678'): Promise<AuthUser & { token: string }> {
  const [user] = await db().insert(schema.users).values({ phone }).returning();
  const token = newSessionToken();
  await db().insert(schema.sessions).values({ userId: user!.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user!.id, phone, shareBps: user!.shareBps, token };
}

describe.skipIf(!enabled)('integration', () => {
  beforeAll(async () => {
    await migrate(db(), { migrationsFolder: 'drizzle' });
  });

  beforeEach(async () => {
    await db().execute(sql`TRUNCATE ledger_entries, withdrawals, conversions, clicks, products, sessions, otp_codes, users, cron_jobs CASCADE`);
  });

  describe('khoá cron', () => {
    it('hai lần chạy cùng lúc thì chỉ một lần giành được khoá', async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => acquireLock(db(), 'shopee:purchase')));
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('nhả khoá xong thì lần sau giành lại được và đọc được cursor', async () => {
      const lock = await acquireLock(db(), 'shopee:purchase');
      const cursor = new Date('2026-10-01T00:00:00Z');
      await releaseLock(db(), lock!, { ok: true, syncCursor: cursor });
      const again = await acquireLock(db(), 'shopee:purchase');
      expect(again?.syncCursor?.toISOString()).toBe(cursor.toISOString());
    });

    it('khoá hết hạn (function bị kill) thì lần sau giành lại được', async () => {
      await acquireLock(db(), 'shopee:purchase');
      expect(await acquireLock(db(), 'shopee:purchase')).toBeNull();
      await db().update(schema.cronJobs).set({ lockedUntil: new Date(Date.now() - 1000) });
      expect(await acquireLock(db(), 'shopee:purchase')).not.toBeNull();
    });

    it('lần chạy cũ không nhả được khoá của lần chạy mới', async () => {
      const old = await acquireLock(db(), 'shopee:purchase');
      await db().update(schema.cronJobs).set({ lockedUntil: new Date(Date.now() - 1000) });
      const fresh = await acquireLock(db(), 'shopee:purchase');
      await releaseLock(db(), old!, { ok: false, error: 'timeout' });
      expect(await acquireLock(db(), 'shopee:purchase')).toBeNull();
      expect(fresh).not.toBeNull();
    });
  });

  describe('luồng dán link → đơn → ví', () => {
    it('cộng tiền đúng một lần dù đồng bộ nhiều lần', async () => {
      const user = await createUser();
      const preview = await createLinkPreview(`Xem ngay ${PRODUCT_URL}`, { user, ipHash: 'ip', userAgent: 'test' });
      expect(preview).toMatchObject({ platform: 'shopee', estimatedCashback: 18_900 });

      // Dán lại trong 24 giờ thì dùng lại click cũ.
      const again = await createLinkPreview(PRODUCT_URL, { user, ipHash: 'ip', userAgent: 'test' });
      expect(again.clickId).toBe(preview.clickId);

      const { affiliateUrl } = await openClick(preview.clickId, user);
      expect(affiliateUrl).toContain(`sub_id=${preview.clickId}`);

      // Đơn vừa đặt: chờ duyệt.
      const adapter = new MockAdapter('shopee');
      await syncPlatform(db(), adapter, 'purchase', opts());
      expect(await balanceOf(db(), user.id)).toEqual({ pending: 18_900, available: 0 });

      // Giả lập đơn đặt từ 40 ngày trước: đã hoàn tất và qua 30 ngày giữ tiền.
      await db().update(schema.clicks).set({ redirectedAt: new Date(Date.now() - 40 * 86_400_000) });
      const first = await syncPlatform(db(), adapter, 'reconcile', opts());
      const second = await syncPlatform(db(), adapter, 'reconcile', opts());
      expect(first).toMatchObject({ status: 'ok', fetched: 1 });
      expect(second).toMatchObject({ status: 'ok', fetched: 1 });
      expect(await balanceOf(db(), user.id)).toEqual({ pending: 0, available: 18_900 });

      const entries = await db().select().from(schema.ledgerEntries).where(eq(schema.ledgerEntries.userId, user.id));
      expect(entries.map((e) => e.type).sort()).toEqual(['order_approved', 'order_pending']);

      // Sàn thu hồi sau khi đã duyệt.
      const [conv] = await db().select().from(schema.conversions);
      await applyConversion(
        db(),
        'shopee',
        { orderId: conv!.orderId, itemId: conv!.itemId, clickId: conv!.clickId, itemName: null, imageUrl: null, orderAmount: 0, commission: 27_000, platformStatus: 'cancelled', purchasedAt: conv!.purchasedAt, completedAt: conv!.completedAt, raw: null },
        { now: new Date(), holdDays: 30 },
      );
      expect(await balanceOf(db(), user.id)).toEqual({ pending: 0, available: 0 });
    });

    it('đơn không có click hợp lệ vẫn được ghi nhưng không cộng tiền', async () => {
      await applyConversion(
        db(),
        'shopee',
        { orderId: 'X1', itemId: '1', clickId: 'NoSuchClk1', itemName: null, imageUrl: null, orderAmount: 100_000, commission: 5_000, platformStatus: 'pending', purchasedAt: new Date(), completedAt: null, raw: null },
        { now: new Date(), holdDays: 30 },
      );
      const [conv] = await db().select().from(schema.conversions);
      expect(conv).toMatchObject({ userId: null, clickId: null, cashback: 0 });
      expect(await db().select().from(schema.ledgerEntries)).toHaveLength(0);
    });
  });

  describe('rút tiền', () => {
    async function userWithBalance(amount: number) {
      const user = await createUser();
      await db().insert(schema.ledgerEntries).values({ userId: user.id, type: 'withdrawal_refund', availableDelta: amount, label: 'seed' });
      return user;
    }
    const input = (amount: number) => ({ amount, bankName: 'Vietcombank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A' });

    it('hai lệnh rút cùng lúc không tiêu chung một số dư', async () => {
      const user = await userWithBalance(18_900);
      const results = await Promise.allSettled([requestWithdrawal(user, input(15_000)), requestWithdrawal(user, input(15_000))]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await balanceOf(db(), user.id)).toEqual({ pending: 0, available: 3_900 });
    });

    it('admin từ chối thì trả tiền lại ví đúng một lần; đã chuyển thì không từ chối được nữa', async () => {
      const user = await userWithBalance(30_000);
      await requestWithdrawal(user, input(20_000));
      await requestWithdrawal(user, input(10_000));
      const [first, second] = await db().select().from(schema.withdrawals).orderBy(schema.withdrawals.amount);
      await rejectWithdrawal(second!.id, 'Sai số tài khoản');
      await rejectWithdrawal(second!.id, 'Bấm hai lần');
      expect(await balanceOf(db(), user.id)).toEqual({ pending: 0, available: 20_000 });
      await markWithdrawalPaid(first!.id);
      await rejectWithdrawal(first!.id, 'muộn');
      expect(await balanceOf(db(), user.id)).toEqual({ pending: 0, available: 20_000 });
    });

    it('từ chối khi dưới mức tối thiểu hoặc vượt số dư', async () => {
      const user = await userWithBalance(18_900);
      await expect(requestWithdrawal(user, input(5_000))).rejects.toMatchObject({ status: 400 });
      await expect(requestWithdrawal(user, input(20_000))).rejects.toMatchObject({ message: 'Số dư khả dụng không đủ.' });
    });
  });

  describe('route handlers', () => {
    it('cron từ chối khi sai CRON_SECRET', async () => {
      const { GET } = await import('@/app/api/cron/sync-orders/[mode]/route');
      const res = await GET(new Request('http://x/api/cron/sync-orders/purchase'), { params: Promise.resolve({ mode: 'purchase' }) });
      expect(res.status).toBe(401);
    });

    it('cron chạy đủ ba sàn ở chế độ mock', async () => {
      const { GET } = await import('@/app/api/cron/sync-orders/[mode]/route');
      const req = new Request('http://x/api/cron/sync-orders/purchase', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      const res = await GET(req, { params: Promise.resolve({ mode: 'purchase' }) });
      const body = (await res.json()) as { results: { job: string; status: string }[] };
      expect(res.status).toBe(200);
      expect(body.results.map((r) => r.job)).toEqual(['shopee:purchase', 'lazada:purchase', 'tiktok:purchase']);
    });

    it('POST /api/links trả lỗi tiếng Việt khi không có link sàn', async () => {
      const { POST } = await import('@/app/api/links/route');
      const res = await POST(new Request('http://x/api/links', { method: 'POST', body: JSON.stringify({ url: 'https://google.com' }) }), undefined);
      expect(res.status).toBe(422);
      expect(((await res.json()) as { message: string }).message).toContain('Không tìm thấy link');
    });

    it('các API cần đăng nhập trả 401 khi thiếu token', async () => {
      const { GET } = await import('@/app/api/wallet/route');
      const res = await GET(new Request('http://x/api/wallet'), undefined);
      expect(res.status).toBe(401);
    });
  });
});
