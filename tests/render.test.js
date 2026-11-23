'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../app/render.js');
const G=require('../app/game.js');
const M=require('../app/map.js');
function rig(webGL,allow2D=true) {
  const base={getShaderParameter:()=>true,getProgramParameter:()=>true, getAttribLocation:()=>1,
    drawArrays(mode,first,count){assert(count%3===0);this.calls++;},calls:0};
  const ctx=new Proxy(base,{get(v,k){return k in v?v[k]:()=>{};}});
  const simple=new Proxy({},{get(v,k){return k in v?v[k]:()=>{};}});
  const doc={createElement:()=>({ getContext:()=>allow2D?simple:null })};
  function canvas() {return {width:0,height:0,ownerDocument:doc,listeners:{},getContext(type){return type==='webgl'?(webGL?ctx:null):(allow2D?simple:null);},addEventListener(k,fn){this.listeners[k]=fn;}};}
  const primary=canvas(), backup=canvas(); backup.hidden=true;
  return {primary,backup,ctx};
}

test('actual WebGL batches obey both tiers and context lost keeps simulation in playable Canvas',()=>{
  const {primary,backup,ctx}=rig(true), changes=[];
  const engine=R.create(primary,backup,v=>changes.push(v));
  const g=G.create(812);
  const normal=engine.draw(g,1170,2532,3);
  assert(normal.ok&&normal.stats.calls<=100&&normal.stats.triangles<=100000);assert.equal(ctx.calls,normal.stats.calls);
  assert(primary.width*primary.height<=2000000);
  engine.lower();const light=engine.draw(g,1170,2532,3);
  assert(light.ok&&light.stats.calls<=50&&light.stats.triangles<=50000);assert(primary.width*primary.height<=1000000);
  let cancel=false;primary.listeners.webglcontextlost({preventDefault(){cancel=true;}});
  assert(cancel&&primary.hidden&&!backup.hidden);assert.equal(engine.mode,'简图');
  const first=g.player.x;G.step(g,{z:1},G.STEP);assert.notEqual(g.player.x,first);
  assert(engine.draw(g,360,800,2).ok);assert.deepEqual(changes,['3D · 轻量画质','简图模式']);
});

test('follow camera stays outside the convenience wall and marker occlusion uses height',()=>{
  const g=G.create(1);Object.assign(g.player,{x:-37,y:0,z:-41});g.view.yaw=Math.PI;
  const {eye}=R.camera(g,320/650);
  assert(Math.abs(eye[2]-(-39.16))<.02,JSON.stringify(eye));
  const market=M.signs[1];
  assert.equal(M.clearFraction([36,1.5,-46],[market.x,market.y,market.z],0),1);
  assert(M.clearFraction([-39,1.5,-46],[-39,1.5,-31],0)<1);
  assert(M.clearFraction([-71,-2,54],[-71,3,54],0)<1);
});

test('foreground at 5 FPS lowers quality, while background recovery clears partial samples',()=>{
  let drops=0;const q=R.qualityMonitor(()=>drops++);
  for(let i=0;i<14;i++) q.sample(200);
  assert.equal(drops,0); q.sample(200);assert.equal(drops,1);
  for(let i=0;i<14;i++) q.sample(200);
  q.reset();q.sample(0);
  for(let i=0;i<100;i++) q.sample(33);
  assert.equal(drops,1);
});

test('unavailable WebGL and total canvas failure are separate bounded states',()=>{
  const g=G.create(812);
  const fallback=rig(false), broken=rig(false,false);
  assert(R.create(fallback.primary,fallback.backup).draw(g,360,800,1).ok);
  assert(!R.create(broken.primary,broken.backup).draw(g,360,800,1).ok);
  assert.deepEqual(R.pixelSize(360,800,3,false),{w:540,h:1200});
  assert.deepEqual(R.pixelSize(360,800,3,true),{w:360,h:800});
});
