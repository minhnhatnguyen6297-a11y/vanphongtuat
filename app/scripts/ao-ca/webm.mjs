// Minimal single-track, single-cluster WebM for a short VP8 clip.
// https://www.webmproject.org/docs/container/
const bytes = (...values) => Buffer.from(values);
const hex = value => Buffer.from(value, 'hex');

function number(n, length) {
  const data = Buffer.alloc(length ?? Math.max(1, Math.ceil(Math.log2(n + 1) / 8)));
  data.writeUIntBE(n, 0, data.length);
  return data;
}

function element(id, ...fields) {
  const data = Buffer.concat(fields);
  let width = 1;
  while (data.length >= 2 ** (7 * width) - 1) width++;
  return Buffer.concat([hex(id), number(data.length + 2 ** (7 * width), width), data]);
}

export function webmFromVp8(frames, {width, height, fps}) {
  const duration = frames.length * 1000 / fps;
  if (!frames.length || duration >= 32768 || frames[0].type !== 'key') {
    throw new Error('Expected a short VP8 stream that starts with a key frame');
  }
  const time = Buffer.alloc(8);
  time.writeDoubleBE(duration);
  const ebml = element('1a45dfa3',
    element('4286',bytes(1)), element('42f7',bytes(1)), element('42f2',bytes(4)),
    element('42f3',bytes(8)), element('4282',Buffer.from('webm')),
    element('4287',bytes(2)), element('4285',bytes(2)));
  const info = element('1549a966',
    element('2ad7b1',number(1_000_000)), element('4489',time),
    element('4d80',Buffer.from('Ao Ca')), element('5741',Buffer.from('Ao Ca')));
  const tracks = element('1654ae6b', element('ae',
    element('d7',bytes(1)), element('73c5',bytes(1)), element('83',bytes(1)),
    element('86',Buffer.from('V_VP8')), element('23e383',number(Math.round(1e9 / fps))),
    element('e0',element('b0',number(width)),element('ba',number(height)))));
  const blocks = frames.map(({timestamp, type, data}) => element('a3',bytes(0x81),
    number(Math.round(timestamp/1000),2), bytes(type==='key' ? 0x80 : 0), Buffer.from(data)));
  return Buffer.concat([ebml,element('18538067',info,tracks,element('1f43b675',element('e7',bytes(0)),...blocks))]);
}
