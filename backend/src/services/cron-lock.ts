import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import type { Db } from '@/db';

/** Dài hơn maxDuration của route cron (300 giây) để function bị kill thì khoá tự hết hạn. */
export const LOCK_TTL_MINUTES = 10;

export type CronLock = { name: string; owner: string; syncCursor: Date | null };

/**
 * Giành khoá job bằng một câu SQL nguyên tử. Trả null nếu đang có lần chạy khác giữ khoá.
 * ON CONFLICT … DO UPDATE khoá dòng trong lúc cập nhật, nên lần chạy thứ hai phải chờ rồi thấy
 * locked_until còn trong tương lai và không nhận được dòng nào.
 */
export async function acquireLock(db: Db, name: string): Promise<CronLock | null> {
  const owner = randomUUID();
  const rows = await db.execute<{ sync_cursor: Date | string | null }>(sql`
    INSERT INTO cron_jobs (name, locked_until, locked_by)
    VALUES (${name}, now() + make_interval(mins => ${LOCK_TTL_MINUTES}), ${owner})
    ON CONFLICT (name) DO UPDATE
      SET locked_until = EXCLUDED.locked_until,
          locked_by    = EXCLUDED.locked_by
      WHERE cron_jobs.locked_until < now()
    RETURNING sync_cursor
  `);
  const row = rows[0];
  if (!row) return null;
  return { name, owner, syncCursor: row.sync_cursor ? new Date(row.sync_cursor) : null };
}

/** Nhả khoá; chỉ có tác dụng khi `locked_by` vẫn là lần chạy này. */
export async function releaseLock(
  db: Db,
  lock: CronLock,
  result: { ok: true; syncCursor?: Date } | { ok: false; error: string },
): Promise<void> {
  // SQL thuần không tự đổi Date như query builder, nên truyền chuỗi ISO.
  if (result.ok) {
    await db.execute(sql`
      UPDATE cron_jobs
      SET locked_until = now(),
          sync_cursor = COALESCE(${result.syncCursor?.toISOString() ?? null}::timestamptz, sync_cursor),
          last_success_at = now(),
          last_error = NULL
      WHERE name = ${lock.name} AND locked_by = ${lock.owner}
    `);
  } else {
    await db.execute(sql`
      UPDATE cron_jobs
      SET locked_until = now(), last_error = ${result.error.slice(0, 2000)}
      WHERE name = ${lock.name} AND locked_by = ${lock.owner}
    `);
  }
}
