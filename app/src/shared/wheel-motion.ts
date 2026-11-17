/** Progress of a finite spin. Values outside 0..1 clamp so a bad clock cannot spin forever. */
export function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(1, Math.max(0, t));
}

/** Ease-out: each later slice of time moves less than the slice before it. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

export function spinProgress(elapsedMs: number, durationMs: number): number {
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return clamp01(elapsed / dur);
}

export function shouldRevealResult(progress: number): boolean {
  return progress >= 1;
}

/**
 * Map a server timestamp onto a local monotonic clock.
 * A server clock ahead of us starts the finite spin now instead of waiting forever.
 * A spin that already finished on the server is done immediately (no second spin).
 */
export function adoptSpinClock(
  nowMs: number,
  serverStartedAt: number,
  durationMs: number,
  perfNow: number,
): { localStart: number; dur: number; done: boolean } {
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;
  let elapsed = nowMs - serverStartedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = 0;
  if (elapsed > dur) elapsed = dur;
  return { localStart: perfNow - elapsed, dur, done: elapsed >= dur };
}
