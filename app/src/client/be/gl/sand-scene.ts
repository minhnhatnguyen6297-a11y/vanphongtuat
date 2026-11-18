import * as THREE from 'three';
import { calibrateCamera, coverImage, sceneUvTransform } from '../fish-math.js';
import { bakeCaustic } from './caustic.js';
import calibration from './scene-calib.json' with { type: 'json' };
import type { AoTier } from './tier.js';

const budgets = { cao: 1_050_000, vua: 620_000, nhe: 360_000, tinh: 360_000 };

export function sandPixelRatio(tier: AoTier, width: number, height: number, dpr: number): number {
  return Math.min(1, dpr) * Math.min(1, Math.sqrt(budgets[tier] / (width * height)));
}

const VERT = /* glsl */ `precision highp float;
in vec3 position;
uniform float uHorizonNdc;
void main() {
  float y = mix(-1.0, clamp(uHorizonNdc, -1.0, 1.0), (position.y + 1.0) * 0.5);
  gl_Position = vec4(position.x, y, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `precision highp float;
uniform sampler2D uCaustic, uScene;
uniform vec4 uSceneXform, uCausticScroll;
uniform vec2 uViewport;
uniform float uTanHalfFov, uAspect, uHorizonNdc, uCamHeight, uCausticScale, uSandGain;
uniform vec3 uCamPos, uKey;
out vec4 outColor;
void main() {
  vec2 ndc = gl_FragCoord.xy / uViewport * 2.0 - 1.0;
  float dy = (uHorizonNdc - ndc.y) * uTanHalfFov;
  if (dy <= 0.001) discard;
  float sand = texture(uScene, gl_FragCoord.xy * uSceneXform.xy + uSceneXform.zw).g;
  if (sand < 1.5 / 255.0) discard;
  sand = (sand * 255.0 - 1.0) / 254.0;
  float distanceToSand = uCamHeight / dy;
  vec2 xz = vec2(uCamPos.x + distanceToSand * ndc.x * uTanHalfFov * uAspect, uCamPos.z - distanceToSand);
  vec2 cp = xz * uCausticScale;
  float c = min(texture(uCaustic, cp + uCausticScroll.xy).r,
                texture(uCaustic, cp * 1.37 + uCausticScroll.zw).r);
  float a = c * sand * uSandGain;
  outColor = vec4(uKey * a, a);
}`;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), seed | 1);
    n = n + Math.imul(n ^ (n >>> 7), n | 61) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export async function createSandScene(renderer: THREE.WebGLRenderer, tier: AoTier, seed: number) {
  const map = await new THREE.TextureLoader().loadAsync('/art/be/scene-map.png');
  map.colorSpace = THREE.NoColorSpace;
  map.flipY = false;
  map.minFilter = map.magFilter = THREE.NearestFilter;
  map.generateMipmaps = false;

  const caustic = bakeCaustic(renderer, tier === 'cao' ? 512 : 256);
  const random = mulberry32(seed);
  const offset = [random(), random(), random(), random()];
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const scene = new THREE.Scene();
  const quad = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    uCaustic: { value: caustic.texture },
    uScene: { value: map },
    uSceneXform: { value: new THREE.Vector4() },
    uCausticScroll: { value: new THREE.Vector4() },
    uViewport: { value: new THREE.Vector2() },
    uTanHalfFov: { value: 0 },
    uAspect: { value: 1 },
    uHorizonNdc: { value: 0 },
    uCamHeight: { value: 0 },
    uCausticScale: { value: 0.12 },
    uSandGain: { value: 0.18 },
    uCamPos: { value: camera.position },
    uKey: { value: new THREE.Vector3(1, 0.96, 0.83) },
  };
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    premultipliedAlpha: true,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sand = new THREE.Mesh(quad, material);
  sand.frustumCulled = false;
  scene.add(sand);
  let framing: ReturnType<typeof calibrateCamera>;
  const dispose = () => {
    quad.dispose();
    material.dispose();
    caustic.dispose();
    map.dispose();
  };
  try {
    await renderer.compileAsync(scene, camera);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    resize(cssW: number, cssH: number, canvasW: number, canvasH: number) {
      const cover = coverImage(calibration.image[0]!, calibration.image[1]!, cssW, cssH);
      framing = calibrateCamera(cover, calibration);
      camera.aspect = cssW / cssH;
      camera.position.y = framing.height;
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[9] = framing.lensShiftY;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      uniforms.uViewport.value.set(canvasW, canvasH);
      uniforms.uSceneXform.value.set(...sceneUvTransform(cover, canvasW, canvasH));
      uniforms.uTanHalfFov.value = framing.tanHalfFov;
      uniforms.uAspect.value = camera.aspect;
      uniforms.uHorizonNdc.value = framing.horizonNdc;
      uniforms.uCamHeight.value = framing.height;
    },
    render(seconds: number, visible: boolean) {
      sand.visible = visible;
      uniforms.uCausticScroll.value.set(
        (offset[0]! + 0.020 * seconds) % 1,
        (offset[1]! + 0.012 * seconds) % 1,
        (offset[2]! - 0.015 * seconds) % 1,
        (offset[3]! + 0.018 * seconds) % 1,
      );
      renderer.render(scene, camera);
    },
    state: () => ({ ...framing, phase: uniforms.uCausticScroll.value.toArray() }),
    dispose,
  };
}
