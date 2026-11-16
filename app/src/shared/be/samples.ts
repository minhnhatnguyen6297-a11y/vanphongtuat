import type { DrawingKind, Stroke, SwimType } from './types.ts';

const PALETTES = [
  ['#f28c28', '#c45a12', '#ffe08a'],
  ['#1f5fd1', '#143e8c', '#d6e4ff'],
  ['#e23b4a', '#a11e2c', '#ffd0d4'],
  ['#1b7a43', '#0e4e2a', '#d9f5e3'],
  ['#e2b13a', '#a67c12', '#fff3c4'],
  ['#7a4bb5', '#4c2a78', '#ead9fb'],
  ['#e07a9a', '#b44b6c', '#ffe0ea'],
  ['#2aa6a0', '#146e6a', '#d5f6f4'],
];

const NAMES = [
  'Bống', 'Mập', 'Sọc', 'Bơn', 'Đèn', 'Cơm', 'Heo', 'Sao', 'Mực', 'Lươn',
  'Bắp', 'Kem', 'Ổi', 'Bún', 'Nô', 'Rô', 'Trê', 'Chép', 'Dìa', 'Nục',
  'Thu', 'Sặc', 'Ét', 'Mè', 'Trôi', 'Lóc', 'Đối', 'Mú', 'Chim', 'Cá ú',
  'Bống cát', 'Bống bớp', 'Cá cơm', 'Rô phi', 'Thát', 'Nóc',
];

const SWIMS: SwimType[] = ['thuong', 'cham', 'tau', 'day'];

export function demoCreature(index: number): {
  kind: DrawingKind;
  name: string;
  swim: SwimType;
  wave: boolean;
  strokes: Stroke[];
} {
  const pal = PALETTES[index % PALETTES.length];
  const swim = SWIMS[index % SWIMS.length];
  const name = `${NAMES[index % NAMES.length]} ${1 + (index % 9)}`;
  return { kind: 'ca', name, swim, wave: swim !== 'day', strokes: fishStrokes(index, pal, swim === 'day') };
}

export function demoPlant(index: number): {
  kind: DrawingKind;
  name: string;
  swim: SwimType;
  wave: boolean;
  strokes: Stroke[];
} {
  return {
    kind: 'cay',
    name: index % 2 === 0 ? `Rong ${index + 1}` : `Lá ${index + 1}`,
    swim: 'thuong',
    wave: false,
    strokes: index % 2 === 0 ? templatePlant() : templatePlantTall(),
  };
}

export function templateFishBasic(): Stroke[] {
  return fishStrokes(0, PALETTES[0], false);
}

export function templateFishSlim(): Stroke[] {
  return fishStrokes(5, PALETTES[1], false);
}

export function templatePlant(): Stroke[] {
  return [
    pen('#1b7a43', 70, [500, 920, 480, 620, 520, 280]),
    pen('#3aaa62', 90, [500, 520, 250, 400, 220, 260]),
    pen('#146b38', 80, [520, 460, 780, 340, 800, 200]),
    pen('#d9f5e3', 36, [470, 700]),
  ];
}

export function templatePlantTall(): Stroke[] {
  return [
    pen('#0e4e2a', 50, [420, 980, 460, 500, 400, 80]),
    pen('#1b7a43', 70, [450, 400, 180, 280]),
    pen('#3aaa62', 64, [460, 300, 760, 160]),
    pen('#d9f5e3', 28, [430, 180]),
  ];
}

export function stampEye(x: number, y: number): Stroke[] {
  return [
    pen('#ffffff', 78, [clamp(x), clamp(y)], true),
    pen('#1b1b1b', 30, [clamp(x + 16), clamp(y)], true),
  ];
}

export function stampFin(x: number, y: number): Stroke[] {
  const cx = clamp(x);
  const cy = clamp(y);
  return [
    {
      tool: 'line',
      color: '#f4e7c5',
      size: 28,
      alpha: 0.95,
      hard: true,
      points: [cx, cy, clamp(cx - 80), clamp(cy - 70)],
    },
    {
      tool: 'line',
      color: '#f4e7c5',
      size: 28,
      alpha: 0.95,
      hard: true,
      points: [cx, cy, clamp(cx - 90), clamp(cy + 50)],
    },
  ];
}

export function stampScales(x: number, y: number): Stroke[] {
  const strokes: Stroke[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      strokes.push(
        pen('#ffe08a', 22, [clamp(x + col * 36), clamp(y + row * 28)], true, true),
      );
    }
  }
  return strokes;
}

function fishStrokes(index: number, pal: string[], flat: boolean): Stroke[] {
  const body: number[] = [];
  const wob = flat ? 6 : 18 + (index % 4) * 6;
  const y0 = flat ? 620 : 480;
  for (let k = 0; k <= 7; k++) {
    const x = 250 + k * 70;
    const y = y0 + Math.sin(k * 0.8 + index) * wob;
    body.push(Math.round(x), Math.round(clamp(y)));
  }
  const tailY = y0;
  return [
    pen(pal[0], flat ? 120 : 150, body),
    pen(pal[1], 55, [250, tailY, 70, tailY - 150]),
    pen(pal[1], 55, [250, tailY, 70, tailY + 140]),
    pen('#ffffff', 42, [690, y0 - 50], true),
    pen('#1b1b1b', 18, [708, y0 - 50], true),
    pen(pal[2], 36, [400, y0, 620, y0 - 10], false, true),
  ];
}

function pen(color: string, size: number, points: number[], hard = false, mask = false): Stroke {
  const s: Stroke = { tool: 'pen', color, size, alpha: 1, points };
  if (hard) s.hard = true;
  if (mask) s.mask = true;
  return s;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1000, Math.round(n)));
}
