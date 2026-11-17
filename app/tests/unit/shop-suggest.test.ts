import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { acceptShopSuggestion } from '../../src/shared/shop-suggest.ts';

const sources = [
  { name: 'Cơm Tấm Bà Hai', type: 'no' },
  { name: 'Trà Đá', type: 'uong' },
];

describe('shop suggestion', () => {
  it('keeps a known shop and its catalog type', () => {
    const got = acceptShopSuggestion({ name: 'cơm tấm bà hai', type: 'vat' }, sources, '');
    assert.equal(got.name, 'Cơm Tấm Bà Hai');
    assert.equal(got.type, 'no');
    assert.equal(got.uncertain, false);
  });

  it('keeps a name the user actually wrote', () => {
    const got = acceptShopSuggestion({ name: 'Bún mộc', type: 'no' }, sources, 'muốn ăn Bún mộc');
    assert.equal(got.name, 'Bún mộc');
    assert.equal(got.type, 'no');
    assert.equal(got.uncertain, true);
  });

  it('drops an invented name', () => {
    const got = acceptShopSuggestion({ name: 'Quán bịa 123', type: 'vat' }, sources, 'gần nhà');
    assert.equal(got.name, null);
    assert.equal(got.type, null);
  });
});
