import * as THREE from 'three';
import { AUTO_SEQUENCE, createBenchRunner, type BenchId } from './bench.js';
import { mountPerfHud, PerfMeter, type PerfSnapshot } from './perf.js';
import { hashQuery } from './query.js';
import { parseTierParam, probeGpu, rememberTier, resolveTier, type AoTier } from './tier.js';

export type AoCaApi = {
  perf: () => PerfSnapshot;
  tier: () => AoTier;
  rendererString: () => string;
};

declare global {
  interface Window {
    __aoCa?: AoCaApi;
  }
}

type MountOpts = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  query?: URLSearchParams;
};

let activeDispose: (() => void) | null = null;

export async function mountAoCaGl(opts: MountOpts): Promise<AoCaApi> {
  activeDispose?.();
  activeDispose = null;

  const q = opts.query ?? hashQuery();
  const probe = probeGpu();
  const tierParam = parseTierParam(q.get('tier'));
  const tier = resolveTier({ soft: probe.soft, param: tierParam });
  rememberTier(tier);

  const stage = opts.canvas.closest('.hn-tank-stage') as HTMLElement | null;
  const host = stage || opts.root;
  host.style.position = host.style.position || 'relative';

  // Background <img> under transparent canvas (KT 4.2 default).
  let bgImg = host.querySelector<HTMLImageElement>('[data-ao-bg]');
  if (!bgImg) {
    bgImg = document.createElement('img');
    bgImg.dataset.aoBg = '1';
    bgImg.alt = '';
    bgImg.src = '/art/be/hang-da-v2.png';
    bgImg.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none';
    host.insertBefore(bgImg, host.firstChild);
  }
  opts.canvas.style.position = 'relative';
  opts.canvas.style.zIndex = '1';
  opts.canvas.style.background = 'transparent';

  const meter = new PerfMeter();
  let scale = 1;
  let renderer: THREE.WebGLRenderer | null = null;
  let raf = 0;
  let disposed = false;
  const cleanups: Array<() => void> = [];

  const setBackdrop = (on: boolean) => {
    host.querySelectorAll<HTMLElement>('.hn-fab').forEach((el) => {
      el.style.backdropFilter = on ? 'blur(12px)' : 'none';
      (el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = on
        ? 'blur(12px)'
        : 'none';
    });
  };
  const setOpaqueBg = (on: boolean) => {
    bgImg!.style.display = on ? 'none' : '';
    opts.canvas.style.background = on ? '#031725' : 'transparent';
  };

  if (tier !== 'tinh' && probe.webgl2) {
    renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
  }

  const resize = () => {
    const w = Math.max(1, Math.floor(opts.canvas.clientWidth || opts.canvas.width || 1));
    const h = Math.max(1, Math.floor(opts.canvas.clientHeight || opts.canvas.height || 1));
    const dpr = Math.min(window.devicePixelRatio || 1, tier === 'cao' ? 1 : tier === 'vua' ? 0.75 : 0.5);
    scale = dpr;
    if (renderer) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
    } else {
      opts.canvas.width = Math.floor(w * dpr);
      opts.canvas.height = Math.floor(h * dpr);
    }
  };
  resize();
  window.addEventListener('resize', resize);
  cleanups.push(() => window.removeEventListener('resize', resize));

  const snapBase = () => ({
    renderer: probe.renderer,
    tier,
    canvas: {
      w: renderer?.domElement.width ?? opts.canvas.width,
      h: renderer?.domElement.height ?? opts.canvas.height,
    },
    scale,
    refreshHz: meter.refreshHz,
    machineNote: probe.soft
      ? 'GPU mềm → mức Tĩnh (không dùng số này để quyết)'
      : 'máy dev, không dùng để quyết',
  });

  const api: AoCaApi = {
    perf: () => meter.snapshot(snapBase()),
    tier: () => tier,
    rendererString: () => probe.renderer,
  };
  window.__aoCa = api;

  const showHud = q.get('perf') === '1' || q.has('bench');
  if (showHud) {
    const hud = mountPerfHud(host, () => api.perf());
    cleanups.push(hud.dispose);
  }

  // Empty clear loop when not benching (perf-only / soft GPU).
  if (!q.has('bench') || !renderer) {
    let last = performance.now();
    const loop = (now: number) => {
      if (disposed) return;
      const dt = now - last;
      last = now;
      const t0 = performance.now();
      if (renderer) {
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        meter.drawCalls = 0;
        meter.triangles = 0;
      } else {
        const c2 = opts.canvas.getContext('2d');
        if (c2) {
          c2.clearRect(0, 0, opts.canvas.width, opts.canvas.height);
          c2.fillStyle = 'rgba(3,23,37,0.15)';
          c2.fillRect(0, 0, opts.canvas.width, opts.canvas.height);
          c2.fillStyle = '#e8f4ff';
          c2.font = '14px sans-serif';
          c2.fillText(probe.soft ? 'Ao cá · mức Tĩnh (GPU mềm)' : 'Ao cá · Tĩnh', 16, 28);
        }
      }
      meter.jsMs = performance.now() - t0;
      meter.push(dt, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    cleanups.push(() => cancelAnimationFrame(raf));
  }

  if (q.has('bench') && renderer) {
    const runner = createBenchRunner({
      renderer,
      canvas: opts.canvas,
      meter,
      opaque: false,
      setBackdrop,
      setOpaqueBg,
    });
    cleanups.push(runner.dispose);

    const benchMode = q.get('bench');
    const status = document.createElement('div');
    status.className = 'hn-ao-bench-status';
    status.style.cssText =
      'position:absolute;bottom:12px;left:12px;z-index:41;font:12px/1.4 ui-monospace,monospace;color:#e8f4ff;background:rgba(0,0,0,.5);padding:6px 8px;';
    host.appendChild(status);
    cleanups.push(() => status.remove());

    const runList = async (ids: BenchId[]) => {
      const scales = [1, 0.75, 0.5];
      for (const sc of scales) {
        renderer!.setPixelRatio(sc);
        scale = sc;
        resize();
        for (const id of ids) {
          status.textContent = `bench ${id} · scale ${sc}…`;
          const r = await runner.run(id, 10);
          status.textContent = `${id} p50=${r.p50} p90=${r.p90} (${r.viewport} @${sc})`;
        }
      }
      status.textContent = 'bench xong — bấm Sao chép số đo';
    };

    if (benchMode === 'auto') {
      void (async () => {
        await runList(AUTO_SEQUENCE);
        // KT 9.4: thêm cảnh 8/24/40 cá từng mức — P0 ghi khung, đo đủ B1–B6.
        status.textContent += ' · auto B1–B6 xong (máy dev)';
      })();
    } else if (benchMode === 'gl') {
      const bar = document.createElement('div');
      bar.style.cssText =
        'position:absolute;top:8px;right:8px;z-index:41;display:flex;flex-wrap:wrap;gap:4px;max-width:48vw;';
      const ids: BenchId[] = ['B1', 'B2', 'B3', 'B4', 'B5-12', 'B5-24', 'B5-40', 'B5-80', 'B6', 'B7'];
      for (const id of ids) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hn-btn';
        b.textContent = id;
        b.style.fontSize = '11px';
        b.addEventListener('click', () => {
          void runner.run(id, 10).then((r) => {
            status.textContent = `${id} p50=${r.p50} p90=${r.p90}`;
          });
        });
        bar.appendChild(b);
      }
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'hn-btn hn-btn-green';
      all.textContent = 'Chạy tất cả';
      all.addEventListener('click', () => void runList(ids));
      bar.appendChild(all);
      host.appendChild(bar);
      cleanups.push(() => bar.remove());
      status.textContent = 'bench=gl — chọn kịch bản hoặc Chạy tất cả';
    }
  }

  const dispose = () => {
    disposed = true;
    for (const c of cleanups) c();
    renderer?.dispose();
    if (window.__aoCa === api) delete window.__aoCa;
    setBackdrop(false);
    setOpaqueBg(false);
  };
  activeDispose = dispose;

  return api;
}
