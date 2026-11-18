import * as THREE from 'three';
import { AUTO_SEQUENCE, createBenchRunner, type BenchId } from './bench.js';
import { mountPerfHud, PerfMeter, type PerfSnapshot } from './perf.js';
import { createSandScene, sandPixelRatio } from './sand-scene.js';
import { hashQuery } from './query.js';
import { parseTierParam, probeGpu, rememberTier, resolveTier, type AoTier } from './tier.js';

export type AoCaApi = {
  perf: () => PerfSnapshot;
  tier: () => AoTier;
  rendererString: () => string;
  advance?: (seconds: number) => void;
  scenario?: (name: 'wide') => void;
  state?: () => { seconds: number; seed: number; scene: ReturnType<SandScene['state']> };
  showSand?: (visible: boolean) => void;
};

declare global {
  interface Window {
    __aoCa?: AoCaApi;
  }
}

type SandScene = Awaited<ReturnType<typeof createSandScene>>;

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
  const golden = q.get('golden') === '1' && !q.has('bench');
  const bench = q.has('bench');
  const seed = Number(q.get('seed') ?? 42) >>> 0;
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
  let water: SandScene | null = null;
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
    const deviceRatio = window.devicePixelRatio || 1;
    const dpr = bench
      ? Math.min(deviceRatio, tier === 'cao' ? 1 : tier === 'vua' ? 0.75 : 0.5)
      : sandPixelRatio(tier, w, h, deviceRatio);
    scale = dpr;
    if (renderer) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      water?.resize(w, h, opts.canvas.width, opts.canvas.height);
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

  if (!bench && tier !== 'cao') setBackdrop(false);

  if (!bench && renderer) {
    const gl = renderer;
    let generation = 0;
    let last: number | undefined;
    let seconds = 0;
    let ticks = 0;
    let sandVisible = true;
    const paint = () => {
      if (!water) return;
      const start = performance.now();
      water.render(seconds, sandVisible);
      meter.jsMs = performance.now() - start;
      meter.drawCalls = gl.info.render.calls;
      meter.triangles = gl.info.render.triangles;
    };
    const frame = (now: number) => {
      if (disposed) return;
      if (!opts.canvas.isConnected) { dispose(); return; }
      raf = requestAnimationFrame(frame);
      if (document.hidden || !water) { last = undefined; return; }
      const dt = last === undefined ? 0 : now - last;
      if (last !== undefined && tier === 'nhe' && dt < 32) return;
      last = now;
      seconds += Math.min(dt / 1000, 0.05);
      paint();
      if (dt > 0) meter.push(dt, now);
    };
    const start = async () => {
      const ticket = ++generation;
      try {
        const scene = await createSandScene(gl, tier, seed);
        if (disposed || ticket !== generation) { scene.dispose(); return; }
        if (!opts.canvas.isConnected) { scene.dispose(); dispose(); return; }
        water = scene;
        resize();
        paint();
        opts.canvas.style.opacity = '1';
        if (golden) {
          api.advance = (duration) => {
            if (!Number.isFinite(duration) || duration < 0) return;
            ticks += Math.round(duration * 60);
            seconds = ticks / 60;
            paint();
          };
          api.scenario = (name) => {
            if (name !== 'wide') return;
            ticks = seconds = 0;
            sandVisible = true;
            paint();
          };
          api.state = () => ({ seconds, seed, scene: scene.state() });
          api.showSand = (visible) => { sandVisible = visible; paint(); };
        } else {
          last = undefined;
          raf = requestAnimationFrame(frame);
        }
      } catch (error) {
        if (!disposed && ticket === generation) console.error('ao-ca sand scene failed', error);
      }
    };
    const stop = () => {
      generation++;
      cancelAnimationFrame(raf);
      water?.dispose();
      water = null;
      delete api.advance;
      delete api.scenario;
      delete api.state;
      delete api.showSand;
    };
    const lost = (event: Event) => { event.preventDefault(); stop(); };
    const restored = () => { if (!disposed) void start(); };
    opts.canvas.style.opacity = '0';
    if (!golden) opts.canvas.style.transition = 'opacity 180ms ease-out';
    opts.canvas.addEventListener('webglcontextlost', lost);
    opts.canvas.addEventListener('webglcontextrestored', restored);
    cleanups.push(() => {
      stop();
      opts.canvas.removeEventListener('webglcontextlost', lost);
      opts.canvas.removeEventListener('webglcontextrestored', restored);
      opts.canvas.style.opacity = '';
      opts.canvas.style.transition = '';
    });
    void start();
  } else if (!renderer) {
    const ctx = opts.canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#e8f4ff';
      ctx.font = '14px sans-serif';
      ctx.fillText(probe.soft ? 'Ao cá · mức Tĩnh (GPU mềm)' : 'Ao cá · Tĩnh', 16, 28);
    }
  }

  if (bench && renderer) {
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
    if (disposed) return;
    disposed = true;
    if (activeDispose === dispose) activeDispose = null;
    for (const c of cleanups) c();
    renderer?.dispose();
    if (window.__aoCa === api) delete window.__aoCa;
    setBackdrop(false);
    setOpaqueBg(false);
  };
  const observer = new MutationObserver(() => {
    if (!opts.canvas.isConnected) dispose();
  });
  observer.observe(opts.root, { childList: true, subtree: true });
  cleanups.push(() => observer.disconnect());
  activeDispose = dispose;

  return api;
}
