import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin">
      <nav className="admin-nav">
        <strong>HoànTiền admin</strong>
        <Link href="/admin">Tổng quan</Link>
        <Link href="/admin/withdrawals">Rút tiền</Link>
        <Link href="/admin/conversions">Đơn hàng</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
