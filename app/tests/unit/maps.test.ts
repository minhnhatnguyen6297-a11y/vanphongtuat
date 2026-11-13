import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMapsName } from '../../src/shared/maps.ts';

describe('maps.parseMapsName', () => {
  it('parse /maps/place/ encoded', () => {
    const url =
      'https://www.google.com/maps/place/Ph%E1%BB%9F+B%C3%B2+Nam/@21.0,105.8,17z';
    assert.equal(parseMapsName(url), 'Phở Bò Nam');
  });

  it('parse /maps/place/ khong query', () => {
    assert.equal(
      parseMapsName('https://maps.google.com/maps/place/Com+Tam+Ba+Ghien/'),
      'Com Tam Ba Ghien',
    );
  });

  it('parse /maps/place/ raw string khong URL hop le', () => {
    assert.equal(
      parseMapsName('xem /maps/place/Bun%20Cha%20Huong%20Lien/data=!3m1'),
      'Bun Cha Huong Lien',
    );
  });

  it('fallback ?q= khi khong phai toa do', () => {
    assert.equal(
      parseMapsName('https://www.google.com/maps?q=Quan+Nem+Nha+Trang'),
      'Quan Nem Nha Trang',
    );
  });

  it('bo qua ?q= toa do', () => {
    assert.equal(parseMapsName('https://www.google.com/maps?q=21.0285,105.8542'), null);
  });

  it('rong / khong phai maps -> null', () => {
    assert.equal(parseMapsName(''), null);
    assert.equal(parseMapsName('https://example.com/place/foo'), null);
  });
});
