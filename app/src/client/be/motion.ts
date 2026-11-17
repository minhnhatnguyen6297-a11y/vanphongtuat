/** Motion numbers from the tank brief: smooth seek, ±30° pitch, 0.4–0.6s turn. */

export const TURN_MS_MIN = 400;
export const TURN_MS_MAX = 600;
export const HEAD_TILT_MAX = Math.PI / 6;

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

/** `unit` is 0..1. Result stays inside 400–600ms. */
export function turnDurationMs(unit: number): number {
  return TURN_MS_MIN + clamp(unit, 0, 1) * (TURN_MS_MAX - TURN_MS_MIN);
}

/** 0 at both ends of a turn, 1 at the middle. */
export function turnSquash(progress: number): number {
  return Math.sin(clamp(progress, 0, 1) * Math.PI);
}

/** Horizontal scale. Full width at the ends, about 0.05 at the tightest point. */
export function turnWidthScale(squash: number): number {
  return 1 - 0.95 * clamp(squash, 0, 1);
}

export function headTilt(deltaRad: number): number {
  return clamp(deltaRad, -HEAD_TILT_MAX, HEAD_TILT_MAX);
}

/** Light tail wag, about ±6°. */
export function tailWag(timeSec: number, phase: number): number {
  return Math.sin(timeSec * 6 + phase) * 0.1;
}

export type DepthLook = {
  scale: number;
  blurPx: number;
  tint: number;
  alpha: number;
};

/** `depth` 0 is far. Far fish are smaller, blurrier, and more blue-green. */
export function depthLook(depth: number): DepthLook {
  const d = clamp(depth, 0, 1);
  return {
    scale: 0.42 + d * 0.68,
    blurPx: (1 - d) * 2.4,
    tint: (1 - d) * 0.42,
    alpha: 0.75 + d * 0.25,
  };
}

export type Facing = 1 | -1;

export type Swimmer = {
  id: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  depth: number;
  facing: Facing;
  phase: number;
  turn: { elapsed: number; dur: number; to: Facing } | null;
};

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export function pickTarget(rand: () => number, bounds: Bounds): { x: number; y: number } {
  return {
    x: bounds.minX + rand() * (bounds.maxX - bounds.minX),
    y: bounds.minY + rand() * (bounds.maxY - bounds.minY),
  };
}

export type StepView = { tilt: number; squash: number; facing: Facing };

/**
 * Seek the current target. A facing change squeezes the body for 0.4–0.6s
 * and flips at the thinnest point. `speedPx` is pixels per second.
 */
function targetInside(s: Swimmer, bounds: Bounds): boolean {
  return s.tx >= bounds.minX && s.tx <= bounds.maxX && s.ty >= bounds.minY && s.ty <= bounds.maxY;
}

export function stepSwimmer(
  s: Swimmer,
  dt: number,
  rand: () => number,
  bounds: Bounds,
  speedPx: number,
): StepView {
  // A smaller tank leaves tx/ty outside the new water. Clamping x/y alone
  // never reaches that point, so the fish sticks to the edge. Retarget first.
  s.x = clamp(s.x, bounds.minX, bounds.maxX);
  s.y = clamp(s.y, bounds.minY, bounds.maxY);
  if (!targetInside(s, bounds)) {
    const next = pickTarget(rand, bounds);
    s.tx = next.x;
    s.ty = next.y;
  }
  let dx = s.tx - s.x;
  let dy = s.ty - s.y;
  if (Math.hypot(dx, dy) < 10) {
    const next = pickTarget(rand, bounds);
    s.tx = next.x;
    s.ty = next.y;
    dx = s.tx - s.x;
    dy = s.ty - s.y;
  }
  const dist = Math.hypot(dx, dy) || 1;
  const want: Facing = dx >= 0 ? 1 : -1;
  if (!s.turn && want !== s.facing && Math.abs(dx) > 18) {
    s.turn = { elapsed: 0, dur: turnDurationMs(rand()) / 1000, to: want };
  }

  let squash = 0;
  const depthSpeed = 0.55 + clamp(s.depth, 0, 1) * 0.65;
  if (s.turn) {
    s.turn.elapsed += dt;
    const p = s.turn.elapsed / s.turn.dur;
    squash = p >= 1 ? 0 : turnSquash(p);
    if (p >= 0.5) s.facing = s.turn.to;
    if (p >= 1) {
      s.facing = s.turn.to;
      s.turn = null;
    }
    const creep = Math.min(dist, speedPx * dt * 0.25 * depthSpeed);
    s.x += (dx / dist) * creep;
    s.y += (dy / dist) * creep;
  } else {
    const ease = clamp(dist / 48, 0.35, 1);
    const step = Math.min(dist, speedPx * dt * ease * depthSpeed);
    s.x += (dx / dist) * step;
    s.y += (dy / dist) * step;
  }

  s.x = clamp(s.x, bounds.minX, bounds.maxX);
  s.y = clamp(s.y, bounds.minY, bounds.maxY);
  return {
    tilt: headTilt(Math.atan2(dy, Math.abs(dx) || 1)),
    squash,
    facing: s.facing,
  };
}
