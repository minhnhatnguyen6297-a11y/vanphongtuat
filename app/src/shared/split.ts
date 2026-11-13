const STEP = 500;

export type SplitMode = 'item' | 'equal';

export type SplitOrder = { memberId: string; price: number | null };

export type SplitInput = {
  orders: SplitOrder[];
  billTotal: number | null;
  mode: SplitMode;
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
  target: number;
  hostCovers: number;
  orderSum: number;
  empty: boolean;
  equal?: boolean;
};

type Person = {
  memberId: string;
  known: number;
  missing: number;
  base: number;
  estimated: boolean;
};

/** Port 1:1 từ design-toi-gian/split.reference.js */
export function split({ orders, billTotal, mode, hostId }: SplitInput): SplitResult {
  const people: Person[] = [];
  const byId = new Map<string, Person>();
  for (const o of orders) {
    let p = byId.get(o.memberId);
    if (!p) {
      p = { memberId: o.memberId, known: 0, missing: 0, base: 0, estimated: false };
      byId.set(o.memberId, p);
      people.push(p);
    }
    if (Number.isFinite(o.price) && (o.price as number) > 0) p.known += Math.round(o.price as number);
    else p.missing += 1;
  }
  const pricedOrders = orders.filter((o) => Number.isFinite(o.price) && (o.price as number) > 0);
  const avgOrder = pricedOrders.length
    ? Math.round(pricedOrders.reduce((t, o) => t + (o.price as number), 0) / pricedOrders.length)
    : 0;
  for (const p of people) {
    p.base = p.known + p.missing * avgOrder;
    p.estimated = p.missing > 0;
  }
  const orderSum = people.reduce((t, p) => t + p.base, 0);

  const bill = billTotal == null ? orderSum : Math.max(0, Math.round(Number(billTotal) || 0));
  if (people.length === 0) {
    return { rows: [], bill, target: 0, hostCovers: bill, orderSum, empty: true };
  }

  const units = Math.floor(bill / STEP);
  const target = units * STEP;
  const hostCovers = bill - target;

  const equal = mode === 'equal' || orderSum === 0;
  const w = people.map((p) => (equal ? 1 : p.base));
  const W = w.reduce((t, x) => t + x, 0);

  const alloc = w.map((wi) => Math.floor((units * wi) / W));
  const rem = w.map((wi) => (units * wi) % W);
  let left = units - alloc.reduce((t, x) => t + x, 0);
  const orderIdx = people
    .map((_, i) => i)
    .sort(
      (a, b) =>
        rem[b]! - rem[a]! ||
        Number(people[b]!.memberId === hostId) - Number(people[a]!.memberId === hostId) ||
        a - b,
    );
  for (const i of orderIdx) {
    if (left <= 0) break;
    alloc[i]! += 1;
    left -= 1;
  }

  const rows = people.map((p, i) => ({
    memberId: p.memberId,
    share: alloc[i]! * STEP,
    estimated: !equal && p.estimated,
  }));
  return { rows, bill, target, hostCovers, orderSum, empty: false, equal };
}
