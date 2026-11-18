export type AoTier = 'cao' | 'vua' | 'nhe' | 'tinh';

const SOFT_RE = /SwiftShader|llvmpipe|Basic Render|Microsoft Basic/i;
const STORE_KEY = 'hng_ao_tier';

export type GpuProbe = {
  soft: boolean;
  renderer: string;
  webgl2: boolean;
};

/** Detect software GL / missing WebGL2 → force Tĩnh (KT 4.5). */
export function probeGpu(): GpuProbe {
  const canvas = document.createElement('canvas');
  const strict = canvas.getContext('webgl2', {
    failIfMajorPerformanceCaveat: true,
    antialias: false,
  }) as WebGL2RenderingContext | null;
  const gl =
    strict ||
    (canvas.getContext('webgl2', { antialias: false }) as WebGL2RenderingContext | null);
  if (!gl) {
    return { soft: true, renderer: 'no-webgl2', webgl2: false };
  }
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext
    ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown')
    : 'unknown';
  const soft = !strict || SOFT_RE.test(renderer);
  const lose = (gl as WebGL2RenderingContext & { getExtension(name: string): unknown }).getExtension(
    'WEBGL_lose_context',
  ) as { loseContext(): void } | null;
  lose?.loseContext();
  return { soft, renderer, webgl2: true };
}

export function parseTierParam(raw: string | null): AoTier | 'auto' | null {
  if (!raw) return null;
  if (raw === 'auto') return 'auto';
  if (raw === 'cao' || raw === 'vua' || raw === 'nhe' || raw === 'tinh') return raw;
  return null;
}

export function resolveTier(opts: {
  soft: boolean;
  param: AoTier | 'auto' | null;
}): AoTier {
  if (opts.soft) return 'tinh';
  if (opts.param && opts.param !== 'auto') return opts.param;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === 'cao' || saved === 'vua' || saved === 'nhe' || saved === 'tinh') return saved;
  } catch {
    /* ignore */
  }
  return opts.param === 'auto' ? 'cao' : 'cao';
}

/** Skeleton for P3 auto-switch; P0 only remembers / accepts ép mức. */
export function rememberTier(tier: AoTier): void {
  try {
    localStorage.setItem(STORE_KEY, tier);
  } catch {
    /* ignore */
  }
}
