import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { clickIdFromUtmContent, mapShopeeStatus, normalizeShopeeNodes, shopeeAuthHeader } from './shopee';

describe('shopeeAuthHeader', () => {
  it('ký sha256(appId + timestamp + payload + secret)', () => {
    const payload = '{"query":"{ x }"}';
    const expected = createHash('sha256').update(`123${1700000000}${payload}secret`).digest('hex');
    expect(shopeeAuthHeader('123', 'secret', payload, 1700000000)).toBe(
      `SHA256 Credential=123, Signature=${expected}, Timestamp=1700000000`,
    );
  });
});

describe('clickIdFromUtmContent', () => {
  it('lấy phần 10 ký tự chữ-số làm click_id', () => {
    expect(clickIdFromUtmContent('k7Qx2mPaAb----')).toBe('k7Qx2mPaAb');
    expect(clickIdFromUtmContent('----')).toBeNull();
    expect(clickIdFromUtmContent(undefined)).toBeNull();
  });
});

describe('mapShopeeStatus', () => {
  it('map trạng thái sàn', () => {
    expect(mapShopeeStatus('COMPLETED', 'VERIFIED')).toBe('completed');
    expect(mapShopeeStatus('PENDING', null)).toBe('pending');
    expect(mapShopeeStatus('CANCELLED', null)).toBe('cancelled');
    expect(mapShopeeStatus('COMPLETED', 'FRAUD')).toBe('cancelled');
  });
});

describe('normalizeShopeeNodes', () => {
  it('mỗi item của mỗi đơn thành một dòng', () => {
    const rows = normalizeShopeeNodes([
      {
        purchaseTime: 1_760_000_000,
        utmContent: 'k7Qx2mPaAb----',
        orders: [
          {
            orderId: '2410A',
            orderStatus: 'COMPLETED',
            items: [
              { itemId: 1, itemName: 'A', actualAmount: '450000', itemTotalCommission: '27000.4', completeTime: 1_760_100_000 },
              { itemId: 2, itemName: 'B', itemPrice: '100000', qty: 2, itemTotalCommission: '0' },
            ],
          },
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ orderId: '2410A', itemId: '1', clickId: 'k7Qx2mPaAb', orderAmount: 450_000, commission: 27_000, platformStatus: 'completed' });
    expect(rows[0]!.completedAt?.toISOString()).toBe(new Date(1_760_100_000_000).toISOString());
    expect(rows[1]).toMatchObject({ orderAmount: 200_000, completedAt: null });
  });
});
