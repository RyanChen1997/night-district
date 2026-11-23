'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../app/map.js');
const G=require('../app/game.js');
const near=(g,x,z,n)=>Math.hypot(g.player.x-x,g.player.z-z)<n;
function ticks(g,n,u) { for(let i=0;i<n;i++) G.step(g,typeof u==='function'?u(g):u,G.STEP); }
function walk(g,x,z,r=0.6) {
  assert(!g.car);
  for(let i=0;i<2500&&!near(g,x,z,r);i++) {
    const a=M.angle(g.player,{x,z})-g.view.yaw;
    ticks(g,1,{x:-Math.sin(a),z:Math.cos(a),looking:true});
  }
  assert(near(g,x,z,r),`walk to ${x},${z} stopped at ${g.player.x.toFixed(2)},${g.player.z.toFixed(2)} y${g.player.y.toFixed(2)}`);
}

function drive(g,x,z,r=4,rules=false) {
  assert(g.car);
  for(let i=0;i<2200&&!near(g,x,z,r);i++) {
    if (!g.car) throw Error(JSON.stringify({x,z,t:g.time,stats:g.stats,notice:g.notice}));


    const c=g.car, delta=M.turn(c.a,M.angle(c,{x,z}));

    let speed=Math.abs(delta)>.55?3.6:Math.abs(delta)>.23?5.5:10.4;
    if(rules) {
      const sx=Math.sin(c.a), sz=Math.cos(c.a), axis=Math.abs(sx)>Math.abs(sz)?'x':'z';
      M.junctions.forEach((j,n)=>{
        const dx=j.x-c.x,dz=j.z-c.z,front=dx*sx+dz*sz;
        if(front>9&&front<20&&Math.abs(dx*sz-dz*sx)<5&&!M.signal(g.time,n,axis)) speed=Math.min(speed,Math.max(0,(front-11.5)*1.3));
      });
      g.traffic.concat(g.policeCars).forEach(e=>{
        const dx=e.x-c.x,dz=e.z-c.z,front=dx*sx+dz*sz;
        if(front>0&&front<15&&Math.abs(dx*sz-dz*sx)<2.6) speed=Math.min(speed,Math.max(0,(front-5.15)*1.4));
      });
    }
    ticks(g,1,{x:M.clamp(-delta*3,-1,1), gas:c.speed<speed-.08, brake:c.speed>speed+.16});
  }
  assert(near(g,x,z,r),`drive to ${x},${z} stopped at ${g.player.x.toFixed(2)},${g.player.z.toFixed(2)} y${g.player.y.toFixed(2)}`);
}
function stop(g) {
  for(let i=0;i<90&&g.car.speed>.11;i++) ticks(g,1,{brake:true});
  assert(Math.abs(g.car.speed)<2.15);
}
function foot(g,points) { points.forEach(p=>walk(g,p[0],p[1])); }
function reachRoof(g) {
  foot(g,[[-43,-41],[-26,-42],[-25.5,-6],[-25.5,5.5],[16,5.5],[17,35],[21,34],[21,13.7],[26,14.8]]);
  assert.equal(g.player.y,4.2);
}
function toMarket(g) { foot(g,[[-45,-43],[-46,-49],[36,-48],[36,-34]]); }
function homeCar(g) {
  walk(g,-42,-46); assert.match(g.notice,/车门/); ticks(g,1,{door:true}); assert.equal(g.car.id,'home');
}

test('A: hints, ring loop with steering, brake / reverse, exit, walk alley and stairs',()=>{
  const g=G.create(183049);
  assert.match(g.notice,/摇杆/); homeCar(g);
  // Approach corners wide enough to round them; reserve a traffic lane for the test route.
  const began=g.time;
  for(const p of [[-27,-57],[48,-57],[56,-56],[57,-46],[57,48],[56,56],[46,57],[-48,57],[-56,56],[-57,46],[-57,-48],[-56,-56],[-45,-57]]) drive(g,p[0],p[1],2.0,true);
  assert(g.time-began>34&&g.time-began<100,String(g.time-began)); assert.equal(g.stats.incidents,0);
  ticks(g,1,{door:true}); assert(g.car,'no exit at speed');
  stop(g); const z0=g.car.z,x0=g.car.x; ticks(g,39,{brake:true}); assert(g.car.speed<-.9); assert(Math.hypot(g.car.x-x0,g.car.z-z0)>.3);
  ticks(g,46,{}); ticks(g,1,{door:true}); assert.equal(g.car,null);
  reachRoof(g);
});

test('continuous garage ramp supports driving, stairs and alleys reject cars, deck does not snap from below',()=>{
  const g=G.create(1); g.player.x=35;g.player.z=24;g.player.y=4.2;
  ticks(g,1,{door:true}); assert(g.car);
  drive(g,35.4,34,1.6); assert(g.car.y<4.2&&g.car.y>3.7);
  drive(g,35.4,46,1.5); assert(g.car.y>0&&g.car.y<1);
  drive(g,35.4,57,1.8); stop(g); assert.equal(g.car.y,0);
  const from={x:35,z:54,y:0};
  for(let z=53.99;z>20;z-=.065) assert(M.place(from,35,z,true));
  assert.equal(from.y,4.2);
  const roofSide={x:29,z:35,y:0};
  assert(!M.place(roofSide,28,29,false)); assert.equal(roofSide.y,0);
  const below={x:-70,z:49,y:-3.2}; assert(M.place(below,-70,54,false)); assert.equal(below.y,-3.2);
  const above={x:-64,z:54,y:0,a:-Math.PI/2};
  for(let x=-64.1;x>-81;x-=.1) assert(M.place(above,x,54,true));
  assert.equal(above.y,0);
  const lane={x:-25.5,z:-48,y:0}; assert(!M.place(lane,-25.5,-47.5,true)); assert(M.place(lane,-25.5,-47.5,false));
  const lane2={x:46,z:7,y:0}; assert(!M.place(lane2,46,8,true)); assert(M.place(lane2,46,8,false));
});

function aim(g,a) { ticks(g,1,{lookX:-M.turn(g.view.yaw,a),looking:true}); }
function waitFor(g,predicate,seconds,input) {
  for(let i=0;i<seconds*60&&!predicate();i++) ticks(g,1,input);
  assert(predicate(),`condition not reached at ${g.time.toFixed(2)}, phase ${g.phase}, ${g.notice} (${g.player.x.toFixed(1)},${g.player.z.toFixed(1)})`);
}
test('B: market flare disperses crowds and slows traffic, a patrol car pursues, crew exits, search lowers wanted level',()=>{
  const g=G.create(183049); homeCar(g);
  drive(g,-27,-57,2,true); drive(g,38,-57,2,true); drive(g,45,-48,1.9,true); stop(g);
  ticks(g,1,{door:true}); assert.equal(g.car,null);
  walk(g,46,-39);
  const affected=g.traffic.filter(e=>M.distance(e,g.player)<28);
  assert(affected.length>0);
  aim(g,Math.PI*.82); ticks(g,1,{arm:true}); assert.match(g.notice,/准星/);
  ticks(g,1,{fire:true});
  assert(g.people.filter(e=>e.state==='flee').length>=4); assert(affected.some(e=>e.scaredUntil>g.time));
  assert(g.stars>=1); assert.equal(g.player.ammo,11);
  ticks(g,23,{}); ticks(g,1,{fire:true}); assert(g.stars>=2);
  waitFor(g,()=>affected.some(e=>e.scaredUntil>g.time && e.speed<2.0),2,{});
  walk(g,g.free[0].x,g.free[0].z,2.6); ticks(g,1,{door:true}); assert(g.car);
  drive(g,49,-42,2.1);drive(g,52.5,-35,2.4);stop(g);
  waitFor(g,()=>g.stats.footChase>0||g.policeCars.some(c=>c.state==='pursuit'&&M.distance(c,g.player)<18),9,{});
  ticks(g,1,{door:true}); assert(!g.car);
  waitFor(g,()=>g.stats.footChase>0,3,{});
  assert(g.officers.some(o=>o.unit&&o.state==='pursuit'));
  foot(g,[[48.5,-63],[49,-77.5],[38,-78.5],[29,-79],[29,-64],[14,-63]]);
  waitFor(g,()=>g.phase==='search',10,{});
  const before=g.stars;
  waitFor(g,()=>g.stars<before,22,{});
  assert.equal(g.stats.captures,0);
});

test('a two-star driver can abandon the car inside the market and the cruiser crew walks in',()=>{
  const g=G.create(183049);
  Object.assign(g.player,{x:36,z:-34,a:0});
  g.car=Object.assign(g.free[0],g.player,{speed:0});
  g.heat=4.2;g.stars=2;g.lastSeen={x:36,z:-34,y:0};g.lastSeenAt=g.lastEvent=g.time;
  const cruiser=g.policeCars[0];
  ticks(g,1,{door:true});assert(!g.car);
  waitFor(g,()=>cruiser.crew!==undefined,5,{});
  const officer=cruiser.crew, initialDistance=M.distance(officer,g.player);
  assert(initialDistance>13);assert.equal(officer.unit,cruiser);
  waitFor(g,()=>M.distance(officer,g.player)<initialDistance-2,3,{});
});

test('civilians and pedestrian patrols start outside geometry, and the market disperses in space',()=>{
  const g=G.create(183049);
  for(const e of g.people.concat(g.officers)) assert(M.place({...e},e.x,e.z,false),e.id);
  toMarket(g);aim(g,0);ticks(g,1,{arm:true});ticks(g,1,{fire:true});
  const fleeing=g.people.filter(e=>e.group===1&&e.state==='flee').map(e=>({e,x:e.x,z:e.z}));
  assert(fleeing.length>=6);
  ticks(g,50,{});
  assert(fleeing.filter(p=>M.distance(p.e,p)>1).length>=6);
});

test('delivery is optional and survives completion; walking under the bridge records all paintings',()=>{
  const completed=[]; const g=G.create(177,{},id=>completed.push(id));
  ticks(g,1,{task:true}); assert.equal(g.active,null);
  walk(g,-40,-42); assert.match(G.interaction(g).label,/顺路/);
  ticks(g,1,{task:true}); assert.equal(g.active.id,'delivery');
  foot(g,[[-45,-42],[-46,-49],[36,-48],[36,-34]]);
  ticks(g,1,{task:true}); assert.equal(g.active,null);assert(g.done.delivery);
  foot(g,[[36,-49],[-63,-49],[-64,37]]);
  ticks(g,1,{task:true}); assert.equal(g.active.id,'graffiti');
  foot(g,[[-64,30],[-71,30],[-71,42]]); assert(g.player.y<-2); assert.equal(g.active.recorded.size,0);
  walk(g,-72.65,42,.2); assert.equal(g.active.recorded.size,1);
  walk(g,-72.6,54,.2); assert.equal(g.player.y,-3.2); assert.equal(g.active.recorded.size,2);
  walk(g,-72.6,66,.2); assert.equal(g.active,null);assert(g.done.graffiti);
  foot(g,[[-71,77],[-65,77],[-63,69]]); assert.equal(g.player.y,0);
  assert.deepEqual(completed,['delivery','graffiti']);
});

function leaveGarage(g) {
  walk(g,35,23,1.7); ticks(g,1,{door:true}); assert.equal(g.car.id,'roof'); assert.equal(g.stars,0);
  drive(g,35.4,34,1.6); assert.equal(g.stars,2); drive(g,35.4,52,1.8); drive(g,35.4,60,1.6); stop(g);
}
test('garage job warns, awards two stars, fails on actual custody, then can be retried and delivered',()=>{
  const g=G.create(29,{delivery:true}); reachRoof(g);
  assert.match(G.interaction(g).label,/二星/); ticks(g,1,{task:true}); assert.equal(g.active.id,'garage');
  leaveGarage(g);
  // A stopped player lets the dispatched cruiser reach the side of the block.
  drive(g,57,57,3.7); stop(g);
  waitFor(g,()=>g.stats.captures===1,24,{});
  assert.equal(g.outcome,'arrested');assert.equal(g.active.id,'garage');
  assert(g.car&&M.distance(g.player,M.spawn)>20,'shown before moving the player');
  ticks(g,120,{gas:true});assert.equal(g.outcome,'arrested');
  assert(G.recover(g));assert.equal(g.outcome,null);
  assert.equal(g.active,null);assert.equal(g.car,null);assert(g.done.delivery);assert(!g.done.garage);
  assert.deepEqual([g.free[1].x,g.free[1].y,g.free[1].z],[M.markedCar.x,M.markedCar.y,M.markedCar.z]);
  reachRoof(g); ticks(g,1,{task:true}); leaveGarage(g);
  drive(g,31,61.5,1.6); drive(g,-20,61.7,1.8); drive(g,-24,67,1.7); drive(g,-25,78.5,1.4);
  drive(g,-33,79,1.4); stop(g);
  waitFor(g,()=>g.stars===0,26,{});
  drive(g,-48,79,2.1); drive(g,-58,76,2.3); drive(g,-63,69,2.2); stop(g);
  waitFor(g,()=>g.done.garage,28,{});
  assert.equal(g.active,null); assert.equal(g.stats.captures,1);
});

test('police proximity cannot reset the game; health defeat is distinct from arrest',()=>{
  const g=G.create(87,{delivery:true});g.people=[];g.traffic=[];
  Object.assign(g.player,{x:5,z:0});Object.assign(g.policeCars[0],{x:7,z:0});
  ticks(g,180,{});assert.equal(g.outcome,null);assert.equal(g.player.health,100);
  g.policeCars=[];
  const o=g.officers[0];g.officers=[o];Object.assign(o,{x:5,z:6,y:0});
  g.stars=2;g.heat=4.2;g.lastSeen={x:5,z:0,y:0};
  // Maintain several meters of in-game range to isolate return-fire damage from arrest pressure.
  for(let i=0;i<800&&!g.outcome;i++){o.x=5;o.z=6;ticks(g,1,{});}
  assert.equal(g.outcome,'downed');assert.equal(g.player.health,0);
  assert.equal(g.stats.captures,0);assert.equal(g.stats.defeats,1);assert(g.done.delivery);
  assert(M.distance(g.player,M.spawn)>20);assert(G.recover(g));
  assert.equal(M.distance(g.player,M.spawn),0);assert(g.done.delivery);assert.equal(g.player.health,100);
});

test('walker pairs and the moving car maintain separation, with one impact per contact',()=>{
  const g=G.create(9), person=g.people[0];g.people=[person];g.officers=[];g.traffic=[];g.policeCars=[];
  Object.assign(g.player,{x:0,z:0,a:0});Object.assign(person,{x:0,z:0,y:0,until:100});
  ticks(g,1,{});assert(M.distance(g.player,person)>=.59);
  const car=g.free[0];Object.assign(car,{x:0,z:0,y:0,a:0,speed:8});g.car=car;
  Object.assign(person,{x:0,z:2.18,y:0,until:0,path:[{x:0,z:2.18},{x:0,z:2.18}],next:1});
  ticks(g,2,{gas:true});assert.equal(g.stats.impacts,1);
  assert.equal(person.state,'stunned');assert(M.distance(car,person)>=2.16||Math.abs(person.x-car.x)>=1.33);
  ticks(g,25,{gas:true});assert.equal(g.stats.impacts,1);
});

test('a stopped civilian car can be taken from its side only, and the driver flees',()=>{
  const g=G.create(5);g.people=[];g.officers=[];g.policeCars=[];
  const car=g.traffic[0];g.traffic=[car];Object.assign(car,{x:10,z:-56.6,a:Math.PI/2,speed:2.2});
  Object.assign(g.player,{x:10,z:-58.5,y:0});
  assert.equal(G.nearRide(g),null);
  ticks(g,1,{door:true});assert(!g.car);
  Object.assign(car,{x:10,z:-56.6,speed:0});
  Object.assign(g.player,{x:12.75,z:-56.6});assert(!G.nearRide(g),'not from the bumper');
  Object.assign(g.player,{x:10,z:-58.5});assert.equal(G.nearRide(g).occupied,true);
  ticks(g,1,{door:true});assert.equal(g.car,car);assert(!g.traffic.includes(car)&&g.free.includes(car));
  assert(g.stars>=1);assert.equal(g.stats.stolen,1);
  const driver=g.people.find(e=>e.id==='driver-'+car.id),from={x:driver.x,z:driver.z};
  assert.equal(driver.state,'flee');ticks(g,36,{});assert(M.distance(driver,from)>1);
  ticks(g,1,{door:true});assert(!g.car);ticks(g,1,{door:true});assert.equal(g.car,car);assert.equal(g.stats.stolen,1);
});

test('unarmed punches cause one nearby stagger, but miss behind, through walls, or from a vehicle',()=>{
  const g=G.create(5),target=g.people[0];g.people=[target];g.traffic=[];g.officers=[];g.policeCars=[];
  Object.assign(g.player,{x:0,z:0,y:0,a:0});
  Object.assign(target,{x:0,z:-1.1,y:0,until:0,path:null});
  ticks(g,1,{punch:true});assert(g.strike&&!g.strike.hit&&g.stars===0);
  ticks(g,31,{});Object.assign(g.player,{x:-37,z:-39.55,y:0,a:0});Object.assign(target,{x:-37,z:-38,y:0});
  ticks(g,1,{punch:true});assert(!g.strike.hit,'wall blocks punches');
  ticks(g,31,{});Object.assign(g.player,{x:0,z:0,y:0,a:0});Object.assign(target,{x:0,z:1.2,y:0});
  ticks(g,1,{punch:true});assert(g.strike.hit);assert.equal(target.state,'stagger');assert.equal(g.stats.punches,1);assert(g.stars>=1);
  const strike=g.strike;ticks(g,12,{punch:true});assert.equal(g.strike,strike);assert.equal(g.stats.punches,1);
  ticks(g,32,{});ticks(g,1,{arm:true,punch:true});assert.equal(g.strike,strike);
  g.car=g.free[0];ticks(g,1,{punch:true});assert.equal(g.strike,strike);
});

test('collision reports once for continuous bumper contact; vehicle mode blocks firing',()=>{
  const g=G.create(44); homeCar(g);
  g.traffic.length=0;
  g.free.push({id:'obstruction',x:-33.5,z:-47,y:0,a:Math.PI/2,color:'#9f9f9f',speed:0});
  const before=g.player.ammo;
  ticks(g,110,{gas:true,arm:true,fire:true});
  assert.equal(g.player.ammo,before); assert(!g.player.armed);
  assert.equal(g.stats.collisions,1);
  ticks(g,100,{gas:true}); assert.equal(g.stats.collisions,1);
  ticks(g,100,{brake:true});assert(g.car.x<-39);
  ticks(g,165,{gas:true});assert.equal(g.stats.collisions,2);
});

test('market crossers wait then cross, and civilian cars stop at red without a player collision',()=>{
  const g=G.create(183049);
  const crossers=g.people.filter(e=>e.group===0);
  waitFor(g,()=>crossers.some(e=>e.state==='wait'),40,{});
  const waiting=crossers.find(e=>e.state==='wait');
  waitFor(g,()=>waiting.state==='cross',16,{});
  const traffic=G.create(183049);traffic.time=11.5;
  const lead=traffic.traffic[1];Object.assign(lead,{x:36,z:-56.6,next:1,speed:4});
  traffic.traffic=[lead];traffic.people=[];traffic.policeCars=[];
  waitFor(traffic,()=>lead.speed<.1&&lead.x>40&&lead.x<44,8,{});
  const stopped={x:lead.x,z:lead.z};
  waitFor(traffic,()=>M.distance(lead,stopped)>4,16,{});
  assert.equal(g.stats.collisions,0);
});

test('officer hit immediately summons one distant road reinforcement; no third unit can appear',()=>{
  const g=G.create(183049);toMarket(g);
  const o=g.officers[0];
  // Set the target actor in an unobstructed market aisle; firing uses the production hit test.
  Object.assign(o,{x:g.player.x+4,z:g.player.z,y:0});
  aim(g,Math.PI/2);ticks(g,1,{arm:true});ticks(g,1,{fire:true});
  assert.equal(o.state,'stunned');assert.equal(g.stars,3);assert.equal(g.policeCars.length,2);
  const extra=g.policeCars[1]; const old={x:extra.x,z:extra.z};
  assert(M.distance(extra,g.player)>62);assert(M.onRoad(extra));
  ticks(g,42,{});assert(M.distance(extra,old)>2);assert.equal(g.stats.backup,1);assert.equal(g.policeCars.length,2);
});

test('the branch lane, garage ramp and alley mouths never block free civilian circulation',()=>{
  const g=G.create(183049);
  const positions=g.traffic.map(e=>({x:e.x,z:e.z,meters:0}));
  for(let i=0;i<900;i++) {
    ticks(g,6,{});g.traffic.forEach((e,j)=>{const recent=positions[j];recent.meters+=M.distance(recent,e);recent.x=e.x;recent.z=e.z;});
  }
  assert(positions.every(p=>p.meters>370),JSON.stringify(positions.map(p=>Math.round(p.meters))));
});
