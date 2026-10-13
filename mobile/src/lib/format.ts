const vnd = new Intl.NumberFormat('vi-VN');

/** 18900 → "18.900₫" */
export function formatVnd(amount: number): string {
  return `${vnd.format(Math.round(amount))}₫`;
}

/** "2026-10-03T08:00:00Z" → "03/10" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
