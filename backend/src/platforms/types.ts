import type { Platform, PlatformStatus } from '@/db/schema';
import type { ProductRef } from '@/lib/links';

export type ProductInfo = {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  /** Phần vạn: 600 = 6%. */
  commissionBps: number | null;
};

/** Một dòng hàng trong báo cáo đơn của sàn, đã chuẩn hoá. Mỗi (orderId, itemId) là một dòng `conversions`. */
export type PlatformConversion = {
  orderId: string;
  itemId: string;
  clickId: string | null;
  itemName: string | null;
  imageUrl: string | null;
  orderAmount: number;
  commission: number;
  platformStatus: PlatformStatus;
  purchasedAt: Date;
  completedAt: Date | null;
  raw: unknown;
};

/** `purchase`: đơn mới đặt; `complete`: đơn vừa hoàn tất; `reconcile`: quét lại cửa sổ dài để bắt đơn bị huỷ. */
export type SyncMode = 'purchase' | 'complete' | 'reconcile';

export type FetchConversionsInput = {
  mode: SyncMode;
  from: Date;
  to: Date;
  /** Dừng phân trang khi qua mốc này để kịp nhả khoá trước khi function bị kill. */
  deadline: number;
};

export type FetchConversionsResult = { conversions: PlatformConversion[]; complete: boolean };

export interface PlatformAdapter {
  readonly platform: Platform;
  getProductInfo(ref: ProductRef): Promise<ProductInfo>;
  /** Tạo link affiliate có gắn `clickId` làm sub_id. */
  createLink(ref: ProductRef, clickId: string): Promise<string>;
  fetchConversions(input: FetchConversionsInput): Promise<FetchConversionsResult>;
}
