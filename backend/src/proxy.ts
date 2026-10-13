import { NextResponse, type NextRequest } from 'next/server';

import { isAdminAuthorization } from '@/lib/admin-auth';

/** Basic Auth cho trang admin (kể cả Server Action, vì action POST vào chính đường dẫn trang). */
export function proxy(request: NextRequest) {
  if (isAdminAuthorization(request.headers.get('authorization'))) return NextResponse.next();
  return new NextResponse('Cần đăng nhập', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="HoanTien admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/admin/:path*'],
};
