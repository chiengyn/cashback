import { and, eq, lte, sql } from 'drizzle-orm';

import { type Db, schema, type Tx } from '@/db';
import type { ConversionStatus, Platform } from '@/db/schema';
import { deriveStatus, LEDGER_LABEL, planLedger, userCashback, type LedgerState } from '@/lib/cashback';
import type { PlatformConversion } from '@/platforms/types';

const { conversions, clicks, users, ledgerEntries } = schema;

type Existing = typeof conversions.$inferSelect;

/**
 * Ghi một dòng đơn từ báo cáo của sàn và các bút toán tương ứng trong cùng một transaction.
 * Chạy lại nhiều lần với cùng dữ liệu cho cùng kết quả: upsert theo (platform, order_id, item_id),
 * bút toán chỉ ghi khi trạng thái đổi, và UNIQUE (conversion_id, type) chặn ghi trùng.
 */
export async function applyConversion(
  db: Db,
  platform: Platform,
  conv: PlatformConversion,
  opts: { now: Date; holdDays: number },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversions)
      .where(and(eq(conversions.platform, platform), eq(conversions.orderId, conv.orderId), eq(conversions.itemId, conv.itemId)))
      .for('update');

    const owner = existing
      ? { userId: existing.userId, shareBps: await shareOf(tx, existing.userId), clickExists: existing.clickId !== null }
      : await ownerOfClick(tx, conv.clickId);
    const cashback = owner.userId ? userCashback(conv.commission, owner.shareBps) : 0;
    const nextStatus = deriveStatus(conv.platformStatus, conv.completedAt, opts.now, opts.holdDays);

    const values = {
      itemName: conv.itemName,
      imageUrl: conv.imageUrl,
      orderAmount: conv.orderAmount,
      commission: conv.commission,
      cashback,
      platformStatus: conv.platformStatus,
      purchasedAt: conv.purchasedAt,
      completedAt: conv.completedAt,
      raw: conv.raw,
      updatedAt: opts.now,
    };

    if (!existing) {
      const [created] = await tx
        .insert(conversions)
        .values({
          platform,
          orderId: conv.orderId,
          itemId: conv.itemId,
          clickId: owner.clickExists ? conv.clickId : null,
          userId: owner.userId,
          status: 'pending',
          ...values,
        })
        .returning();
      await transition(tx, created!, null, nextStatus, cashback);
      return;
    }

    const [updated] = await tx.update(conversions).set(values).where(eq(conversions.id, existing.id)).returning();
    await transition(tx, updated!, stateOf(existing), nextStatus, cashback);
  });
}

/**
 * Đơn đã hoàn tất và qua thời gian giữ tiền thì chuyển sang approved, không cần gọi API sàn.
 * Chạy sau mỗi lần đồng bộ.
 */
export async function promoteMatured(db: Db, opts: { now: Date; holdDays: number }): Promise<number> {
  const cutoff = new Date(opts.now.getTime() - opts.holdDays * 86_400_000);
  const due = await db
    .select({ id: conversions.id })
    .from(conversions)
    .where(and(eq(conversions.status, 'pending'), eq(conversions.platformStatus, 'completed'), lte(conversions.completedAt, cutoff)))
    .limit(1000);

  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const [row] = await tx.select().from(conversions).where(eq(conversions.id, id)).for('update');
      if (!row || row.status !== 'pending') return;
      await transition(tx, row, stateOf(row), 'approved', row.cashback);
    });
  }
  return due.length;
}

function stateOf(row: Existing): LedgerState {
  return { status: row.status, creditedPending: row.creditedPending, creditedAvailable: row.creditedAvailable };
}

async function transition(tx: Tx, row: Existing, prev: LedgerState | null, nextStatus: ConversionStatus, cashback: number) {
  const { events, state } = planLedger(prev, nextStatus, cashback);
  if (row.userId && events.length > 0) {
    const label = `${LEDGER_LABEL[events.at(-1)!.type]} #…${row.orderId.slice(-4)}`;
    await tx
      .insert(ledgerEntries)
      .values(events.map((e) => ({ userId: row.userId!, conversionId: row.id, label, ...e })))
      .onConflictDoNothing();
  }
  await tx
    .update(conversions)
    .set({ status: state.status, creditedPending: state.creditedPending, creditedAvailable: state.creditedAvailable })
    .where(eq(conversions.id, row.id));
}

async function ownerOfClick(tx: Tx, clickId: string | null) {
  if (!clickId) return { userId: null, shareBps: 0, clickExists: false };
  const [row] = await tx
    .select({ userId: clicks.userId, shareBps: users.shareBps, status: users.status })
    .from(clicks)
    .leftJoin(users, eq(users.id, clicks.userId))
    .where(eq(clicks.id, clickId));
  if (!row) return { userId: null, shareBps: 0, clickExists: false };
  // Tài khoản đã xoá hoặc bị khoá vẫn ghi đơn để đối soát nhưng không cộng tiền.
  const eligible = row.userId && row.status === 'active';
  return { userId: eligible ? row.userId : null, shareBps: row.shareBps ?? 0, clickExists: true };
}

async function shareOf(tx: Tx, userId: string | null): Promise<number> {
  if (!userId) return 0;
  const [row] = await tx.select({ shareBps: users.shareBps }).from(users).where(eq(users.id, userId));
  return row?.shareBps ?? 0;
}

/** Số dư ví từ sổ cái. */
export async function balanceOf(db: Db | Tx, userId: string) {
  const [row] = await db
    .select({
      pending: sql<string>`coalesce(sum(${ledgerEntries.pendingDelta}), 0)`,
      available: sql<string>`coalesce(sum(${ledgerEntries.availableDelta}), 0)`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId));
  return { pending: Number(row?.pending ?? 0), available: Number(row?.available ?? 0) };
}
