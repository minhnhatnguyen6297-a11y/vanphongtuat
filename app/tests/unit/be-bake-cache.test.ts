import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cacheControlFor, spritePublicPath, stepQuality, fishPose, canEat } from '../../src/shared/be.ts';
import { contentHash, spriteFileFor } from '../../src/server/be-sprites.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('cache nướng sprite', () => {
  it('sprite và lớp nền có hash thì cache một năm, manifest thì không', () => {
    const hash = 'a'.repeat(64);
    assert.equal(spritePublicPath(hash), `/art/be/s/${hash}.png`);
    assert.equal(spritePublicPath('../etc/passwd'), null);
    assert.equal(spritePublicPath('zz'), null);
    assert.equal(cacheControlFor(`/art/be/s/${hash}.png`), 'public, max-age=31536000, immutable');
    assert.equal(cacheControlFor('/art/be/water.ab12cd34.png'), 'public, max-age=31536000, immutable');
    assert.equal(cacheControlFor('/art/be/manifest.json'), 'no-cache');
    assert.equal(cacheControlFor('/styles.css'), null);
  });

  it('cùng byte thì cùng hash, đường dẫn không được thoát thư mục', () => {
    const a = Buffer.from('ca-be');
    const b = Buffer.from('ca-be');
    const c = Buffer.from('ca-khac');
    assert.equal(contentHash(a), contentHash(b));
    assert.notEqual(contentHash(a), contentHash(c));
    const dir = mkdtempSync(join(tmpdir(), 'be-sprite-'));
    const hash = contentHash(a);
    const file = spriteFileFor(dir, hash);
    assert.ok(file && file.startsWith(dir));
    assert.equal(spriteFileFor(dir, '../' + hash), null);
    assert.equal(spriteFileFor(dir, hash.slice(0, 10)), null);
  });
});

describe('mức đồ họa', () => {
  it('bắt đầu vừa, hạ khi khung thấp, không lên cao nếu máy 4GB', () => {
    assert.equal(stepQuality({ tier: 'vua', avgFps: 20, samples: 8, reducedMotion: false }), 'nhe');
    assert.equal(stepQuality({ tier: 'vua', avgFps: 29, samples: 8, reducedMotion: false, deviceMemory: 8 }), 'cao');
    assert.equal(stepQuality({ tier: 'vua', avgFps: 29, samples: 8, reducedMotion: false, deviceMemory: 4 }), 'vua');
    assert.equal(stepQuality({ tier: 'cao', avgFps: 10, samples: 8, reducedMotion: false, deviceMemory: 4 }), 'vua');
    assert.equal(stepQuality({ tier: 'nhe', avgFps: 29, samples: 8, reducedMotion: false }), 'vua');
    assert.equal(stepQuality({ tier: 'cao', avgFps: 20, samples: 2, reducedMotion: false }), 'cao');
    assert.equal(stepQuality({ tier: 'cao', avgFps: 40, samples: 8, reducedMotion: true }), 'tinh');
  });
});

describe('cá bơi có hạt giống', () => {
  it('ở trong kính và đuổi mồi', () => {
    const fish = { id: 'ca-1', kind: 'ca' as const, swim: 'active' as const, wave: true, x: 0.5, y: 0.5, growth: 0.62 };
    const pose = fishPose(fish, 10_000, []);
    assert.ok(pose.x > 0.05 && pose.x < 0.95);
    assert.ok(pose.y > 0.1 && pose.y < 0.95);
    const pellet = { id: 'p', x: pose.x, bornAt: 9_000, eaten: false };
    const chase = fishPose(fish, 10_000, [pellet]);
    assert.ok(canEat(chase, pellet, 12_000) || Math.abs(chase.x - pellet.x) < Math.abs(pose.x - pellet.x) + 0.02);
  });
});
