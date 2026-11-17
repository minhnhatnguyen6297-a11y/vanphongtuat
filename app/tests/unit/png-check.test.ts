import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { assertPng } from '../../src/server/png-check.ts';

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(head));
  return Buffer.concat([len, head, crc]);
}

function rgbPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3, 0);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const REAL_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('png check', () => {
  it('accepts a real 1x1 png and a generated 2x2', () => {
    assert.doesNotThrow(() => assertPng(REAL_1X1));
    assert.doesNotThrow(() => assertPng(rgbPng(2, 2)));
  });

  it('rejects a fake header, a truncated file, a bad crc, and a huge image', () => {
    const fake = Buffer.alloc(24);
    fake[0] = 0x89;
    fake.write('PNG', 1, 'ascii');
    fake.write('IHDR', 12, 'ascii');
    assert.throws(() => assertPng(fake), /bad_png/);

    const whole = rgbPng(2, 2);
    assert.throws(() => assertPng(whole.subarray(0, whole.length - 8)), /bad_png/);

    const badCrc = Buffer.from(whole);
    badCrc[20] ^= 0xff;
    assert.throws(() => assertPng(badCrc), /bad_png/);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(100_000, 0);
    ihdr.writeUInt32BE(100_000, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const huge = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IEND', Buffer.alloc(0))]);
    assert.throws(() => assertPng(huge), /bad_png/);
  });
});
