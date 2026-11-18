import * as THREE from 'three';
import type { AoTier } from './tier.js';
import type { FishPose } from './fish-school.js';
import { createAtlas } from './fish-atlas.js';
import { FISH_VERT,FISH_FRAG } from './fish-shaders.js';
import { THICK } from './fish-pixels.js';

export type FishUniforms = Record<string, THREE.IUniform>;
const CAPACITY=40;
export function fishLimit(tier:AoTier) {return tier==='cao'?40:tier==='vua'?24:tier==='nhe'?12:8;}

function fishGeometry(tier:AoTier) {
  const n=tier==='nhe'?16:24;
  const plane=new THREE.PlaneGeometry(1,1,n,n/2);
  const position=plane.getAttribute('position').array as Float32Array;
  const uv=plane.getAttribute('uv').array as Float32Array;
  const index=plane.getIndex()!.array;
  const vertexCount=position.length/3;
  const geom=new THREE.InstancedBufferGeometry();
  const sides=new Float32Array(vertexCount*2);
  sides.fill(1,0,vertexCount);sides.fill(-1,vertexCount);
  geom.setAttribute('position',new THREE.BufferAttribute(new Float32Array([...position,...position]),3));
  geom.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([...uv,...uv]),2));
  geom.setAttribute('aSide',new THREE.BufferAttribute(sides,1));
  const indices=new Uint16Array(index.length*2);
  indices.set(index);
  for(let i=0;i<index.length;i+=3) {
    indices[index.length+i]=vertexCount+index[i]!;
    indices[index.length+i+1]=vertexCount+index[i+2]!;
    indices[index.length+i+2]=vertexCount+index[i+1]!;
  }
  geom.setIndex(new THREE.BufferAttribute(indices,1));
  plane.dispose();
  return geom;
}

const SHADOW_VERT=`precision highp float;
uniform mat4 viewMatrix,projectionMatrix;
uniform vec3 uLightDir;
in vec3 position,iPos,iRot;
in vec2 iSize;
in float iAlpha;
out vec2 vQuad;
out float vHeight,vZ,vAlpha;
void main(){
  vQuad=position.xy*2.0;
  vHeight=max(iPos.y,0.0);
  vAlpha=iAlpha;
  float angle=iRot.x,c=cos(angle),s=sin(angle);
  vec2 wide=vec2(vQuad.x*iSize.x*(0.30+0.20*abs(c)),vQuad.y*iSize.y*0.225);
  vec2 xz=iPos.xz-uLightDir.xz/uLightDir.y*vHeight+mat2(c,-s,s,c)*wide;
  vZ=xz.y;
  gl_Position=projectionMatrix*viewMatrix*vec4(xz.x,0.003,xz.y,1.0);
}`;
const SHADOW_FRAG=`precision highp float;
uniform sampler2D uScene;
uniform vec4 uSceneXform;
uniform float uGlassZ,uDepthRange;
in vec2 vQuad;
in float vHeight,vZ,vAlpha;
out vec4 outColor;
void main(){
  vec2 mask=texture(uScene,gl_FragCoord.xy*uSceneXform.xy+uSceneXform.zw).rg;
  float depth=clamp((uGlassZ-vZ)/uDepthRange,0.0,1.0);
  if(mask.g<1.5/255.0 || (mask.r<1.0&&mask.r<depth)) discard;
  float h=clamp(vHeight/4.0,0.0,1.0);
  float a=.35*(1.0-h)*(1.0-smoothstep(mix(.2,.7,h),1.0,length(vQuad)));
  outColor=vec4(0.0,0.0,0.0,a*((mask.g*255.0-1.0)/254.0)*vAlpha);
}`;

export function createFishLayer(renderer:THREE.WebGLRenderer, scene:THREE.Scene,tier:AoTier,shared:FishUniforms) {
  const atlas=createAtlas(renderer);
  const geometry=fishGeometry(tier);
  const attrs=Object.fromEntries(Object.entries({iPos:3,iRot:3,iSize:2,iWave:3,iAtlas:4,iAlpha:1}).map(([name,axes])=>{
    const attr=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*axes),axes);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name,attr);
    return [name,attr];
  })) as Record<'iPos'|'iRot'|'iSize'|'iWave'|'iAtlas'|'iAlpha',THREE.InstancedBufferAttribute>;
  const material=new THREE.RawShaderMaterial({
    vertexShader:FISH_VERT,fragmentShader:FISH_FRAG,glslVersion:THREE.GLSL3,
    defines:tier==='nhe'?{LITE:1}:{},
    uniforms:{...shared,uColor:{value:atlas.color},uShape:{value:atlas.shape},
      uThick:{value:THICK},uBendY:{value:.012}},
    transparent:true,premultipliedAlpha:true,depthWrite:false,depthTest:false,
  });
  const fish=new THREE.Mesh(geometry,material);
  fish.renderOrder=2;fish.frustumCulled=false;fish.visible=false;
  scene.add(fish);
  const quad=new THREE.PlaneGeometry(1,1);
  const floor=new THREE.InstancedBufferGeometry();
  floor.index=quad.index;
  floor.setAttribute('position',quad.getAttribute('position'));
  for(const key of ['iPos','iRot','iSize','iAlpha'] as const) floor.setAttribute(key,attrs[key]);
  const shadowMaterial=new THREE.RawShaderMaterial({
    vertexShader:SHADOW_VERT,fragmentShader:SHADOW_FRAG,glslVersion:THREE.GLSL3,uniforms:shared,
    transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
    forceSinglePass:true,
  });
  const shadows=new THREE.Mesh(floor,shadowMaterial);
  shadows.renderOrder=1;shadows.frustumCulled=false;shadows.visible=false;
  scene.add(shadows);
  return {
    atlas,
    update(poses:readonly FishPose[], renderShadows=true) {
      let i=0;
      for(const p of poses) {
        const region=atlas.regions.get(p.id);
        if(!region || i>=CAPACITY) continue;
        attrs.iPos.setXYZ(i,p.x,p.y,-p.depth);
        attrs.iRot.setXYZ(i,p.yaw,p.pitch,p.roll);
        attrs.iSize.setXY(i,p.length,p.height);
        attrs.iWave.setXYZ(i,p.phase,p.amplitude,.9);
        attrs.iAtlas.setXYZW(i,...region.uv);
        attrs.iAlpha.setX(i,p.alpha);
        i++;
      }
      fish.visible=i>0;shadows.visible=i>0&&renderShadows;
      geometry.instanceCount=floor.instanceCount=i;
      for(const attr of Object.values(attrs)) {
        attr.clearUpdateRanges();
        if(i) attr.addUpdateRange(0,i*attr.itemSize);
        attr.needsUpdate=i>0;
      }
      return i;
    },
    dispose(){atlas.dispose();geometry.dispose();material.dispose();floor.dispose();quad.dispose();shadowMaterial.dispose();},
  };
}
