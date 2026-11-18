import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdaptiveTier } from '../../src/client/be/gl/adaptive-tier.js';
import { fishLength, priorityFish, turnYaw } from '../../src/client/be/gl/fish-school.js';
import { fishPixels } from '../../src/client/be/gl/fish-pixels.js';

function run(start:'cao'|'nhe', seconds:number, slowEvery=0) {
  const controller=createAdaptiveTier(start);
  let n=0,time=0,changes=0;
  while(time<seconds*1000) {
    const dt=slowEvery&&++n%slowEvery===0?40:16.667;
    time+=dt;
    const next=controller.frame(time,dt);
    if(next) changes++;
  }
  return {tier:controller.tier,changes};
}
test('stable frame cadence does not lower tier; sustained drops lower one tier',()=>{
  assert.deepEqual(run('cao',300),{tier:'cao',changes:0});
  assert.equal(run('cao',9,10).tier,'vua');
});
test('sustained drops in light tier choose Canvas2D and there is no oscillation',()=>{
  assert.equal(run('nhe',10,9).tier,'tinh');
  assert.ok(run('nhe',300).changes<=3);
});
test('rotation faces the viewer during both directions of a U-turn',()=>{
  assert.equal(turnYaw(0,-Math.PI,.5),-Math.PI/2);
  assert.equal(turnYaw(Math.PI,Math.PI*2,.5),Math.PI*1.5);
  const layout={height:2,surfaceY:6,front:10,back:17,tanHalfFov:.4,aspect:16/9};
  const band=2*13.5*layout.tanHalfFov*layout.aspect;
  assert.ok(Math.abs(fishLength(layout)/band-.11)<1e-9);
});
test('own new fish precede recent arrivals without consuming more than four own slots',()=>{
  const now=1_800_000_000_000;
  const item=(id:string,ownerId:string,age:number)=>({id,ownerId,createdAt:new Date(now-age).toISOString(),png:''});
  const fish=[...Array.from({length:6},(_,i)=>item('own'+i,'me',1_000_000+i)),item('new','other',200),item('old','other',700_000)];
  assert.deepEqual([...priorityFish(fish,'me',now,8)],['own0','own1','own2','own3','new']);
});
test('worker processing premultiplies alpha and domes only solid body pixels',()=>{
  const src=new Uint8ClampedArray(17*17*4);
  for(let y=4;y<=12;y++) for(let x=4;x<=12;x++)src.set([180,100,50,255],(y*17+x)*4);
  src.set([180,100,50,80],(3*17+8)*4);
  const out=fishPixels(src,17,17);
  assert.deepEqual([...out.color.slice((3*17+8)*4,(3*17+9)*4)],[56,31,16,80]);
  assert.equal(out.shape[2],0);
  assert.ok(out.shape[(8*17+8)*4+2]!>out.shape[(4*17+4)*4+2]!);
});
