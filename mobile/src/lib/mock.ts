/**
 * Dữ liệu giả để chạy app khi chưa có backend (không đặt EXPO_PUBLIC_API_URL).
 * Mọi hàm có cùng chữ ký với bản gọi API thật trong api.ts.
 */
import { detectPlatform, type Platform } from '@/lib/links';
import type { LinkPreview, Order, RecentLink, SignInResult, Wallet, WithdrawalRequest } from '@/lib/types';

const SHARE_RATE = 0.7;
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const SAMPLE_PRODUCTS: Record<Platform, { title: string; price: number; commissionRate: number }> = {
  shopee: { title: 'Tai nghe Bluetooth chống ồn chủ động', price: 450_000, commissionRate: 0.06 },
  lazada: { title: 'Nồi chiên không dầu 5L', price: 1_290_000, commissionRate: 0.04 },
  tiktok: { title: 'Áo khoác gió nam nữ chống nước', price: 259_000, commissionRate: 0.1 },
};

const clicks = new Map<string, string>();
const recent: RecentLink[] = [
  { clickId: 'k7Qx2mPa', platform: 'shopee', originalUrl: 'https://s.shopee.vn/6AbCdEf123', title: 'Tai nghe Bluetooth chống ồn chủ động', imageUrl: null, estimatedCashback: 18_900, createdAt: daysAgo(1) },
  { clickId: 'p2Lm9sXe', platform: 'lazada', originalUrl: 'https://s.lazada.vn/s.ZxY12', title: 'Nồi chiên không dầu 5L', imageUrl: null, estimatedCashback: 36_100, createdAt: daysAgo(3) },
];

let wallet: Wallet = {
  available: 126_400,
  pending: 58_600,
  minWithdrawal: 50_000,
  entries: [
    { id: 'l3', type: 'cashback', label: 'Hoàn đơn #…8821', amount: 18_900, createdAt: daysAgo(1) },
    { id: 'l2', type: 'cashback', label: 'Hoàn đơn #…7310', amount: 7_500, createdAt: daysAgo(5) },
    { id: 'l1', type: 'withdrawal', label: 'Rút về Vietcombank', amount: -100_000, createdAt: daysAgo(12) },
  ],
};

const orders: Order[] = [
  { id: 'o1', platform: 'shopee', title: 'Tai nghe Bluetooth chống ồn chủ động', imageUrl: null, orderedAt: daysAgo(10), expectedApprovalAt: daysFromNow(33), cashback: 18_900, status: 'pending' },
  { id: 'o2', platform: 'lazada', title: 'Nồi chiên không dầu 5L', imageUrl: null, orderedAt: daysAgo(15), expectedApprovalAt: daysFromNow(28), cashback: 32_500, status: 'pending' },
  { id: 'o3', platform: 'tiktok', title: 'Áo khoác gió nam nữ chống nước', imageUrl: null, orderedAt: daysAgo(20), expectedApprovalAt: daysFromNow(23), cashback: 7_200, status: 'pending' },
  { id: 'o4', platform: 'shopee', title: 'Bình giữ nhiệt 750ml', imageUrl: null, orderedAt: daysAgo(48), expectedApprovalAt: null, cashback: 18_900, status: 'approved' },
  { id: 'o5', platform: 'shopee', title: 'Ốp lưng điện thoại', imageUrl: null, orderedAt: daysAgo(40), expectedApprovalAt: null, cashback: 2_100, status: 'cancelled' },
];

function randomId(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const mockApi = {
  async createLink(url: string): Promise<LinkPreview> {
    await delay(700);
    const platform = detectPlatform(url);
    if (!platform) throw new Error('Link này không thuộc Shopee, Lazada hoặc TikTok Shop.');
    const sample = SAMPLE_PRODUCTS[platform];
    const clickId = randomId();
    clicks.set(clickId, url);
    const estimatedCashback = Math.round(sample.price * sample.commissionRate * SHARE_RATE);
    recent.unshift({ clickId, platform, originalUrl: url, title: sample.title, imageUrl: null, estimatedCashback, createdAt: new Date().toISOString() });
    return {
      clickId,
      platform,
      originalUrl: url,
      product: { title: sample.title, imageUrl: null, price: sample.price },
      estimatedCashback,
    };
  },

  async openClick(clickId: string): Promise<{ affiliateUrl: string }> {
    await delay(200);
    // Bản giả không có mã affiliate thật nên mở thẳng link gốc.
    return { affiliateUrl: clicks.get(clickId) ?? 'https://shopee.vn' };
  },

  async recentLinks(): Promise<RecentLink[]> {
    await delay(300);
    return recent.slice(0, 10);
  },

  async orders(): Promise<Order[]> {
    await delay();
    return orders;
  },

  async wallet(): Promise<Wallet> {
    await delay();
    return wallet;
  },

  async requestWithdrawal(req: WithdrawalRequest): Promise<void> {
    await delay(800);
    if (req.amount < wallet.minWithdrawal) throw new Error('Số tiền rút tối thiểu là 50.000₫.');
    if (req.amount > wallet.available) throw new Error('Số dư khả dụng không đủ.');
    wallet = {
      ...wallet,
      available: wallet.available - req.amount,
      entries: [
        { id: randomId(), type: 'withdrawal', label: `Rút về ${req.bankName}`, amount: -req.amount, createdAt: new Date().toISOString() },
        ...wallet.entries,
      ],
    };
  },

  async sendOtp(_phone: string): Promise<void> {
    await delay();
  },

  async verifyOtp(phone: string, code: string): Promise<SignInResult> {
    await delay();
    if (!/^\d{6}$/.test(code)) throw new Error('Mã OTP gồm 6 chữ số.');
    return { token: `mock-${randomId(16)}`, phone };
  },

  async signInWithApple(_identityToken: string, _authorizationCode: string | null): Promise<SignInResult> {
    await delay();
    return { token: `mock-apple-${randomId(16)}`, phone: null };
  },

  async deleteAccount(): Promise<void> {
    await delay();
  },
};
