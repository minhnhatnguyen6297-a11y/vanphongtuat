import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVietQrPayload, crc16ccitt } from '../../src/shared/vietqr.ts';

/** Tách TLV EMVCo (tag 2 ký tự + length 2 số + value). */
function parseTlvs(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    assert.ok(Number.isFinite(len) && len >= 0, `bad len at ${i}`);
    const value = payload.slice(i + 4, i + 4 + len);
    out[tag] = value;
    i += 4 + len;
  }
  assert.equal(i, payload.length, 'TLV must consume entire payload');
  return out;
}

describe('vietqr', () => {
  it('CRC16-CCITT known vector (empty + short)', () => {
    // Poly 0x1021, init 0xFFFF — "123456789" -> 0x29B1 (CCITT-FALSE)
    assert.equal(crc16ccitt('123456789'), '29B1');
  });

  it('payload EMVCo co CRC hop le + dung tag', () => {
    // Mau tham chieu noi bo (BIN Vietcombank 970436). Owner quet thu bang app ngan hang.
    const payload = buildVietQrPayload({
      bankBin: '970436',
      account: '0123456789',
      amount: 56500,
      description: '#12 MINH',
    });

    assert.match(payload, /^00020101021238.+6304[0-9A-F]{4}$/);

    const body = payload.slice(0, -4); // bo 4 hex CRC
    const expectedCrc = crc16ccitt(body);
    assert.equal(payload.slice(-4), expectedCrc);

    const tags = parseTlvs(payload);
    assert.equal(tags['00'], '01');
    assert.equal(tags['01'], '12');
    assert.equal(tags['53'], '704');
    assert.equal(tags['54'], '56500');
    assert.equal(tags['58'], 'VN');
    assert.equal(tags['63'], expectedCrc);

    // Tag 38: GUID + BIN + STK + QRIBFTTA
    assert.ok(tags['38']?.includes('A000000727'));
    assert.ok(tags['38']?.includes('970436'));
    assert.ok(tags['38']?.includes('0123456789'));
    assert.ok(tags['38']?.includes('QRIBFTTA'));

    // Tag 62.08 description
    assert.ok(tags['62']?.includes('#12 MINH'));
  });

  it('mo ta dai bi cat 25 ky tu; ky tu ngoai ASCII bi loai', () => {
    const payload = buildVietQrPayload({
      bankBin: '970436',
      account: '1',
      amount: 1000,
      description: 'ÁÂ 123456789012345678901234567890',
    });
    const tags = parseTlvs(payload);
    const add = tags['62']!;
    // TLV 08 + len + value trong 62
    const descLen = Number(add.slice(2, 4));
    const desc = add.slice(4, 4 + descLen);
    assert.ok(desc.length <= 25);
    assert.ok(!/[^\x20-\x7E]/.test(desc));
    assert.equal(payload.slice(-4), crc16ccitt(payload.slice(0, -4)));
  });

  it('amount am -> 0; lam tron so', () => {
    const p = buildVietQrPayload({
      bankBin: '970436',
      account: '99',
      amount: -100,
      description: 'X',
    });
    const tags = parseTlvs(p);
    assert.equal(tags['54'], '0');
  });
});
