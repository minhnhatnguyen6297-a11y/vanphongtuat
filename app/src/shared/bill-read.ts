export type BillLine = {
  name: string;
  qty: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  uncertain: boolean;
};

export type BillView = {
  lines: BillLine[];
  fees: number | null;
  discount: number | null;
  total: number | null;
  computed: number | null;
  totalMatches: boolean | null;
  flags: string[];
};

function intOrNull(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v);
}

/** Đối chiếu tổng bằng code. Dòng mờ để trống. Không tự điền số bịa. */
export function reconcileBill(raw: {
  lines?: Array<{
    name?: string | null;
    qty?: number | null;
    unitPrice?: number | null;
    lineTotal?: number | null;
    uncertain?: boolean;
  }>;
  fees?: number | null;
  discount?: number | null;
  total?: number | null;
}): BillView {
  const flags: string[] = [];
  const lines: BillLine[] = [];
  let sum = 0;
  let complete = true;

  for (const row of raw.lines || []) {
    const name = String(row?.name || '').trim().slice(0, 120);
    const qty = intOrNull(row?.qty);
    const unitPrice = intOrNull(row?.unitPrice);
    let lineTotal = intOrNull(row?.lineTotal);
    let uncertain = !!row?.uncertain || !name;
    if (qty != null && unitPrice != null) {
      const code = qty * unitPrice;
      if (lineTotal != null && lineTotal !== code) {
        uncertain = true;
        flags.push('lech_dong');
      }
      lineTotal = code;
    }
    if (lineTotal == null) {
      complete = false;
      uncertain = true;
    } else {
      sum += lineTotal;
    }
    if (!name) flags.push('thieu_ten');
    lines.push({ name, qty, unitPrice, lineTotal, uncertain });
  }

  const fees = intOrNull(raw.fees ?? null);
  const discount = intOrNull(raw.discount ?? null);
  const total = intOrNull(raw.total ?? null);
  let computed: number | null = null;
  if (lines.length > 0 && complete) {
    computed = sum + (fees ?? 0) - (discount ?? 0);
  } else {
    flags.push('thieu_dong');
  }

  let totalMatches: boolean | null = null;
  if (computed != null && total != null) {
    totalMatches = computed === total;
    if (!totalMatches) flags.push('lech_tong');
  }

  return {
    lines,
    fees,
    discount,
    total,
    computed,
    totalMatches,
    flags: [...new Set(flags)],
  };
}
