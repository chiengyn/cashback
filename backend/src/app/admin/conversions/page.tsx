import { desc, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { Suspense } from 'react';

import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/require-admin';
import { formatDateTime, formatVnd } from '@/lib/format';

const { conversions } = schema;

const STATUS: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', cancelled: 'Đã huỷ' };

export default function ConversionsPage({ searchParams }: { searchParams: Promise<{ unmatched?: string }> }) {
  return (
    <>
      <h1>Đơn hàng</h1>
      <Suspense fallback={<p>Đang tải…</p>}>
        <Conversions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conversions({ searchParams }: { searchParams: Promise<{ unmatched?: string }> }) {
  await requireAdmin();
  const unmatched = (await searchParams).unmatched === '1';
  const rows = await db()
    .select()
    .from(conversions)
    .where(unmatched ? isNull(conversions.userId) : undefined)
    .orderBy(desc(conversions.purchasedAt))
    .limit(200);

  return (
    <>
      <p>
        {unmatched ? (
          <>Đơn sàn trả về nhưng không khớp được người dùng (thiếu hoặc sai sub_id). <Link href="/admin/conversions">Xem tất cả</Link></>
        ) : (
          <>Tối đa 200 đơn gần nhất. <Link href="/admin/conversions?unmatched=1">Chỉ xem đơn không khớp click</Link></>
        )}
      </p>
      <table>
        <thead>
          <tr><th>Đặt lúc</th><th>Sàn</th><th>Mã đơn</th><th>Sản phẩm</th><th className="num">Giá trị</th><th className="num">Hoa hồng</th><th className="num">Hoàn cho user</th><th>Trạng thái</th><th>Click</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={9}>Không có đơn nào.</td></tr> : null}
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{formatDateTime(c.purchasedAt)}</td>
              <td>{c.platform}</td>
              <td><code>{c.orderId}</code></td>
              <td>{c.itemName ?? '—'}</td>
              <td className="num">{formatVnd(c.orderAmount)}</td>
              <td className="num">{formatVnd(c.commission)}</td>
              <td className="num">{formatVnd(c.cashback)}</td>
              <td>{STATUS[c.status]}</td>
              <td>{c.clickId ? <code>{c.clickId}</code> : <span className="warn">không có</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
