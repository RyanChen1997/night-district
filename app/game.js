(function (out) {
  'use strict';
  const N = out.District = out.District || {};
  const M = N.Map || (typeof module !== 'undefined' && require('./map.js'));
  const { clamp, distance, angle, turn, move, visible } = M;
  const STEP = 1 / 60;
  const titles = ['delivery', 'graffiti', 'garage'];
  const home = Object.assign({ id: 'home', speed: 0, color: '#38a7a3' }, M.startCar);
  const prize = Object.assign({ id: 'roof', speed: 0, color: '#ecad4e' }, M.markedCar);
  const palette = ['#ca778b','#70a0cb','#e9bf78','#84a49e','#a69acf','#b8685c'];
  const at = (x,z,y) => ({ x, z, y: y || 0 });
  const close = (a,b,r) => Math.abs(a.y-b.y)<1.1 && distance(a,b)<r;
  const pedPaths = [
    [at(48,-39),at(48,-44),at(61,-44),at(63,-38),at(63,-18),at(61,-15),at(47,-15),at(46,-26)],
    [at(25,-35),at(35,-34),at(43.6,-33.4),at(43.6,-15),at(41.3,-13.3),at(31.3,-14),at(31.3,-28)],
    [at(-46,-41),at(-25,-41),at(-25,-12),at(-26,-4),at(-46,-7)],
    [at(-63,31),at(-63,47),at(-63,66),at(-51,68),at(-48,61),at(-64,61)]
  ];
  const trafficPaths = [
    [at(-51.4,-56.6),at(56.6,-56.6),at(56.6,56.6),at(-56.6,56.6),at(-56.6,-56.6)],
    [at(51.4,-51.4),at(-51.4,-51.4),at(-51.4,51.4),at(51.4,51.4),at(51.4,-51.4)],
    [at(-51.4,2.5),at(-51.4,51.4),at(51.4,51.4),at(51.4,2.5)]
  ];
  function random(game) { game.seed = (Math.imul(game.seed,1664525)+1013904223) >>> 0; return game.seed / 4294967296; }
  function message(g, text, length) { g.notice = text; g.noticeUntil = g.time + (length || 3.4); }
  function freshCar(template) { return Object.assign({}, template); }
  function create(seed, done, onComplete) {
    const g = { seed: seed >>> 0, time: 0, player: Object.assign({ armed: false, ammo: 12, health: 100 }, M.spawn), car: null,
      view: { yaw: M.spawn.a, offset: 0, pitch: 0 }, free: [freshCar(home), freshCar(prize)], people: [], traffic: [],
      officers: [], policeCars: [], pairs: new Set(), redGate: new Set(), hints: {}, stars: 0, heat: 0, lastEvent: -99,
      lastSeenAt: -99, lastSeen: null, phase: 'patrol', pressure: 0, gunAt: -99, punchAt: -99, strike: null, shot: null, reply: null,
      active: null, done: Object.assign({}, done), onComplete, notice: '', noticeUntil: 0, outcome: null,
      stats: { incidents: 0, collisions: 0, impacts: 0, stolen: 0, punches: 0, horns: 0, footChase: 0, backup: 0, captures: 0, defeats: 0 } };
    pedPaths.forEach((path, group) => {
      const count = [5,12,4,4][group];
      for (let i=0; i<count; i++) {
        const index = i % path.length, next = (index+1)%path.length, d = group === 0 ? (i<3 ? 0 : 0.12) : (i>=path.length ? 0.45 : 0.06);
        const a = path[index], b = path[next];
        g.people.push({ id: 'p'+group+'-'+i, x: a.x+(b.x-a.x)*d, z: a.z+(b.z-a.z)*d, y: 0, a: angle(a,b), path,
          next, speed: 1.25+random(g)*0.5, state: 'walk', group, style:(i+group*2)%4, tint: palette[(i+group)%palette.length], until: 0, fade: 0 });
      }
    });
    [[0,1,.17],[0,1,.58],[0,2,.33],[0,3,.27],[0,4,.37],[1,1,.22],[1,2,.53],[1,3,.27],[1,4,.71],[2,0,.55]].forEach((v,i) => {
      const path=trafficPaths[v[0]], a=path[(v[1]+path.length-1)%path.length], b=path[v[1]];
      g.traffic.push({ id:'t'+i, x:a.x+(b.x-a.x)*v[2], z:a.z+(b.z-a.z)*v[2], y:0, a:angle(a,b), path, next:v[1], speed:6.5, color:palette[i%palette.length], hornAt:-99 });
    });
    [[at(48,-28),at(46,-35),at(42,-32),at(46,-19)], [at(-62,24),at(-63,42),at(-61,49),at(-60,33)]].forEach((path,i) => {
      g.officers.push({ id:'o'+i, x:path[0].x,z:path[0].z,y:0,a:angle(path[0],path[1]), path, next:1, state:'patrol', until:0, tint:'#7b9dd5' });
    });
    g.policeCars.push({ id:'unit1', x:56.6,z:-30,y:0,a:0, path:trafficPaths[0], next:2, speed:5.4, color:'#6894d7', police:true, state:'patrol' });
    message(g,'今晚没有路线。推左侧摇杆走走，右侧空地拖动镜头。',6);
    return g;
  }
  function nearRide(g) {
    const p=g.player;
    const parked=g.free.find(c=>close(p,c,3.55)&&visible(p,c));
    if(parked) return {car:parked,occupied:false};
    let best=null, gap=3.1;
    for(const c of g.traffic) {
      if(Math.abs(c.speed)>1.05||Math.abs(p.y-c.y)>.85) continue;
      const dx=p.x-c.x,dz=p.z-c.z, d=Math.hypot(dx,dz), s=Math.sin(c.a), k=Math.cos(c.a);
      if(d>=gap||Math.abs(dx*s+dz*k)>1.55||Math.abs(dx*k-dz*s)<.88||!visible(p,c)) continue;
      gap=d;best={car:c,occupied:true};
    }
    return best;
  }
  function nearCar(g) { const ride=nearRide(g);return ride&&ride.car; }
  function moveDriver(g,c) {
    const p=g.player, driver={id:'driver-'+c.id,x:c.x,y:c.y,z:c.z,a:c.a,group:-1,style:2,tint:c.color,until:0,speed:1.5};
    const away=turn(c.a,angle(c,p))<0?Math.PI/2:-Math.PI/2;
    for(const direction of [away,-away,Math.PI,0]) {
      const a=c.a+direction, d=Math.abs(direction)===Math.PI/2?1.63:2.38;
      if(!M.place(driver,c.x+Math.sin(a)*d,c.z+Math.cos(a)*d,false)) continue;
      if(g.people.concat(g.officers).some(e=>close(driver,e,.6))) continue;
      if(g.free.concat(g.traffic,g.policeCars).some(v=>v!==c&&vehicleContact(driver,v))) continue;
      driver.state='flee';driver.flee=a;driver.fade=g.time+6;
      g.people.push(driver);return true;
    }
    return false;
  }
  function nearbyTask(g) {
    if (g.car || g.active) return null;
    return titles.find(k => !g.done[k] && close(g.player,M.points[k],3.1)) || null;
  }
  function interaction(g) {
    if (g.car) return Math.abs(g.car.speed) < 2.15 ? { kind:'door', label:'下车' } : null;
    if (g.active && g.active.id === 'delivery' && close(g.player,M.points.market,3.0)) return { kind:'task', label:'交给摊主' };
    const id=nearbyTask(g);
    if (id) return { kind:'task', label: id==='garage' ? '开始任务 · 预告二星' : '开始任务 · '+M.points[id].name };
    return null;
  }
  function door(g) {
    const p=g.player;
    if (!g.car) {
      const ride=nearRide(g);
      if(!ride) return false;
      const c=ride.car;
      if(ride.occupied) {
        if(!moveDriver(g,c)) {message(g,'车门旁太挤，等车辆停到空处再试。');return false;}
        g.traffic.splice(g.traffic.indexOf(c),1);g.free.push(c);c.speed=0;
        g.stats.stolen++;incident(g,'抢车被目击 · 巡逻员已接报',3.25,true);
      }
      g.car=c; p.armed=false; Object.assign(p,{x:c.x,y:c.y,z:c.z,a:c.a}); g.view.offset=0;
      if (g.active && g.active.id==='garage' && g.active.stage==='take' && c.id==='roof') {
        g.active.launch=at(c.x,c.z,c.y);
      }
      return true;
    }
    const c=g.car;
    if (Math.abs(c.speed)>=2.15) return false;
    const options=[Math.PI/2,-Math.PI/2,Math.PI,0];
    for (let i=0;i<options.length;i++) {
      const a=c.a+options[i];
      const offset=i<2?1.8:2.45;
      if (M.place(p,c.x+Math.sin(a)*offset,c.z+Math.cos(a)*offset,false) && !g.people.concat(g.officers).some(e=>close(p,e,.62))) {
        c.speed=0; g.car=null; p.a=c.a; g.view.offset=0; return true;
      }
      Object.assign(p,{x:c.x,z:c.z,y:c.y});
    }
    message(g,'这里没有下车空间，移开一点再试。'); return false;
  }
  function task(g) {
    if (g.active && g.active.id==='delivery' && !g.car && close(g.player,M.points.market,3)) {
      finish(g); return true;
    }
    const id=nearbyTask(g);
    if (!id) return false;
    if (id==='garage' && (!close(g.free[1],M.markedCar,3) || g.free[1].y < 3.8)) {
      g.free[1]=freshCar(prize);
    }
    g.active={ id, stage:id==='garage' ? 'take' : 'search', recorded:new Set() };
    message(g, id==='garage' ? '开走琥珀色标记车即触发二星。甩掉通缉后开去河边。' : M.points[id].name+' · 已追踪',5);
    return true;
  }
  function finish(g) {
    const id=g.active.id;
    g.active=null; g.done[id]=true; message(g,'完成 · '+M.points[id].name,4.5);
    if (g.onComplete) g.onComplete(id);
  }
  function restoreCompletions(g, done) {
    Object.assign(g.done, done);
    if (g.active && g.done[g.active.id]) {
      g.active=null;
      message(g,'这项任务已经完成。可以去接另一项。');
    }
  }
  function taskText(g) {
    if (!g.active) return '';
    if (g.active.id==='delivery') return '顺路送一单｜把包裹交给夜市摊主，不限时';
    if (g.active.id==='graffiti') return '桥下的三幅涂鸦 '+g.active.recorded.size+'/3｜河水一侧：入坡、桥影、出坡';
    if (g.active.stage==='take') return '停车楼取车｜开走顶层琥珀车会触发二星';
    return g.stars ? '停车楼取车｜摆脱追踪与搜索，再开标记车去河边' : '停车楼取车｜驾驶标记车去河边集合点';
  }
  function updateTasks(g) {
    if (!g.active) return;
    if (g.active.id==='graffiti' && !g.car) {
      M.paintings.forEach((p,i) => {
        if (close(g.player,p,2.55) && !g.active.recorded.has(i)) {
          g.active.recorded.add(i); message(g,'涂鸦已记录 · '+g.active.recorded.size+'/3');
        }
      });
      if (g.active.recorded.size===3) finish(g);
    } else if (g.active.id==='garage' && g.active.stage==='escape' && g.stars===0 && g.car && g.car.id==='roof' && close(g.player,M.points.meet,4.5)) finish(g);
  }
  function witness(g, atPoint) {
    return g.people.concat(g.officers,g.traffic,g.policeCars).some(e => !(e.until>g.time) && distance(e,atPoint)<25 && visible(e,atPoint));
  }
  function stars(heat) { return heat<=0 ? 0 : heat<3 ? 1 : heat<7 ? 2 : 3; }
  function incident(g,label,weight,force) {
    if (!force && !witness(g,g.player)) return false;
    g.heat=clamp(g.heat+weight,0,9); g.stars=stars(g.heat); g.lastEvent=g.time;
    g.lastSeenAt=g.time; g.lastSeen=at(g.player.x,g.player.z,g.player.y);
    g.stats.incidents++; message(g,label); return true;
  }
  function pulse(g) {
    const p=g.player;
    if (g.car || !p.armed || g.time-g.gunAt<.34) return false;
    if (p.ammo<=0) { message(g,'信号弹用尽。可继续徒步或开车。'); return false; }
    p.ammo--; g.gunAt=g.time; p.a=g.view.yaw;
    const sx=Math.sin(p.a), sz=Math.cos(p.a), height=p.y+1.32, slope=M.aimSlope(g.view.pitch);
    let end=22, hit=null;
    for (let r=1;r<=22;r+=.65) if (!visible(p,at(p.x+sx*r,p.z+sz*r,p.y))) { end=r-.65; break; }
    g.people.concat(g.officers).forEach(e => {
      const dx=e.x-p.x,dz=e.z-p.z,t=dx*sx+dz*sz;
      const y=height+t*slope;
      if (e.until>g.time || t<.4 || t>end || y<e.y+.23 || y>e.y+1.91 || Math.abs(dx*sz-dz*sx)>.85 || !visible(p,e)) return;
      end=t; hit=e;
    });
    g.shot={ x:p.x,z:p.z,y:height, x1:p.x+sx*end,z1:p.z+sz*end,y1:height+end*slope,end:g.time+.18, hit:!!hit };
    if (hit) {
      hit.until=g.time+8; hit.state='stunned';
      const officer=g.officers.indexOf(hit)>=0;
      incident(g,officer ? '巡逻员受击 · 三星' : '路人受击 · 至少两星',officer?8:3.6,true);
    } else incident(g,'响声被听见 · 有人报警',2.15,false);
    scatter(g,p,25,5.5);
    return true;
  }
  function punch(g) {
    const p=g.player;
    if(g.car||p.armed||g.time-g.punchAt<.48) return false;
    g.punchAt=g.time;
    let target=null, limit=2.12;
    for(const e of g.people.concat(g.officers)) {
      const range=distance(p,e);
      if(range>=limit||e.until>g.time||Math.abs(e.y-p.y)>.77||Math.abs(turn(p.a,angle(p,e)))>.94||!visible(p,e)) continue;
      target=e;limit=range;
    }
    g.strike={start:g.time,end:g.time+.30,hit:!!target};
    if(target) {
      const a=angle(p,target);p.a=a;
      Object.assign(g.strike,{x:target.x,y:target.y+1.16,z:target.z});
      target.until=g.time+.72;target.state='stagger';target.a=angle(target,p);
      move(target,target.x+Math.sin(a)*.19,target.z+Math.cos(a)*.19,false);
      g.stats.punches++;
      const patrol=g.officers.includes(target);
      incident(g,patrol?'袭击巡逻员 · 已被发现':'斗殴被目击',patrol?4:2.0,true);
      scatter(g,p,9,2.2);
    }
    return true;
  }
  function scatter(g, source, radius, duration) {
    g.people.forEach(e => {
      if (e.until>g.time || !close(e,source,radius)) return;
      e.flee=angle(source,e)+ (random(g)-.5)*.6;
      e.fade=g.time+duration+random(g)*2;
      e.state='flee';
    });
    g.traffic.forEach(c => { if (close(c,source,radius+3)) c.scaredUntil=g.time+duration; });
  }
  function redAhead(c,g) {
    const sx=Math.sin(c.a),sz=Math.cos(c.a);
    const laneAxis=Math.abs(sx)>Math.abs(sz) ? 'x' : 'z';
    for (let i=0;i<M.junctions.length;i++) {
      const j=M.junctions[i], dx=j.x-c.x,dz=j.z-c.z;
      const along=dx*sx+dz*sz, cross=Math.abs(dx*sz-dz*sx);
      if (cross<4.8 && along>9.7 && along<19 && !M.signal(g.time,i,laneAxis)) return along;
    }
    return 0;
  }
  function redViolation(g,c) {
    M.junctions.forEach((j,i) => {
      const d=distance(j,c);
      if (d>15) g.redGate.delete(i);
      if (d>7.4 || g.redGate.has(i) || Math.abs(c.speed)<2.2 || c.y>1) return;
      g.redGate.add(i);
      const a=c.a+(c.speed<0 ? Math.PI:0);
      if (!M.signal(g.time,i,Math.abs(Math.sin(a))>Math.abs(Math.cos(a))?'x':'z')) incident(g,'闯红灯 · 有目击',1.1,false);
    });
  }
  function stepTowards(e,target,speed,dt,car) {
    const d=distance(e,target);
    if (d<.015) return true;
    const a=angle(e,target), k=Math.min(d,speed*dt);
    e.a=a;
    move(e,e.x+Math.sin(a)*k,e.z+Math.cos(a)*k,car);
    return d<=speed*dt+.04;
  }
  function traffic(g,e,dt) {
    const target=e.path[e.next];
    e.a=angle(e,target);
    let goal=e.police ? 5.4 : 7.6;
    const light=redAhead(e,g);
    if (light) goal=Math.min(goal,Math.max(0,(light-11.35)*1.8));
    if (e.scaredUntil>g.time) goal=Math.min(goal,1.85);
    const sx=Math.sin(e.a),sz=Math.cos(e.a);
    const trafficAll=g.traffic.concat(g.policeCars,g.free);
    for (let i=0;i<trafficAll.length+1;i++) {
      const q=i===trafficAll.length ? (g.car ? null : g.player) : trafficAll[i];
      if (!q || q===e || Math.abs(e.y-q.y)>.95) continue;
      const dx=q.x-e.x,dz=q.z-e.z;
      const along=dx*sx+dz*sz, side=Math.abs(dx*sz-dz*sx), onFoot=q===g.player;
      if (along>0 && along<10 && side<(onFoot?1.55:2.1)) {
        goal=Math.min(goal,Math.max(0,(along-(onFoot?3.2:4.85))*1.65));
        if ((q===g.car || onFoot) && along<7 && g.time-e.hornAt>4) { e.hornAt=g.time; g.stats.horns++; }
      }
    }
    e.speed+=clamp(goal-e.speed,-10*dt,3.6*dt);
    if (e.speed>.06 && stepTowards(e,target,e.speed,dt,true)) e.next=(e.next+1)%e.path.length;
  }
  function pedestrian(g,e,dt) {
    if (e.until>g.time) return;
    if (e.state==='flee' && e.fade>g.time) {
      const a=e.flee; e.a=a;
      const x=e.x,z=e.z; move(e,x+Math.sin(a)*3.15*dt,z+Math.cos(a)*3.15*dt,false);
      if (Math.hypot(e.x-x,e.z-z)<.012) e.flee+=1.23;
      return;
    }
    if(!e.path) {e.state='wait';return;}
    const target=e.path[e.next];
    const crossing=e.group===0 && ([2,6].includes(e.next));
    if (crossing && !M.onRoad(e) && M.signal(g.time,e.next===2 ? 1 : 4,'z')) { e.state='wait'; return; }
    e.state=crossing ? 'cross' : 'walk';
    const x=e.x,z=e.z;
    if (stepTowards(e,target,e.speed,dt,false)) e.next=(e.next+1)%e.path.length;
    if (Math.hypot(e.x-x,e.z-z)<.001) {
      const candidates=[e.a+1.1,e.a-1.1,e.a+2.1];
      for (let i=0;i<candidates.length;i++) {
        const a=candidates[i];
        if (move(e,x+Math.sin(a)*dt,z+Math.cos(a)*dt,false)) break;
      }
    }
  }
  function routeRoad(a,b) {
    const J=M.junctions;
    function projection(p) {
      let best=null;
      M.roadEdges.forEach(edge => {
        const n=J[edge[0]], m=J[edge[1]], xAxis=n.z===m.z;
        const x=xAxis?clamp(p.x,Math.min(n.x,m.x),Math.max(n.x,m.x)):n.x;
        const z=xAxis?n.z:clamp(p.z,Math.min(n.z,m.z),Math.max(n.z,m.z));
        const d=Math.hypot(p.x-x,p.z-z);
        if (!best || d<best.d) {
          best={ point:at(x,z), edge,d };
        }
      });
      return best;
    }
    const s=projection(a), f=projection(b);
    const d=J.map((n,i)=>s.edge.includes(i)?distance(n,s.point):Infinity), via=J.map(()=>-1), seen=new Set();
    for (let k=0;k<J.length;k++) {
      let idx=-1;
      J.forEach((n,i)=>{if (!seen.has(i)&&(idx<0||d[i]<d[idx])) idx=i;});
      seen.add(idx);
      M.roadEdges.forEach(pair=> {
        if (!pair.includes(idx)) return;
        const j=pair[0]===idx?pair[1]:pair[0], cost=d[idx]+distance(J[idx],J[j]);
        if (cost<d[j]) { d[j]=cost; via[j]=idx; }
      });
    }
    let i=f.edge.reduce((u,v)=>d[u]+distance(J[u],f.point)<d[v]+distance(J[v],f.point)?u:v);
    const path=[f.point];
    if (s.edge.every(x=>f.edge.includes(x))) return [s.point,f.point];
    while (i>=0) { path.unshift(J[i]); i=via[i]; }
    path.unshift(s.point); return path;
  }
  function police(g,dt) {
    const p=g.player, stopped=g.car&&Math.abs(g.car.speed)<.65;
    g.stoppedAt=stopped?(g.stoppedAt===undefined?g.time:g.stoppedAt):undefined;
    if (g.stars===3 && g.policeCars.length<2) {
      const entries=[at(-54,-81),at(54,81),at(54,-81),at(-54,81)];
      entries.sort((a,b)=>distance(b,p)-distance(a,p));
      const s=entries.find(e=>distance(e,p)>62 && (!visible(e,p) || Math.abs(turn(g.view.yaw,angle(p,e)))>1.2));
      if (s) {
        g.policeCars.push(Object.assign({ id:'unit2', a:s.z<0?0:Math.PI, speed:0, color:'#82a5ee', police:true, state:'respond', hornAt:-99 },s));
        g.stats.backup++;
      }
    }
    if (g.stars) {
      const canSee=g.officers.some(e=>e.until<=g.time && distance(e,p)<21 && visible(e,p)) ||
        (g.stars>=2 && g.policeCars.some(e=>!e.crew && distance(e,p)<30 && visible(e,p)));
      if (canSee) { g.lastSeenAt=g.time; g.lastSeen=at(p.x,p.z,p.y); }
      const lost=g.time-g.lastSeenAt;
      g.phase=lost>2.1 ? 'search' : g.stars===1 ? 'investigate' : 'pursuit';
      if (lost>6.2 && g.time-g.lastEvent>6.2) {
        g.heat=Math.max(0,g.heat-dt*.53); g.stars=stars(g.heat);
        if (!g.stars) message(g,'搜寻结束 · 通缉已解除');
      }
    }
    if (!g.stars) g.phase='patrol';
    g.policeCars.forEach(e=> {
      if (g.stars<2) {
        if (e.id==='unit2') { e.state='leave'; return; }
        if (e.crew || !e.path || e.state!=='patrol') {
          if (e.crew) {
            const k=g.officers.indexOf(e.crew); if (k>=0) g.officers.splice(k,1);
            e.crew=null;
          }
          e.path=trafficPaths[0];
          const returnPoint=routeRoad(e,e.path[1])[0];
          if (distance(returnPoint,e)>2.9) {
            e.state='return'; stepTowards(e,returnPoint,5.4,dt,true); return;
          }
          let j=0;
          e.path.forEach((p,i)=>{if(distance(e,p)<distance(e,e.path[j])) j=i;});
          e.next=j; e.state='patrol'; e.plan=null;
        }
        traffic(g,e,dt); return;
      }
      if (e.crew && g.car && !stopped && e.crew.until<=g.time) {
        if (distance(e,e.crew)<3) { g.officers.splice(g.officers.indexOf(e.crew),1); e.crew=null; }
      }
      if (e.crew) { e.speed=0; return; }
      const target=g.lastSeen;
      if (!target) return;
      e.state=g.phase;
      const d=distance(e,target);
      const streetEnd=e.plan && e.plan.length===0 && distance(e,target)<32 && distance(e.destination,target)<7;
      const onFoot=!g.car&&((d<13&&visible(e,target))||streetEnd);
      const heldVehicle=stopped&&g.time-g.stoppedAt>1.1&&distance(e,p)<10.5&&visible(e,p);
      if (onFoot||heldVehicle) {
        const actor={ id:e.id+'-crew', x:e.x,z:e.z,y:e.y,a:e.a,tint:'#91ace9',state:'pursuit',until:0,unit:e };
        const side=Math.PI/2;
        if (M.place(actor,e.x+Math.sin(e.a+side)*1.48,e.z+Math.cos(e.a+side)*1.48,false)||
            M.place(actor,e.x+Math.sin(e.a-side)*1.48,e.z+Math.cos(e.a-side)*1.48,false)) {
          g.officers.push(actor);e.crew=actor;e.speed=0;g.stats.footChase++;return;
        }
      }
      if (d>9 || !visible(e,target)) {
        if (!e.plan || distance(e.destination,target)>7 || (e.plan.length===0 && g.time-e.planAt>1.25)) {
          e.plan=routeRoad(e,target); e.destination=target; e.planAt=g.time;
        }
        const waypoint=e.plan[0];
        if (waypoint) {
          e.speed=10.1;
          if (distance(e,waypoint)<.48 || stepTowards(e,waypoint,e.speed,dt,true)) e.plan.shift();
        } else e.speed=0;
      } else if (g.car && d>4.0 && M.onRoad(e) && M.onRoad(target)) {
        e.speed=9.6; stepTowards(e,target,e.speed,dt,true);
      } else e.speed=0;
    });
    const extra=g.policeCars[1];
    if (extra && extra.state==='leave') {
      if (extra.crew) { const n=g.officers.indexOf(extra.crew); if(n>=0) g.officers.splice(n,1); extra.crew=null; }
      const exit=extra.x<0 ? at(-54,81) : at(54,81);
      if (!extra.exit) { extra.exit=routeRoad(extra,exit); extra.exit.push(exit); }
      if (extra.exit.length && stepTowards(extra,extra.exit[0],8,dt,true)) extra.exit.shift();
      if (!extra.exit.length) g.policeCars.pop();
    } else if(extra) extra.exit=null;
    let pressure=0;
    g.officers.forEach(e=> {
      if (e.until>g.time) return;
      if (g.stars && g.lastSeen && (e.unit || distance(e,g.lastSeen)<26 || e.engaged)) {
        e.engaged=true;
        if (e.unit && g.car && !stopped) { stepTowards(e,e.unit,4.1,dt,false); return; }
        const target=g.lastSeen;
        const d=distance(e,target);
        e.state=g.phase;
        if (d>1.65) {
          if (!visible(e,target)) {
            const x=e.x,z=e.z;
            if (!stepTowards(e,target,g.stars===1?2.3:4.0,dt,false) && Math.hypot(e.x-x,e.z-z)<.018) {
              const a=e.a+(e.id==='o0' ? -1.3 : 1.3);
              move(e,x+Math.sin(a)*3.7*dt,z+Math.cos(a)*3.7*dt,false);
            }
          } else stepTowards(e,target,g.stars===1?2.3:4.15,dt,false);
        }
        const range=distance(e,p), seen=range<10&&visible(e,p);
        if (g.stars>=2 && seen && range<(g.car?3.6:2.25) && (!g.car||stopped)) pressure=.37;
        if (!g.car&&g.stars>=2&&seen&&range>=2.25&&g.time-(e.replyAt||-99)>1.9 && g.time-(g.hitAt||-99)>1.1) {
          e.replyAt=g.time;g.hitAt=g.time;
          g.reply={x:e.x,y:e.y+1.1,z:e.z,x1:p.x,z1:p.z,end:g.time+.21};
          p.health=Math.max(0,p.health-24);
        }
      } else {
        e.state='patrol'; e.engaged=false;
        if (e.path && stepTowards(e,e.path[e.next],1.4,dt,false)) e.next=(e.next+1)%e.path.length;
      }
    });
    g.pressure=clamp(g.pressure+(pressure||-.73)*dt,0,1);
    if(p.health===0) endEncounter(g,'downed');
    else if(g.pressure===1) endEncounter(g,'arrested');
  }
  function endEncounter(g,kind) {
    if(g.car) g.car.speed=0;
    g.outcome=kind;
    if(kind==='arrested') g.stats.captures++;
    else {g.player.state='stunned';g.player.until=Infinity;g.stats.defeats++;}
  }
  function recover(g) {
    if(!g.outcome) return false;
    g.outcome=null;g.car=null;
    Object.assign(g.player,M.spawn,{ armed:false,ammo:12,health:100,state:'walk',until:0 });
    if (g.active && g.active.id==='garage') { g.active=null; g.free[1]=freshCar(prize); }
    if (!g.free.some(c=>close(c,M.spawn,10))) g.free[0]=freshCar(home);
    g.view.yaw=M.spawn.a; g.view.offset=0; g.view.pitch=0;
    g.stars=0; g.heat=0; g.pressure=0; g.phase='patrol'; g.lastSeen=null; g.pairs.clear(); g.redGate.clear();
    g.reply=null;g.shot=null;g.strike=null;g.stoppedAt=undefined;g.hitAt=-99;
    message(g,'回到雾灯便利 · 已完成的任务已保留',5);return true;
  }
  function drive(g,u,dt) {
    const c=g.car;
    const old=at(c.x,c.z,c.y);
    const brake=u.brake, throttle=u.gas && !brake;
    if (brake) c.speed=Math.max(-4.0,c.speed-(c.speed>0 ? 16 : 4.3)*dt);
    else if (throttle) c.speed=Math.min(11.5,c.speed+5.9*dt);
    else c.speed-=Math.sign(c.speed)*Math.min(Math.abs(c.speed),3.2*dt);
    c.a-=u.x*clamp(c.speed/2.5,-1,1)*(1.58-Math.max(0,Math.abs(c.speed)-5)*.057)*dt;
    if (!move(c,c.x+Math.sin(c.a)*c.speed*dt,c.z+Math.cos(c.a)*c.speed*dt,true)) c.speed*=.22;
    g.traffic.concat(g.policeCars,g.free).forEach(e=> {
      if (e===c || Math.abs(e.y-c.y)>1.45) return;
      const d=distance(c,e);
      const dx=e.x-c.x,dz=e.z-c.z, each=Math.abs(Math.sin(e.a-c.a));
      const along=Math.abs(dx*Math.sin(c.a)+dz*Math.cos(c.a)), side=Math.abs(dx*Math.cos(c.a)-dz*Math.sin(c.a));
      const touching=along<(3.65-.7*each) && side<(1.9+.83*each);
      if (touching) {
        if (!g.pairs.has(e.id)) {
          g.pairs.add(e.id);
          if (Math.abs(c.speed)>1.15 || Math.abs(e.speed||0)>2.7) {
            g.stats.collisions++; incident(g,'碰车 · 有目击',1.55,false);
          }
        }
        if (distance(old,e)>=d-.001) { c.x=old.x;c.z=old.z;c.y=old.y;c.speed*=.38; }
      } else if (d>5.2) g.pairs.delete(e.id);
    });
    Object.assign(g.player,{x:c.x,z:c.z,y:c.y,a:c.a});
    if (g.active && g.active.id==='garage' && g.active.stage==='take' && c.id==='roof' &&
      g.active.launch && distance(c,g.active.launch)>.65) {
      g.active.stage='escape'; incident(g,'标记车已驶离车位 · 两星',4.2,true);
    }
    redViolation(g,c);
    if (!M.onRoad(c) && Math.abs(c.speed)>2.6 && g.time-(g.lastFright||-99)>.8) {
      scatter(g,c,6.5,2.7); g.lastFright=g.time;
    }
  }
  const PERSON_GAP=.60, CAR_HALF_W=1.04, CAR_HALF_L=1.87, PERSON_R=.30;
  function remember(body) {body.prevX=body.x;body.prevZ=body.z;body.prevY=body.y;}
  function vehicleContact(person,car) {
    if(Math.abs(person.y-car.y)>.85) return null;
    const s=Math.sin(car.a), c=Math.cos(car.a), dx=person.x-car.x, dz=person.z-car.z;
    const x=dx*c-dz*s,z=dx*s+dz*c;
    const nx=x-clamp(x,-CAR_HALF_W,CAR_HALF_W),nz=z-clamp(z,-CAR_HALF_L,CAR_HALF_L);
    const d=Math.hypot(nx,nz);
    if(d>=PERSON_R) return null;
    const side=Math.sign(x)||1,end=Math.sign(z)||1;
    return {s,c,x,z,side,end};
  }
  function resolvePeople(g) {
    const people=g.people.concat(g.officers);
    if(!g.car) people.push(g.player);
    const cars=g.free.concat(g.traffic,g.policeCars);
    let bumped=null;
    people.forEach(e=>{if(e.impactCar&&distance(e,e.impactCar)>3.2)e.impactCar=null;});
    for(let pass=0;pass<3;pass++) {
      let adjusted=false;
      for(let i=0;i<people.length;i++) for(let j=i+1;j<people.length;j++) {
        const a=people[i],b=people[j], dx=b.x-a.x,dz=b.z-a.z;
        if(Math.abs(a.y-b.y)>.8||Math.abs(dx)>=PERSON_GAP||Math.abs(dz)>=PERSON_GAP) continue;
        const d=Math.hypot(dx,dz);if(d>=PERSON_GAP) continue;
        adjusted=true;
        const ux=d>1e-5?dx/d:1,uz=d>1e-5?dz/d:0, delta=(PERSON_GAP-d)*.51;
        const aMoved=M.place(a,a.x-ux*delta,a.z-uz*delta,false);
        const bMoved=M.place(b,b.x+ux*delta*(aMoved?1:2),b.z+uz*delta*(aMoved?1:2),false);
        if(aMoved&&!bMoved) M.place(a,a.x-ux*delta,a.z-uz*delta,false);
      }
      for(let i=0;i<people.length;i++) for(let j=0;j<cars.length;j++) {
        const person=people[i],car=cars[j];
        if(Math.abs(person.x-car.x)>2.5||Math.abs(person.z-car.z)>2.5) continue;
        const hit=vehicleContact(person,car);
        if(!hit) continue;
        adjusted=true;
        const {s,c,x,z,side,end}=hit;
        const sideEdge=side*(CAR_HALF_W+PERSON_R+.012), endEdge=end*(CAR_HALF_L+PERSON_R+.012);
        const place=(u,v)=>M.place(person,car.x+u*c+v*s,car.z+v*c-u*s,false);
        const preferSide=Math.abs(sideEdge-x)<=Math.abs(endEdge-z)||(!car.police&&person!==g.player&&person.path&&Math.abs(car.speed)>1.0);
        const moved=preferSide?(place(sideEdge,z)||place(x,endEdge)):(place(x,endEdge)||place(sideEdge,z));
        if(!moved) {
          if(person.prevX!==undefined) M.place(person,person.prevX,person.prevZ,false);
          if(vehicleContact(person,car)&&car.prevX!==undefined) {
            car.x=car.prevX;car.z=car.prevZ;car.y=car.prevY;
          }
        }
        if(car===g.car&&Math.abs(car.speed)>2.2&&person.until<=g.time&&person.impactCar!==car) {
          person.impactCar=car;person.a=angle(car,person)+Math.PI/2;
          person.until=g.time+2.8;person.state='stunned';g.stats.impacts++;bumped=person;
          incident(g,'车辆撞到路人 · 有目击',2.15,false);
        }
        if(moved&&person!==g.player&&person.path&&!car.police&&person.until<=g.time&&Math.abs(car.speed)>1.0) {
          person.flee=angle(car,person);person.fade=g.time+1.2;person.state='flee';
        }
        if(!moved||car===g.car||person===g.player) car.speed*=.34;
        else if(car.path&&!car.police) car.speed*=.8;
      }
      if(!adjusted) break;
    }
    if(g.car) Object.assign(g.player,{x:g.car.x,z:g.car.z,y:g.car.y});
    if(bumped) scatter(g,bumped,8,2.6);
  }
  function step(g,input,dt) {
    if(g.outcome) return;
    remember(g.player);g.people.forEach(remember);g.officers.forEach(remember);
    g.free.forEach(remember);g.traffic.forEach(remember);g.policeCars.forEach(remember);
    const u=input||{};
    const ix=clamp(u.x||0,-1,1), iz=clamp(u.z||0,-1,1);
    g.time+=dt;
    if (u.door) door(g);
    if (u.task) task(g);
    if (u.arm && !g.car) {
      g.player.armed=!g.player.armed;
      if (g.player.armed && !g.hints.arm) {g.hints.arm=true;message(g,'拖右侧准星瞄准，「发射」一次只用一枚。',4.7);}
    }
    const v=g.view, p=g.player;
    p.walking=false;p.run=false;
    v.offset=clamp(v.offset-(u.lookX||0),-3.14,3.14);
    v.pitch=clamp(v.pitch+(u.lookY||0),-.67,.60);
    if (g.car) {
      drive(g,{x:u.steer===undefined?ix:clamp(u.steer,-1,1),gas:u.gas,brake:u.brake},dt);
      if (!u.looking) v.offset*=Math.max(0,1-dt*1.8);
      v.yaw+=turn(v.yaw,g.car.a+v.offset)*Math.min(1,dt*6.2);
    } else {
      if (u.lookX) v.yaw-=u.lookX;
      const magnitude=clamp(Math.hypot(ix,iz),0,1);
      if (magnitude>.08) {
        const a=v.yaw-Math.atan2(ix,iz), speed=magnitude<.61 ? 3.15*magnitude/.61 : 3.15+(magnitude-.61)*7.2;
        const px=p.x,pz=p.z;
        move(p,px+Math.sin(a)*speed*dt,pz+Math.cos(a)*speed*dt,false);
        p.walking=Math.hypot(p.x-px,p.z-pz)>.004;p.run=magnitude>.75;
        if (!p.armed) p.a=a;
        if (!p.armed && !u.looking && Math.abs(ix)<.38 && iz>.5) v.yaw+=turn(v.yaw,p.a)*dt*2.1;
      }
      if (p.armed) p.a=v.yaw;
      if (u.fire) pulse(g);
      if (u.punch) punch(g);
    }
    if(!g.car) {
      const ride=!g.hints.door||!g.hints.steal?nearRide(g):null;
      if(ride&&ride.occupied&&!g.hints.steal) {g.hints.steal=true;message(g,'慢车旁可以「抢车」，会引来巡逻员。',4.6);}
      else if(ride&&!ride.occupied&&!g.hints.door) {g.hints.door=true;message(g,'车门在手边。点「上车」，慢下来才能下车。',4.8);}
    }
    g.traffic.forEach(e=>traffic(g,e,dt));
    g.people.forEach(e=>pedestrian(g,e,dt));
    police(g,dt);
    resolvePeople(g);
    if(!g.outcome) updateTasks(g);
  }
  N.Game={create,step,STEP,nearCar,nearRide,interaction,taskText,restoreCompletions,routeRoad,message,recover};
  if (typeof module!=='undefined' && module.exports) module.exports=N.Game;
})(typeof window === 'undefined' ? global : window);
