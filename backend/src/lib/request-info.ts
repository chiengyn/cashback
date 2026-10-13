import { keyedHash } from '@/lib/crypto';

/** IP của client sau proxy Vercel; null khi không xác định được. */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

export function ipHash(req: Request): string | null {
  const ip = clientIp(req);
  return ip ? keyedHash(`ip:${ip}`) : null;
}

export function userAgent(req: Request): string | null {
  return req.headers.get('user-agent')?.slice(0, 300) ?? null;
}
