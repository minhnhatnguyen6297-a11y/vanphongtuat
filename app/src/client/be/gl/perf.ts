import type { AoTier } from './tier.js';

export type FrameSample = { ms: number; at: number };

export type PerfSnapshot = {
  renderer: string;
  tier: AoTier;
  canvas: { w: number; h: number };
  scale: number;
  refreshHz: number | null;
  fps: number;
  p50: number;
  p90: number;
  p99: number;
  dropPct: number;
  fishShown: number;
  fishTotal: number;
  drawCalls: number;
  triangles: number;
  jsMs: number;
  gpuMs: number | null;
  machineNote: string;
  scenarios?: Record<string, unknown>;
};

const WINDOW_MS = 4000;

export class PerfMeter {
  samples: FrameSample[] = [];
  jsMs = 0;
  fishShown = 0;
  fishTotal = 0;
  drawCalls = 0;
  triangles = 0;
  gpuMs: number | null = null;
  refreshHz: number | null = null;
  scenarios: Record<string, unknown> = {};

  push(frameMs: number, now = performance.now()): void {
    this.samples.push({ ms: frameMs, at: now });
    const cut = now - WINDOW_MS;
    while (this.samples.length && this.samples[0]!.at < cut) this.samples.shift();
  }

  snapshot(base: Omit<PerfSnapshot, 'fps' | 'p50' | 'p90' | 'p99' | 'dropPct' | 'jsMs' | 'gpuMs' | 'fishShown' | 'fishTotal' | 'drawCalls' | 'triangles' | 'scenarios'>): PerfSnapshot {
    const ms = this.samples.map((s) => s.ms).sort((a, b) => a - b);
    const n = ms.length;
    const pct = (p: number) => (n ? ms[Math.min(n - 1, Math.floor((p / 100) * n))]! : 0);
    const target = 1000 / 60;
    const drops = ms.filter((v) => v > target * 1.5).length;
    const span = n >= 2 ? (this.samples[n - 1]!.at - this.samples[0]!.at) / 1000 : 0;
    const fps = span > 0 ? (n - 1) / span : 0;
    return {
      ...base,
      fps: round1(fps),
      p50: round2(pct(50)),
      p90: round2(pct(90)),
      p99: round2(pct(99)),
      dropPct: round1(n ? (100 * drops) / n : 0),
      jsMs: round2(this.jsMs),
      gpuMs: this.gpuMs == null ? null : round2(this.gpuMs),
      fishShown: this.fishShown,
      fishTotal: this.fishTotal,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      scenarios: { ...this.scenarios },
    };
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mountPerfHud(
  host: HTMLElement,
  getSnap: () => PerfSnapshot,
): { el: HTMLElement; copyBtn: HTMLButtonElement; dispose: () => void } {
  const el = document.createElement('div');
  el.className = 'hn-ao-perf';
  el.setAttribute('data-ao-perf', '1');
  el.style.cssText =
    'position:absolute;top:8px;left:8px;z-index:40;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e8f4ff;background:rgba(0,0,0,.55);padding:8px 10px;max-width:min(420px,92vw);pointer-events:auto;white-space:pre-wrap';
  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0 0 6px;white-space:pre-wrap';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Sao chép số đo';
  copyBtn.className = 'hn-btn';
  copyBtn.style.cssText = 'pointer-events:auto;font-size:12px';
  copyBtn.addEventListener('click', () => {
    const json = JSON.stringify(getSnap(), null, 2);
    void navigator.clipboard.writeText(json).then(
      () => {
        copyBtn.textContent = 'Đã chép';
        setTimeout(() => {
          copyBtn.textContent = 'Sao chép số đo';
        }, 1200);
      },
      () => {
        copyBtn.textContent = 'Chép lỗi';
      },
    );
  });
  el.append(pre, copyBtn);
  host.appendChild(el);
  let raf = 0;
  const tick = () => {
    const s = getSnap();
    pre.textContent = [
      `${s.renderer}`,
      `mức ${s.tier} · ${s.canvas.w}×${s.canvas.h} · scale ${s.scale} · hz ${s.refreshHz ?? '?'}`,
      `fps ${s.fps} · p50 ${s.p50} / p90 ${s.p90} / p99 ${s.p99} ms · rớt ${s.dropPct}%`,
      `cá ${s.fishShown}/${s.fishTotal} · draws ${s.drawCalls} · tris ${s.triangles}`,
      `JS ${s.jsMs} ms · GPU ${s.gpuMs ?? '—'} ms`,
      s.machineNote,
    ].join('\n');
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    el,
    copyBtn,
    dispose: () => {
      cancelAnimationFrame(raf);
      el.remove();
    },
  };
}
