export const SLOT_W = 192;
export const SLOT_H = 96;
export const THICK = 0.20;

export type FishPixels = { width: number; height: number; color: Uint8Array; shape: Uint8Array };

// Lower envelope of parabolas, applied along each dimension (exact squared EDT).
function distanceLine(src: Float32Array, dst: Float32Array, count: number, sites: Int32Array, cuts: Float32Array) {
  let k = 0;
  sites[0] = 0;
  cuts[0] = -Infinity;
  cuts[1] = Infinity;
  for (let q = 1; q < count; q++) {
    let i = sites[k]!;
    let p = (src[q]! + q*q - src[i]! - i*i) / (2*(q-i));
    while (p <= cuts[k]!) {
      i = sites[--k]!;
      p = (src[q]! + q*q - src[i]! - i*i) / (2*(q-i));
    }
    sites[++k] = q;
    cuts[k] = p;
    cuts[k+1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < count; q++) {
    while (cuts[k+1]! < q) k++;
    const i = sites[k]!;
    dst[q] = (q-i)*(q-i) + src[i]!;
  }
}

export function fishPixels(rgba: Uint8ClampedArray, width: number, height: number): FishPixels {
  const area = width*height;
  const size = Math.max(width,height);
  const src = new Float32Array(size), dst = new Float32Array(size);
  const sites = new Int32Array(size), cuts = new Float32Array(size+1);
  const field = new Float32Array(area), h = new Float32Array(area), temp = new Float32Array(area);
  let max = 0;
  for (let y=0;y<height;y++) {
    for(let x=0;x<width;x++) src[x]=x===0||x===width-1||y===0||y===height-1||rgba[(y*width+x)*4+3]!<128?0:1e6;
    distanceLine(src,dst,width,sites,cuts);
    field.set(dst.subarray(0,width),y*width);
  }
  for(let x=0;x<width;x++) {
    for(let y=0;y<height;y++) src[y]=field[y*width+x]!;
    distanceLine(src,dst,height,sites,cuts);
    for(let y=0;y<height;y++) {
      const d=Math.sqrt(dst[y]!);
      field[y*width+x]=d;
      max=Math.max(max,d);
    }
  }
  for(let i=0;i<area;i++) {
    const x=max ? field[i]!/max : 0;
    h[i]=Math.sqrt(1-(1-x)*(1-x));
  }
  const weights=Array.from({length:13},(_,i)=>Math.exp(-((i-6)**2)/8));
  const total=weights.reduce((a,b)=>a+b,0);
  const bound=(v:number,n:number)=>Math.max(0,Math.min(n-1,v));
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    let sum=0;
    for(let d=-6;d<=6;d++) sum+=h[y*width+bound(x+d,width)]!*weights[d+6]!;
    temp[y*width+x]=sum/total;
  }
  const color=new Uint8Array(area*4),shape=new Uint8Array(area*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=y*width+x;
    let sum=0;
    for(let d=-6;d<=6;d++) sum+=temp[bound(y+d,height)*width+x]!*weights[d+6]!;
    const alpha=rgba[i*4+3]!/255;
    const a=Math.max(0,Math.min(1,(alpha-0.02)/0.28));
    h[i]=sum/total*a*a*(3-2*a);
    for(let c=0;c<3;c++) color[i*4+c]=Math.round(rgba[i*4+c]!*alpha);
    color[i*4+3]=rgba[i*4+3]!;
  }
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=y*width+x;
    const dx=(h[y*width+bound(x-1,width)]!-h[y*width+bound(x+1,width)]!)*THICK*height/2;
    const dy=(h[bound(y+1,height)*width+x]!-h[bound(y-1,height)*width+x]!)*THICK*height/2;
    const norm=Math.hypot(dx,dy,1);
    shape[i*4]=Math.round((dx/norm*0.5+0.5)*255);
    shape[i*4+1]=Math.round((dy/norm*0.5+0.5)*255);
    shape[i*4+2]=Math.round(h[i]!*255);
    shape[i*4+3]=255;
  }
  return {width,height,color,shape};
}
