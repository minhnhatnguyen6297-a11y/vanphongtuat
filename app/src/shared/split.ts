const STEP = 500;

export type SplitMode = 'item' | 'equal';

export type SplitOrder = { memberId: string; price: number | null };

export type SplitInput = {
  orders: SplitOrder[];
  billTotal: number | null;
  /** Giữ để lệnh cũ vẫn gọi được. Không còn đổi cách chia. */
  mode: SplitMode;
  /** Giữ chữ ký cũ. Không còn người gánh phần lẻ. */
  hostId: string;
};

export type SplitRow = {
  memberId: string;
  share: number;
  estimated: boolean;
};

export type SplitResult = {
  rows: SplitRow[];
  bill: number;
  /** Số thực thu = each × số người. Có thể lớn hơn bill vì làm tròn lên. */
  target: number;
  /** Luôn 0. Quy tắc Chủ xị gánh lẻ đã bỏ ngày 18/11/2026. */
  hostCovers: number;
  orderSum: number;
  empty: boolean;
  equal?: boolean;
  /** Mỗi người, đồng, bội 500, làm tròn lên. */
  each: number;
};

function ceilDiv(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return Math.floor((a + b - 1) / b);
}

/**
 * Chia đều cho mỗi người có ít nhất một order.
 * Mỗi phần = làm tròn LÊN bội 500đ của (bill / số người).
 * Giá món và mode không tham gia. Bill null coi như chưa có tổng (0), không lấy tổng order.
 * Ví dụ: 100.001đ / 3 người → 33.500đ, thực thu 100.500đ.
 */
export function split({ orders, billTotal }: SplitInput): SplitResult {
  const people: string[] = [];
  const seen = new Set<string>();
  for (const o of orders) {
    if (!o.memberId || seen.has(o.memberId)) continue;
    seen.add(o.memberId);
    people.push(o.memberId);
  }
  const bill = billTotal == null ? 0 : Math.max(0, Math.round(Number(billTotal) || 0));
  const n = people.length;
  const each = n === 0 ? 0 : ceilDiv(bill, n * STEP) * STEP;
  const rows = people.map((memberId) => ({
    memberId,
    share: each,
    estimated: false,
  }));
  return {
    rows,
    bill,
    target: each * n,
    hostCovers: 0,
    orderSum: 0,
    empty: n === 0,
    equal: true,
    each,
  };
}
