import { env } from '@/lib/env';

/**
 * Gửi SMS. Hiện chỉ có `console` (in ra log) cho môi trường phát triển.
 * Trước khi chạy production cần chọn nhà cung cấp SMS brandname (ví dụ eSMS, SpeedSMS…) và thêm vào đây.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
  const provider = env().SMS_PROVIDER;
  if (provider === 'console') {
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
      throw new Error('SMS_PROVIDER=console không được dùng ở production');
    }
    console.info(`[sms] ${phone}: ${message}`);
  }
}
