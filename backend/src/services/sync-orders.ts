import type { Db } from '@/db';
import type { Platform } from '@/db/schema';
import type { PlatformAdapter, SyncMode } from '@/platforms/types';
import { applyConversion, promoteMatured } from './conversions';
import { acquireLock, releaseLock } from './cron-lock';

const HOUR_MS = 3_600_000;
/** Lùi lại 6 giờ so với lần đồng bộ trước để bắt dữ liệu sàn cập nhật muộn. */
const OVERLAP_MS = 6 * HOUR_MS;
/** Lần chạy đầu tiên (chưa có cursor) lấy 3 ngày gần nhất. */
const FIRST_RUN_LOOKBACK_MS = 72 * HOUR_MS;
/** Quét đối soát hằng ngày: 60 ngày gần nhất, để bắt đơn bị huỷ / trả hàng. */
const RECONCILE_LOOKBACK_MS = 60 * 24 * HOUR_MS;

export type SyncResult =
  | { job: string; status: 'skipped'; reason: 'locked' }
  | { job: string; status: 'ok'; fetched: number; complete: boolean; promoted: number }
  | { job: string; status: 'error'; error: string };

/**
 * Một lần đồng bộ cho một sàn: giành khoá `<platform>:<mode>`, kéo báo cáo, ghi đơn, nhả khoá.
 * Cursor chỉ tiến khi đã lấy hết các trang; nếu hết giờ giữa chừng thì lần sau làm lại cả cửa sổ.
 */
export async function syncPlatform(
  db: Db,
  adapter: PlatformAdapter,
  mode: SyncMode,
  opts: { now: Date; deadline: number; holdDays: number },
): Promise<SyncResult> {
  const job = jobName(adapter.platform, mode);
  const lock = await acquireLock(db, job);
  if (!lock) return { job, status: 'skipped', reason: 'locked' };

  try {
    const to = opts.now;
    const from =
      mode === 'reconcile'
        ? new Date(to.getTime() - RECONCILE_LOOKBACK_MS)
        : new Date((lock.syncCursor?.getTime() ?? to.getTime() - FIRST_RUN_LOOKBACK_MS) - OVERLAP_MS);

    const { conversions, complete } = await adapter.fetchConversions({ mode, from, to, deadline: opts.deadline });
    for (const conv of conversions) {
      await applyConversion(db, adapter.platform, conv, { now: opts.now, holdDays: opts.holdDays });
    }
    const promoted = await promoteMatured(db, { now: opts.now, holdDays: opts.holdDays });

    await releaseLock(db, lock, { ok: true, syncCursor: complete && mode !== 'reconcile' ? to : undefined });
    return { job, status: 'ok', fetched: conversions.length, complete, promoted };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[cron ${job}]`, e);
    await releaseLock(db, lock, { ok: false, error });
    return { job, status: 'error', error };
  }
}

export function jobName(platform: Platform, mode: SyncMode) {
  return `${platform}:${mode}`;
}
