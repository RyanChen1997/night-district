'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../app/platform.js');
const G=require('../app/game.js');
const M=require('../app/map.js');
const options=(v)=>({miniToolEnv:{buildVersion:v}});
const client=(methods,v=9552008)=>P.connect({launchOptions:options(v),miniTool:methods},100);
const read=data=>({errMsg:'getStorage:ok',data});
const written={errMsg:'setStorage:ok'};
const deferred=()=>{let resolve; const promise=new Promise(r=>{resolve=r;});return {resolve,promise};};
const flush=()=>new Promise(r=>setImmediate(r));

test('strict build version, sync preference, unknown is distinct from old',async()=>{
  assert.equal(P.version(options('9490003')),9490);
  for(const v of [null,0,true,9460,' 9460001','9460001.0',9007199254740992]) assert.equal(P.version(options(v)),null);
  let invoked=0;
  const miniTool={getLaunchOptions:()=>{invoked++;return Promise.resolve(options(9553009));}};
  assert.equal(P.version(await P.connect({launchOptions:options(9490001),miniTool}).context),9490);assert.equal(invoked,0);
  assert.equal(P.version(await P.connect({launchOptions:options('bad'),miniTool}).context),9553);assert.equal(invoked,1);
  assert.equal(P.version(await P.connect({miniTool:{getLaunchOptions:()=>Promise.reject(new Error('no sdk'))}}).context),null);
});

test('layout uses actual capsule or buttons and maxes out with injected insets without summing',()=>{
  const r=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top});
  const base={top:22,bottom:19,left:0,right:3};
  const info={windowWidth:320,windowHeight:640,pixelRatio:3,statusBarHeight:42,safeArea:r(8,32,316,628),gestureArea:r(0,0,26,640),
    menuButtons:{capsule:r(238,28,316,60),back:r(9,29,50,78),me:r(100,42,100,42)}};
  assert.deepEqual(P.spacing(info,9550,base,320,640),{top:60,bottom:19,left:26,right:4,dpr:3});
  assert.equal(P.spacing(info,9549,base,320,640).top,78);
  info.gestureArea=r(0,0,0,0);info.menuButtons.capsule=null;
  assert.equal(P.spacing(info,9550,base,320,640).left,8);
  assert.equal(P.spacing(info,9550,base,320,640).top,78);
  assert.deepEqual(P.spacing(info,9550,base,430,900),Object.assign({dpr:0},base));
  assert.deepEqual(P.landscapeInsets({top:60,bottom:19,left:26,right:4,dpr:3},true),{top:4,right:19,bottom:26,left:60,dpr:3});
});

test('completion merges with a pending read and serializes rapid additional completions',async()=>{
  const initial=deferred(), first=deferred(), writes=[];
  let loaded;
  const s=P.storage(client({getStorage:()=>initial.promise,setStorage:({data})=>{
    writes.push(JSON.parse(data)); return writes.length===1?first.promise:written;
  }}),v=>{loaded=v;});
  s.complete('delivery');await flush();assert.deepEqual(writes,[]);
  initial.resolve(read('{"garage":true}'));await flush();
  assert.deepEqual(loaded,{delivery:true,garage:true}); assert.deepEqual(writes,[{delivery:true,garage:true}]);
  s.complete('graffiti');await flush();assert.equal(writes.length,1);
  first.resolve(written);await s.ready;
  assert.deepEqual(writes,[{delivery:true,garage:true},{delivery:true,graffiti:true,garage:true}]);
});

test('a late save frees the active slot for a different mission without writing',async()=>{
  const initial=deferred(), g=G.create(2);let writes=0;
  const s=P.storage(client({getStorage:()=>initial.promise,setStorage:()=>{writes++;return written;} }),data=>G.restoreCompletions(g,data));
  Object.assign(g.player,M.points.delivery);G.step(g,{task:true},G.STEP);
  assert.equal(g.active.id,'delivery');
  initial.resolve(read('{"delivery":true}'));await s.ready;
  assert(g.done.delivery);assert.equal(g.active,null);assert.equal(writes,0);
  Object.assign(g.player,M.points.graffiti);G.step(g,{task:true},G.STEP);
  assert.equal(g.active.id,'graffiti');
});

test('unavailable versions, corrupt/ambiguous storage and timed out reads never write',async()=>{
  let writes=0;
  const methods={getStorage:()=>read(null),setStorage:()=>{writes++;return written;}};
  for(const v of [9459999,'unknown']) {
    const s=P.storage(client(methods,v));s.complete('garage');await s.ready;assert.equal(s.mode,'unavailable');
  }
  const unreadable=[()=>read('{"invalid":true}'),()=>read('{!!'),()=>Promise.reject(new Error('unavailable')),()=>new Promise(()=>{}),()=>({errMsg:'getStorage:fail missing'})];
  for(const getStorage of unreadable) {
    const c=P.connect({launchOptions:options(9460000),miniTool:Object.assign({},methods,{getStorage})},10);
    const s=P.storage(c);s.complete('delivery');await s.ready;s.complete('garage');assert.equal(s.mode,'read-failed');
  }
  assert.equal(writes,0);
});

test('unconfirmed writes preserve in-session completion and avoid overwrite after a late result',async()=>{
  const first=deferred(), writes=[];
  const api={getStorage:()=>read(null),setStorage:({data})=>{writes.push(JSON.parse(data));return first.promise;}};
  const s=P.storage(P.connect({launchOptions:options(9550000),miniTool:api},10));
  await s.ready;
  const pending=s.complete('delivery');s.complete('garage');await pending;
  assert.equal(s.mode,'write-failed');s.complete('graffiti');first.resolve(written);await flush();
  assert.deepEqual(writes,[{delivery:true}]);
});
