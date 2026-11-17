import * as THREE from 'three';
import type { PerfMeter } from './perf.js';

export type BenchId = 'B1' | 'B2' | 'B3' | 'B4' | 'B5-12' | 'B5-24' | 'B5-40' | 'B5-80' | 'B6' | 'B7';

export type BenchResult = {
  id: BenchId;
  viewport: string;
  scale: number;
  p50: number;
  p90: number;
  mean: number;
  frames: number;
  seconds: number;
};

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG_CLEAR = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0); }`;

const FRAG_TWO_TEX = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 a = texture(uA, vUv);
  vec4 b = texture(uB, vUv);
  outColor = vec4(a.rgb * 0.5 + b.rgb * 0.5, 0.15);
}`;

const FRAG_VORONOI = /* glsl */ `#version 300 es
precision highp float;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  if (vUv.y > 0.45) discard;
  vec2 uv = vUv * vec2(8.0, 4.0);
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float d1 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 17.0));
    o = 0.5 + 0.5 * sin(uTime + 6.2831 * o);
    float d = length(g + o - f);
    d1 = min(d1, d);
  }
  float c = pow(clamp(1.0 - d1, 0.0, 1.0), 3.0);
  outColor = vec4(vec3(c), c * 0.35);
}`;

const FRAG_CAUSTIC = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uCaustic;
uniform vec4 uScroll;
in vec2 vUv;
out vec4 outColor;
void main() {
  if (vUv.y > 0.45) discard;
  vec2 cp = vUv * 3.0;
  float c = min(texture(uCaustic, cp + uScroll.xy).r, texture(uCaustic, cp * 1.37 + uScroll.zw).r);
  outColor = vec4(vec3(c), c * 0.25);
}`;

const FRAG_FISH = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uShape;
uniform sampler2D uCaustic;
uniform vec3 uKey;
uniform vec3 uAmbient;
uniform float uTime;
in vec2 vUv;
in float vSide;
out vec4 outColor;
void main() {
  vec4 tex = texture(uColor, vUv);
  if (tex.a < 0.02) discard;
  vec2 nxy = texture(uShape, vUv).rg * 2.0 - 1.0;
  vec3 N = normalize(vec3(nxy, 0.8) * vSide);
  float wrap = clamp(dot(N, normalize(vec3(0.3, 0.8, 0.4))) * 0.6 + 0.4, 0.0, 1.0);
  float c = texture(uCaustic, vUv * 2.0 + vec2(uTime * 0.02, 0.0)).r;
  vec3 col = tex.rgb * (uAmbient + uKey * (wrap + c * 0.4));
  outColor = vec4(col, tex.a);
}`;

const VERT_FISH = /* glsl */ `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
in float aSide;
in vec3 iPos;
in vec2 iSize;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
out vec2 vUv;
out float vSide;
void main() {
  vUv = uv;
  vSide = aSide;
  vec3 p = vec3(position.x * iSize.x, position.y * iSize.y, aSide * 0.15 * iSize.y);
  vec3 w = iPos + p;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const FRAG_BG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uBg;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(uBg, vUv); }`;

function makeNoiseTex(size: number, seed: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s & 255;
  };
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    data[o] = rnd();
    data[o + 1] = rnd();
    data[o + 2] = rnd();
    data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  return t;
}

function bakeCaustic(renderer: THREE.WebGLRenderer): THREE.Texture {
  const size = 512;
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
  });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
const float CELLS = 8.0;
vec2 hash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float cellEdge(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(mod(i + g, CELLS));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
void main() {
  float e = cellEdge(vUv * CELLS);
  float c = pow(clamp(1.0 - e * 2.2, 0.0, 1.0), 5.0);
  outColor = vec4(vec3(c), 1.0);
}`,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(mesh);
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  mesh.geometry.dispose();
  mat.dispose();
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  return rt.texture;
}

function makeFishAtlas(): { color: THREE.DataTexture; shape: THREE.DataTexture } {
  const w = 256;
  const h = 128;
  const color = new Uint8Array(w * h * 4);
  const shape = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const ell = (nx * nx) / 1.0 + (ny * ny) / 0.45;
      const a = ell < 1 ? Math.max(0, 1 - ell) : 0;
      const alpha = Math.floor(Math.min(1, a * 1.4) * 255);
      color[o] = Math.floor(140 * a);
      color[o + 1] = Math.floor(190 * a);
      color[o + 2] = Math.floor(200 * a);
      color[o + 3] = alpha;
      // premultiply
      color[o] = Math.floor((color[o]! * alpha) / 255);
      color[o + 1] = Math.floor((color[o + 1]! * alpha) / 255);
      color[o + 2] = Math.floor((color[o + 2]! * alpha) / 255);
      const hx = Math.sqrt(Math.max(0, 1 - ell));
      shape[o] = Math.floor((nx * 0.5 + 0.5) * 255);
      shape[o + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      shape[o + 2] = Math.floor(hx * 255);
      shape[o + 3] = 255;
    }
  }
  const cTex = new THREE.DataTexture(color, w, h, THREE.RGBAFormat);
  const sTex = new THREE.DataTexture(shape, w, h, THREE.RGBAFormat);
  cTex.needsUpdate = true;
  sTex.needsUpdate = true;
  return { color: cTex, shape: sTex };
}

function fishGeo(): THREE.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(1, 1, 8, 4);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const n = (base.getAttribute('position') as THREE.BufferAttribute).count;
  const side = new Float32Array(n);
  side.fill(1);
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  base.dispose();
  return geo;
}

export type BenchContext = {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  meter: PerfMeter;
  opaque: boolean;
  setBackdrop: (on: boolean) => void;
  setOpaqueBg: (on: boolean) => void;
};

export function createBenchRunner(ctx: BenchContext): {
  run: (id: BenchId, seconds?: number) => Promise<BenchResult>;
  dispose: () => void;
} {
  const { renderer, meter } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 5;
  const persp = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  persp.position.set(0, 0, 8);

  const texA = makeNoiseTex(256, 1);
  const texB = makeNoiseTex(256, 2);
  const caustic = bakeCaustic(renderer);
  const atlas = makeFishAtlas();

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: VERT,
      fragmentShader: FRAG_CLEAR,
    }),
  );
  scene.add(quad);

  let fishMesh: THREE.Mesh | null = null;
  let scroll = new THREE.Vector4(0, 0, 0, 0);
  let running = false;
  let raf = 0;
  let disposed = false;

  const applyMode = (id: BenchId) => {
    ctx.setBackdrop(id === 'B6');
    ctx.setOpaqueBg(id === 'B7');
    const mat = quad.material as THREE.RawShaderMaterial;
    mat.uniforms = {};
    fishMesh?.removeFromParent();
    fishMesh = null;
    meter.fishShown = 0;
    meter.fishTotal = 0;

    if (id === 'B1') {
      mat.fragmentShader = FRAG_CLEAR;
      mat.transparent = true;
      renderer.setClearColor(0x000000, 0);
    } else if (id === 'B2') {
      mat.fragmentShader = FRAG_TWO_TEX;
      mat.uniforms = { uA: { value: texA }, uB: { value: texB } };
      mat.transparent = true;
      renderer.setClearColor(0x000000, 0);
    } else if (id === 'B3') {
      mat.fragmentShader = FRAG_VORONOI;
      mat.uniforms = { uTime: { value: 0 } };
      mat.transparent = true;
      renderer.setClearColor(0x000000, 0);
    } else if (id === 'B4') {
      mat.fragmentShader = FRAG_CAUSTIC;
      mat.uniforms = { uCaustic: { value: caustic }, uScroll: { value: scroll } };
      mat.transparent = true;
      renderer.setClearColor(0x000000, 0);
    } else if (id === 'B7') {
      mat.fragmentShader = FRAG_BG;
      const bg = new THREE.TextureLoader().load('/art/be/hang-da-v2.png');
      bg.colorSpace = THREE.SRGBColorSpace;
      mat.uniforms = { uBg: { value: bg } };
      mat.transparent = false;
      renderer.setClearColor(0x031725, 1);
    } else {
      // B5 / B6 fish
      const n =
        id === 'B5-12' ? 12 : id === 'B5-24' || id === 'B6' ? 24 : id === 'B5-40' ? 40 : 80;
      meter.fishShown = n;
      meter.fishTotal = n;
      const geo = fishGeo();
      const pos = new Float32Array(n * 3);
      const size = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = ((i % 10) - 4.5) * 0.7;
        pos[i * 3 + 1] = (Math.floor(i / 10) - 2) * 0.55;
        pos[i * 3 + 2] = -2 - (i % 5) * 0.4;
        size[i * 2] = 0.9;
        size[i * 2 + 1] = 0.45;
      }
      geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
      geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2));
      geo.instanceCount = n;
      const fmat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        vertexShader: VERT_FISH,
        fragmentShader: FRAG_FISH,
        uniforms: {
          uColor: { value: atlas.color },
          uShape: { value: atlas.shape },
          uCaustic: { value: caustic },
          uKey: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
          uAmbient: { value: new THREE.Vector3(0.25, 0.3, 0.35) },
          uTime: { value: 0 },
        },
      });
      fishMesh = new THREE.Mesh(geo, fmat);
      fishMesh.frustumCulled = false;
      scene.add(fishMesh);
      mat.fragmentShader = FRAG_CLEAR;
      mat.transparent = true;
      renderer.setClearColor(0x000000, 0);
    }
    mat.needsUpdate = true;
  };

  const frame = (now: number, last: number) => {
    if (disposed || !running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    const t0 = performance.now();
    scroll.x += 0.02 * dt;
    scroll.y += 0.012 * dt;
    scroll.z -= 0.015 * dt;
    scroll.w += 0.018 * dt;
    const mat = quad.material as THREE.RawShaderMaterial;
    if (mat.uniforms.uTime) mat.uniforms.uTime.value += dt;
    if (mat.uniforms.uScroll) mat.uniforms.uScroll.value = scroll;
    if (fishMesh) {
      const fm = fishMesh.material as THREE.RawShaderMaterial;
      if (fm.uniforms.uTime) fm.uniforms.uTime.value += dt;
    }
    const cam = fishMesh ? persp : camera;
    if (fishMesh) {
      persp.aspect = ctx.canvas.clientWidth / Math.max(1, ctx.canvas.clientHeight);
      persp.updateProjectionMatrix();
    }
    renderer.render(scene, cam);
    meter.jsMs = performance.now() - t0;
    meter.drawCalls = renderer.info.render.calls;
    meter.triangles = renderer.info.render.triangles;
    meter.push(now - last, now);
  };

  return {
    async run(id, seconds = 10) {
      applyMode(id);
      running = true;
      const samples: number[] = [];
      await new Promise<void>((resolve) => {
        let last = performance.now();
        const start = last;
        const end = start + seconds * 1000;
        const loop = (now: number) => {
          if (disposed) {
            resolve();
            return;
          }
          frame(now, last);
          if (now - last > 0) samples.push(now - last);
          last = now;
          if (now >= end) {
            running = false;
            resolve();
            return;
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
      samples.sort((a, b) => a - b);
      const n = samples.length;
      const pct = (p: number) => (n ? samples[Math.min(n - 1, Math.floor((p / 100) * n))]! : 0);
      const mean = n ? samples.reduce((a, b) => a + b, 0) / n : 0;
      const rect = ctx.canvas.getBoundingClientRect();
      const result: BenchResult = {
        id,
        viewport: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        scale: renderer.getPixelRatio(),
        p50: Math.round(pct(50) * 100) / 100,
        p90: Math.round(pct(90) * 100) / 100,
        mean: Math.round(mean * 100) / 100,
        frames: n,
        seconds,
      };
      meter.scenarios[id] = result;
      return result;
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      quad.geometry.dispose();
      (quad.material as THREE.Material).dispose();
      texA.dispose();
      texB.dispose();
      atlas.color.dispose();
      atlas.shape.dispose();
      fishMesh?.geometry.dispose();
      (fishMesh?.material as THREE.Material | undefined)?.dispose();
    },
  };
}

export const AUTO_SEQUENCE: BenchId[] = [
  'B1',
  'B2',
  'B3',
  'B4',
  'B5-12',
  'B5-24',
  'B5-40',
  'B6',
];
