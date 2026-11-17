import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileBill } from '../../src/shared/bill-read.ts';

describe('bill reconcile', () => {
  it('code overwrites a mismatched line and flags the total', () => {
    const view = reconcileBill({
      lines: [{ name: 'Cơm', qty: 2, unitPrice: 30000, lineTotal: 50000 }],
      fees: 5000,
      discount: 0,
      total: 70000,
    });
    assert.equal(view.lines[0]?.lineTotal, 60000);
    assert.ok(view.flags.includes('lech_dong'));
    assert.equal(view.computed, 65000);
    assert.equal(view.totalMatches, false);
    assert.ok(view.flags.includes('lech_tong'));
  });

  it('a missing line stays empty', () => {
    const view = reconcileBill({
      lines: [{ name: '', qty: null, unitPrice: null, lineTotal: null }],
      total: null,
    });
    assert.equal(view.lines[0]?.lineTotal, null);
    assert.equal(view.computed, null);
    assert.ok(view.flags.includes('thieu_dong'));
    assert.ok(view.flags.includes('thieu_ten'));
  });

  it('a matching total is accepted', () => {
    const view = reconcileBill({
      lines: [{ name: 'Trà', qty: 1, unitPrice: 15000, lineTotal: 15000 }],
      fees: 0,
      discount: 0,
      total: 15000,
    });
    assert.equal(view.totalMatches, true);
    assert.deepEqual(view.flags, []);
  });
});
