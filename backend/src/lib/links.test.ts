import { describe, expect, it } from 'vitest';

import { extractProductLink, parseProductUrl, platformOfHost } from './links';
import { resolveProductLink } from './resolve-link';

describe('extractProductLink', () => {
  it('tách link khỏi đoạn chữ chia sẻ của app sàn', () => {
    expect(extractProductLink('Xem Tai nghe giá ₫450.000 tại Shopee! https://s.shopee.vn/6AbCdEf123')).toEqual({
      url: 'https://s.shopee.vn/6AbCdEf123',
      platform: 'shopee',
    });
    expect(extractProductLink('Mua ngay https://vt.tiktok.com/ZSabc123/ nhé!')?.platform).toBe('tiktok');
  });

  it('bỏ qua domain giả mạo và link không thuộc sàn', () => {
    expect(extractProductLink('https://shopee.vn.evil.com/x')).toBeNull();
    expect(extractProductLink('https://google.com https://shp.ee/abc')?.url).toBe('https://shp.ee/abc');
    expect(extractProductLink('không có link')).toBeNull();
  });
});

describe('platformOfHost', () => {
  it('chấp nhận subdomain, từ chối domain chỉ trùng đuôi', () => {
    expect(platformOfHost('s.lazada.vn')).toBe('lazada');
    expect(platformOfHost('notlazada.vn')).toBeNull();
  });
});

describe('parseProductUrl', () => {
  it.each([
    ['https://shopee.vn/product/88201234/23456789012', 'shopee', '88201234', '23456789012'],
    ['https://shopee.vn/Tai-nghe-Bluetooth-i.88201234.23456789012?sp_atk=x', 'shopee', '88201234', '23456789012'],
    ['https://www.lazada.vn/products/noi-chien-i2345678901-s12345678901.html?spm=a', 'lazada', '', '2345678901'],
    ['https://shop.tiktok.com/view/product/1729384756102938475?region=VN', 'tiktok', '', '1729384756102938475'],
  ])('%s', (url, platform, shopId, itemId) => {
    expect(parseProductUrl(url)).toMatchObject({ platform, shopId, itemId });
  });

  it('trả null cho trang không phải sản phẩm', () => {
    expect(parseProductUrl('https://shopee.vn/mall')).toBeNull();
  });
});

describe('resolveProductLink', () => {
  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

  it('theo redirect của short link tới trang sản phẩm', async () => {
    const hops = [redirect('https://shopee.vn/universal-link/x'), redirect('/product/1/2?smtt=0')];
    const fake = (async () => hops.shift()!) as unknown as typeof fetch;
    expect(await resolveProductLink('https://s.shopee.vn/abc', fake)).toMatchObject({ shopId: '1', itemId: '2' });
  });

  it('không đi theo redirect ra ngoài domain sàn', async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return redirect('http://169.254.169.254/latest/meta-data');
    }) as unknown as typeof fetch;
    await expect(resolveProductLink('https://s.shopee.vn/abc', fake)).rejects.toMatchObject({ status: 422 });
    expect(calls).toBe(1);
  });
});
