/** VietQR EMVCo payload + CRC16-CCITT (poly 0x1021, init 0xFFFF). */

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return tag + len + value;
}

export function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export type VietQrInput = {
  bankBin: string;
  account: string;
  amount: number;
  description: string;
};

export function buildVietQrPayload(input: VietQrInput): string {
  const bin = String(input.bankBin || '').replace(/\D/g, '');
  const account = String(input.account || '').replace(/\s/g, '');
  const amount = Math.max(0, Math.round(Number(input.amount) || 0));
  const desc = String(input.description || '')
    .slice(0, 25)
    .replace(/[^\x20-\x7E]/g, '');

  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  const add = tlv('08', desc);

  let payload =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchant) +
    tlv('53', '704') +
    tlv('54', String(amount)) +
    tlv('58', 'VN') +
    tlv('62', add) +
    '6304';
  payload += crc16ccitt(payload);
  return payload;
}
