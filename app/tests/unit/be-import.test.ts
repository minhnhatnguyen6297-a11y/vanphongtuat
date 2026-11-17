import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IMPORT_MAX_BYTES, IMPORT_MAX_EDGE, importEdgeError, importFileError } from '../../src/client/be/image.ts';

describe('nhập ảnh cá', () => {
  it('chặn đúng 4MB và đuôi file', () => {
    assert.equal(importFileError({ size: 10, type: 'image/png', name: 'a.png' }), null);
    assert.equal(importFileError({ size: 10, type: 'image/jpeg', name: 'a.jpg' }), null);
    assert.equal(importFileError({ size: 10, type: 'image/webp', name: 'a.webp' }), null);
    assert.equal(importFileError({ size: 10, type: '', name: 'a.jpeg' }), null);
    assert.equal(importFileError({ size: IMPORT_MAX_BYTES, type: 'image/png', name: 'a.png' }), null);
    assert.equal(
      importFileError({ size: IMPORT_MAX_BYTES + 1, type: 'image/png', name: 'a.png' }),
      'Ảnh lớn hơn 4MB',
    );
    assert.equal(importFileError({ size: 10, type: 'text/plain', name: 'a.txt' }), 'Chỉ PNG, JPG, WebP');
    assert.equal(importFileError({ size: 10, type: 'text/plain', name: 'a.png' }), 'Chỉ PNG, JPG, WebP');
  });

  it('chặn mỗi chiều trên 4096 sau khi giải mã', () => {
    assert.equal(importEdgeError(IMPORT_MAX_EDGE, IMPORT_MAX_EDGE), null);
    assert.equal(importEdgeError(1, 1), null);
    assert.equal(importEdgeError(IMPORT_MAX_EDGE + 1, 10), 'Mỗi chiều tối đa 4096px');
    assert.equal(importEdgeError(10, IMPORT_MAX_EDGE + 1), 'Mỗi chiều tối đa 4096px');
    assert.equal(importEdgeError(0, 10), 'Không đọc được ảnh');
    assert.equal(importEdgeError(10, 0), 'Không đọc được ảnh');
  });
});
