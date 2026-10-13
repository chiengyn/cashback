import type { Platform } from '@/lib/links';

export type LinkPreview = {
  clickId: string;
  platform: Platform;
  originalUrl: string;
  product: {
    title: string;
    imageUrl: string | null;
    price: number | null;
  };
  /** null khi sàn không trả % hoa hồng; vẫn cho mua, chỉ ẩn phần ước tính. */
  estimatedCashback: number | null;
};

export type RecentLink = {
  clickId: string;
  platform: Platform;
  originalUrl: string;
  title: string;
  imageUrl: string | null;
  estimatedCashback: number | null;
  createdAt: string;
};

export type OrderStatus = 'pending' | 'approved' | 'cancelled';

export type Order = {
  id: string;
  platform: Platform;
  title: string;
  imageUrl: string | null;
  orderedAt: string;
  expectedApprovalAt: string | null;
  cashback: number;
  status: OrderStatus;
};

export type LedgerEntry = {
  id: string;
  type: 'cashback' | 'reversal' | 'withdrawal';
  label: string;
  amount: number;
  createdAt: string;
};

export type Wallet = {
  available: number;
  pending: number;
  minWithdrawal: number;
  entries: LedgerEntry[];
};

export type WithdrawalRequest = {
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
};
