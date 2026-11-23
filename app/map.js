(function (out) {
  'use strict';
  const N = out.District = out.District || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angle = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const box = (x0, z0, x1, z1, h, color, y) => ({ x0, z0, x1, z1, h, color, y: y || 0 });
  const spawn = { x: -45.6, z: -45.9, y: 0, a: 1.43 };
  const startCar = { x: -40, z: -47, y: 0, a: Math.PI / 2 };
  const markedCar = { x: 35, z: 21, y: 4.2, a: 0 };
  const buildings = [
    box(-45,-39,-31,-28,5.4,'#27585b'), box(-43,-24,-29,-11,9.6,'#4e415c'),
    box(-22,-45,-6,-24,13,'#333d64'), box(-22,-21,-7,-9,8.5,'#3b4664'),
    box(0,-44,17,-27,10,'#514461'),
    box(4,-32,21,-18,15,'#3b394d'), box(33,-30,42,-15,5,'#5b344a'),
    box(-43,11,-32,36,11,'#2f475d'), box(-22,12,-7,29,14,'#335659'),
    box(-29,36,-13,43,5,'#31575b'), box(-2,10,12,34,11,'#444265'),
    box(-45,65,-29,76,7,'#295151'), box(-19,66,0,73,6,'#394b63'),
    box(9,66,28,78,10,'#494663'), box(34,65,49,76,7,'#3d415c'),
    box(-44,-76,-29,-64,10,'#383c58'), box(-19,-77,2,-65,14,'#413b56'),
    box(7,-75,23,-65,10,'#553d55'), box(32,-76,47,-66,7,'#5d3c50'),
    box(65,-40,76,-19,10,'#4d4662'), box(65,15,77,34,12,'#3f3b5e')
  ];
  const stalls = [
    box(23,-40,27,-37,2.5,'#ab5262'), box(30,-40,34,-37,2.5,'#b8683e'),
    box(38,-40,42,-37,2.5,'#ba4f49'), box(27,-22,30,-18,2.5,'#a45457'),
    box(23,-17,26,-13,2.5,'#99724c'), box(32,-12,37,-9,2.5,'#ae6946')
  ];
  const roof = { x0: 23, z0: 12, x1: 43, z1: 32, y: 4.2 };
  const ramp = { x0: 30, z0: 32, x1: 41, z1: 48, y: 4.2 };
  const stairs = { x0: 19.5, z0: 13, x1: 23, z1: 32, y: 4.2, steps: 18 };
  const underpass = { x0: -74, z0: 30, x1: -68, z1: 77, y: -3.2 };
  const rails = [
    box(22.7,11.7,43.3,12.15,0.9,'#5b668c',4.1), box(42.8,12,43.3,32.3,0.9,'#5b668c',4.1),
    box(22.75,17.2,23.2,32,0.85,'#657195',4.1), box(23,31.8,30,32.3,0.9,'#5b668c',4.1),
    box(41,31.8,43,32.3,0.9,'#5b668c',4.1)
  ];
  const alleys = [{ x: -25.5, width: 6.4, entries: [-47.5, -9] }, { x: 46, width: 5.7, entries: [8, 46] }];
  const bollards = [];
  alleys.forEach(lane => lane.entries.forEach(z => [-3.58, -1.18, 1.18, 3.58].forEach(offset => {
    const x = lane.x + offset;
    bollards.push(box(x - 0.19,z - 0.22,x + 0.19,z + 0.22,0.95,'#deb668'));
  })));
  const garageBase = box(23,12,43,32,4.15,'#485572');
  const bridgeRails = [50,58].map(z=>box(-84,z-.13,-64,z+.13,.76,'#67778c'));
  const blockers = buildings.concat(stalls, rails, bollards, bridgeRails, [garageBase]);
  const cameraBlockers = blockers.concat([box(-84,50,-64,58,.62,'#67677c',-.62)]);
  const points = {
    delivery: { x: -39, z: -41, y: 0, name: '顺路送一单' },
    market: { x: 36, z: -34, y: 0, name: '夜市摊位' },
    graffiti: { x: -63, z: 37, y: 0, name: '桥下的三幅涂鸦' },
    garage: { x: 26, z: 15, y: 4.2, name: '停车楼取车' },
    meet: { x: -63, z: 69, y: 0, name: '河边集合点' }
  };
  const paintings = [{ x: -73.7, z: 42, y: -2.56 }, { x: -73.7, z: 54, y: -3.2 }, { x: -73.7, z: 66, y: -2.55 }];
  const signs = [
    { x: -39, z: -39.15, y: 3.85, name: '雾灯便利', tint: '#a6ffd2' },
    { x: 36, z: -39, y: 4.5, name: '砂糖夜市', tint: '#ffd19a' },
    { x: 31, z: 32.45, y: 3.3, name: '折线车库', tint: '#c5c5ff' },
    { x: -64, z: 64, y: 3.2, name: '蓝汐河岸', tint: '#9aeaf8' }
  ];
  const loop = [{ x: -54, z: -54 }, { x: 54, z: -54 }, { x: 54, z: 54 }, { x: -54, z: 54 }];
  const junctions = loop.concat([{ x: 54, z: 0 }, { x: -54, z: 0 }]);
  const roadEdges = [[0,1],[1,4],[4,2],[2,3],[3,5],[5,0],[4,5]];
  const inside = (x, z, b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  function riverHeight(z) {
    return -3.2 * clamp(Math.min((z - 30) / 15, (77 - z) / 14), 0, 1);
  }
  function surface(x, z, y, car) {
    if (inside(x, z, underpass) && !(z >= 50 && z <= 58 && y > -1.5)) {
      if (car) return null;
      return riverHeight(z);
    }
    if (inside(x, z, ramp)) return ramp.y * (ramp.z1 - z) / (ramp.z1 - ramp.z0);
    if (inside(x, z, stairs)) {
      if (car) return null;
      const t = clamp((stairs.z1 - z) / (stairs.z1 - stairs.z0), 0, 1);
      return Math.min(stairs.steps, Math.floor(t * (stairs.steps + 2))) * stairs.y / stairs.steps;
    }
    if (inside(x, z, roof) && y >= roof.y - 0.5) return roof.y;
    return 0;
  }
  function place(body, x, z, car) {
    const heading=body.a||0, s=Math.abs(Math.sin(heading)), c=Math.abs(Math.cos(heading));
    const rx=car ? 1.04*c+1.87*s : 0.32, rz=car ? 1.04*s+1.87*c : 0.32;
    if (x < -82 || x > 82 || z < -82 || z > 82 || (x < -74 + rx && (z < 50+rz || z > 58-rz || body.y < -1.5))) return false;
    if (car && alleys.some(a=>Math.abs(x-a.x)<a.width/2 && z>a.entries[0] && z<a.entries[1])) return false;
    const y = surface(x, z, body.y, car);
    if (y === null || Math.abs(y - body.y) > 0.42) return false;
    if (car && ((inside(x, z, ramp) && (x < ramp.x0+rx || x > ramp.x1-rx)) ||
      (inside(x, z, roof) && (x < roof.x0+rx || x > roof.x1-rx || z < roof.z0+rz)))) return false;
    for (let i = 0; i < blockers.length; i++) {
      const b = blockers[i];
      if (b === garageBase && inside(x,z,ramp)) continue;
      if (y + 1.2 > b.y && y + 0.018 < b.y + b.h &&
        x + rx > b.x0 && x - rx < b.x1 && z + rz > b.z0 && z - rz < b.z1) return false;
    }
    body.x = x; body.z = z; body.y = y;
    return true;
  }
  function move(body, x, z, car) {
    if (place(body, x, z, car)) return true;
    if (!car) {
      if (x !== body.x) place(body, x, body.z, false);
      if (z !== body.z) place(body, body.x, z, false);
    }
    return false;
  }
  function visible(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    if (Math.abs((a.y || 0) - (b.y || 0)) > 2.6) return false;
    for (let i = 0; i < blockers.length; i++) {
      const c = blockers[i];
      if (c.h < 1.4 || Math.min(a.y || 0, b.y || 0) + 1.35 >= c.y + c.h) continue;
      let lo = 0, hi = 1;
      if (!dx && (a.x <= c.x0 || a.x >= c.x1)) continue;
      if (!dz && (a.z <= c.z0 || a.z >= c.z1)) continue;
      if (dx) {
        const a0 = (c.x0 - a.x)/dx, a1 = (c.x1 - a.x)/dx;
        lo = Math.max(lo, Math.min(a0,a1)); hi = Math.min(hi, Math.max(a0,a1));
      }
      if (dz) {
        const a0 = (c.z0 - a.z)/dz, a1 = (c.z1 - a.z)/dz;
        lo = Math.max(lo, Math.min(a0,a1)); hi = Math.min(hi, Math.max(a0,a1));
      }
      if (lo < hi && hi > 0.02 && lo < 0.98) return false;
    }
    return true;
  }
  function clearFraction(from, to, margin) {
    const dx=to[0]-from[0], dy=to[1]-from[1], dz=to[2]-from[2];
    let clear=1;
    for(let i=0;i<cameraBlockers.length;i++) {
      const b=cameraBlockers[i];
      let enter=0, leave=clear;
      // Intersect in all three dimensions; a bridge can be clear below but not through its deck.
      for(let axis=0;axis<3;axis++) {
        const start=from[axis], d=axis===0?dx:axis===1?dy:dz;
        const lo=(axis===0?b.x0:axis===1?b.y:b.z0)-margin;
        const hi=(axis===0?b.x1:axis===1?b.y+b.h:b.z1)+margin;
        if(Math.abs(d)<1e-6) { if(start<lo||start>hi) {enter=1;leave=0;break;} }
        else {
          const a=(lo-start)/d, c=(hi-start)/d;
          enter=Math.max(enter,Math.min(a,c));leave=Math.min(leave,Math.max(a,c));
          if(enter>leave) break;
        }
      }
      if(enter<=leave) clear=enter;
    }
    return clear;
  }
  const aimSlope = pitch => -.42*pitch;
  function signal(time, i, axis) { return ((time + (i === 1 ? 0 : i * 2)) % 22 < 11) === (axis === 'x'); }
  function onRoad(b) {
    return (Math.abs(Math.abs(b.x) - 54) < 6 && Math.abs(b.z) < 83) ||
      (Math.min(Math.abs(b.z), Math.abs(Math.abs(b.z) - 54)) < 6 && Math.abs(b.x) < 61);
  }
  function area(b) {
    if (b.x < -62 || (b.x < 0 && b.z > 40)) return '蓝汐河岸';
    if (b.z < -9) return b.x < 0 ? '雾灯便利' : '砂糖夜市';
    return b.x >= 15 && b.z > 9 ? '折线车库' : '街心支路';
  }
  N.Map = { clamp, distance, angle, turn, box, spawn, startCar, markedCar, buildings, stalls, rails, bollards, bridgeRails,
    roof, ramp, stairs, underpass, points, paintings, signs, loop, junctions, roadEdges, alleys, riverHeight,
    inside, surface, place, move, aimSlope, signal, visible, clearFraction, onRoad, area };
  if (typeof module !== 'undefined' && module.exports) module.exports = N.Map;
})(typeof window === 'undefined' ? global : window);
