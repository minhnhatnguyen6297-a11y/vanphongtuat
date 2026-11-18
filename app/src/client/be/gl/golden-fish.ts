import { fishLength, turnYaw, type FishLayout, type FishPose, type FishSource } from './fish-school.js';

export type Scenario = 'wide'|'closeup'|'uturn'|'depth'|'bubbles';
const fixtures=['round','long','hole','detached-fin','soft-edge','black','white','tiny'];
export function goldenFish(seed:number,count:number):FishSource[] {
  return Array.from({length:count},(_,i)=>({
    id:'golden-'+seed+'-'+i,png:'/art/ao-ca-fixtures/'+fixtures[i%8]+'.png',
    ownerId:'',createdAt:new Date(0).toISOString(),
  }));
}
export function goldenPoses(scenario:Scenario,fixture:readonly FishSource[],layout:FishLayout,time:number,
    ratio:(id:string)=>number|undefined):FishPose[] {
  const count=scenario==='depth'?4:scenario==='wide'||scenario==='bubbles'?fixture.length:1;
  const list:FishPose[]=[];
  for(let i=0;i<count;i++) {
    const f=fixture[scenario==='depth'?0:i];
    if(!f) continue;
    const aspect=ratio(f.id);
    if(!aspect) continue;
    const length=fishLength(layout,scenario==='closeup'?1.5:1);
    const height=length*aspect;
    const middle=(layout.front+layout.back)/2;
    const depth=scenario==='depth'?(i===2?layout.front:i===3?layout.back:middle):
      scenario==='closeup'?layout.front:scenario==='uturn'?middle:layout.front+(layout.back-layout.front)*((i*5)%8)/7;
    const edge=depth*layout.tanHalfFov*layout.aspect;
    const x=scenario==='depth'?edge*[-.66,-.22,.22,.66][i]!:
      count===1?0:edge*((((i % 8)+0.5)/8)*1.6-.8)+Math.sin(time*.45+i)*length*.2;
    const y=scenario==='depth'?(i===0?layout.surfaceY-height*.65:i===1?height*.54:layout.surfaceY*.56):
      count===1?layout.surfaceY*.44:layout.surfaceY*(.22+.57*(((i*3)%count)/Math.max(1,count-1)));
    list.push({id:f.id,x,y,depth,length,height,
      yaw:scenario==='uturn'?turnYaw(0,-Math.PI,time/.7):scenario==='depth'?0:.32+Math.sin(time+i)*.08,
      pitch:0,roll:0,phase:time*2*Math.PI*2.4+i,
      amplitude:scenario==='uturn'?.098:.07,alpha:1});
  }
  return list.sort((a,b)=>b.depth-a.depth);
}
