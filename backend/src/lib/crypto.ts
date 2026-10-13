import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Mã click 10 ký tự base62 (chỉ chữ và số để vừa giới hạn sub_id của các sàn). */
export function newClickId(): string {
  let id = '';
  for (let i = 0; i < 10; i++) id += BASE62[randomInt(62)];
  return id;
}

export const CLICK_ID_PATTERN = /^[0-9A-Za-z]{10}$/;

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** HMAC với AUTH_SECRET: dùng cho IP và mã OTP để bản lưu trong DB không đảo ngược được. */
export function keyedHash(value: string): string {
  return createHmac('sha256', env().AUTH_SECRET).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
