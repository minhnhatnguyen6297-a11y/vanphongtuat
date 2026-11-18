import * as THREE from 'three';
import { calibrateCamera, coverImage, sceneUvTransform } from '../fish-math.js';
import { bakeCaustic } from './caustic.js';
import { createFishLayer, fishLimit } from './fish-layer.js';
import { createSchool, type FishLayout, type FishPose, type FishSource } from './fish-school.js';
import { goldenPoses, type Scenario } from './golden-fish.js';
import calibration from './scene-calib.json' with { type: 'json' };
import type { AoTier } from './tier.js';
import { createWaterLife,type WaterEvent } from './water-life.js';

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

type SceneFish = { read:()=>readonly FishSource[]; viewer:()=>string; golden:boolean; background: HTMLImageElement };
export async function createSandScene(renderer: THREE.WebGLRenderer, tier: AoTier, seed: number, fish?:SceneFish) {
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
  const sampleFog = () => {
    const fallback=new THREE.Vector3(.03,.20,.25);
    const img=fish?.background;
    if(!img?.naturalWidth) return fallback;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
    const ctx=canvas.getContext('2d');if(!ctx) return fallback;
    const [l,t,r,b]=calibration.fogSampleRect as [number,number,number,number];
    ctx.drawImage(img,l*img.naturalWidth,t*img.naturalHeight,(r-l)*img.naturalWidth,(b-t)*img.naturalHeight,0,0,16,16);
    const values=ctx.getImageData(0,0,16,16).data;
    for(let i=0;i<values.length;i+=4) {
      fallback.x+=values[i]!;fallback.y+=values[i+1]!;fallback.z+=values[i+2]!;
    }
    return fallback.divideScalar(255*256);
  };
  const fog=sampleFog();
  const layerUniforms={
    uScene:uniforms.uScene, uSceneXform:uniforms.uSceneXform, uCaustic:uniforms.uCaustic,
    uCausticScroll:uniforms.uCausticScroll,uCausticScale:{value:.35},uCamPos:uniforms.uCamPos,
    uLightDir:{value:new THREE.Vector3(-.3,1,.2).normalize()},
    uSurfaceY:{value:0},uSandY:{value:0},uGlassZ:{value:-10},uDepthRange:{value:7},
    uKey:{value:new THREE.Vector3(.73,.72,.63)}, uAmbient:{value:new THREE.Vector3(.43,.44,.48)},
    uRim:{value:fog.clone().multiplyScalar(1.6)},uFog:{value:fog},
    uAbsorb:{value:new THREE.Vector3(.06,.02,.01)},uSandBounce:{value:new THREE.Vector3(.13,.12,.095)},
    uFogPerUnit:{value:.085},uCausticGain:{value:.5},uSpec:{value:1},
  };
  const school=createSchool();
  const layer=fish?createFishLayer(renderer,scene,tier,layerUniforms):null;
  let layout:FishLayout;
  let lastSource:readonly FishSource[]|undefined;
  let lastTime=0;
  let poses:FishPose[]=[];
  const life=fish?createWaterLife(scene,tier,seed,map,uniforms.uSceneXform.value):null;
  let event:WaterEvent|null=null;
  let shown=0;
  let shadow=true;
  let fishVisible=true;
  let scenario:Scenario='wide';
  const sand = new THREE.Mesh(quad, material);
  sand.frustumCulled = false;
  scene.add(sand);
  let framing: ReturnType<typeof calibrateCamera>;
  const dispose = () => {
    quad.dispose();
    material.dispose();
    caustic.dispose();
    map.dispose();
    layer?.dispose();
    life?.dispose();
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
      layout={...framing,aspect:camera.aspect};
      life?.resize(cover,cssW,cssH,canvasW/cssW);
      layerUniforms.uSurfaceY.value=framing.surfaceY;
      layerUniforms.uGlassZ.value=-framing.front;
      layerUniforms.uDepthRange.value=framing.back-framing.front;
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
      if(layer && fish) {
        const source=fish.read();
        if(lastSource!==source) {layer.atlas.sync(source);lastSource=source;}
        layer.atlas.flush();
        const ratio=(id:string)=>{const r=layer.atlas.regions.get(id);return r?r.height/r.width:undefined;};
        poses=fish.golden?goldenPoses(scenario,source,layout,seconds,ratio):
          school.update(source,fish.viewer(),fishLimit(tier),layout,ratio,seconds,Math.max(0,seconds-lastTime),Date.now(),event);
        shown=layer.update(fishVisible?poses:[],shadow);
      }
      life?.update(seconds,!fish?.golden || scenario==='wide' || scenario==='bubbles');
      lastTime=seconds;
      renderer.render(scene, camera);
    },
    pushWaterEvent(x:number,y:number,kind:'feed'|'scare') {
      event={x,y,kind,at:lastTime};life?.push(event,lastTime);
    },
    scenario(name:Scenario) { scenario=name;lastTime=0;event=null;school.reset();life?.reset(); },
    get preparing(){return layer?.atlas.pending??false;},
    setShadow(visible:boolean) { shadow=visible; },
    setFishVisible(visible:boolean) { fishVisible=visible; },
    state: () => ({ ...framing, phase: uniforms.uCausticScroll.value.toArray(), poses,
      shown,total:lastSource?.length??0,workerMs:layer?.atlas.samples??[],pending:layer?.atlas.pending??false,
      failed:layer?[...layer.atlas.failed]:[], bubbles:life?.state()??null }),
    dispose,
  };
}
