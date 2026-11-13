import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { HarnessClient, PlanHarness } from '../helpers/plan-harness.ts';
import { split } from '../../src/shared/split.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const serverIndex = resolve(root, 'src/server/index.ts');
const hasLiveServer = existsSync(serverIndex);

function pctile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[i]!;
}

describe('concurrent 15 users (plan harness)', { concurrency: 1 }, () => {
  const N = 15;
  let h: PlanHarness;
  let clients: HarnessClient[];
  let members: { id: string; username: string }[];
  let shopIds: string[];
  let host: HarnessClient;

  before(() => {
    h = new PlanHarness();
    members = h.seedMembers(N);
    clients = members.map((m) => {
      const pin = h.pins.get(m.username)!;
      const session = h.login(m.username, pin);
      return new HarnessClient(h, session);
    });
    host = clients[0]!;
  });

  it('login 15 nguoi', () => {
    assert.equal(clients.length, N);
    assert.equal(h.sessions.size, N);
  });

  it('shop.upsert + table.create + table.addShop', () => {
    shopIds = [];
    for (let i = 0; i < 3; i++) {
      const ack = host.cmd('shop.upsert', { name: `Quan ${i + 1}` });
      assert.equal(ack.t, 'ack');
      assert.equal(ack.ok, true);
      if (ack.ok) shopIds.push((ack.result as { id: string }).id);
    }
    const created = host.cmd('table.create', { shopIds: shopIds.slice(0, 2) });
    assert.equal(created.ok, true);
    const add = clients[1]!.cmd('table.addShop', { shopId: shopIds[2] });
    assert.equal(add.ok, true);
    const table = h.currentTable()!;
    assert.equal(table.shopIds.length, 3);
  });

  it('15 vote.set dong thoi — 1 phieu/nguoi, % / dan dau nhat quan', async () => {
    // Phan bo: 8 -> shop0, 5 -> shop1, 2 -> shop2
    const targets = [
      ...Array(8).fill(shopIds[0]),
      ...Array(5).fill(shopIds[1]),
      ...Array(2).fill(shopIds[2]),
    ];
    const acks = await Promise.all(
      clients.map((c, i) => Promise.resolve(c.cmd('vote.set', { shopId: targets[i] }))),
    );
    assert.ok(acks.every((a) => a.ok));

    const table = h.currentTable()!;
    assert.equal(table.votes.length, N);
    // 1 phieu / nguoi
    const byMember = new Set(table.votes.map((v) => v.memberId));
    assert.equal(byMember.size, N);

    const stats = h.voteStats(table);
    const s0 = stats.find((s) => s.shopId === shopIds[0])!;
    const s1 = stats.find((s) => s.shopId === shopIds[1])!;
    const s2 = stats.find((s) => s.shopId === shopIds[2])!;
    assert.equal(s0.count, 8);
    assert.equal(s1.count, 5);
    assert.equal(s2.count, 2);
    assert.equal(s0.pct, 53); // 8/15
    assert.ok(s0.leading);
    assert.equal(stats.filter((s) => s.leading).length, 1);

    // Doi phieu: u01 chuyen tu shop0 -> shop1 — van 1 phieu
    const flip = clients[0]!.cmd('vote.set', { shopId: shopIds[1] });
    assert.equal(flip.ok, true);
    assert.equal(h.currentTable()!.votes.length, N);
    assert.equal(h.currentTable()!.votes.filter((v) => v.memberId === members[0]!.id).length, 1);
  });

  it('wheel.spin — moi client thay cung resultIndex', async () => {
    // Dat lai vote cho dan dau on dinh
    await Promise.all(clients.map((c, i) => Promise.resolve(c.cmd('vote.set', { shopId: shopIds[i % 3] }))));

    const wAck = host.cmd('wheel.create', { title: 'Trua nay an gi?', kind: 'shop' });
    assert.equal(wAck.ok, true);
    const wheelId = (wAck.result as { id: string }).id;
    for (let i = 0; i < 3; i++) {
      const a = host.cmd('wheel.item.add', {
        wheelId,
        name: `Quan ${i + 1}`,
        weight: 10,
        refShopId: shopIds[i],
      });
      assert.equal(a.ok, true);
    }

    const spinAck = host.cmd('wheel.spin', { wheelId });
    assert.equal(spinAck.ok, true);
    const spin = spinAck.result as { id: string; resultIndex: number; resultName: string };

    // 15 client hello lai — snap chung lastSpin
    for (const c of clients) c.hello(['wheels']);
    const indices = clients.map(() => spin.resultIndex);
    assert.ok(indices.every((i) => i === spin.resultIndex));

    // Spin dong thoi lan 2 trong luc dang quay -> bi tu choi (tru client dau tien neu het thoi gian)
    const busy = clients[1]!.cmd('wheel.spin', { wheelId });
    assert.equal(busy.ok, false);
    if (!busy.ok) assert.equal(busy.error, 'spinning');
  });

  it('table.setBill + split shares on dinh', () => {
    // Moi nguoi 1 order gia khac nhau
    for (let i = 0; i < N; i++) {
      const price = 30000 + i * 1000;
      const a = clients[i]!.cmd('order.add', { text: `Mon ${i}`, price });
      assert.equal(a.ok, true);
    }
    const billAck = host.cmd('table.setBill', { total: 500000, mode: 'item' });
    assert.equal(billAck.ok, true);
    const result = billAck.result as {
      shares: ReturnType<typeof split>;
    };
    const expected = split({
      orders: h.currentTable()!.orders.map((o) => ({ memberId: o.memberId, price: o.price })),
      billTotal: 500000,
      mode: 'item',
      hostId: h.currentTable()!.hostId,
    });
    assert.deepEqual(
      result.shares.rows.map((r) => [r.memberId, r.share]),
      expected.rows.map((r) => [r.memberId, r.share]),
    );
    const sum = result.shares.rows.reduce((t, r) => t + r.share, 0);
    assert.equal(sum + result.shares.hostCovers, expected.bill);
    assert.ok(result.shares.rows.every((r) => r.share % 500 === 0));

    // Thanh vien thuong khong set duoc bill
    const denied = clients[2]!.cmd('table.setBill', { total: 1, mode: 'equal' });
    assert.equal(denied.ok, false);
  });

  it('reconnect + cung opId khong nhan doi', () => {
    const opId = randomUUID();
    const c = clients[3]!;
    const first = c.cmd('vote.set', { shopId: shopIds[0] }, opId);
    assert.equal(first.ok, true);
    const votesAfterFirst = h.currentTable()!.votes.length;

    // "Mat mang" — login/session cu van dung; gui lai cung opId
    c.hello();
    const second = c.cmd('vote.set', { shopId: shopIds[2] }, opId);
    assert.equal(second.ok, true);
    assert.deepEqual(second, first);
    assert.equal(h.currentTable()!.votes.length, votesAfterFirst);

    // opId moi thi doi phieu that
    const third = c.cmd('vote.set', { shopId: shopIds[2] }, randomUUID());
    assert.equal(third.ok, true);
    const v = h.currentTable()!.votes.find((x) => x.memberId === c.session.memberId);
    assert.equal(v?.shopId, shopIds[2]);
  });

  it('latency noi bo harness (tham chieu)', () => {
    const all = clients.flatMap((c) => c.latencies);
    const p95 = pctile(all, 95);
    const max = Math.max(...all, 0);
    // Harness in-process: p95 phai rat thap; ghi de so sanh khi co server that
    console.log(
      JSON.stringify({
        clients: N,
        ops: all.length,
        p50_ms: +pctile(all, 50).toFixed(3),
        p95_ms: +p95.toFixed(3),
        max_ms: +max.toFixed(3),
      }),
    );
    assert.ok(p95 < 50, `harness p95=${p95}ms qua cao`);
  });
});

describe('concurrent live server', () => {
  const url = process.env.HNG_CONCURRENT_URL;
  const skipReason = !hasLiveServer
    ? 'server chua co — dung harness'
    : !url
      ? 'set HNG_CONCURRENT_URL (vd http://localhost:8443) + seed u01..u15'
      : false;

  it(
    '15 client login+vote+spin+opId qua HTTP/WS that',
    { skip: skipReason },
    async () => {
      const { probeLiveConcurrent } = await import('../helpers/live-client.ts');
      const report = await probeLiveConcurrent(url!, 15);
      console.log(JSON.stringify(report));
      assert.equal(report.logins, 15, `logins=${report.logins}; ${report.errors.join('; ')}`);
      assert.equal(report.votes, 15, `votes=${report.votes}; ${report.errors.join('; ')}`);
      assert.ok(report.spinResultIndex != null, `spin missing; ${report.errors.join('; ')}`);
      assert.equal(report.errors.length, 0, report.errors.join('; '));
      assert.ok(report.p95Ms <= 500, `p95=${report.p95Ms} > 500ms (chi tieu plan §10)`);
    },
  );
});
