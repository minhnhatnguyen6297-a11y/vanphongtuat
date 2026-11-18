import { webmFromVp8 } from './webm.mjs';

export async function recordPond(page, width, height, {scenario='wide',seconds=10,lead=0}={}) {
  const clipWidth = 960, clipHeight = Math.round(height*clipWidth/width);
  const fps=30, frameCount=seconds*fps;
  const frames=await page.evaluate(async ({width,height,fps,frameCount,scenario,lead}) => {
    const api=window.__aoCa;
    api.scenario(scenario);
    api.advance(lead);
    const source=document.querySelector('[data-fish-tank]');
    const background=document.querySelector('[data-ao-bg]');
    await background.decode();
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d');
    const ratio=Math.max(width/background.naturalWidth,height/background.naturalHeight);
    const w=background.naturalWidth*ratio, h=background.naturalHeight*ratio;
    const frames=[];
    let encoderError;
    const encoder=new VideoEncoder({
      output(chunk) {
        const data=new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        frames.push({type:chunk.type,timestamp:chunk.timestamp,data:Array.from(data)});
      },
      error(error) { encoderError=error; },
    });
    encoder.configure({codec:'vp8',width,height,framerate:fps,bitrate:3_000_000,latencyMode:'quality'});
    try {
      // Render each timestamp directly. The review clip keeps its cadence even if Chrome is occluded.
      for(let index=0;index<frameCount;index++) {
        api.advance(index===0 ? 0 : 1/fps);
        ctx.drawImage(background,(width-w)/2,(height-h)/2,w,h);
        ctx.drawImage(source,0,0,width,height);
        const frame=new VideoFrame(canvas,{timestamp:Math.round(index*1e6/fps)});
        encoder.encode(frame,{keyFrame:index%60===0});
        frame.close();
        if(index%15===14) await encoder.flush();
        if(encoderError) throw encoderError;
      }
      await encoder.flush();
      return frames;
    } finally {
      if(encoder.state!=='closed') encoder.close();
    }
  }, {width:clipWidth,height:clipHeight,fps,frameCount,scenario,lead});
  const clip=webmFromVp8(frames,{width:clipWidth,height:clipHeight,fps});
  const metadata = await page.evaluate(async data => {
    const video=document.createElement('video');
    await new Promise((done,fail)=>{
      video.onloadeddata=done;
      video.onerror=()=>fail(new Error('Chrome could not decode review clip'));
      video.src='data:video/webm;base64,'+data;
    });
    return {duration:video.duration,width:video.videoWidth,height:video.videoHeight};
  },clip.toString('base64'));
  if(frames.length!==frameCount || Math.abs(metadata.duration-seconds)>=.05 ||
      metadata.width!==clipWidth || metadata.height!==clipHeight) throw new Error('Unexpected review clip format');
  return {clip,metadata,frameCount};
}
