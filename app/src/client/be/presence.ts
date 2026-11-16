import { idlePhase } from '../../shared/be/idle.js';
import { getBe, isBeKicked, markKicked } from './model.js';
import { sendRaw } from '../ws.js';

let timer = 0;
let lastActive = 0;
let hiddenAt: number | null = null;
let lastPulse = 0;
let root: HTMLElement | null = null;

/** Chỉ việc của chính người này mới gia hạn. Cá bơi và tin người khác không đếm. */
export function startPresence(stage: HTMLElement): void {
  stopPresence();
  root = stage;
  lastActive = Date.now();
  hiddenAt = document.hidden ? Date.now() : null;
  const opts = { capture: true };
  window.addEventListener('pointerdown', onAct, opts);
  window.addEventListener('pointermove', onAct, opts);
  window.addEventListener('keydown', onAct, opts);
  window.addEventListener('wheel', onAct, opts);
  document.addEventListener('visibilitychange', onVis);
  const idle = getBe()?.idle;
  const tick = idle ? Math.min(1000, Math.max(50, Math.floor(Math.min(idle.visibleMs, idle.hiddenMs) / 5))) : 1000;
  timer = window.setInterval(check, tick);
  pulse(true);
}

export function stopPresence(): void {
  window.clearInterval(timer);
  timer = 0;
  const opts = { capture: true };
  window.removeEventListener('pointerdown', onAct, opts);
  window.removeEventListener('pointermove', onAct, opts);
  window.removeEventListener('keydown', onAct, opts);
  window.removeEventListener('wheel', onAct, opts);
  document.removeEventListener('visibilitychange', onVis);
  root = null;
}

export function poke(): void {
  lastActive = Date.now();
  hiddenAt = document.hidden ? hiddenAt : null;
  pulse(true);
  paintWarn('active');
}

function onAct(): void {
  if (!root || isBeKicked()) return;
  lastActive = Date.now();
  if (!document.hidden) hiddenAt = null;
  pulse(false);
  paintWarn('active');
}

function onVis(): void {
  if (!root || isBeKicked()) return;
  if (document.hidden) {
    hiddenAt = Date.now();
    sendRaw({ t: 'be.pulse', hidden: true, active: false });
    lastPulse = Date.now();
    return;
  }
  hiddenAt = null;
  lastActive = Date.now();
  pulse(true);
}

function pulse(force: boolean): void {
  const now = Date.now();
  if (!force && now - lastPulse < 5000) return;
  lastPulse = now;
  sendRaw({ t: 'be.pulse', hidden: document.hidden, active: !document.hidden });
}

function check(): void {
  if (!root || isBeKicked()) return;
  const idle = getBe()?.idle;
  if (!idle) return;
  const result = idlePhase({
    now: Date.now(),
    lastActiveAt: lastActive,
    hiddenAt: document.hidden ? hiddenAt ?? Date.now() : null,
    ...idle,
  });
  paintWarn(result.phase);
  if (result.phase === 'kick') markKicked();
}

function paintWarn(phase: string): void {
  const el = root?.querySelector('[data-be-warn]') as HTMLElement | null;
  if (!el) return;
  el.hidden = phase !== 'warn';
}
