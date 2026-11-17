/** Placeholder outlines until the graphics pass lands real pattern art. Head faces right. */

const INK = '#13110F';
const PAPER = '#FDF7EB';

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 120 64" fill="${PAPER}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">${body}</svg>`;
}

export type FishPattern = { id: string; label: string; svg: string };

export const FISH_PATTERNS: FishPattern[] = [
  {
    id: 'tron',
    label: 'Tròn',
    svg: svg(
      `<ellipse cx="72" cy="34" rx="32" ry="16"/>
       <path d="M40 34 L16 18 L22 34 L16 50 Z"/>
       <circle cx="90" cy="30" r="2.2" fill="${INK}" stroke="none"/>`,
    ),
  },
  {
    id: 'dai',
    label: 'Dài',
    svg: svg(
      `<path d="M18 34 C30 18 78 16 100 30 C108 34 100 42 92 40 C70 48 36 50 18 34 Z"/>
       <path d="M22 34 L8 24 L12 34 L8 44 Z"/>
       <circle cx="90" cy="30" r="2" fill="${INK}" stroke="none"/>`,
    ),
  },
  {
    id: 'tamgiac',
    label: 'Tam giác',
    svg: svg(
      `<path d="M22 34 L78 16 L102 34 L78 52 Z"/>
       <path d="M28 34 L10 20 L14 34 L10 48 Z"/>
       <circle cx="86" cy="30" r="2" fill="${INK}" stroke="none"/>`,
    ),
  },
  {
    id: 'noc',
    label: 'Nóc',
    svg: svg(
      `<circle cx="64" cy="34" r="18"/>
       <path d="M64 12 L68 18 L60 18 Z M86 20 L80 26 L88 28 Z M90 40 L82 40 L88 48 Z M46 16 L50 22 L42 24 Z M38 36 L46 34 L40 44 Z" fill="${INK}" stroke="none"/>
       <path d="M46 34 L28 24 L32 34 L28 44 Z"/>
       <circle cx="74" cy="30" r="2.1" fill="${INK}" stroke="none"/>`,
    ),
  },
  {
    id: 'chep',
    label: 'Chép',
    svg: svg(
      `<path d="M24 36 C40 14 70 18 96 28 C104 32 98 44 88 46 C64 54 40 50 24 36 Z"/>
       <path d="M30 36 L12 22 L18 36 L12 50 Z"/>
       <path d="M70 28 C66 36 66 40 74 44" fill="none"/>
       <circle cx="86" cy="32" r="2" fill="${INK}" stroke="none"/>`,
    ),
  },
  {
    id: 'dep',
    label: 'Dẹp',
    svg: svg(
      `<path d="M34 32 L70 10 L100 32 L70 56 Z"/>
       <path d="M40 32 L16 14 L22 32 L16 50 Z"/>
       <path d="M70 16 L78 32 L70 50" fill="none"/>
       <circle cx="86" cy="28" r="2" fill="${INK}" stroke="none"/>`,
    ),
  },
];

export function patternById(id: string): FishPattern | undefined {
  return FISH_PATTERNS.find((p) => p.id === id);
}
