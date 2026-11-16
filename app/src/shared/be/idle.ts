import type { IdleConfig } from './types.ts';

export type IdlePhase = 'active' | 'warn' | 'kick';

export type IdleInput = {
  now: number;
  lastActiveAt: number;
  /** null khi tab đang hiện. */
  hiddenAt: number | null;
  visibleMs: number;
  hiddenMs: number;
  warnMs: number;
};

/**
 * Hết giờ khi tab hiện: lastActive + visibleMs.
 * Khi tab ẩn: lấy mốc sớm hơn giữa (ẩn + hiddenMs) và (hoạt động + visibleMs),
 * nên thu nhỏ tab không gia hạn thêm giờ.
 * Tin nhắn người khác không phải đầu vào — chỉ lastActiveAt do chính người đó đổi.
 */
export function idlePhase(input: IdleInput): { phase: IdlePhase; remainingMs: number } {
  const visibleRemain = input.visibleMs - (input.now - input.lastActiveAt);
  let remaining = visibleRemain;
  if (input.hiddenAt != null) {
    const hiddenRemain = input.hiddenMs - (input.now - input.hiddenAt);
    remaining = Math.min(visibleRemain, hiddenRemain);
  }
  if (remaining <= 0) return { phase: 'kick', remainingMs: 0 };
  if (remaining <= input.warnMs) return { phase: 'warn', remainingMs: remaining };
  return { phase: 'active', remainingMs: remaining };
}

export function sanitizeIdle(raw: Partial<IdleConfig> | IdleConfig): IdleConfig {
  const visibleMs = clamp(num(raw.visibleMs, 15 * 60 * 1000), 500, 86_400_000);
  const hiddenMs = clamp(num(raw.hiddenMs, 5 * 60 * 1000), 500, visibleMs);
  const warnMs = clamp(num(raw.warnMs, 60_000), 0, Math.max(0, Math.min(visibleMs, hiddenMs) - 200));
  return { visibleMs, hiddenMs, warnMs };
}

export function idleTickMs(cfg: IdleConfig): number {
  const smallest = Math.min(cfg.visibleMs, cfg.hiddenMs);
  if (smallest <= 2_000) return 100;
  if (smallest <= 15_000) return 400;
  return 5_000;
}

export function readIdleEnv(env: NodeJS.ProcessEnv = process.env): IdleConfig {
  return sanitizeIdle({
    visibleMs: env.HNG_BE_IDLE_VISIBLE_MS ? Number(env.HNG_BE_IDLE_VISIBLE_MS) : undefined,
    hiddenMs: env.HNG_BE_IDLE_HIDDEN_MS ? Number(env.HNG_BE_IDLE_HIDDEN_MS) : undefined,
    warnMs: env.HNG_BE_IDLE_WARN_MS ? Number(env.HNG_BE_IDLE_WARN_MS) : undefined,
  });
}

function num(v: number | undefined, fallback: number): number {
  if (v == null || !Number.isFinite(v)) return fallback;
  return v;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
