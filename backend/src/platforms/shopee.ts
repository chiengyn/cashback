/**
 * Shopee Affiliate Open API (GraphQL).
 *
 * Tài liệu chính thức nằm sau trang đăng nhập affiliate.shopee.vn; tên field và cách ký dưới đây lấy từ
 * tài liệu/SDK bên thứ ba. CẦN XÁC MINH với tài khoản thật trước khi chạy production, nhất là:
 *  - giá trị `orderStatus` / `fraudStatus` và cách map sang pending / completed / cancelled
 *  - định dạng `utmContent` (các subIds nối bằng "-")
 *  - đơn vị của tiền (chuỗi số VND) và `commissionRate` (tỉ lệ thập phân, ví dụ "0.06")
 */
import { createHash } from 'node:crypto';

import type { PlatformStatus } from '@/db/schema';
import { CLICK_ID_PATTERN } from '@/lib/crypto';
import { HttpError } from '@/lib/http';
import type { ProductRef } from '@/lib/links';
import type {
  FetchConversionsInput,
  FetchConversionsResult,
  PlatformAdapter,
  PlatformConversion,
  ProductInfo,
} from './types';

const ENDPOINT = 'https://open-api.affiliate.shopee.vn/graphql';
const PAGE_SIZE = 500;

/** Authorization: SHA256 Credential={appId}, Signature=sha256(appId + timestamp + payload + secret), Timestamp={timestamp} */
export function shopeeAuthHeader(appId: string, secret: string, payload: string, timestamp: number): string {
  const signature = createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
  return `SHA256 Credential=${appId}, Signature=${signature}, Timestamp=${timestamp}`;
}

/** subIds được nối vào utmContent; click_id là phần 10 ký tự chữ-số đầu tiên. */
export function clickIdFromUtmContent(utmContent: string | null | undefined): string | null {
  if (!utmContent) return null;
  return utmContent.split(/[^0-9A-Za-z]+/).find((part) => CLICK_ID_PATTERN.test(part)) ?? null;
}

export function mapShopeeStatus(orderStatus: string | null | undefined, fraudStatus: string | null | undefined): PlatformStatus {
  const order = (orderStatus ?? '').toUpperCase();
  if ((fraudStatus ?? '').toUpperCase() === 'FRAUD') return 'cancelled';
  if (order === 'CANCELLED' || order === 'CANCELED' || order === 'UNPAID_CANCELLED') return 'cancelled';
  if (order === 'COMPLETED' || order === 'COMPLETE') return 'completed';
  return 'pending';
}

const toVnd = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const fromUnix = (value: unknown) => (value ? new Date(Number(value) * 1000) : null);
const q = (value: string) => JSON.stringify(value);

type ShopeeItem = {
  itemId: string | number;
  itemName?: string;
  imageUrl?: string;
  actualAmount?: string;
  itemPrice?: string;
  qty?: number;
  itemTotalCommission?: string;
  completeTime?: number;
  fraudStatus?: string;
};
type ShopeeConversionNode = {
  purchaseTime: number;
  utmContent?: string;
  orders: { orderId: string; orderStatus?: string; items: ShopeeItem[] }[];
};

export function normalizeShopeeNodes(nodes: ShopeeConversionNode[]): PlatformConversion[] {
  const out: PlatformConversion[] = [];
  for (const node of nodes) {
    const clickId = clickIdFromUtmContent(node.utmContent);
    for (const order of node.orders ?? []) {
      for (const item of order.items ?? []) {
        out.push({
          orderId: String(order.orderId),
          itemId: String(item.itemId),
          clickId,
          itemName: item.itemName ?? null,
          imageUrl: item.imageUrl ?? null,
          orderAmount: toVnd(item.actualAmount ?? Number(item.itemPrice ?? 0) * (item.qty ?? 1)),
          commission: toVnd(item.itemTotalCommission),
          platformStatus: mapShopeeStatus(order.orderStatus, item.fraudStatus),
          purchasedAt: fromUnix(node.purchaseTime) ?? new Date(),
          completedAt: fromUnix(item.completeTime),
          raw: { utmContent: node.utmContent, orderStatus: order.orderStatus, item },
        });
      }
    }
  }
  return out;
}

export class ShopeeAdapter implements PlatformAdapter {
  readonly platform = 'shopee' as const;

  constructor(
    private readonly appId: string,
    private readonly secret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async gql<T>(query: string): Promise<T> {
    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: shopeeAuthHeader(this.appId, this.secret, payload, timestamp),
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
    if (!res.ok || !body?.data || body.errors?.length) {
      throw new Error(`Shopee API ${res.status}: ${body?.errors?.map((e) => e.message).join('; ') ?? 'no data'}`);
    }
    return body.data;
  }

  async getProductInfo(ref: ProductRef): Promise<ProductInfo> {
    const data = await this.gql<{
      productOfferV2: { nodes: { productName?: string; imageUrl?: string; priceMin?: string; commissionRate?: string }[] };
    }>(`{ productOfferV2(itemId: ${Number(ref.itemId)}, shopId: ${Number(ref.shopId)}, limit: 1) {
          nodes { productName imageUrl priceMin commissionRate } } }`);
    const node = data.productOfferV2.nodes[0];
    if (!node) return { title: null, imageUrl: null, price: null, commissionBps: null };
    const rate = Number(node.commissionRate);
    return {
      title: node.productName ?? null,
      imageUrl: node.imageUrl ?? null,
      price: node.priceMin ? toVnd(node.priceMin) : null,
      commissionBps: Number.isFinite(rate) && rate > 0 ? Math.round(rate * 10_000) : null,
    };
  }

  async createLink(ref: ProductRef, clickId: string): Promise<string> {
    try {
      const data = await this.gql<{ generateShortLink: { shortLink: string } }>(
        `mutation { generateShortLink(input: { originUrl: ${q(ref.canonicalUrl)}, subIds: [${q(clickId)}] }) { shortLink } }`,
      );
      return data.generateShortLink.shortLink;
    } catch (e) {
      console.error('[shopee.createLink]', e);
      throw new HttpError(502, 'Shopee đang bận, chưa tạo được link hoàn tiền. Bạn thử lại sau ít phút.');
    }
  }

  async fetchConversions({ mode, from, to, deadline }: FetchConversionsInput): Promise<FetchConversionsResult> {
    const timeArgs =
      mode === 'complete'
        ? `completeTimeStart: ${Math.floor(from.getTime() / 1000)}, completeTimeEnd: ${Math.floor(to.getTime() / 1000)}`
        : `purchaseTimeStart: ${Math.floor(from.getTime() / 1000)}, purchaseTimeEnd: ${Math.floor(to.getTime() / 1000)}`;
    const conversions: PlatformConversion[] = [];
    let scrollId = '';
    // scrollId hết hạn sau 30 giây nên trang kế tiếp phải gọi ngay.
    while (true) {
      if (Date.now() > deadline) return { conversions, complete: false };
      const data = await this.gql<{
        conversionReport: { nodes: ShopeeConversionNode[]; pageInfo: { hasNextPage: boolean; scrollId?: string } };
      }>(`{ conversionReport(${timeArgs}, limit: ${PAGE_SIZE}${scrollId ? `, scrollId: ${q(scrollId)}` : ''}) {
            nodes { purchaseTime utmContent
              orders { orderId orderStatus
                items { itemId itemName imageUrl itemPrice actualAmount qty itemTotalCommission completeTime fraudStatus } } }
            pageInfo { hasNextPage scrollId } } }`);
      conversions.push(...normalizeShopeeNodes(data.conversionReport.nodes));
      const { hasNextPage, scrollId: next } = data.conversionReport.pageInfo;
      if (!hasNextPage || !next) return { conversions, complete: true };
      scrollId = next;
    }
  }
}
