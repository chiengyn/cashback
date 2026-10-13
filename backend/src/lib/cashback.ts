import type { ConversionStatus, LedgerType, PlatformStatus } from '@/db/schema';

const DAY_MS = 86_400_000;

/** Phần hoàn cho người dùng, làm tròn xuống để không trả quá hoa hồng thực nhận. */
export function userCashback(commission: number, shareBps: number): number {
  return Math.floor((commission * shareBps) / 10_000);
}

/**
 * Trạng thái hoàn tiền của app từ trạng thái của sàn:
 * hoàn tất + đã qua thời gian giữ tiền (hết hạn đổi trả) → approved.
 */
export function deriveStatus(
  platformStatus: PlatformStatus,
  completedAt: Date | null,
  now: Date,
  holdDays: number,
): ConversionStatus {
  if (platformStatus === 'cancelled') return 'cancelled';
  if (platformStatus === 'completed' && completedAt && completedAt.getTime() + holdDays * DAY_MS <= now.getTime()) {
    return 'approved';
  }
  return 'pending';
}

/** Ngày dự kiến duyệt để hiển thị trong app; chưa hoàn tất thì cộng thêm ~7 ngày giao hàng. */
export function expectedApprovalAt(purchasedAt: Date, completedAt: Date | null, holdDays: number): Date {
  const base = completedAt ?? new Date(purchasedAt.getTime() + 7 * DAY_MS);
  return new Date(base.getTime() + holdDays * DAY_MS);
}

export type LedgerEvent = { type: LedgerType; pendingDelta: number; availableDelta: number };

export type LedgerState = {
  status: ConversionStatus;
  /** Số tiền đơn này đang giữ ở ngăn "chờ duyệt" của ví. */
  creditedPending: number;
  /** Số tiền đơn này đã cộng vào ngăn "khả dụng". */
  creditedAvailable: number;
};

/**
 * Các bút toán cần ghi khi một đơn chuyển trạng thái. Hàm thuần, không đụng DB.
 *
 * - Lần đầu thấy đơn pending: cộng `cashback` vào ngăn chờ duyệt.
 * - pending → approved: rút đúng số đã giữ ở ngăn chờ, cộng `cashback` mới nhất vào ngăn khả dụng
 *   (sàn có thể chỉnh hoa hồng giữa chừng).
 * - pending → cancelled: rút số đã giữ ở ngăn chờ.
 * - approved → cancelled (sàn thu hồi): trừ ngăn khả dụng; số dư có thể âm và sẽ trừ vào lần hoàn sau.
 * - Đơn đã huỷ rồi sống lại: không tự ghi lại (UNIQUE theo type sẽ chặn), để admin xử lý tay.
 */
export function planLedger(
  prev: LedgerState | null,
  nextStatus: ConversionStatus,
  cashback: number,
): { events: LedgerEvent[]; state: LedgerState } {
  const state: LedgerState = prev ? { ...prev } : { status: 'pending', creditedPending: 0, creditedAvailable: 0 };
  const events: LedgerEvent[] = [];

  const addPending = () => {
    events.push({ type: 'order_pending', pendingDelta: cashback, availableDelta: 0 });
    state.creditedPending = cashback;
  };
  const approve = () => {
    events.push({ type: 'order_approved', pendingDelta: -state.creditedPending, availableDelta: cashback });
    state.creditedPending = 0;
    state.creditedAvailable = cashback;
  };

  if (!prev) {
    if (nextStatus === 'pending') addPending();
    if (nextStatus === 'approved') {
      addPending();
      approve();
    }
    state.status = nextStatus;
    return { events, state };
  }

  if (prev.status === 'pending' && nextStatus === 'approved') approve();
  if (prev.status === 'pending' && nextStatus === 'cancelled') {
    events.push({ type: 'order_cancelled', pendingDelta: -prev.creditedPending, availableDelta: 0 });
    state.creditedPending = 0;
  }
  if (prev.status === 'approved' && nextStatus === 'cancelled') {
    events.push({ type: 'order_clawback', pendingDelta: 0, availableDelta: -prev.creditedAvailable });
    state.creditedAvailable = 0;
  }
  if (prev.status === 'cancelled' && nextStatus !== 'cancelled') {
    // Giữ nguyên trạng thái huỷ; xem ghi chú ở trên.
    return { events, state };
  }

  // approved → pending (sàn chuyển ngược) được bỏ qua: tiền đã khả dụng thì giữ nguyên.
  if (!(prev.status === 'approved' && nextStatus === 'pending')) state.status = nextStatus;
  return { events, state };
}

export const LEDGER_LABEL: Record<LedgerType, string> = {
  order_pending: 'Đơn chờ duyệt',
  order_approved: 'Hoàn tiền đơn',
  order_cancelled: 'Đơn bị huỷ',
  order_clawback: 'Thu hồi hoàn tiền',
  withdrawal: 'Rút tiền',
  withdrawal_refund: 'Hoàn lại lệnh rút bị từ chối',
};
