import { CLICK_ID_PATTERN } from '@/lib/crypto';
import { HttpError, json, route } from '@/lib/http';
import { requireUser } from '@/services/auth';
import { openClick } from '@/services/links';

/** App gọi khi bấm "Mua ngay", rồi tự mở link affiliate để app sàn bắt được universal link. */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!CLICK_ID_PATTERN.test(id)) throw new HttpError(404, 'Link đã hết hạn. Bạn dán lại link sản phẩm nhé.');
  const user = await requireUser(req);
  return json(await openClick(id, user));
});
