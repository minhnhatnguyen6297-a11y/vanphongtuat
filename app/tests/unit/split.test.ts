import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { split } from '../../src/shared/split.ts';
import { StubProvider } from '../../src/server/ai/provider.ts';
import type { BillView } from '../../src/shared/bill-read.ts';

const sum = (r: ReturnType<typeof split>) => r.rows.reduce((t, x) => t + x.share, 0);

const three = [
  { memberId: 'a', price: 10000 },
  { memberId: 'b', price: null },
  { memberId: 'c', price: 1 },
];

describe('split', () => {
  it('100.001đ / 3 người = 33.500đ, thực thu 100.500đ', () => {
    const r = split({ orders: three, billTotal: 100001, mode: 'item', hostId: 'a' });
    assert.equal(r.each, 33500);
    assert.ok(r.rows.every((x) => x.share === 33500));
    assert.equal(sum(r), 100500);
    assert.equal(r.target, 100500);
    assert.equal(r.bill, 100001);
    assert.equal(r.hostCovers, 0);
    assert.equal(r.equal, true);
    assert.ok(r.rows.every((x) => x.estimated === false));
  });

  it('mode equal cho cùng một kết quả — giá món không đổi phần', () => {
    const item = split({ orders: three, billTotal: 100001, mode: 'item', hostId: 'zzz' });
    const equal = split({ orders: three, billTotal: 100001, mode: 'equal', hostId: 'a' });
    assert.deepEqual(item.rows, equal.rows);
  });

  it('một người hai order vẫn tính một suất', () => {
    const r = split({
      orders: [
        { memberId: 'a', price: 30000 },
        { memberId: 'a', price: null },
        { memberId: 'b', price: 40000 },
      ],
      billTotal: 100001,
      mode: 'equal',
      hostId: 'b',
    });
    assert.equal(r.rows.length, 2);
    assert.equal(r.each, 50500);
    assert.equal(r.target, 101000);
  });

  it('bill 0 thì mỗi người 0', () => {
    const r = split({ orders: three, billTotal: 0, mode: 'equal', hostId: 'a' });
    assert.equal(r.bill, 0);
    assert.equal(r.each, 0);
    assert.equal(sum(r), 0);
    assert.equal(r.hostCovers, 0);
    assert.equal(r.empty, false);
  });

  it('0 người thì không chia, không ai gánh phần lẻ', () => {
    const r = split({ orders: [], billTotal: 100001, mode: 'item', hostId: 'a' });
    assert.equal(r.empty, true);
    assert.equal(r.rows.length, 0);
    assert.equal(r.each, 0);
    assert.equal(r.target, 0);
    assert.equal(r.hostCovers, 0);
    assert.equal(r.bill, 100001);
  });

  it('bill null không lấy tổng giá món', () => {
    const r = split({ orders: three, billTotal: null, mode: 'item', hostId: 'a' });
    assert.equal(r.bill, 0);
    assert.equal(r.each, 0);
    assert.equal(r.orderSum, 0);
  });

  it('AI total null không bịa tổng để chia', async () => {
    const provider = new StubProvider();
    const view = (await provider.read(
      'bill',
      Buffer.alloc(0),
      'image/png',
      new AbortController().signal,
    )) as BillView;
    assert.equal(view.total, null);
    const r = split({ orders: three, billTotal: view.total, mode: 'equal', hostId: 'a' });
    assert.equal(r.bill, 0);
    assert.equal(r.each, 0);
    assert.equal(sum(r), 0);
  });

  it('đúng bội 500 thì không cộng thêm', () => {
    const r = split({
      orders: [
        { memberId: 'a', price: null },
        { memberId: 'b', price: null },
      ],
      billTotal: 67000,
      mode: 'equal',
      hostId: 'a',
    });
    assert.equal(r.each, 33500);
    assert.equal(r.target, 67000);
  });

  it('2000 ca: mỗi suất bằng nhau, không âm, bội 500, không gánh lẻ', () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let k = 0; k < 2000; k++) {
      const n = rnd(8);
      const orders = Array.from({ length: n + rnd(4) }, () => ({
        memberId: 'm' + rnd(Math.max(1, n)),
        price: rnd(4) ? 5000 * (1 + rnd(20)) : null,
      }));
      const billTotal = rnd(5) === 0 ? null : rnd(3) === 0 ? 0 : rnd(2_000_000);
      const r = split({
        orders,
        billTotal,
        mode: rnd(2) ? 'item' : 'equal',
        hostId: 'm0',
      });
      const people = new Set(orders.map((o) => o.memberId)).size;
      assert.equal(r.hostCovers, 0);
      assert.equal(r.rows.length, people);
      assert.equal(r.target, r.each * people);
      assert.ok(r.rows.every((x) => x.share === r.each && x.share >= 0 && x.share % 500 === 0));
      if (people > 0 && r.bill > 0) assert.ok(r.target >= r.bill);
      if (people === 0) assert.equal(r.each, 0);
    }
  });
});
