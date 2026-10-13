import { desc, eq, ne } from 'drizzle-orm';
import { Suspense } from 'react';

import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/require-admin';
import { formatDateTime, formatVnd } from '@/lib/format';
import { markPaidAction, rejectAction } from '../actions';

const { withdrawals, users } = schema;

export default function WithdrawalsPage() {
  return (
    <>
      <h1>Lệnh rút tiền</h1>
      <Suspense fallback={<p>Đang tải…</p>}>
        <Withdrawals />
      </Suspense>
    </>
  );
}

async function Withdrawals() {
  await requireAdmin();
  const select = { w: withdrawals, phone: users.phone };
  const [requested, processed] = await Promise.all([
    db().select(select).from(withdrawals).innerJoin(users, eq(users.id, withdrawals.userId)).where(eq(withdrawals.status, 'requested')).orderBy(withdrawals.createdAt),
    db().select(select).from(withdrawals).innerJoin(users, eq(users.id, withdrawals.userId)).where(ne(withdrawals.status, 'requested')).orderBy(desc(withdrawals.processedAt)).limit(50),
  ]);

  return (
    <>
      <h2>Chờ xử lý ({requested.length})</h2>
      <p className="muted">Chuyển khoản xong mới bấm “Đã chuyển”. Từ chối sẽ trả tiền lại ví người dùng.</p>
      <table>
        <thead>
          <tr><th>Tạo lúc</th><th>SĐT</th><th className="num">Số tiền</th><th>Ngân hàng</th><th>Số TK</th><th>Chủ TK</th><th /></tr>
        </thead>
        <tbody>
          {requested.length === 0 ? <tr><td colSpan={7}>Không có lệnh rút nào.</td></tr> : null}
          {requested.map(({ w, phone }) => (
            <tr key={w.id}>
              <td>{formatDateTime(w.createdAt)}</td>
              <td>{phone}</td>
              <td className="num">{formatVnd(w.amount)}</td>
              <td>{w.bankName}</td>
              <td><code>{w.accountNumber}</code></td>
              <td>{w.accountName}</td>
              <td>
                <div className="actions">
                  <form action={markPaidAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <button type="submit">Đã chuyển</button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <input name="note" placeholder="Lý do từ chối" aria-label="Lý do từ chối" />
                    <button type="submit" className="danger">Từ chối</button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Đã xử lý gần đây</h2>
      <table>
        <thead>
          <tr><th>Xử lý lúc</th><th>SĐT</th><th className="num">Số tiền</th><th>Trạng thái</th><th>Ghi chú</th></tr>
        </thead>
        <tbody>
          {processed.length === 0 ? <tr><td colSpan={5}>Chưa có lệnh rút nào được xử lý.</td></tr> : null}
          {processed.map(({ w, phone }) => (
            <tr key={w.id}>
              <td>{w.processedAt ? formatDateTime(w.processedAt) : '—'}</td>
              <td>{phone}</td>
              <td className="num">{formatVnd(w.amount)}</td>
              <td>{w.status === 'paid' ? 'Đã chuyển' : 'Từ chối'}</td>
              <td>{w.adminNote ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
