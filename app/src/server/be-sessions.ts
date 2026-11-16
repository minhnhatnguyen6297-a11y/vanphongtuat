import type { WebSocket } from 'ws';
import { idlePhase, type IdleCfg } from '../shared/be.ts';

export type BeSess = {
  memberId: string;
  lastActive: number;
  visible: boolean;
  hiddenAt: number | null;
};

const sessions = new Map<WebSocket, BeSess>();

export function beJoin(ws: WebSocket, memberId: string, now: number): void {
  sessions.set(ws, { memberId, lastActive: now, visible: true, hiddenAt: null });
}

export function beLeave(ws: WebSocket): void {
  sessions.delete(ws);
}

export function bePulse(ws: WebSocket, active: boolean, visible: boolean, now: number): void {
  const s = sessions.get(ws);
  if (!s) return;
  if (active) s.lastActive = now;
  if (visible) {
    s.visible = true;
    s.hiddenAt = null;
  } else if (s.visible || s.hiddenAt == null) {
    s.visible = false;
    s.hiddenAt = now;
  }
}

/** Trả về socket cần đá. Không đụng cá. */
export function beSweep(now: number, cfg: IdleCfg): WebSocket[] {
  const out: WebSocket[] = [];
  for (const [ws, s] of sessions) {
    const phase = idlePhase({
      now,
      lastActive: s.lastActive,
      visible: s.visible,
      hiddenAt: s.hiddenAt,
      cfg,
    });
    if (phase === 'kick') out.push(ws);
  }
  for (const ws of out) sessions.delete(ws);
  return out;
}

export function beSessionCount(): number {
  return sessions.size;
}

export function resetBeSessions(): void {
  sessions.clear();
}
