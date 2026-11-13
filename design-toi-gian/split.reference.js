// Thuật toán chia tiền tham chiếu cho worker (port sang TypeScript ở shared/split.ts).
// Chạy kiểm thử: node split.reference.js
'use strict';

const STEP = 500;

/**
 * @param {object} input
 * @param {{memberId:string, price:number|null}[]} input.orders  theo thứ tự gọi
 * @param {number|null} input.billTotal  null = chưa nhập bill; 0 là số hợp lệ
 * @param {'item'|'equal'} input.mode
 * @param {string} input.hostId  Chủ xị của bàn
 */
function split({ orders, billTotal, mode, hostId }) {
  // 1. Gom theo người, giữ thứ tự order đầu tiên.
  const people = [];
  const byId = new Map();
  for (const o of orders) {
    let p = byId.get(o.memberId);
    if (!p) { p = { memberId: o.memberId, known: 0, missing: 0 }; byId.set(o.memberId, p); people.push(p); }
    if (Number.isFinite(o.price) && o.price > 0) p.known += Math.round(o.price); else p.missing += 1;
  }
  const pricedOrders = orders.filter((o) => Number.isFinite(o.price) && o.price > 0);
  const avgOrder = pricedOrders.length ? Math.round(pricedOrders.reduce((t, o) => t + o.price, 0) / pricedOrders.length) : 0;
  for (const p of people) { p.base = p.known + p.missing * avgOrder; p.estimated = p.missing > 0; }
  const orderSum = people.reduce((t, p) => t + p.base, 0);

  // 2. Tổng bill: null thì dùng tổng order; số âm kẹp về 0.
  const bill = billTotal == null ? orderSum : Math.max(0, Math.round(Number(billTotal) || 0));
  if (people.length === 0) return { rows: [], bill, target: 0, hostCovers: bill, orderSum, empty: true };

  // 3. Tổng mục tiêu = làm tròn XUỐNG tới 500đ; phần lẻ 0..499đ Chủ xị gánh (không bao giờ âm).
  const units = Math.floor(bill / STEP);
  const target = units * STEP;
  const hostCovers = bill - target;

  // 4. Trọng số nguyên; chia đều khi chọn CHIA ĐỀU hoặc không ai có giá.
  const equal = mode === 'equal' || orderSum === 0;
  const w = people.map((p) => (equal ? 1 : p.base));
  const W = w.reduce((t, x) => t + x, 0);

  // 5. Phương pháp phần dư lớn nhất, toàn số nguyên (không sai số float).
  const alloc = w.map((wi) => Math.floor((units * wi) / W));
  const rem = w.map((wi) => (units * wi) % W);
  let left = units - alloc.reduce((t, x) => t + x, 0);
  const order = people
    .map((p, i) => i)
    .sort((a, b) => rem[b] - rem[a] || (people[b].memberId === hostId) - (people[a].memberId === hostId) || a - b);
  for (const i of order) { if (left <= 0) break; alloc[i] += 1; left -= 1; }

  const rows = people.map((p, i) => ({ memberId: p.memberId, share: alloc[i] * STEP, estimated: !equal && p.estimated }));
  return { rows, bill, target, hostCovers, orderSum, empty: false, equal };
}

module.exports = { split };

// ---------------- kiểm thử ----------------
if (require.main === module) {
  const assert = require('assert');
  const sum = (r) => r.rows.reduce((t, x) => t + x.share, 0);
  const shares = (r) => Object.fromEntries(r.rows.map((x) => [x.memberId, x.share]));
  const six = [
    { memberId: 'minh', price: 65000 }, { memberId: 'lan', price: 45000 }, { memberId: 'tuan', price: 60000 },
    { memberId: 'huong', price: 50000 }, { memberId: 'hoang', price: 60000 }, { memberId: 'thao', price: null }
  ];
  const cases = [];
  const t = (name, input, check) => cases.push([name, input, check]);

  t('A theo món, 340k', { orders: six, billTotal: 340000, mode: 'item', hostId: 'minh' }, (r) => {
    assert.deepStrictEqual(shares(r), { minh: 66000, lan: 45500, tuan: 61000, huong: 50500, hoang: 60500, thao: 56500 });
    assert.strictEqual(sum(r), 340000); assert.strictEqual(r.hostCovers, 0);
    assert.ok(r.rows.find((x) => x.memberId === 'thao').estimated);
  });
  t('B chia đều, 340k', { orders: six, billTotal: 340000, mode: 'equal', hostId: 'minh' }, (r) => {
    assert.deepStrictEqual(shares(r), { minh: 57000, lan: 57000, tuan: 56500, huong: 56500, hoang: 56500, thao: 56500 });
    assert.strictEqual(sum(r), 340000);
  });
  t('C 4 người chia 1.000đ (lỗi plan cũ)', { orders: ['a', 'b', 'c', 'd'].map((m) => ({ memberId: m, price: null })), billTotal: 1000, mode: 'equal', hostId: 'c' }, (r) => {
    assert.strictEqual(sum(r), 1000); assert.ok(r.rows.every((x) => x.share >= 0));
    assert.strictEqual(shares(r).c, 500); // hoà phần dư thì Chủ xị nhận trước
  });
  t('D bill lẻ 100.100đ', { orders: [{ memberId: 'a', price: 50000 }, { memberId: 'b', price: 50000 }], billTotal: 100100, mode: 'item', hostId: 'a' }, (r) => {
    assert.strictEqual(r.target, 100000); assert.strictEqual(r.hostCovers, 100); assert.strictEqual(sum(r), 100000);
  });
  t('E bill null = tổng order', { orders: six, billTotal: null, mode: 'item', hostId: 'minh' }, (r) => {
    assert.strictEqual(r.bill, 336000); assert.strictEqual(sum(r) + r.hostCovers, 336000);
  });
  t('F bill 0 hợp lệ', { orders: six, billTotal: 0, mode: 'item', hostId: 'minh' }, (r) => {
    assert.strictEqual(sum(r), 0); assert.strictEqual(r.hostCovers, 0);
  });
  t('G không có order', { orders: [], billTotal: 120000, mode: 'item', hostId: 'minh' }, (r) => {
    assert.ok(r.empty); assert.strictEqual(r.rows.length, 0); assert.strictEqual(r.hostCovers, 120000);
  });
  t('H không ai có giá -> chia đều', { orders: ['a', 'b', 'c', 'd'].map((m) => ({ memberId: m, price: null })), billTotal: 200000, mode: 'item', hostId: 'a' }, (r) => {
    assert.ok(Object.values(shares(r)).every((s) => s === 50000));
  });
  t('I một người 2 order', { orders: [{ memberId: 'a', price: 30000 }, { memberId: 'a', price: 10000 }, { memberId: 'b', price: 40000 }], billTotal: 80000, mode: 'item', hostId: 'b' }, (r) => {
    assert.deepStrictEqual(shares(r), { a: 40000, b: 40000 });
  });
  // Ngẫu nhiên: tổng luôn = target, không âm, bội 500.
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let k = 0; k < 2000; k++) {
    const n = 1 + rnd(15);
    const orders = Array.from({ length: n + rnd(5) }, () => ({ memberId: 'm' + rnd(n), price: rnd(4) ? 5000 * (1 + rnd(20)) : null }));
    const r = split({ orders, billTotal: rnd(10) ? rnd(2000000) : null, mode: rnd(2) ? 'item' : 'equal', hostId: 'm0' });
    assert.strictEqual(sum(r) + r.hostCovers, r.bill);
    assert.ok(r.rows.every((x) => x.share >= 0 && x.share % 500 === 0));
    assert.ok(r.hostCovers >= 0 && r.hostCovers < 500);
  }
  for (const [name, input, check] of cases) { check(split(input)); console.log('OK ', name); }
  console.log('OK  2000 ca ngẫu nhiên: tổng khớp, không âm, bội 500');
}
