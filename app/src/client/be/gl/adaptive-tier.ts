import type { AoTier } from './tier.js';

const tiers:AoTier[]=['cao','vua','nhe','tinh'];
export function createAdaptiveTier(start:AoTier) {
  let tier=start;
  let clock=0, windowStart=0,last=0;
  let bad=0, severe=0, good=0, attempts=0, blockedUntil=0;
  let count=0,dropped=0;
  let nominal=16.667;
  const samples:number[]=[];
  let trial:{from:AoTier}|null=null;
  const change=(next:AoTier)=>{ tier=next; windowStart=clock;count=dropped=bad=severe=good=0;return tier; };
  return {
    get tier(){return tier;},get nominal(){return nominal;},get target(){return tier==='nhe'?nominal*2:nominal;},
    reset() {count=dropped=0;last=0;windowStart=clock;},
    frame(at:number,dt:number,skip=false):AoTier|null {
      clock=at;
      if(!last) {last=at;windowStart=at;}
      if(skip || dt<=0) {count=dropped=0;windowStart=at;return null;}
      if(samples.length<60 && dt<32) {
        samples.push(dt);
        nominal=[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]!;
      }
      count++;
      if(dt>nominal*1.5) dropped++;
      if(at-windowStart<(trial?5000:4000)) return null;
      const rate=dropped/Math.max(1,count);
      count=dropped=0;windowStart=at;
      if(trial) {
        const {from}=trial;trial=null;
        if(rate>.03){blockedUntil=at+600_000;return change(from);}
        return null;
      }
      bad=rate>.05?bad+1:0;
      severe=rate>=.10?severe+1:0;
      good=rate<.01?good+4000:0;
      const index=tiers.indexOf(tier);
      if(index<2 && bad>=2) return change(tiers[index+1]!);
      if(index===2&&severe>=2) return change('tinh');
      if(index>0&&index<3&&good>=30_000&&at>=blockedUntil&&attempts<3) {
        attempts++;trial={from:tier};
        return change(tiers[index-1]!);
      }
      return null;
    },
  };
}
