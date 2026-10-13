import { and, desc, eq, ne } from 'drizzle-orm';

import { db, schema } from '@/db';
import type { LedgerType } from '@/db/schema';
import { expectedApprovalAt } from '@/lib/cashback';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http';
import type { AuthUser } from './auth';
import { balanceOf } from './conversions';

const { conversions, clicks, products, ledgerEntries, withdrawals, users } = schema;

/** Kiểu bút toán hiển thị trong app (mobile/src/lib/types.ts). */
const ENTRY_KIND: Partial<Record<LedgerType, 'cashback' | 'reversal' | 'withdrawal'>> = {
  order_approved: 'cashback',
  order_clawback: 'reversal',
  withdrawal: 'withdrawal',
  withdrawal_refund: 'reversal',
};

export async function getWallet(user: AuthUser) {
  const balance = await balanceOf(db(), user.id);
  const rows = await db()
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.userId, user.id), ne(ledgerEntries.availableDelta, 0)))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(50);
  return {
    ...balance,
    minWithdrawal: env().MIN_WITHDRAWAL,
    entries: rows.map((r) => ({
      id: r.id,
      type: ENTRY_KIND[r.type] ?? 'cashback',
      label: r.label,
      amount: r.availableDelta,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function listOrders(user: AuthUser) {
  const holdDays = env().APPROVAL_HOLD_DAYS;
  const rows = await db()
    .select({ c: conversions, productTitle: products.title, productImage: products.imageUrl })
    .from(conversions)
    .leftJoin(clicks, eq(clicks.id, conversions.clickId))
    .leftJoin(products, eq(products.id, clicks.productId))
    .where(eq(conversions.userId, user.id))
    .orderBy(desc(conversions.purchasedAt))
    .limit(200);
  return rows.map(({ c, productTitle, productImage }) => ({
    id: c.id,
    platform: c.platform,
    title: c.itemName ?? productTitle ?? 'Sản phẩm',
    imageUrl: c.imageUrl ?? productImage,
    orderedAt: c.purchasedAt.toISOString(),
    expectedApprovalAt: c.status === 'pending' ? expectedApprovalAt(c.purchasedAt, c.completedAt, holdDays).toISOString() : null,
    cashback: c.cashback,
    status: c.status,
  }));
}

export type WithdrawalInput = { amount: number; bankName: string; accountNumber: string; accountName: string };

/**
 * Tạo lệnh rút: khoá dòng user (FOR UPDATE) để hai lệnh rút cùng lúc không cùng tiêu một số dư,
 * kiểm tra số dư khả dụng rồi ghi lệnh rút và bút toán trừ tiền trong cùng transaction.
 */
export async function requestWithdrawal(user: AuthUser, input: WithdrawalInput): Promise<void> {
  const min = env().MIN_WITHDRAWAL;
  if (input.amount < min) throw new HttpError(400, `Số tiền rút tối thiểu là ${min.toLocaleString('vi-VN')}₫.`);

  await db().transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for('update');
    const { available } = await balanceOf(tx, user.id);
    if (input.amount > available) throw new HttpError(400, 'Số dư khả dụng không đủ.');

    const [w] = await tx.insert(withdrawals).values({ userId: user.id, ...input }).returning({ id: withdrawals.id });
    await tx.insert(ledgerEntries).values({
      userId: user.id,
      type: 'withdrawal',
      availableDelta: -input.amount,
      withdrawalId: w!.id,
      label: `Rút về ${input.bankName}`,
    });
  });
}

/** Admin: đã chuyển khoản xong. */
export async function markWithdrawalPaid(id: string): Promise<void> {
  await db()
    .update(withdrawals)
    .set({ status: 'paid', processedAt: new Date() })
    .where(and(eq(withdrawals.id, id), eq(withdrawals.status, 'requested')));
}

/** Admin: từ chối lệnh rút, trả tiền lại ví. */
export async function rejectWithdrawal(id: string, note: string): Promise<void> {
  await db().transaction(async (tx) => {
    const [w] = await tx
      .update(withdrawals)
      .set({ status: 'rejected', processedAt: new Date(), adminNote: note || null })
      .where(and(eq(withdrawals.id, id), eq(withdrawals.status, 'requested')))
      .returning();
    if (!w) return;
    await tx
      .insert(ledgerEntries)
      .values({ userId: w.userId, type: 'withdrawal_refund', availableDelta: w.amount, withdrawalId: w.id, label: 'Hoàn lại lệnh rút bị từ chối' })
      .onConflictDoNothing();
  });
}
