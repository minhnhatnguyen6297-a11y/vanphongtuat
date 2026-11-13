import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { split } from '../../src/shared/split.ts';

const sum = (r: ReturnType<typeof split>) => r.rows.reduce((t, x) => t + x.share, 0);
const shares = (r: ReturnType<typeof split>) =>
  Object.fromEntries(r.rows.map((x) => [x.memberId, x.share]));

const six = [
  { memberId: 'minh', price: 65000 },
  { memberId: 'lan', price: 45000 },
  { memberId: 'tuan', price: 60000 },
  { memberId: 'huong', price: 50000 },
  { memberId: 'hoang', price: 60000 },
  { memberId: 'thao', price: null },
];

describe('split', () => {
  it('A theo món, 340k', () => {
    const r = split({ orders: six, billTotal: 340000, mode: 'item', hostId: 'minh' });
    assert.deepEqual(shares(r), {
      minh: 66000, lan: 45500, tuan: 61000, huong: 50500, hoang: 60500, thao: 56500,
    });
    assert.equal(sum(r), 340000);
    assert.equal(r.hostCovers, 0);
    assert.ok(r.rows.find((x) => x.memberId === 'thao')?.estimated);
  });

  it('B chia đều, 340k', () => {
    const r = split({ orders: six, billTotal: 340000, mode: 'equal', hostId: 'minh' });
    assert.deepEqual(shares(r), {
      minh: 57000, lan: 57000, tuan: 56500, huong: 56500, hoang: 56500, thao: 56500,
    });
    assert.equal(sum(r), 340000);
  });

  it('C 4 người chia 1.000đ — Chủ xị nhận suất hoà', () => {
    const r = split({
      orders: ['a', 'b', 'c', 'd'].map((m) => ({ memberId: m, price: null })),
      billTotal: 1000,
      mode: 'equal',
      hostId: 'c',
    });
    assert.equal(sum(r), 1000);
    assert.ok(r.rows.every((x) => x.share >= 0));
    assert.equal(shares(r).c, 500);
  });

  it('D bill lẻ 100.100đ — Chủ xị gánh 100', () => {
    const r = split({
      orders: [
        { memberId: 'a', price: 50000 },
        { memberId: 'b', price: 50000 },
      ],
      billTotal: 100100,
      mode: 'item',
      hostId: 'a',
    });
    assert.equal(r.target, 100000);
    assert.equal(r.hostCovers, 100);
    assert.equal(sum(r), 100000);
  });

  it('E bill null = tổng order', () => {
    const r = split({ orders: six, billTotal: null, mode: 'item', hostId: 'minh' });
    assert.equal(r.bill, 336000);
    assert.equal(sum(r) + r.hostCovers, 336000);
  });

  it('F bill 0 hợp lệ', () => {
    const r = split({ orders: six, billTotal: 0, mode: 'item', hostId: 'minh' });
    assert.equal(sum(r), 0);
    assert.equal(r.hostCovers, 0);
  });

  it('G không có order', () => {
    const r = split({ orders: [], billTotal: 120000, mode: 'item', hostId: 'minh' });
    assert.ok(r.empty);
    assert.equal(r.rows.length, 0);
    assert.equal(r.hostCovers, 120000);
  });

  it('H không ai có giá -> chia đều', () => {
    const r = split({
      orders: ['a', 'b', 'c', 'd'].map((m) => ({ memberId: m, price: null })),
      billTotal: 200000,
      mode: 'item',
      hostId: 'a',
    });
    assert.ok(Object.values(shares(r)).every((s) => s === 50000));
  });

  it('I một người 2 order', () => {
    const r = split({
      orders: [
        { memberId: 'a', price: 30000 },
        { memberId: 'a', price: 10000 },
        { memberId: 'b', price: 40000 },
      ],
      billTotal: 80000,
      mode: 'item',
      hostId: 'b',
    });
    assert.deepEqual(shares(r), { a: 40000, b: 40000 });
  });

  it('2000 ca ngẫu nhiên: tổng khớp, không âm, bội 500', () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let k = 0; k < 2000; k++) {
      const n = 1 + rnd(15);
      const orders = Array.from({ length: n + rnd(5) }, () => ({
        memberId: 'm' + rnd(n),
        price: rnd(4) ? 5000 * (1 + rnd(20)) : null,
      }));
      const r = split({
        orders,
        billTotal: rnd(10) ? rnd(2000000) : null,
        mode: rnd(2) ? 'item' : 'equal',
        hostId: 'm0',
      });
      assert.equal(sum(r) + r.hostCovers, r.bill);
      assert.ok(r.rows.every((x) => x.share >= 0 && x.share % 500 === 0));
      assert.ok(r.hostCovers >= 0 && r.hostCovers < 500);
    }
  });
});

