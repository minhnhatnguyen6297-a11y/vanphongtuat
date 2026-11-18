import * as THREE from 'three';
import type { AoTier } from './tier.js';
import { hashFish } from './fish-school.js';

export type WaterEvent = { x:number;y:number;kind:'feed'|'scare';at:number };
const limits = {cao:[220,100],vua:[160,60],nhe:[90,30],tinh:[40,18]};
const SOURCE=[.78,.62];
const SURFACE=.113;
const RATE=15;
const BUBBLE_VERT=`precision highp float;
in vec3 position;
in vec4 iBubble;
in float iSize;
uniform vec2 uCss;
out vec2 vQuad;
out vec3 vLook;
void main() {
  vQuad=position.xy*2.;
  vLook=vec3(iBubble.z,iBubble.w,iSize);
  gl_Position=vec4(vec2(iBubble.x*2.-1.,1.-iBubble.y*2.)+vQuad*iSize*2./uCss,0.,1.);
}`;
const BUBBLE_FRAG=`precision highp float;
uniform sampler2D uScene;
uniform vec4 uSceneXform;
in vec2 vQuad;
in vec3 vLook;
out vec4 outColor;
void main() {
  float depth=texture(uScene,gl_FragCoord.xy*uSceneXform.xy+uSceneXform.zw).r;
  if(vLook.z<10. && depth<.76) discard;
  float r=length(vQuad);
  float ring=smoothstep(.62,.86,r)*(1.-smoothstep(.86,1.,r));
  float core=.08*(1.-smoothstep(0.,.9,r));
  float spec=1.-smoothstep(0.,.22,length(vQuad-vec2(-.35,.35)));
  float a=mix(.7*(1.-smoothstep(0.,1.,r)),ring*.9+core+spec*.9,smoothstep(1.5,2.5,vLook.z))*vLook.x;
  if(vLook.y>.0) a=ring*(1.-vLook.y)*vLook.x;
  outColor=vec4(vec3(.92,.97,1.)*a,a);
}`;
const POINT_VERT=`precision highp float;
in vec3 position;
in float aPhase;
uniform float uTime,uScale;
out float vAlpha;
void main() {
  float y=fract(position.y-uTime*(.008+aPhase*.005));
  float x=fract(position.x+sin(uTime*.44+position.z*6.28)*.01);
  gl_Position=vec4(x*2.-1.,1.-y*2.,0.,1.);
  gl_PointSize=max(1.,(1.+1.5*position.z)*uScale);
  vAlpha=.10+.20*aPhase;
}`;
const POINT_FRAG=`precision highp float;
in float vAlpha;
out vec4 outColor;
void main() {
  float a=vAlpha*(1.-smoothstep(.05,.5,length(gl_PointCoord-.5)));
  outColor=vec4(vec3(.73,.91,.96)*a,a);
}`;
const GLOW_VERT=`precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform vec2 uOrigin;
void main(){
  vUv=uv;
  gl_Position=vec4(uOrigin+position.xy*vec2(.06,1.02)+vec2(0.,.49),0.,1.);
}`;
const GLOW_FRAG=`precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform vec4 uSceneXform;
void main(){
  if(texture(uScene,gl_FragCoord.xy*uSceneXform.xy+uSceneXform.zw).r<.76) discard;
  float a=.06*(1.-smoothstep(.0,.5,abs(vUv.x-.5)))*sin(vUv.y*3.14159);
  outColor=vec4(vec3(.60,.83,.91)*a,a);
}`;

export function createWaterLife(scene:THREE.Scene,tier:AoTier,seed:number,
    map:THREE.Texture,transform:THREE.Vector4) {
  const [cap,motes]=limits[tier] as [number,number];
  const css=new THREE.Vector2(1366,768);
  const origin=new THREE.Vector2(SOURCE[0]!*2-1,1-SOURCE[1]!*2);
  let surface=SURFACE, sourceX=SOURCE[0]!,sourceY=SOURCE[1]!;
  const common={uScene:{value:map},uSceneXform:{value:transform}};
  const material=(vertexShader:string,fragmentShader:string,uniforms:Record<string,THREE.IUniform>)=>
    new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,uniforms,
      transparent:true,premultipliedAlpha:true,depthWrite:false,depthTest:false});
  const plane=new THREE.PlaneGeometry(1,1);
  const bubbleGeom=new THREE.InstancedBufferGeometry();
  bubbleGeom.setIndex(plane.getIndex());
  bubbleGeom.setAttribute('position',plane.getAttribute('position'));
  const bubbleAttr=new THREE.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr=new THREE.InstancedBufferAttribute(new Float32Array(cap),1).setUsage(THREE.DynamicDrawUsage);
  bubbleGeom.setAttribute('iBubble',bubbleAttr);bubbleGeom.setAttribute('iSize',sizeAttr);
  const bubbleMat=material(BUBBLE_VERT,BUBBLE_FRAG,{uCss:{value:css},...common});
  const bubbles=new THREE.Mesh(bubbleGeom,bubbleMat);
  const glowMat=material(GLOW_VERT,GLOW_FRAG,{uOrigin:{value:origin},...common});
  const glow=new THREE.Mesh(plane,glowMat);
  const pointGeom=new THREE.BufferGeometry();
  const p=new Float32Array(motes*3),ph=new Float32Array(motes);
  const rng=(id:number,dim:string)=>hashFish(seed+'-'+id+'-'+dim);
  for(let i=0;i<motes;i++) {
    p.set([rng(i,'x'),rng(i,'y'),rng(i,'r')],i*3);ph[i]=rng(i,'p');
  }
  pointGeom.setAttribute('position',new THREE.BufferAttribute(p,3));
  pointGeom.setAttribute('aPhase',new THREE.BufferAttribute(ph,1));
  const uniformTime={value:0}, uniformScale={value:1};
  const pointMat=material(POINT_VERT,POINT_FRAG,{uTime:uniformTime,uScale:uniformScale});
  const dots=new THREE.Points(pointGeom,pointMat);
  const objects=[glow,bubbles,dots];
  for(const [i,o] of objects.entries()) {o.renderOrder=3+i;o.frustumCulled=false;scene.add(o);}
  let count=0,spawned=0;
  const events:Array<{event:WaterEvent;time:number}>=[];
  return {
    resize(cover:{width:number;height:number;top:number;left:number},w:number,h:number,scale:number) {
      css.set(w,h);uniformScale.value=scale;
      sourceX=(SOURCE[0]!-cover.left)/cover.width;
      sourceY=(SOURCE[1]!-cover.top)/cover.height;
      origin.set(sourceX*2-1,1-sourceY*2);
      surface=(SURFACE-cover.top)/cover.height;
    },
    push(event:WaterEvent,time:number) {events.push({event,time});if(events.length>6) events.shift();},
    update(time:number,enabled=true) {
      count=0;uniformTime.value=time;
      const push=(x:number,y:number,r:number,a:number,pop=0)=>{
        if(count>=cap) return;
        bubbleAttr.setXYZW(count,x,y,a,pop);
        sizeAttr.setX(count,r);count++;
      };
      // Nine bubbles per pulse, six hundredths of a second apart.
      const last=Math.floor(time*RATE);
      spawned=enabled?last+1:0;
      for(let i=Math.max(0,last-175);enabled&&i<=last;i++) {
        const u=rng(i,'radius');
        const r=.6*(4/.6)**(u*u);
        const age=time-i/RATE;
        const travel=(sourceY-surface)*css.y/(30+22*r);
        if(age>travel+.12) continue;
        const elapsed=Math.min(age,travel);
        const wobble=(.6*r+1)*Math.sin((2.5-.3*r)*elapsed*2*Math.PI+rng(i,'phase')*6.28);
        const x=sourceX+(wobble+(rng(i,'spread')-.5)*css.x*.023)/css.x;
        const pop=Math.max(0,(age-travel)/.12);
        push(x,sourceY-(30+22*r)*elapsed/css.y,r*(1+.15*elapsed/travel+2*pop),.7,pop);
      }
      for(const {event,time:at} of events) {
        const age=time-at;
        if(age<0||age>1.3) continue;
        for(let i=0;i<(event.kind==='feed'?14:8);i++) {
          const a=rng(i,'event')*6.28;
          push(event.x+Math.cos(a)*age*.04,event.y+Math.sin(a)*age*.03-age*.06,
            1.1+rng(i,'eventRadius')*2.6,(1-age/1.3)*.7);
        }
      }
      bubbleGeom.instanceCount=count;bubbleAttr.needsUpdate=true;sizeAttr.needsUpdate=true;
      glow.visible=dots.visible=enabled;bubbles.visible=count>0;
    },
    reset(){events.length=0;},
    state:()=>({count,spawned,motes}),
    dispose(){bubbleGeom.dispose();plane.dispose();pointGeom.dispose();bubbleMat.dispose();glowMat.dispose();pointMat.dispose();},
  };
}
