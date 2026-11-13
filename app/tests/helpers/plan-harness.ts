/**
 * In-memory harness chống interface plan §5.2 (cmd/ack/snap + opId).
 * Dùng khi server thật chưa sẵn; concurrent test chạy trên harness này.
 */
import { randomUUID } from 'node:crypto';
import { split } from '../../src/shared/split.ts';

export type AckMsg =
  | { t: 'ack'; opId: string; ok: true; result: unknown }
  | { t: 'ack'; opId: string; ok: false; error: string; current?: unknown };

export type WsOut =
  | { t: 'snap'; scope: string; version: number; data: unknown }
  | AckMsg;

type Member = { id: string; username: string; displayName: string };
type Shop = { id: string; name: string; version: number };
type Vote = { memberId: string; shopId: string };
type Order = { id: string; memberId: string; text: string; price: number | null };
type WheelItem = { id: string; name: string; weight: number; refShopId: string | null };
type Wheel = { id: string; title: string; kind: string; tableId: number | null; version: number; items: WheelItem[] };
type Spin = {
  id: string;
  wheelId: string;
  resultIndex: number;
  resultName: string;
  startedAt: number;
  durationMs: number;
};

type TableState = {
  id: number;
  hostId: string;
  shopIds: string[];
  votes: Vote[];
  orders: Order[];
  winnerShopId: string | null;
  billTotal: number | null;
  billMode: 'item' | 'equal';
  version: number;
};

export type Session = { sid: string; memberId: string };

function weightedPick(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.floor(Math.random() * total);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export class PlanHarness {
  members = new Map<string, Member>();
  pins = new Map<string, string>(); // username -> pin
  sessions = new Map<string, Session>();
  shops = new Map<string, Shop>();
  tables: TableState[] = [];
  wheels = new Map<string, Wheel>();
  spins = new Map<string, Spin>();
  ops = new Map<string, { memberId: string; name: string; result: unknown }>();
  activeSpinUntil = new Map<string, number>(); // wheelId -> endedAt
  shopVersion = 0;
  wheelListVersion = 0;

  seedMembers(count: number): Member[] {
    const out: Member[] = [];
    for (let i = 1; i <= count; i++) {
      const username = `u${String(i).padStart(2, '0')}`;
      const m: Member = { id: randomUUID(), username, displayName: `User ${i}` };
      this.members.set(m.id, m);
      this.pins.set(username, String(100000 + i).slice(0, 6));
      out.push(m);
    }
    return out;
  }

  login(username: string, pin: string): Session {
    const member = [...this.members.values()].find((m) => m.username === username);
    if (!member || this.pins.get(username) !== pin) throw new Error('auth_failed');
    const sid = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const s: Session = { sid: sid.slice(0, 64), memberId: member.id };
    this.sessions.set(s.sid, s);
    return s;
  }

  currentTable(): TableState | null {
    return this.tables.length ? this.tables[this.tables.length - 1]! : null;
  }

  voteStats(table: TableState): { shopId: string; count: number; pct: number; leading: boolean }[] {
    const counts = new Map<string, number>();
    for (const id of table.shopIds) counts.set(id, 0);
    for (const v of table.votes) counts.set(v.shopId, (counts.get(v.shopId) ?? 0) + 1);
    const total = table.votes.length || 1;
    const max = Math.max(0, ...counts.values());
    return table.shopIds.map((shopId) => {
      const count = counts.get(shopId) ?? 0;
      return {
        shopId,
        count,
        pct: Math.round((count / total) * 100),
        leading: !table.winnerShopId && count === max && max > 0,
      };
    });
  }

  handle(sid: string, msg: { t: string; opId?: string; name?: string; args?: Record<string, unknown>; subs?: string[] }): WsOut[] {
    const session = this.sessions.get(sid);
    if (!session) return [{ t: 'ack', opId: msg.opId ?? '', ok: false, error: 'unauthorized' }];

    if (msg.t === 'hello') {
      const outs: WsOut[] = [];
      const table = this.currentTable();
      if (msg.subs?.includes('table:current') && table) {
        outs.push({ t: 'snap', scope: 'table:current', version: table.version, data: this.tableSnap(table) });
      }
      if (msg.subs?.includes('shops')) {
        outs.push({
          t: 'snap',
          scope: 'shops',
          version: this.shopVersion,
          data: [...this.shops.values()],
        });
      }
      if (msg.subs?.includes('wheels')) {
        outs.push({
          t: 'snap',
          scope: 'wheels',
          version: this.wheelListVersion,
          data: [...this.wheels.values()],
        });
      }
      if (msg.subs?.includes('members')) {
        outs.push({
          t: 'snap',
          scope: 'members',
          version: 1,
          data: [...this.members.values()],
        });
      }
      return outs;
    }

    if (msg.t !== 'cmd' || !msg.opId || !msg.name) {
      return [{ t: 'ack', opId: msg.opId ?? '', ok: false, error: 'bad_request' }];
    }

    const cached = this.ops.get(msg.opId);
    if (cached) {
      return [{ t: 'ack', opId: msg.opId, ok: true, result: cached.result }];
    }

    const outs = this.dispatch(session, msg.opId, msg.name, msg.args ?? {});
    return outs;
  }

  private tableSnap(table: TableState) {
    return {
      ...table,
      voteStats: this.voteStats(table),
    };
  }

  private dispatch(session: Session, opId: string, name: string, args: Record<string, unknown>): WsOut[] {
    const outs: WsOut[] = [];
    let result: unknown = null;

    switch (name) {
      case 'shop.upsert': {
        const id = typeof args.id === 'string' && args.id ? args.id : randomUUID();
        const shop: Shop = {
          id,
          name: String(args.name ?? '').slice(0, 120),
          version: (this.shops.get(id)?.version ?? 0) + 1,
        };
        this.shops.set(id, shop);
        this.shopVersion += 1;
        result = shop;
        outs.push({ t: 'snap', scope: 'shops', version: this.shopVersion, data: [...this.shops.values()] });
        break;
      }
      case 'table.create': {
        const shopIds = Array.isArray(args.shopIds) ? (args.shopIds as string[]) : [];
        const table: TableState = {
          id: this.tables.length + 1,
          hostId: session.memberId,
          shopIds: [...shopIds],
          votes: [],
          orders: [],
          winnerShopId: null,
          billTotal: null,
          billMode: 'item',
          version: 1,
        };
        this.tables.push(table);
        result = { id: table.id };
        outs.push({ t: 'snap', scope: 'table:current', version: table.version, data: this.tableSnap(table) });
        break;
      }
      case 'table.addShop': {
        const table = this.currentTable();
        if (!table) return [{ t: 'ack', opId, ok: false, error: 'no_table' }];
        const shopId = String(args.shopId ?? '');
        if (!table.shopIds.includes(shopId)) table.shopIds.push(shopId);
        table.version += 1;
        result = { shopId };
        outs.push({ t: 'snap', scope: 'table:current', version: table.version, data: this.tableSnap(table) });
        break;
      }
      case 'vote.set': {
        const table = this.currentTable();
        if (!table) return [{ t: 'ack', opId, ok: false, error: 'no_table' }];
        const shopId = args.shopId == null ? null : String(args.shopId);
        table.votes = table.votes.filter((v) => v.memberId !== session.memberId);
        if (shopId) {
          if (!table.shopIds.includes(shopId)) return [{ t: 'ack', opId, ok: false, error: 'bad_shop' }];
          table.votes.push({ memberId: session.memberId, shopId });
        }
        table.version += 1;
        result = { votes: table.votes.length };
        outs.push({ t: 'snap', scope: 'table:current', version: table.version, data: this.tableSnap(table) });
        break;
      }
      case 'wheel.create': {
        const wheel: Wheel = {
          id: randomUUID(),
          title: String(args.title ?? 'Vòng').slice(0, 120),
          kind: String(args.kind ?? 'free'),
          tableId: this.currentTable()?.id ?? null,
          version: 1,
          items: [],
        };
        this.wheels.set(wheel.id, wheel);
        this.wheelListVersion += 1;
        result = wheel;
        outs.push({ t: 'snap', scope: 'wheels', version: this.wheelListVersion, data: [...this.wheels.values()] });
        break;
      }
      case 'wheel.item.add': {
        const wheel = this.wheels.get(String(args.wheelId ?? ''));
        if (!wheel) return [{ t: 'ack', opId, ok: false, error: 'no_wheel' }];
        if (wheel.items.length >= 30) return [{ t: 'ack', opId, ok: false, error: 'limit' }];
        const item: WheelItem = {
          id: randomUUID(),
          name: String(args.name ?? '').slice(0, 120),
          weight: Math.min(100, Math.max(1, Number(args.weight) || 1)),
          refShopId: args.refShopId ? String(args.refShopId) : null,
        };
        wheel.items.push(item);
        wheel.version += 1;
        this.wheelListVersion += 1;
        result = item;
        outs.push({ t: 'snap', scope: 'wheels', version: this.wheelListVersion, data: [...this.wheels.values()] });
        break;
      }
      case 'wheel.spin': {
        const wheel = this.wheels.get(String(args.wheelId ?? ''));
        if (!wheel) return [{ t: 'ack', opId, ok: false, error: 'no_wheel' }];
        if (wheel.items.length < 2) return [{ t: 'ack', opId, ok: false, error: 'need_items' }];
        const until = this.activeSpinUntil.get(wheel.id) ?? 0;
        if (Date.now() < until) return [{ t: 'ack', opId, ok: false, error: 'spinning' }];
        const weights = wheel.items.map((i) => i.weight);
        const resultIndex = weightedPick(weights);
        const durationMs = 4300;
        const spin: Spin = {
          id: randomUUID(),
          wheelId: wheel.id,
          resultIndex,
          resultName: wheel.items[resultIndex]!.name,
          startedAt: Date.now(),
          durationMs,
        };
        this.spins.set(spin.id, spin);
        this.activeSpinUntil.set(wheel.id, spin.startedAt + durationMs);
        result = spin;
        this.wheelListVersion += 1;
        outs.push({
          t: 'snap',
          scope: 'wheels',
          version: this.wheelListVersion,
          data: { wheels: [...this.wheels.values()], lastSpin: spin },
        });
        break;
      }
      case 'table.setBill': {
        const table = this.currentTable();
        if (!table) return [{ t: 'ack', opId, ok: false, error: 'no_table' }];
        if (table.hostId !== session.memberId) return [{ t: 'ack', opId, ok: false, error: 'forbidden' }];
        table.billTotal = args.total == null ? null : Number(args.total);
        if (args.mode === 'equal' || args.mode === 'item') table.billMode = args.mode;
        table.version += 1;
        const shares = split({
          orders: table.orders.map((o) => ({ memberId: o.memberId, price: o.price })),
          billTotal: table.billTotal,
          mode: table.billMode,
          hostId: table.hostId,
        });
        result = { billTotal: table.billTotal, mode: table.billMode, shares };
        outs.push({ t: 'snap', scope: 'table:current', version: table.version, data: this.tableSnap(table) });
        break;
      }
      case 'order.add': {
        const table = this.currentTable();
        if (!table) return [{ t: 'ack', opId, ok: false, error: 'no_table' }];
        const order: Order = {
          id: randomUUID(),
          memberId: session.memberId,
          text: String(args.text ?? '').slice(0, 120),
          price: args.price == null ? null : Number(args.price),
        };
        table.orders.push(order);
        table.version += 1;
        result = order;
        outs.push({ t: 'snap', scope: 'table:current', version: table.version, data: this.tableSnap(table) });
        break;
      }
      default:
        return [{ t: 'ack', opId, ok: false, error: 'unknown_cmd' }];
    }

    this.ops.set(opId, { memberId: session.memberId, name, result });
    outs.unshift({ t: 'ack', opId, ok: true, result });
    return outs;
  }
}

/** Client mỏng gắn harness — mô phỏng 1 máy trạm. */
export class HarnessClient {
  lastSnaps = new Map<string, unknown>();
  lastAcks = new Map<string, WsOut>();
  latencies: number[] = [];

  constructor(
    public harness: PlanHarness,
    public session: Session,
  ) {}

  hello(subs = ['table:current', 'shops', 'wheels', 'members']) {
    for (const m of this.harness.handle(this.session.sid, { t: 'hello', subs })) {
      if (m.t === 'snap') this.lastSnaps.set(m.scope, m.data);
    }
  }

  cmd(name: string, args: Record<string, unknown>, opId = randomUUID()): AckMsg {
    const t0 = performance.now();
    const outs = this.harness.handle(this.session.sid, { t: 'cmd', opId, name, args });
    this.latencies.push(performance.now() - t0);
    for (const m of outs) {
      if (m.t === 'snap') this.lastSnaps.set(m.scope, m.data);
      if (m.t === 'ack') this.lastAcks.set(opId, m);
    }
    const ack = outs.find((m): m is AckMsg => m.t === 'ack');
    if (!ack) throw new Error('no_ack');
    return ack;
  }
}
