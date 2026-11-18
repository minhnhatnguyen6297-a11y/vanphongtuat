import * as THREE from 'three';
import { SLOT_H, SLOT_W, type FishPixels } from './fish-pixels.js';

export type AtlasRegion = { width: number; height: number; uv: [number,number,number,number]; slot: number };
const EDGE=2048, PAD=8, COLS=7, CAP=105;
type FishResult = FishPixels & {id:string;ms:number};

export function createAtlas(renderer: THREE.WebGLRenderer) {
  const gl=renderer.getContext() as WebGL2RenderingContext;
  const makeTexture=()=>{
    const texture=new THREE.DataTexture(new Uint8Array(EDGE*EDGE*4),EDGE,EDGE);
    texture.magFilter=THREE.LinearFilter;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;
    texture.needsUpdate=true;
    renderer.initTexture(texture);
    texture.generateMipmaps=false; // one generation after each batch of slot writes
    return texture;
  };
  const color=makeTexture(),shape=makeTexture();
  const worker=new Worker('/ao-ca-worker.js',{type:'module'});
  const regions=new Map<string,AtlasRegion>();
  const slots=new Set<number>();
  const wanted=new Map<string,string>();
  const queue=new Map<string,string>();
  const failed=new Set<string>();
  const ready: FishResult[]=[];
  const samples:number[]=[];
  let inflight:string|null=null;
  const pump=()=>{
    if(inflight||!queue.size) return;
    const [id,png]=queue.entries().next().value!;
    queue.delete(id);
    inflight=id;
    worker.postMessage({id,png});
  };
  worker.onmessage=({data}:MessageEvent<FishResult|{id:string;error:true}>)=>{
    inflight=null;
    if('error' in data) failed.add(data.id);
    else if(wanted.has(data.id)) {ready.push(data);samples.push(data.ms);}
    pump();
  };
  worker.onerror=()=>{
    if(inflight) failed.add(inflight);
    for(const id of queue.keys()) failed.add(id);
    inflight=null;
    queue.clear();
  };
  const generate=(texture:THREE.DataTexture)=>{
    const {__webglTexture}=renderer.properties.get(texture) as {__webglTexture:WebGLTexture};
    renderer.state.bindTexture(gl.TEXTURE_2D,__webglTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAX_LEVEL,3);
    gl.generateMipmap(gl.TEXTURE_2D);
    renderer.state.unbindTexture();
  };
  const upload=(pixels:FishResult,slot:number)=>{
    const x=PAD+(slot%COLS)*(SLOT_W+2*PAD);
    const y=PAD+Math.floor(slot/COLS)*(SLOT_H+2*PAD);
    for(const [texture,bytes] of [[color,pixels.color],[shape,pixels.shape]] as const) {
      // Clear the unused part of a recycled slot before generating mipmaps.
      const padded=new Uint8Array(SLOT_W*SLOT_H*4);
      const stride=pixels.width*4;
      for(let row=0;row<pixels.height;row++) padded.set(bytes.subarray(row*stride,(row+1)*stride),row*SLOT_W*4);
      const region=new THREE.DataTexture(padded,SLOT_W,SLOT_H);
      renderer.copyTextureToTexture(region,texture,null,new THREE.Vector2(x,y));
    }
    return {width:pixels.width,height:pixels.height,slot,
      // Source bytes are top-down. The mesh's V runs from bottom to top.
      uv:[(x+0.5)/EDGE,(y+pixels.height-0.5)/EDGE,(pixels.width-1)/EDGE,-(pixels.height-1)/EDGE] as const};
  };
  return {
    color,shape,regions,failed,samples,
    get pending(){ return Boolean(inflight||queue.size||ready.length); },
    sync(fish:readonly {id:string;png:string}[]) {
      const keep=new Set(fish.map(f=>f.id));
      for(const id of wanted.keys()) {
        if(keep.has(id)) continue;
        wanted.delete(id);queue.delete(id);failed.delete(id);
        const region=regions.get(id);
        if(region) {slots.delete(region.slot);regions.delete(id);}
      }
      for(const {id,png} of fish) {
        if(wanted.has(id)) continue;
        wanted.set(id,png);queue.set(id,png);
      }
      pump();
    },
    flush() {
      let changed=false;
      for(const item of ready.splice(0)) {
        if(!wanted.has(item.id)||regions.has(item.id)) continue;
        let slot=0;
        while(slots.has(slot)) slot++;
        if(slot>=CAP) continue;
        slots.add(slot);
        const region=upload(item,slot);
        regions.set(item.id,{...region,uv:[...region.uv]});
        changed=true;
      }
      if(changed) {generate(color);generate(shape);}
      return changed;
    },
    dispose() {worker.terminate();color.dispose();shape.dispose();},
  };
}
