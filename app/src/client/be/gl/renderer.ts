import * as THREE from 'three';
import { AUTO_SEQUENCE, createBenchRunner, type BenchId } from './bench.js';
import { mountPerfHud, PerfMeter, type PerfSnapshot } from './perf.js';
import { createSandScene, sandPixelRatio } from './sand-scene.js';
import { goldenFish,type Scenario } from './golden-fish.js';
import type { FishSource } from './fish-school.js';
import { createGpuTimer } from './gpu-timer.js';
import { createAdaptiveTier } from './adaptive-tier.js';
import { readPondLook, type PondLook } from '../pond-look.js';
import { hashQuery } from './query.js';
import { parseTierParam, probeGpu, rememberTier, resolveTier, type AoTier } from './tier.js';

export type AoCaApi = {
  perf: () => PerfSnapshot;
  tier: () => AoTier;
  rendererString: () => string;
  advance?: (seconds: number) => void;
  scenario?: (name: Scenario) => void;
  showShadows?: (visible:boolean) => void;
  showFish?: (visible:boolean) => void;
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
  readFish?: () => readonly FishSource[];
  viewer?: () => string;
  look?: () => PondLook;
  pointerMode?: () => 'none'|'feed'|'scare';
  fallback?: (replaceCanvas:boolean, fixtures?: FishSource[]) => void;
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
  let tier = resolveTier({ soft: probe.soft, param: tierParam });
  const auto=!bench&&!golden&&(!tierParam||tierParam==='auto');
  if(auto && !probe.soft) rememberTier(tier);

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
  let benchmarkScale: number|undefined;
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
      ? benchmarkScale ?? Math.min(deviceRatio, tier === 'cao' ? 1 : tier === 'vua' ? 0.75 : 0.5)
      : sandPixelRatio(tier, w, h, deviceRatio);
    scale = dpr;
    if (renderer) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      water?.resize(w, h, opts.canvas.width, opts.canvas.height);
    } else {
      const staticRatio=Math.min(1,deviceRatio);
      opts.canvas.width = Math.floor(w * staticRatio);
      opts.canvas.height = Math.floor(h * staticRatio);
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
      : 'Nguồn: trình duyệt này',
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

  if(renderer) opts.canvas.dataset.aoRenderer='webgl2';
  if (!bench) setBackdrop(false); // P90 B6 exceeded 1 ms on MAY3

  if (!bench && renderer) {
    const gl = renderer;
    const requestedLook=q.get('look');
    const fixedLook=requestedLook==='ink'||requestedLook==='form'?requestedLook:null;
    const ctx=gl.getContext() as WebGL2RenderingContext;
    const timer=q.get('perf')==='1'&&!golden?createGpuTimer(ctx):null;
    cleanups.push(()=>timer?.dispose());
    let generation = 0;
    let last: number | undefined;
    let rawLast: number|undefined;
    let resizedAt=performance.now();
    let measuringSince=performance.now();
    const controller=createAdaptiveTier(tier);
    const resized=()=>{resizedAt=performance.now();controller.reset();};
    window.addEventListener('resize',resized);
    cleanups.push(()=>window.removeEventListener('resize',resized));
    let seconds = 0;
    let ticks = 0;
    let sandVisible = true;
    const useFixtures=golden||q.get('fixtures')==='1';
    const fixtures=useFixtures?goldenFish(seed,Math.min(80,Math.max(0,Math.floor(Number(q.get('fish')??8)||0)))):[];
    const source=useFixtures?()=>fixtures:opts.readFish;
    const paint = () => {
      if (!water) return;
      const start = performance.now();
      water.setLook(fixedLook??opts.look?.()??readPondLook());
      if(timer) {
        const ms=timer.measure(()=>water?.render(seconds,sandVisible));
        if(ms!==null) meter.gpuMs=ms;
      } else water.render(seconds, sandVisible);
      meter.jsMs = performance.now() - start;
      meter.drawCalls = gl.info.render.calls;
      meter.triangles = gl.info.render.triangles;
      meter.fishShown=water.state().shown;
      meter.fishTotal=water.state().total;
    };
    const frame = (now: number) => {
      if (disposed) return;
      if (!opts.canvas.isConnected) { dispose(); return; }
      raf = requestAnimationFrame(frame);
      if (document.hidden || !water) { last = rawLast = undefined;controller.reset();return; }
      const rawDt=rawLast===undefined?0:now-rawLast;
      rawLast=now;
      // Windows may throttle an occluded but "visible" Chrome window to 1 Hz.
      // Reset the measurement window instead of interpreting the suspension as load.
      if(rawDt>250) {last=undefined;meter.samples.length=0;controller.reset();return;}
      const changed=auto?controller.frame(now,rawDt,water.preparing||now-resizedAt<1000||now-measuringSince<3000):null;
      if(auto) {meter.refreshHz=Math.round(1000/controller.nominal);meter.targetMs=controller.target;}
      if(changed && changed!==tier) {
        tier=changed;rememberTier(tier);
        if(tier==='tinh' && opts.fallback) {dispose();opts.fallback(true);return;}
        stop();resize();setBackdrop(false);void start();return;
      }
      const dt = last === undefined ? 0 : now - last;
      if (last !== undefined && tier === 'nhe' && dt < controller.nominal * 1.85) return;
      last = now;
      seconds += Math.min(dt / 1000, 0.05);
      paint();
      if (dt > 0) meter.push(dt, now);
    };
    const start = async () => {
      const ticket = ++generation;
      try {
        await bgImg!.decode().catch(()=>{});
        if(disposed || ticket!==generation) return;
        const scene = await createSandScene(gl, tier, seed, source && q.get('water')!=='only' ?
          {read:source,viewer:opts.viewer??(()=>''),golden,background:bgImg!}:undefined);
        if (disposed || ticket !== generation) { scene.dispose(); return; }
        if (!opts.canvas.isConnected) { scene.dispose(); dispose(); return; }
        water = scene;
        measuringSince=performance.now();
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
            scene.scenario(name);
            ticks = seconds = 0;
            sandVisible = true;
            paint();
          };
          api.state = () => ({ seconds, seed, scene: scene.state() });
          api.showSand = (visible) => { sandVisible = visible; paint(); };
          api.showShadows = (visible) => { scene.setShadow(visible);paint(); };
          api.showFish = (visible) => { scene.setFishVisible(visible);paint(); };
        } else {
          last = undefined;
          raf = requestAnimationFrame(frame);
        }
      } catch (error) {
        if (!disposed && ticket === generation) {
          console.error('ao-ca sand scene failed', error);
          if(opts.fallback && !golden) {dispose();opts.fallback(true);}
        }
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
      delete api.showShadows;
      delete api.showFish;
    };
    const pointer=(e:PointerEvent)=>{
      const mode=opts.pointerMode?.();
      if(e.button!==0||!water||!mode||mode==='none') return;
      const rect=opts.canvas.getBoundingClientRect();
      water.pushWaterEvent((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height,mode);
    };
    opts.canvas.addEventListener('pointerdown',pointer);
    cleanups.push(()=>opts.canvas.removeEventListener('pointerdown',pointer));
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
    const ctx = bench || !opts.fallback ? opts.canvas.getContext('2d') : null;
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

    let benchBusy=false;
    const runList = async (ids: BenchId[]) => {
      if (benchBusy) return;
      benchBusy=true;
      try {
        for (const sc of [1, 0.75, 0.5]) {
          benchmarkScale=sc;
          resize();
          for (const id of ids) {
            if(disposed) return;
            status.textContent = `bench ${id} · scale ${sc}…`;
            const result = await runner.run(id, 10);
            meter.scenarios[`${id}@${sc}`]=result;
            delete meter.scenarios[id];
          }
        }
        status.textContent = 'bench xong — bấm Sao chép số đo';
      } finally {
        benchBusy=false;
      }
    };

    if (benchMode === 'auto') {
      void runList(AUTO_SEQUENCE);
    } else if (benchMode === 'gl') {
      const bar = document.createElement('div');
      bar.style.cssText =
        'position:absolute;top:8px;right:8px;z-index:41;display:flex;flex-wrap:wrap;gap:4px;max-width:48vw;';
      const ids = AUTO_SEQUENCE;
      for (const id of ids) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hn-btn';
        b.textContent = id;
        b.style.fontSize = '11px';
        b.addEventListener('click', () => {
          if(benchBusy) return;
          benchBusy=true;
          void runner.run(id, 10).then((r) => {
            status.textContent = `${id} p50=${r.p50} p90=${r.p90}`;
          }).finally(()=>{benchBusy=false;});
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
  if(!renderer && !bench) {
    const count=Math.min(8,Math.max(0,Math.floor(Number(q.get('fish')??8)||0)));
    opts.fallback?.(false,golden ? goldenFish(seed,count):undefined);
  }

  return api;
}
