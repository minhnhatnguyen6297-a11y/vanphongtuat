import { inflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_EDGE = 1024;
const MAX_PIXELS = 1024 * 1024;

const DEPTHS: Record<number, number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function bitsPerPixel(colorType: number, bitDepth: number): number {
  if (colorType === 2) return bitDepth * 3;
  if (colorType === 4) return bitDepth * 2;
  if (colorType === 6) return bitDepth * 4;
  return bitDepth;
}

/** Reject a buffer that is not a complete, bounded PNG. Dimensions are refused before inflate. */
export function assertPng(buf: Buffer): void {
  if (buf.length < 8 + 25 || !buf.subarray(0, 8).equals(SIG)) throw new Error('bad_png');
  let off = 8;
  let width = 0;
  let height = 0;
  let bpp = 0;
  let sawIhdr = false;
  let sawPlte = false;
  let colorType = 0;
  let idatOpen = false;
  let sawIdat = false;
  let ended = false;
  const idat: Buffer[] = [];

  while (off + 12 <= buf.length) {
    if (ended) throw new Error('bad_png');
    const len = buf.readUInt32BE(off);
    if (len > 0x7fffffff || off + 12 + len > buf.length) throw new Error('bad_png');
    const type = buf.toString('ascii', off + 4, off + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error('bad_png');
    const dataEnd = off + 8 + len;
    const got = buf.readUInt32BE(dataEnd);
    if (got !== crc32(buf.subarray(off + 4, dataEnd))) throw new Error('bad_png');
    const data = buf.subarray(off + 8, dataEnd);

    if (!sawIhdr && type !== 'IHDR') throw new Error('bad_png');
    if (type === 'IHDR') {
      if (sawIhdr || len !== 13) throw new Error('bad_png');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error('bad_png');
      const allowed = DEPTHS[colorType];
      if (!allowed || !allowed.includes(bitDepth)) throw new Error('bad_png');
      if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
        throw new Error('bad_png');
      }
      bpp = bitsPerPixel(colorType, bitDepth);
      sawIhdr = true;
    } else if (type === 'PLTE') {
      if (!sawIhdr || sawIdat || len % 3 !== 0 || len < 3 || len > 256 * 3) throw new Error('bad_png');
      sawPlte = true;
    } else if (type === 'IDAT') {
      if (!sawIhdr || (colorType === 3 && !sawPlte)) throw new Error('bad_png');
      if (sawIdat && !idatOpen) throw new Error('bad_png');
      sawIdat = true;
      idatOpen = true;
      idat.push(data);
    } else if (type === 'IEND') {
      if (len !== 0 || !sawIdat) throw new Error('bad_png');
      idatOpen = false;
      ended = true;
    } else if (type[0] >= 'A' && type[0] <= 'Z') {
      throw new Error('bad_png');
    } else if (sawIdat) {
      idatOpen = false;
    }
    off = dataEnd + 4;
  }
  if (!ended || off !== buf.length) throw new Error('bad_png');

  const stride = 1 + Math.ceil((width * bpp) / 8);
  const expected = height * stride;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    throw new Error('bad_png');
  }
  if (raw.length !== expected) throw new Error('bad_png');
  for (let y = 0; y < height; y++) {
    if (raw[y * stride] > 4) throw new Error('bad_png');
  }
}
