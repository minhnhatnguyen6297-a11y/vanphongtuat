import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTierParam, resolveTier } from '../../src/client/be/gl/tier.ts';

describe('ao cá tier', () => {
  it('ép mức từ query', () => {
    assert.equal(parseTierParam('cao'), 'cao');
    assert.equal(parseTierParam('vua'), 'vua');
    assert.equal(parseTierParam('nhe'), 'nhe');
    assert.equal(parseTierParam('tinh'), 'tinh');
    assert.equal(parseTierParam('auto'), 'auto');
    assert.equal(parseTierParam('nope'), null);
  });

  it('GPU mềm luôn Tĩnh', () => {
    assert.equal(resolveTier({ soft: true, param: 'cao' }), 'tinh');
    assert.equal(resolveTier({ soft: true, param: 'auto' }), 'tinh');
  });

  it('không mềm giữ ép mức', () => {
    assert.equal(resolveTier({ soft: false, param: 'nhe' }), 'nhe');
  });
});
