import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { Suspense } from 'react';

import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/require-admin';
import { formatDateTime } from '@/lib/format';

const { cronJobs, clicks, conversions, withdrawals } = schema;

export default function AdminHome() {
  return (
    <>
      <h1>Tổng quan</h1>
      <Suspense fallback={<p>Đang tải…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

/** Đọc dữ liệu ngoài component để không gọi Date.now() trong lúc render. */
async function loadOverview() {
  const now = Date.now();
  const dayAgo = new Date(now - 86_400_000);
  const [[clicks24h], [opened24h], [pending], [unmatched], [requested], jobs] = await Promise.all([
    db().select({ n: count() }).from(clicks).where(gt(clicks.createdAt, dayAgo)),
    db().select({ n: count() }).from(clicks).where(gt(clicks.redirectedAt, dayAgo)),
    db().select({ n: count() }).from(conversions).where(eq(conversions.status, 'pending')),
    db().select({ n: count() }).from(conversions).where(and(isNull(conversions.userId), gt(conversions.createdAt, new Date(now - 30 * 86_400_000)))),
    db().select({ n: count() }).from(withdrawals).where(eq(withdrawals.status, 'requested')),
    db().select().from(cronJobs).orderBy(cronJobs.name),
  ]);
  return { now, staleBefore: now - 2 * 3_600_000, clicks24h, opened24h, pending, unmatched, requested, jobs };
}

async function Overview() {
  await requireAdmin();
  const { now, staleBefore, clicks24h, opened24h, pending, unmatched, requested, jobs } = await loadOverview();

  return (
    <>
      <div className="stats">
        <Stat label="Link tạo trong 24 giờ" value={clicks24h!.n} />
        <Stat label="Bấm “Mua ngay” trong 24 giờ" value={opened24h!.n} />
        <Stat label="Đơn chờ duyệt" value={pending!.n} />
        <Stat label="Đơn không khớp click (30 ngày)" value={unmatched!.n} warn={unmatched!.n > 0} />
        <Stat label="Lệnh rút chờ xử lý" value={requested!.n} warn={requested!.n > 0} />
      </div>

      <h2>Cron đồng bộ đơn</h2>
      <table>
        <thead>
          <tr><th>Job</th><th>Thành công gần nhất</th><th>Lỗi gần nhất</th><th>Khoá đến</th></tr>
        </thead>
        <tbody>
          {jobs.length === 0 ? <tr><td colSpan={4}>Chưa có lần chạy nào.</td></tr> : null}
          {jobs.map((j) => {
            const stale = !j.lastSuccessAt || j.lastSuccessAt.getTime() < staleBefore;
            return (
              <tr key={j.name}>
                <td><code>{j.name}</code></td>
                <td className={stale && !j.name.endsWith(':reconcile') ? 'warn' : undefined}>{j.lastSuccessAt ? formatDateTime(j.lastSuccessAt) : '—'}</td>
                <td className={j.lastError ? 'warn' : undefined}>{j.lastError ?? '—'}</td>
                <td>{j.lockedUntil.getTime() > now ? formatDateTime(j.lockedUntil) : 'Không khoá'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={warn ? 'stat warn' : 'stat'}>
      <span>{label}</span>
      <b>{value.toLocaleString('vi-VN')}</b>
    </div>
  );
}
