import { db } from '@/db';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import { json } from '@/lib/http';
import { getAdapter, syncedPlatforms } from '@/platforms';
import type { SyncMode } from '@/platforms/types';
import { syncPlatform, type SyncResult } from '@/services/sync-orders';

export const maxDuration = 300;
/** Chừa 30 giây để ghi kết quả và nhả khoá trước khi hết maxDuration. */
const BUDGET_MS = (maxDuration - 30) * 1000;

const MODES: SyncMode[] = ['purchase', 'complete', 'reconcile'];

/**
 * Vercel Cron gọi GET với header `Authorization: Bearer $CRON_SECRET` (lịch trong vercel.json).
 * Mỗi sàn có khoá riêng trong bảng cron_jobs, nên hai lần gọi chồng nhau thì lần sau tự bỏ qua.
 */
export async function GET(req: Request, { params }: { params: Promise<{ mode: string }> }) {
  const auth = req.headers.get('authorization') ?? '';
  if (!safeEqual(auth, `Bearer ${env().CRON_SECRET}`)) return json({ message: 'Unauthorized' }, 401);

  const { mode } = await params;
  if (!MODES.includes(mode as SyncMode)) return json({ message: `mode phải là ${MODES.join(' | ')}` }, 404);

  const started = Date.now();
  const results: SyncResult[] = [];
  for (const platform of syncedPlatforms()) {
    results.push(
      await syncPlatform(db(), getAdapter(platform), mode as SyncMode, {
        now: new Date(),
        deadline: started + BUDGET_MS,
        holdDays: env().APPROVAL_HOLD_DAYS,
      }),
    );
  }
  return json({ results }, results.some((r) => r.status === 'error') ? 500 : 200);
}
