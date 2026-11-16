import { FOOD_FALL_MS, type SwimType } from './types.ts';

export type SimFish = {
  id: string;
  swim: SwimType;
  phase: number;
  holdX: number | null;
  holdY: number | null;
  holdUntil: number | null;
};

export type SimFood = {
  id: string;
  x: number;
  y: number;
  bornAt: number;
  eatenAt: number | null;
  eaterId: string | null;
};

export type Pose = {
  x: number;
  y: number;
  facing: 1 | -1;
  bend: number;
};

const SPEED: Record<SwimType, number> = {
  thuong: 0.055,
  cham: 0.022,
  tau: 0.1,
  day: 0.032,
};

const BAND: Record<SwimType, [number, number]> = {
  thuong: [0.48, 0.07],
  cham: [0.36, 0.045],
  tau: [0.55, 0.06],
  day: [0.8, 0.02],
};

/** Ghi đè `out` — không cấp phát, để vòng vẽ trên máy yếu khỏi rác bộ nhớ. */
export function writeFishPose(
  fish: SimFish,
  foods: SimFood[],
  t: number,
  waterLevel: number,
  out: Pose,
): void {
  const speed = SPEED[fish.swim] ?? SPEED.thuong;
  const u = (((t / 1000) * speed + fish.phase) % 1 + 1) % 1;
  const tri = u < 0.5 ? u * 2 : (1 - u) * 2;
  const [cy, amp] = BAND[fish.swim] ?? BAND.thuong;
  let x = 0.08 + tri * 0.84;
  let y = cy + Math.sin(t / 900 + fish.phase * 6.283) * amp;
  const surface = Math.min(0.7, Math.max(0.08, 1 - waterLevel));
  y = Math.min(0.86, Math.max(surface + 0.08, y));
  out.x = x;
  out.y = y;
  out.facing = u < 0.5 ? 1 : -1;
  out.bend = Math.sin(t / 170 + fish.phase * 4);

  if (
    fish.holdUntil != null &&
    t < fish.holdUntil &&
    fish.holdX != null &&
    fish.holdY != null
  ) {
    out.x = fish.holdX;
    out.y = fish.holdY;
    out.bend *= 0.25;
  }

  for (const food of foods) {
    if (food.eaterId !== fish.id || food.eatenAt == null) continue;
    if (t >= food.eatenAt || t < food.bornAt) continue;
    const k = (t - food.bornAt) / Math.max(1, food.eatenAt - food.bornAt);
    const foodY = foodYAt(food, t);
    out.x += (food.x - out.x) * k;
    out.y += (foodY - out.y) * k;
    out.facing = food.x >= out.x ? 1 : -1;
  }
}

export function foodAlive(food: SimFood, t: number): boolean {
  if (food.eatenAt != null && t >= food.eatenAt) return false;
  if (t - food.bornAt > 20_000) return false;
  return true;
}

export function foodYAt(food: SimFood, t: number): number {
  const k = Math.min(1, Math.max(0, (t - food.bornAt) / FOOD_FALL_MS));
  return 0.12 + (food.y - 0.12) * k;
}
