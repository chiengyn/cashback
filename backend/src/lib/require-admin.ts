import { headers } from 'next/headers';

import { isAdminAuthorization } from '@/lib/admin-auth';

/** Kiểm tra lại trong trang và Server Action, phòng khi matcher của proxy bị đổi. */
export async function requireAdmin(): Promise<void> {
  if (!isAdminAuthorization((await headers()).get('authorization'))) throw new Error('Unauthorized');
}
