export type FishSource = {id:string;png:string;ownerId:string;createdAt:string};
export type FishPose = {
  id:string; x:number; y:number; depth:number; yaw:number; pitch:number; roll:number;
  length:number; height:number; phase:number; amplitude:number; alpha:number;
};
export type FishLayout = {height:number;surfaceY:number;front:number;back:number;tanHalfFov:number;aspect:number};
type Swimmer = FishPose & {size:number;ratio:number;seed:number;speed:number;facing:1|-1;until:number;
  entering:number;rested:number;turn:{at:number;duration:number;from:number;to:number}|null};

const TAU=2*Math.PI;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function hashFish(id:string) {
  let hash=2166136261;
  for(let i=0;i<id.length;i++) hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return (hash>>>0)/4294967296;
}
export function turnYaw(from:number,to:number,t:number) {
  const a=clamp(t,0,1);
  return from+(to-from)*a*a*(3-2*a);
}
export function fishLength(layout:FishLayout,size=1) {
  return .11*(layout.front+layout.back)*layout.tanHalfFov*layout.aspect*size;
}
export function priorityFish<T extends FishSource>(fish:readonly T[], viewer:string, now:number, limit:number) {
  const newest=[...fish].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
  const own=viewer?newest.filter(f=>f.ownerId===viewer).slice(0,Math.min(4,limit)):[];
  const keep=new Set(own.map(f=>f.id));
  for(const f of newest) {
    if(keep.size>=limit || now-Date.parse(f.createdAt)>600_000) break;
    keep.add(f.id);
  }
  return keep;
}

export function createSchool() {
  const swimmers=new Map<string,Swimmer>();
  const visible=new Set<string>();
  let nextSwap=150;
  let retiring:{out:string;in:string;until:number}|null=null;
  function spawn(f:FishSource, layout:FishLayout, ratio:number, time:number):Swimmer {
    const seed=hashFish(f.id), size=.8+.4*seed, length=fishLength(layout,size);
    const depth=layout.front+(layout.back-layout.front)*hashFish(f.id+'depth');
    const height=length*ratio;
    const facing=seed<.5?1:-1;
    return {
      id:f.id,seed,size,ratio,length,height,depth,
      x:(hashFish(f.id+'x')-.5)*depth*layout.tanHalfFov*layout.aspect*1.3,
      y:height*.5+hashFish(f.id+'y')*Math.max(0,layout.surfaceY-height*1.2),
      yaw:facing===1?0:Math.PI,pitch:0,roll:0,phase:seed*TAU,amplitude:.07,
      alpha:0,speed:.25+.35*hashFish(f.id+'speed'),facing,
      until:time+8+12*seed,entering:time,rested:time,turn:null,
    };
  }
  function update(fish:readonly FishSource[], viewer:string, limit:number, layout:FishLayout,
      getRatio:(id:string)=>number|undefined, time:number, dt:number, now:number, event?:{x:number;y:number;kind:'feed'|'scare';at:number}|null):FishPose[] {
    const all=new Map(fish.map(f=>[f.id,f]));
    for(const [id] of swimmers) if(!all.has(id)) {swimmers.delete(id);visible.delete(id);}
    for(const f of fish) {
      const ratio=getRatio(f.id);
      if(ratio && !swimmers.has(f.id)) swimmers.set(f.id,spawn(f,layout,ratio,time));
    }
    const priorities=priorityFish(fish,viewer,now,limit);
    for(const id of priorities) if(swimmers.has(id)) visible.add(id);
    for(const id of [...visible].reverse()) {
      if(visible.size<=limit) break;
      if(!priorities.has(id)) {visible.delete(id);swimmers.get(id)!.rested=time;}
    }
    for(const [id,s] of swimmers) {
      if(visible.size>=limit) break;
      if(!visible.has(id)) {visible.add(id);s.entering=time;}
    }
    if(retiring && time>=retiring.until) {
      const prev=swimmers.get(retiring.out),next=swimmers.get(retiring.in);
      if(prev && next && visible.has(prev.id) && !priorities.has(prev.id) && !visible.has(next.id)) {
        visible.delete(prev.id);prev.rested=time;visible.add(next.id);
        const edge=next.depth*layout.tanHalfFov*layout.aspect;
        next.facing=prev.x>=0?1:-1;
        next.x=next.facing===1?-edge:edge;
        next.yaw=next.facing===1?0:Math.PI;next.turn=null;next.entering=time;
      }
      retiring=null;
    }
    if(time>=nextSwap) {
      nextSwap=time+120+60*hashFish(String(Math.floor(time)));
      const out=[...visible].find(id=>!priorities.has(id));
      const rest=[...swimmers.values()].filter(s=>!visible.has(s.id)).sort((a,b)=>a.rested-b.rested);
      if(out && rest[0]) retiring={out,in:rest[0].id,until:time+2};
    }
    const poses:FishPose[]=[];
    for(const id of visible) {
      const s=swimmers.get(id)!;
      s.length=fishLength(layout,s.size);s.height=s.length*s.ratio;
      const edge=s.depth*layout.tanHalfFov*layout.aspect;
      const exit=retiring?.out===id;
      if(exit) {
        s.x+=(s.x>=0?1:-1)*s.length*1.1*dt;
        s.yaw=s.x>=0?0:Math.PI;
        s.alpha=clamp((retiring!.until-time)/1.7,0,1);
      } else {
        const active=event && time-event.at<1.3;
        const spot=active?(event.x*2-1)*edge:0;
        const target=active?(event.kind==='feed'?spot-s.x:s.x-spot):0;
        const react=active&&Math.abs(s.x-spot)<edge*.75&&Math.sign(target)!==s.facing&&Math.abs(target)>.2;
        if(!s.turn && (react || time>=s.until || (s.facing*s.x>edge-1.1*s.length))) {
          const from=s.facing===1?s.yaw: s.yaw+TAU*(s.yaw<0?1:0);
          s.turn={at:time,duration:.5+.4*s.seed,from,to:s.facing===1?-Math.PI:TAU};
        }
        const previous=s.yaw;
        if(s.turn) {
          const t=(time-s.turn.at)/s.turn.duration;
          s.yaw=turnYaw(s.turn.from,s.turn.to,t);
          if(t>=1) {s.facing=s.facing===1?-1:1;s.turn=null;s.until=time+8+12*s.seed;s.yaw=s.facing===1?0:Math.PI;}
        } else {
          s.yaw=(s.facing===1?0:Math.PI)+.37*Math.sin(time*.48+s.seed*TAU);
        }
        s.roll=dt?clamp(-.35*Math.atan2(Math.sin(s.yaw-previous),Math.cos(s.yaw-previous))/dt,-.4,.4):0;
        s.pitch=.18*Math.sin(time*.72+s.seed*TAU);
        s.x+=Math.cos(s.yaw)*s.speed*s.length*dt*(s.turn ? .6:1);
        s.depth=clamp(s.depth+Math.sin(s.yaw)*s.length*.1*dt,layout.front,layout.back);
        if(active && event.kind==='feed') s.y+=(layout.surfaceY*(1-event.y)-s.y)*dt*.35;
        s.y=clamp(s.y+Math.sin(s.pitch)*s.length*dt*.33,s.height*.5,Math.max(s.height*.5,layout.surfaceY-s.height*.7));
        s.phase=(s.phase+TAU*(1.2+2*s.speed/.6)*(s.turn?1.5:1)*dt)%TAU;
        s.amplitude=s.turn? .098:.07;
        s.alpha=clamp((time-s.entering)/.6,0,1);
      }
      poses.push({...s,y:s.y+.03*s.height*Math.sin(.8*time+s.seed*TAU)});
    }
    return poses.sort((a,b)=>b.depth-a.depth);
  }
  function reset(){swimmers.clear();visible.clear();nextSwap=150;retiring=null;}
  return {update,reset};
}
