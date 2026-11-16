import type { BePublic } from '../../shared/be/types.js';

export type Nudge = { x: number; y: number; kind: 'follow' | 'scare'; until: number };

let state: BePublic | null = null;
let receivedAt = 0;
let kicked = false;
let nudge: Nudge | null = null;
const listeners = new Set<() => void>();
let kickHook: (() => void) | null = null;

export function onBe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBe(): BePublic | null {
  return state;
}

export function serverNow(): number {
  if (!state) return Date.now();
  return Date.now() + (state.now - receivedAt);
}

export function applyBeState(next: BePublic): void {
  if (state && next.rev < state.rev) return;
  state = next;
  receivedAt = Date.now();
  emit();
}

export function setNudge(next: Nudge): void {
  nudge = next;
  emit();
}

export function currentNudge(now: number): Nudge | null {
  return nudge && now < nudge.until ? nudge : null;
}

export function isBeKicked(): boolean {
  return kicked;
}

export function setKickHook(fn: () => void): void {
  kickHook = fn;
}

export function markKicked(): void {
  if (kicked) return;
  kicked = true;
  kickHook?.();
}

function emit(): void {
  for (const fn of listeners) fn();
}
