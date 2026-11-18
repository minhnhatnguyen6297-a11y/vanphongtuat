import { fishPixels, SLOT_H, SLOT_W } from './fish-pixels.js';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<{ id: string; png: string }>) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({data:{id,png}}) => {
  const began=performance.now();
  try {
    const response=await fetch(png);
    const image=await createImageBitmap(await response.blob());
    const src=new OffscreenCanvas(image.width,image.height);
    const ctx=src.getContext('2d',{willReadFrequently:true})!;
    ctx.drawImage(image,0,0);
    image.close();
    const {data}=ctx.getImageData(0,0,src.width,src.height);
    let l=src.width, t=src.height, r=-1, b=-1;
    for(let y=0;y<src.height;y++) for(let x=0;x<src.width;x++) {
      if(data[(y*src.width+x)*4+3]!<=8) continue;
      l=Math.min(l,x); t=Math.min(t,y); r=Math.max(r,x); b=Math.max(b,y);
    }
    if(r<l) throw new Error('Empty fish');
    l=Math.max(0,l-4); t=Math.max(0,t-4);
    r=Math.min(src.width-1,r+4); b=Math.min(src.height-1,b+4);
    const sw=r-l+1,sh=b-t+1;
    const scale=Math.min((SLOT_W-4)/sw,(SLOT_H-4)/sh);
    const width=Math.max(1,Math.round(sw*scale))+4,height=Math.max(1,Math.round(sh*scale))+4;
    const dst=new OffscreenCanvas(width,height);
    const out=dst.getContext('2d',{willReadFrequently:true})!;
    out.drawImage(src,l,t,sw,sh,2,2,width-4,height-4);
    const pixels=fishPixels(out.getImageData(0,0,width,height).data,width,height);
    scope.postMessage({id,...pixels,ms:performance.now()-began},[pixels.color.buffer,pixels.shape.buffer]);
  } catch {
    scope.postMessage({id,error:true});
  }
};
