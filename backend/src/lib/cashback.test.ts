import { describe, expect, it } from 'vitest';

import { deriveStatus, planLedger, userCashback, type LedgerEvent } from './cashback';

const sum = (events: LedgerEvent[]) => ({
  pending: events.reduce((s, e) => s + e.pendingDelta, 0),
  available: events.reduce((s, e) => s + e.availableDelta, 0),
});

describe('userCashback', () => {
  it('tính theo phần vạn và làm tròn xuống', () => {
    expect(userCashback(27_000, 7000)).toBe(18_900);
    expect(userCashback(1_001, 7000)).toBe(700);
  });
});

describe('deriveStatus', () => {
  const now = new Date('2026-10-13T00:00:00Z');
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it('chỉ duyệt khi đã hoàn tất và qua thời gian giữ tiền', () => {
    expect(deriveStatus('completed', days(31), now, 30)).toBe('approved');
    expect(deriveStatus('completed', days(5), now, 30)).toBe('pending');
    expect(deriveStatus('pending', null, now, 30)).toBe('pending');
    expect(deriveStatus('cancelled', days(40), now, 30)).toBe('cancelled');
  });
});

describe('planLedger', () => {
  it('đơn mới chờ duyệt → cộng ngăn chờ', () => {
    const { events, state } = planLedger(null, 'pending', 18_900);
    expect(sum(events)).toEqual({ pending: 18_900, available: 0 });
    expect(state).toEqual({ status: 'pending', creditedPending: 18_900, creditedAvailable: 0 });
  });

  it('chờ → duyệt: rút đúng số đã giữ, cộng số tiền mới nhất vào khả dụng', () => {
    const first = planLedger(null, 'pending', 18_900);
    const { events, state } = planLedger(first.state, 'approved', 17_500);
    expect(sum([...first.events, ...events])).toEqual({ pending: 0, available: 17_500 });
    expect(state.status).toBe('approved');
  });

  it('lần đầu thấy đơn đã duyệt: ghi cả hai bút toán', () => {
    const { events } = planLedger(null, 'approved', 10_000);
    expect(events.map((e) => e.type)).toEqual(['order_pending', 'order_approved']);
    expect(sum(events)).toEqual({ pending: 0, available: 10_000 });
  });

  it('chờ → huỷ: trả ngăn chờ về 0', () => {
    const first = planLedger(null, 'pending', 5_000);
    const { events } = planLedger(first.state, 'cancelled', 5_000);
    expect(sum([...first.events, ...events])).toEqual({ pending: 0, available: 0 });
  });

  it('đã duyệt rồi bị huỷ: thu hồi khỏi ngăn khả dụng', () => {
    const a = planLedger(null, 'approved', 10_000);
    const { events, state } = planLedger(a.state, 'cancelled', 10_000);
    expect(events).toEqual([{ type: 'order_clawback', pendingDelta: 0, availableDelta: -10_000 }]);
    expect(state.status).toBe('cancelled');
  });

  it('không đổi trạng thái thì không ghi gì (chạy lại idempotent)', () => {
    const a = planLedger(null, 'pending', 5_000);
    expect(planLedger(a.state, 'pending', 6_000).events).toEqual([]);
    const b = planLedger(null, 'approved', 5_000);
    expect(planLedger(b.state, 'approved', 5_000).events).toEqual([]);
    expect(planLedger(b.state, 'pending', 5_000).state.status).toBe('approved');
  });

  it('đơn đã huỷ không tự sống lại', () => {
    const c = planLedger(null, 'cancelled', 5_000);
    const { events, state } = planLedger(c.state, 'approved', 5_000);
    expect(events).toEqual([]);
    expect(state.status).toBe('cancelled');
  });
});
