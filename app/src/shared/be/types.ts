/** Kiểu dùng chung cho bể — máy chủ và trình duyệt. */

export const RASTER_V = '1';
export const SCENE_V = '1';
export const FOOD_FALL_MS = 2800;
export const STROKE_JSON_MAX = 8192;
export const STROKE_MAX = 64;
export const POINTS_MAX = 480;

export const BE_CAPS = { ca: 40, cay: 16, do: 12, thuc_an: 8 } as const;

export const SPRITE_SIZE = {
  ca: { w: 192, h: 96 },
  cay: { w: 96, h: 168 },
  thuc_an: { w: 64, h: 64 },
  do: { w: 128, h: 96 },
} as const;

export const UNLOCKS = {
  tem_vay: { cost: 3, label: 'Tem vây' },
  tem_van: { cost: 3, label: 'Tem vân' },
  khuon_ca2: { cost: 4, label: 'Khuôn cá mảnh' },
  khuon_cay2: { cost: 4, label: 'Khuôn cây cao' },
} as const;

export type UnlockId = keyof typeof UNLOCKS;
export type DrawingKind = keyof typeof SPRITE_SIZE;
export type SwimType = 'thuong' | 'cham' | 'tau' | 'day';
export type SandId = 'vang' | 'trang' | 'hong' | 'xam';
export type LightId = 'auto' | 'ngay' | 'chieu' | 'dem';
export type QualityName = 'cao' | 'vua' | 'nhe' | 'tinh';
export type StrokeTool = 'pen' | 'erase' | 'line' | 'fill';
export type DayBucket = 'ngay' | 'chieu' | 'dem';

export type Stroke = {
  tool: StrokeTool;
  color: string;
  size: number;
  alpha: number;
  hard?: boolean;
  mask?: boolean;
  points: number[];
};

export type IdleConfig = {
  visibleMs: number;
  hiddenMs: number;
  warnMs: number;
};

export type BeSprite = {
  hash: string;
  url: string;
  w: number;
  h: number;
  atlas: number | null;
  ax: number;
  ay: number;
};

export type BeDrawing = {
  id: string;
  authorId: string;
  authorName: string;
  kind: DrawingKind;
  name: string;
  swim: SwimType;
  wave: boolean;
  hidden: boolean;
  reported: boolean;
  scale: number;
  feeds: number;
  placed: boolean;
  x: number;
  y: number;
  phase: number;
  holdX: number | null;
  holdY: number | null;
  holdUntil: number | null;
  releasedAt: number | null;
  createdAt: string;
  sprite: BeSprite;
};

export type BeFood = {
  id: string;
  x: number;
  y: number;
  bornAt: number;
  eatenAt: number | null;
  eaterId: string | null;
  sprite: BeSprite | null;
};

export type BeSceneLayer = {
  url: string;
  w: number;
  h: number;
  frames?: number;
  fw?: number;
  fh?: number;
};

export type BeTank = {
  sand: SandId;
  lighting: LightId;
  waterLevel: number;
  rockCount: number;
  woodCount: number;
  dirt: number;
};

export type BePublic = {
  rev: number;
  now: number;
  idle: IdleConfig;
  tank: BeTank;
  drawings: BeDrawing[];
  foods: BeFood[];
  wallet: { scales: number; unlocks: string[] };
  atlases: { url: string; w: number; h: number }[];
  scene: Record<string, BeSceneLayer>;
};

export function saigonBucket(now = new Date()): DayBucket {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Saigon',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  if (hour >= 6 && hour < 16) return 'ngay';
  if (hour < 19) return 'chieu';
  return 'dem';
}

export function lightBucket(lighting: LightId, now = new Date()): DayBucket {
  if (lighting === 'auto') return saigonBucket(now);
  return lighting;
}

export function growthScale(feeds: number): number {
  return Math.min(1.2, 0.58 + Math.max(0, feeds) * 0.04);
}
