import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findShops, foldShopQuery } from '../../src/shared/shop-find.ts';

const shops = [
  {
    id: 'cafe',
    name: 'Cafe Mood',
    menu: [{ name: 'Cold brew' }, { name: 'Bạc xỉu' }],
  },
  {
    id: 'pho',
    name: 'Phở Bò Phú Gia',
    menu: [{ name: 'Phở tái' }],
  },
  {
    id: 'bun',
    name: 'Bún Đậu Mắm Tôm',
    menu: [{ name: 'Mẹt bún đậu' }],
  },
];

describe('findShops', () => {
  it('bỏ dấu khi so tên quán và tên món', () => {
    assert.equal(foldShopQuery('  Phở  '), 'pho');
    assert.deepEqual(
      findShops(shops, 'pho').map((hit) => hit.id),
      ['pho'],
    );
    assert.deepEqual(
      findShops(shops, 'bun dau').map((hit) => hit.id),
      ['bun'],
    );
  });

  it('gõ món ra quán có món đó, gõ tên quán thì khớp tên', () => {
    const byDish = findShops(shops, 'cold brew');
    assert.equal(byDish.length, 1);
    assert.equal(byDish[0]!.id, 'cafe');
    assert.equal(byDish[0]!.matchedName, false);
    assert.deepEqual(byDish[0]!.dishes, ['Cold brew']);

    const byName = findShops(shops, 'cafe mood');
    assert.equal(byName[0]!.id, 'cafe');
    assert.equal(byName[0]!.matchedName, true);
  });

  it('ô trống không trả kết quả và tôn trọng trần', () => {
    assert.deepEqual(findShops(shops, '   '), []);
    assert.equal(findShops(shops, 'a', 1).length, 1);
  });
});
