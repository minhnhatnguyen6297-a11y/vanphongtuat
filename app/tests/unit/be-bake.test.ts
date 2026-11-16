import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { BakeCache, sha20 } from '../../src/server/be/cache.ts';
import { crc32, encodePng } from '../../src/server/be/png.ts';
import { rasterStrokes } from '../../src/shared/be/raster.ts';
import type { Stroke } from '../../src/shared/be/types.ts';

const body: Stroke = {
  tool: 'pen',
  color: '#ff0000',
  size: 80,
  alpha: 1,
  hard: true,
  points: [80, 500, 920, 500],
};

describe('nướng ảnh và kho', () => {
  it('crc32 và png đọc lại được', () => {
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
    const rgba = new Uint8Array(8);
    rgba[3] = 255;
    const png = encodePng(2, 2, rgba);
    assert.equal(png[0], 0x89);
    assert.equal(png.readUInt32BE(16), 2);
    assert.equal(png.readUInt32BE(20), 2);
    const parts: Buffer[] = [];
    let off = 8;
    while (off + 8 <= png.length) {
      const len = png.readUInt32BE(off);
      const type = png.toString('ascii', off + 4, off + 8);
      if (type === 'IDAT') parts.push(png.subarray(off + 8, off + 8 + len));
      off += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(parts));
    assert.equal(raw.length, (2 * 4 + 1) * 2);
  });

  it('nét đỏ có mặt ở giữa sprite', () => {
    const px = rasterStrokes([body], 192, 96);
    const i = (48 * 192 + 96) * 4;
    assert.ok(px[i + 3] > 200);
    assert.ok(px[i] > 200);
    assert.ok(px[i + 1] < 40);
  });

  it('lần sau không nướng lại, atlas không chồng', () => {
    const dir = mkdtempSync(join(tmpdir(), 'be-bake-'));
    try {
      const cache = new BakeCache(dir);
      const h1 = sha20('one');
      const h2 = sha20('two');
      cache.ensureSprite(h1, 'ca', [body]);
      cache.ensureSprite(h2, 'cay', [{ ...body, color: '#00aa44', points: [400, 100, 500, 900] }]);
      assert.equal(cache.rasterCount, 2);
      cache.ensureSprite(h1, 'ca', [body]);
      assert.equal(cache.rasterCount, 2);
      assert.equal(cache.hitCount, 1);
      const pack = cache.pack([
        { id: 'a', hash: h1 },
        { id: 'b', hash: h2 },
      ]);
      const fa = pack.frames.a;
      const fb = pack.frames.b;
      assert.ok(fa && fb);
      const same = fa.atlas === fb.atlas;
      const overlap =
        same &&
        fa.x < fb.x + fb.w &&
        fa.x + fa.w > fb.x &&
        fa.y < fb.y + fb.h &&
        fa.y + fa.h > fb.y;
      assert.equal(overlap, false);
      assert.ok(fa.x + fa.w <= pack.atlases[fa.atlas].w);
      assert.ok(fa.y + fa.h <= pack.atlases[fa.atlas].h);
      const encodes = cache.atlasEncodes;
      cache.pack([
        { id: 'a', hash: h1 },
        { id: 'b', hash: h2 },
      ]);
      assert.equal(cache.atlasEncodes, encodes);

      const again = new BakeCache(dir);
      again.ensureSprite(h1, 'ca', [body]);
      assert.equal(again.rasterCount, 0);
      assert.equal(again.hitCount, 1);
      assert.ok(again.pngOf(h1));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
