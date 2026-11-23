(function (out) {
  'use strict';
  const N=out.District=out.District||{}, M=N.Map || (typeof module!=='undefined' && require('./map.js'));
  const RAD=Math.PI/180;
  const fog=[.039,.061,.119];
  const asphalt='#22283e', paving='#35364d', line='#b1a293';
  const colorCache={};
  function rgb(s) {
    if (!colorCache[s]) colorCache[s]=[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255];
    return colorCache[s];
  }
  function tri(a,p,q,r,c,f) {
    for(let i=0;i<3;i++) {
      const v=i===0?p:i===1?q:r;
      a.push(v[0],v[1],v[2],c[0]*f,c[1]*f,c[2]*f);
    }
  }
  function quad(a,p,q,r,s,c,f) { tri(a,p,q,r,c,f); tri(a,p,r,s,c,f); }
  function flat(a,x,z,w,d,y,tint,slope) {
    const y2=slope===undefined?y:slope;
    quad(a,[x,y,z],[x+w,y,z],[x+w,y2,z+d],[x,y2,z+d],rgb(tint),1);
  }
  function block(a,x,y,z,w,h,d,tint,yaw) {
    const s=Math.sin(yaw||0),c=Math.cos(yaw||0), t=rgb(tint), hw=w*.5,hd=d*.5;
    const v=(u,v,h)=>[x+u*c+v*s,y+h,z+v*c-u*s];
    const p=v(-hw,-hd,0),q=v(hw,-hd,0),r=v(hw,hd,0),l=v(-hw,hd,0);
    const P=v(-hw,-hd,h),Q=v(hw,-hd,h),R=v(hw,hd,h),L=v(-hw,hd,h);
    quad(a,P,Q,R,L,t,1.12); quad(a,p,q,Q,P,t,.83); quad(a,q,r,R,Q,t,.70);
    quad(a,r,l,L,R,t,.56); quad(a,l,p,P,L,t,.93); quad(a,p,l,r,q,t,.48);
  }
  function world() {
    const batches={};
    function layer(x,z,detail) {
      const ix=Math.floor((x+84)/28),iz=Math.floor((z+84)/28), key=ix+'/'+iz+'/'+detail;
      if (!batches[key]) batches[key]={x:ix*28-70,z:iz*28-70,detail,data:[]};
      return batches[key].data;
    }
    const tile=(x,z,w,d,y,tint,detail)=>flat(layer(x+w/2,z+d/2,detail||0),x,z,w,d,y,tint);
    const geom=(x,y,z,w,h,d,tint,detail)=>block(layer(x,z,detail||0),x,y,z,w,h,d,tint);
    const item=(b,detail)=>geom((b.x0+b.x1)/2,b.y,(b.z0+b.z1)/2,b.x1-b.x0,b.h,b.z1-b.z0,b.color,detail);
    for(let x=-84;x<84;x+=4) for(let z=-84;z<84;z+=4) {
      if(x < -76) tile(x,z,4,4,-3.48,'#233c57');
      else if(x===-76 || (x===-72 && z>=28 && z<80)) {
        if(x===-76 && (z<28||z>=80)) tile(x,z,4,4,0,'#2b4a57');
        else flat(layer(x,z,0),x,z,4,4,M.riverHeight(z),'#354b56',M.riverHeight(z+4));
      } else {
        const t = M.onRoad({x:x+2,z:z+2}) ? asphalt : paving;
        tile(x,z,4,4,-.035,t);
      }
    }
    // Wet lane markings and luminous reflections are static painted geometry.
    for(let i=-49;i<50;i+=6) {
      [54,-54,0].forEach(z=>tile(i,z-.07,2.5,.14,.014,line));
      [-54,54].forEach(x=>tile(x-.07,i,.14,2.5,.014,line));
    }
    [-54,54,0].forEach(z=>{
      [-6,6].forEach(o=>tile(-61,z+o-.06,122,.12,.018,'#696273'));
    });
    [-54,54].forEach(x=>[-6,6].forEach(o=>tile(x+o-.06,-82,.12,164,.018,'#696273')));
    [-44,-15].forEach(z=>{for(let x=48.8;x<60;x+=1.35) tile(x,z-.64,.65,1.28,.024,'#c0b2a7');});
    [-54,54].forEach(x=>[-54,54].forEach(z=>{for(let i=-4.8;i<5;i+=1.28) {
      tile(x+(x<0?8:-9.4),z+i,1.4,.58,.021,'#9d9290');
    }}));
    M.alleys.forEach(l=>{
      const a=l.entries[0], b=l.entries[1];
      tile(l.x-2.15,a,4.3,b-a,.031,'#53616a');
      for(let z=a+.5;z<b;z+=2) tile(l.x-.72,z,1.45,.11,.033,'#89958e');
    });
    function pitched(x0,z0,x1,z1,y,rise,left,right) {
      const x=(x0+x1)/2, a=layer(x,(z0+z1)/2,0);
      quad(a,[x0,y,z0],[x,y+rise,z0],[x,y+rise,z1],[x0,y,z1],rgb(left),.94);
      quad(a,[x,y+rise,z0],[x1,y,z0],[x1,y,z1],[x,y+rise,z1],rgb(right),1);
      tri(a,[x0,y,z0],[x1,y,z0],[x,y+rise,z0],rgb(right),.58);
      tri(a,[x0,y,z1],[x1,y,z1],[x,y+rise,z1],rgb(left),.69);
    }
    function strip(x,z,y,width,color) {geom(x,y,z,width,.19,.16,color);}
    function storefront(b) {
      const x=(b.x0+b.x1)/2,w=b.x1-b.x0,d=b.z1-b.z0,z=(b.z0+b.z1)/2;
      geom(x,b.h,z,w+.75,.36,d+.65,'#526b66');
      for(const end of [b.z0-.08,b.z1+.08]) {
        strip(x,end,3.02,w,'#f4c383');strip(x,end,4.96,w,'#7ca996');
        for(const dx of [-4.5,-2.25,2.25,4.5]) {
          geom(x+dx,.25,end,1.82,2.19,.12,'#507472');
          geom(x+dx,.52,end-.08,1.36,.67,.10,'#79c0a1',1);
          geom(x+dx,1.49,end-.08,1.50,.85,.10,'#a2b895',1);
        }
      }
      for(const xx of [b.x0-.06,b.x1+.06]) geom(xx,2.4,z,.11,.27,d,'#d6a179');
      geom(x,b.h+.36,z,3.8,1.12,2.4,'#485855',1);
    }
    function apartment(b,i) {
      const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,w=b.x1-b.x0,d=b.z1-b.z0;
      const trim=i%2?'#a67871':'#768998', dark=i%2?'#463849':'#393e52';
      geom(x,b.h,z,w+.36,.27,d+.34,trim);geom(x-.8,b.h+.27,z,w*.53,.98,d*.53,dark);
      for(const dz of [b.z0-.055,b.z1+.055]) {
        geom(x,.2,dz,w*.91,1.1,.13,dark);
        for(let y=2.45;y<b.h-.6;y+=2.65) {
          strip(x,dz,y-.15,w,trim);
          for(let xx=b.x0+1.4;xx<b.x1-.6;xx+=3.1) {
            geom(xx,y+.16,dz,1.1,1.38,.13,(Math.floor(xx+y+i)%3===0)?'#cea987':'#54708a',1);
            if((Math.floor(xx+i)%2)===0) {
              geom(xx,y-.21,dz,1.74,.12,.63,dark,1);
              geom(xx,y+.11,dz+(dz<z?-.27:.27),1.74,.075,.09,trim,1);
            }
          }
        }
      }
      for(const xx of [b.x0-.055,b.x1+.055]) {
        const face=xx<x?-1:1;
        geom(xx,.25,z,.13,1.08,d*.94,dark);
        for(const corner of [b.z0+.22,b.z1-.22]) geom(xx,.18,corner,.18,b.h-.35,.27,trim);
        for(let y=2.65;y<b.h-1;y+=2.7) {
          geom(xx,y-.20,z,.13,.17,d*.96,trim);
          for(let zz=b.z0+1.6;zz<b.z1-.7;zz+=2.85) {
            geom(xx,y,zz,.12,1.25,1.14,(Math.floor(zz+y+i)%4===0)?'#b89277':'#64768d',1);
            if(Math.floor(zz+i)%3===0) {
              geom(xx+face*.18,y-.39,zz,.46,.13,1.68,dark,1);
              geom(xx+face*.37,y-.07,zz,.095,.08,1.65,trim,1);
            }
          }
        }
      }
    }
    function townhouse(b,i) {
      const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,w=b.x1-b.x0,d=b.z1-b.z0;
      const count=Math.max(2,Math.round(w/4.7)), span=w/count;
      for(let n=0;n<count;n++) {
        const lo=b.x0+n*span,hi=lo+span,xx=(lo+hi)/2;
        pitched(lo-.12,b.z0-.24,hi+.12,b.z1+.24,b.h,1.15+(n%2)*.65,'#78686b','#9b7764');
        for(const end of [b.z0-.065,b.z1+.065]) {
          geom(lo+.16,0,end,.20,b.h,.14,'#85958d');
          geom(xx,.29,end,.86,1.84,.15,'#416162');
          for(let y=2.45;y<b.h-.58;y+=2.2) {
            geom(xx,y,end,span*.56,.88,.16,(n+i)%2?'#d5a77f':'#719896',1);
            strip(xx,end-.018,y-.16,span*.62,'#839d91');
          }
        }
      }
      for(const side of [b.x0-.05,b.x1+.05]) {
        geom(side,2.28,z,.12,.15,d,'#739188');
        for(let zz=b.z0+1;zz<b.z1-.4;zz+=2.6) geom(side,2.62,zz,.11,.98,.62,'#98a598',1);
      }
      geom(x-1,b.h+.42,z,.55,1.94,.52,'#584947',1);
    }
    function workshop(b,i) {
      const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,w=b.x1-b.x0,d=b.z1-b.z0;
      pitched(b.x0-.12,b.z0-.12,b.x1+.12,b.z1+.12,b.h,1.54,'#465987','#57608b');
      for(const end of [b.z0-.06,b.z1+.06]) {
        strip(x,end,1.84,w,'#8598ad');strip(x,end,b.h-.40,w,'#427a8b');
        for(let xx=b.x0+2;xx<b.x1-1;xx+=4.7) {
          geom(xx,1.86,end,2.95,Math.min(2.0,b.h-2.1),.12,'#496477');
          geom(xx,2.27,end-.071,2.69,.83,.09,i%2?'#80b2bd':'#ad886b',1);
        }
      }
      for(const side of [b.x0-.06,b.x1+.06]) {
        geom(side,b.h-.37,z,.13,.22,d,'#5b93a3');
        for(let zz=b.z0+1;zz<b.z1;zz+=3.1) geom(side,.2,zz,.13,b.h-.47,.13,'#687d9a',1);
      }
    }
    const styles=['shop','town','residence','workshop','residence','workshop','shop','workshop','residence','town','workshop','town','town','residence','town','residence','residence','workshop','town','residence','workshop'];
    M.buildings.forEach((b,i)=>{
      item(b);
      ({shop:storefront,town:townhouse,residence:apartment,workshop})[styles[i]](b,i);
    });
    for(let i=0;i<25;i++) {
      const t=i/25,x=-43+i*.34,z=-43-(i%5)*.78;
      tile(x,z,.13+.18*(1-t),1.6+t*2.7,.021,i%3===0?'#56636b':'#3b4a5b',1);
    }
    geom(-39,.09,-39.19,1.65,2.12,.12,'#c2ecbf');
    geom(-39,2.59,-39.85,12.9,.23,2.1,'#a0e1b7');
    for(let i=0;i<12;i++) geom(-45+i*1.08,2.56,-40.93,.49,.20,.12,i%2?'#e9bc81':'#7ea391');
    tile(-44,-42,10,2,.022,'#355c5a'); tile(-41,-45,3,1.75,.023,'#536663');
    M.stalls.forEach((b,i)=>{
      const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,w=b.x1-b.x0,d=b.z1-b.z0;
      geom(x,0,z,w,1.01,d,b.color);geom(x,1.01,z,w+.38,.15,d+.25,'#d6a27d');
      for(const xx of [b.x0+.13,b.x1-.13]) for(const zz of [b.z0+.12,b.z1-.12]) geom(xx,1.16,zz,.13,1.36,.13,'#895f55');
      pitched(b.x0-.42,b.z0-.42,b.x1+.42,b.z1+.42,2.53,.70,i%2?'#cd7d5c':'#88435a',i%2?'#ffb875':'#e69885');
      for(let j=0;j<4;j++) geom(b.x0+.42+j*.85,1.18,b.z1-.26,.36,.22+(j%2)*.14,.38,j%2?'#d8a66e':'#9eaf79',1);
    });
    for(const z of [-37,-29]) {
      geom(34.5,4.47,z,19,.045,.05,'#745564',1);
      for(let i=0;i<9;i++) {
        const x=26+i*2.1,y=4.02+Math.abs(i-4)*.047;
        geom(x,y+.41,z,.037,.29,.035,'#94806d',1);
        geom(x,y,z,.30,.39,.30,i%2?'#f1a271':'#ffc48b',1);
        geom(x,y+.05,z,.39,.26,.39,i%2?'#cc6661':'#ef9a71',1);
      }
    }
    for(let x=24;x<44;x+=4) tile(x,-33.6,2.7,4.1,.028,x%8?'#6e5457':'#594957',1);
    const R=M.roof, B=M.ramp, S=M.stairs;
    geom((R.x0+R.x1)/2,0,(R.z0+R.z1)/2,R.x1-R.x0,4.19,R.z1-R.z0,'#5c6381');
    tile(R.x0,R.z0,R.x1-R.x0,R.z1-R.z0,R.y,'#5c6989');
    for(let x=24;x<42;x+=4) {
      for(const z of [11.95,32.05]) {
        geom(x,1.07,z,2.8,1.52,.16,'#2c3d57');
        geom(x,2.47,z,.27,.17,.18,'#8bd6e5',1);
        geom(x-1.76,.12,z,.35,3.8,.21,'#9aa7ae');
      }
      tile(x,17,.14,6,R.y+.015,'#d0c0ae');
    }
    geom(33,3.48,11.93,20.2,.27,.13,'#6bc0d2');
    geom(26.4,3.14,32.09,5.9,.26,.14,'#7bc7d4');geom(42,3.14,32.09,1.9,.26,.14,'#7bc7d4');
    const rampMesh=layer(35,41,0), g='#6a7189';
    flat(rampMesh,B.x0,B.z0,B.x1-B.x0,B.z1-B.z0,B.y,g,0);
    [B.x0,B.x1].forEach(x=>quad(rampMesh,[x,0,B.z0],[x,B.y,B.z0],[x,0,B.z1],[x,-.03,B.z1],rgb('#3f4b68'),1));
    for(let z=B.z0;z+1.15<B.z1;z+=2.15) {
      const y=B.y*(B.z1-z)/(B.z1-B.z0);
      flat(rampMesh,34.93,z,.17,1.15,y+.018,'#d1bea2',y+.018-B.y*1.15/(B.z1-B.z0));
      [B.x0+.13,B.x1-.13].forEach(x=>geom(x,y,z,.24,.7,.24,'#9a99b2'));
    }
    for(let i=0;i<S.steps+2;i++) {
      const dz=(S.z1-S.z0)/(S.steps+2), z=S.z1-(i+.5)*dz, y=Math.max(.03,Math.min(i,S.steps)*S.y/S.steps);
      geom((S.x1+S.x0)/2,0,z,S.x1-S.x0,y,dz+.006,i%2?'#8187a0':'#747e99');
      if(i%3===0) geom(S.x0+.07,y,z,.14,.65,.16,'#9998af');
    }
    M.rails.forEach(b=>item(b)); M.bollards.forEach(b=>item(b));
    // The bridge deck is rendered separately from the footway below it.
    geom(-74,-.62,54,20,.62,8,'#67677c');
    M.bridgeRails.forEach(b=>item(b));
    [-80,-75.4].forEach(x=>geom(x,-3.4,54.2,.7,2.8,.8,'#67728b'));
    for(let z=28;z<78;z+=3) {
      const y=M.riverHeight(z);
      geom(-74.35,y-.08,z,.4,.9,2.7,'#4b7781');
      if(z%2===0) {
        geom(-74.24,y+.05,z,.17,.99,.18,'#447279');
        geom(-74.25,y+.85,z,.22,.22,.34,'#83e5d2',1);
      }
      if(z<49||z>59) tile(-73.5,z,4.8,.11,M.riverHeight(z)+.014,'#5e8a91',1);
    }
    M.paintings.forEach((p,i)=>{
      const tint=['#f59aaf','#babeff','#6df4d9'][i], x=p.x-.37;
      geom(x,p.y+.05,p.z,.13,.87,2.35,'#384258');
      for(let j=0;j<7;j++) geom(x+.079,p.y+.25+(j%3)*.13,p.z-1+j*.32,.08,.20,.23,tint);
    });
    for(let z=-78;z<79;z+=4) {
      const x=-80+Math.cos(z*.19)*1.5;
      tile(x,z,2.8,.12,-3.445,'#4e8793',1);
    }
    function lamp(x,z,tint) {
      geom(x,0,z,.18,4,.18,'#6c738b'); geom(x+.55,3.82,z,1.1,.14,.18,'#72778a');
      geom(x+1,3.71,z,.61,.16,.43,tint);
      tile(x-.9,z-.7,3,1.4,.033,'#494959',1);
    }
    for(let i=-64;i<=66;i+=22) {
      lamp(-64,i,'#acdce4'); lamp(64,i,'#edcaa9');
      lamp(i,-62,'#f3ba97'); lamp(i,62,'#c3c6ef');
    }
    M.junctions.forEach(j=>[[7,7],[-7,-7]].forEach(o=> {
      const x=j.x+o[0],z=j.z+o[1],d=Math.sign(o[0]);
      tile(j.x+d*11.35-.13,j.z-4.8,.26,9.6,.022,'#918190');
      tile(j.x-4.8,j.z+d*11.35-.13,9.6,.26,.022,'#918190');
      geom(x,0,z,.16,3.5,.16,'#7a7e8e'); geom(x,2.8,z,.52,.79,.49,'#292e49');
    }));
    M.signs.forEach(s=>geom(s.x,s.y-.56,s.z,5.6,1.15,.14,s.tint));
    for(let i=0;i<24;i++) {
      const x=i%2===0 ? 69+i%3 : -65+i%4, z=-76+i*6.5;
      if(Math.abs(z+54)<9||Math.abs(z-54)<9||Math.abs(z)<8) continue;
      geom(x,0,z,.42,2.4,.42,'#5b4d57',1);
      geom(x,1.75,z,1.9,1.33,1.67,'#3a6468',1);
      geom(x-.3,2.7,z+.21,1.42,.8,1.35,'#497577',1);
    }
    return Object.values(batches);
  }
  function markers(g) {
    const P=M.points;
    if(!g.active) return ['delivery','graffiti','garage'].filter(k=>!g.done[k]).map(k=>P[k]);
    if(g.active.id==='delivery') return [P.market];
    if(g.active.id==='garage' && g.active.stage==='escape' && !g.stars) return [P.meet];
    if(g.active.id==='garage' && g.active.stage==='take') return [M.markedCar];
    return [];
  }
  // Shared faceted mesh recipe. Points are in character space, not separate draw calls.
  const ringAngles={};
  function ring(n) {
    if(!ringAngles[n]) ringAngles[n]=Array.from({length:n},(_,i)=>[Math.cos(i*Math.PI*2/n),Math.sin(i*Math.PI*2/n)]);
    return ringAngles[n];
  }
  function human(a,e,g,hero,low) {
    const yaw=e.a,s=Math.sin(yaw),c=Math.cos(yaw),down=e.state==='stunned'&&e.until>g.time;
    const stumble=e.state==='stagger'?M.clamp((e.until-g.time)/.72,0,1):0;
    const strike=hero&&g.strike&&g.strike.end>g.time?Math.sin(Math.PI*M.clamp((g.time-g.strike.start)/.30,0,1)):0;
    const scale=hero?1:1+Math.sin(e.x*.55+(e.style||0))*.035;
    const world=(x,y,z)=>{
      const h=down?.23-z:y, d=down?y-.81:z-Math.max(0,y-.58)*stumble*.23;
      return [e.x+(x*c+d*s)*scale,e.y+h*scale,e.z+(d*c-x*s)*scale];
    };
    function shell(p,q,rx,rz,tx,tz,tint,n) {
      const base=[],top=[], t=rgb(tint), dy=q[1]-p[1],dz=q[2]-p[2], len=Math.hypot(dy,dz)||1;
      const y=-dz/len,z=dy/len;
      const points=ring(n);
      for(let i=0;i<n;i++) {
        const u=points[i][0],v=points[i][1];
        base.push(world(p[0]+u*rx,p[1]+v*rz*y,p[2]+v*rz*z));
        top.push(world(q[0]+u*tx,q[1]+v*tz*y,q[2]+v*tz*z));
      }
      for(let i=0;i<n;i++) {
        const j=(i+1)%n, shade=.60+.46*(points[i][1]*s*.4+points[i][0]*c*.65+1)/2;
        quad(a,base[i],base[j],top[j],top[i],t,shade);
        if(i>0&&i<n-1) {tri(a,top[0],top[i],top[j],t,1.07);tri(a,base[0],base[i],base[j],t,.60);}
      }
    }
    const coat=hero?'#deb083':e.tint, pants=hero?'#354457':e.id&&e.id[0]==='o'?'#283c57':'#465067';
    const skin=hero?'#c99575':['#d3a288','#9e7058','#d8af99','#aa7766'][e.style||0], ink='#202331';
    const n=low?5:6, moving=!down&&!stumble&&(hero?e.walking:e.state!=='wait');
    const swing=moving?Math.sin(g.time*(hero&&e.run||e.state==='flee'?13:8)+(e.style||0)*2)*.24:0;
    const bob=Math.abs(swing)*.10;
    const shape=(p,q,rx,rz,tx,tz,tint)=>shell(p,q,rx,rz,tx,tz,tint,n);
    shape([0,.78+bob,0],[0,1.32+bob,0],.187,.12,.238,.125,coat);
    shape([0,1.32+bob,0],[0,1.43+bob,.006],.235,.121,.116,.087,coat);
    shape([0,1.39+bob,0],[0,1.51+bob,.012],.072,.065,.072,.067,skin);
    shape([0,1.46+bob,.018],[0,1.69+bob,0],.058,.063,.117,.103,skin);
    shape([0,1.66+bob,0],[0,1.82+bob,-.008],.118,.106,.065,.059,hero?'#3d2b29':ink);
    if(!low) {
      shape([0,1.57+bob,.086],[0,1.636+bob,.115],.025,.019,.022,.014,skin);
      shape([0,1.17+bob,-.116],[0,1.30+bob,-.12],.134,.039,.09,.033,hero?'#6a5448':coat);
    }
    [-1,1].forEach(side=>{
      const step=swing*side,x=side*.112;
      const hip=[x,.83+bob,0],knee=[x,.46,step*.54+.035],ankle=[x,.12,step];
      shape(hip,knee,.097,.10,.072,.078,pants);shape(knee,ankle,.075,.075,.051,.053,pants);
      shape([x,.045,step+.04],[x,.13,step+.069],.068,.123,.061,.086,ink);
      const shoulder=[side*.222,1.343+bob,0], armed=hero&&e.armed&&!down;
      const reach=side===1?strike:0;
      const elbow=[side*(armed?.213:.266)-reach*.11,1.10+bob+reach*.19,armed?.20:-step*.38+reach*.31];
      const hand=[side*(armed?.13:.258)-reach*.21,(armed?1.24:.93)+bob+reach*.40,armed?.43:-step*.68+reach*.64];
      shape(shoulder,elbow,.082,.077,.062,.061,coat);shape(elbow,hand,.065,.058,.045,.043,coat);
      shape(hand,[hand[0],hand[1]-.083,hand[2]+.032],.045,.043,.038,.035,skin);
      if(armed&&side===1) shape([.13,1.24+bob,.44],[.13,1.26+bob,.62],.041,.04,.028,.028,'#a7d6cf');
    });
  }
  function actors(a,g,low) {
    a.length=0;
    const local=e=>M.distance(e,g.player)<(low?53:77);
    function car(c) {
      if(!local(c)) return;
      const x=c.x,z=c.z,y=c.y,b=c.a,s=Math.sin(b),k=Math.cos(b);
      const part=(px,py,pz,w,h,d,t)=>block(a,x+px*k+pz*s,y+py,z+pz*k-px*s,w,h,d,t,b);
      part(0,.33,0,2.04,.67,3.83,c.color); part(0,1.0,-.34,1.70,.49,1.94,'#253d57');
      part(0,1.49,-.28,1.56,.09,1.55,c.color);
      [-.77,.77].forEach(q=>{
        part(q,.65,1.94,.36,.19,.10,'#fff0be'); part(q,.65,-1.94,.36,.15,.1,'#ed6779');
        if(!low) [-1.19,1.19].forEach(end=>part(q*1.19,.13,end,.36,.55,.73,'#20283e'));
      });
      if(c.police) {
        const flash=Math.floor(g.time*6)%2===0;
        part(-.38,1.61,-.34,.56,.14,.31,flash?'#ed6d91':'#886b88');
        part(.38,1.61,-.34,.56,.14,.31,flash?'#6a749b':'#a4cafd');
      }
      if(c.hornAt>g.time-.32) part(0,1.95,0,.22,.32,.24,'#fdd58f');
    }
    function person(e,player) {
      if(local(e)) human(a,e,g,player,low||M.distance(e,g.player)>27);
    }
    g.free.forEach(car);g.traffic.forEach(car);g.policeCars.forEach(car);
    g.people.forEach(e=>person(e,false));g.officers.forEach(e=>person(e,false));
    if(!g.car) person(g.player,true);
    M.junctions.forEach((j,i)=> {
      if(!local(j)) return;
      [-1,1].forEach(d=>{
        block(a,j.x+7*d,3.02,j.z+7*d,.6,.2,.3,M.signal(g.time,i,'x')?'#77ebbb':'#f96981');
        block(a,j.x+7*d,3.31,j.z+7*d,.3,.2,.61,M.signal(g.time,i,'z')?'#77ebbb':'#f96981');
      });
    });
    markers(g).forEach(p=>{
      if(!local(p)) return;
      block(a,p.x,p.y+2.3+Math.sin(g.time*2.9)*.20,p.z,.53,.53,.53,'#f6cb84',g.time*1.1);
      flat(a,p.x-.65,p.z-.65,1.3,1.3,p.y+.044,'#aa875d');
    });
    const strike=g.strike;
    if(strike&&strike.hit&&g.time>=strike.start+.07&&g.time<strike.start+.20) {
      const t=(g.time-strike.start-.07)/.13;
      for(let i=0;i<4;i++) {
        const d=i*Math.PI/2, r=.15+t*.33;
        block(a,strike.x+Math.cos(d)*r,strike.y+.09*i+t*.20,strike.z+Math.sin(d)*r,.11,.11,.11,'#ffce95',d+t);
      }
    }
    [g.shot,g.reply].forEach((p,i)=> {
      if(!p||p.end<g.time) return;
      const dir=M.angle(p,{x:p.x1,z:p.z1}), dx=Math.cos(dir)*.054,dz=-Math.sin(dir)*.054, y1=p.y1===undefined?p.y:p.y1;
      quad(a,[p.x+dx,p.y,p.z+dz],[p.x-dx,p.y,p.z-dz],[p.x1-dx,y1,p.z1-dz],[p.x1+dx,y1,p.z1+dz],rgb(i?'#f390a7':'#fff0ad'),1);
      block(a,p.x1,y1-.15,p.z1,.36,.37,.36,p.hit?'#a2d9ff':'#f1c18a',g.time*9);
    });
  }
  function pixelSize(w,h,dpr,low) {
    let d=Math.min(dpr||1,low?1:1.5,Math.sqrt((low?1000000:2000000)/Math.max(1,w*h)));
    return {w:Math.max(1,Math.floor(w*d)),h:Math.max(1,Math.floor(h*d))};
  }
  function camera(g,aspect) {
    if(g.title) return perspective([40,10,-64],[-5,1,-12],aspect,74);
    const p=g.player,a=g.view.yaw,s=Math.sin(a),c=Math.cos(a), armed=p.armed&&!g.car;
    const distance=g.car?9.15:armed?4.9:7.35, offset=armed?0:.36, slope=M.aimSlope(g.view.pitch);
    const eyeY=armed?1.32-distance*slope:(g.car?4.85:4.2)+g.view.pitch*2.4;
    const targetY=armed?1.32+8*slope:1.09-g.view.pitch*4.0;
    const pivot=[p.x,p.y+1.32,p.z];
    const eye=[p.x-s*distance-c*offset,p.y+eyeY,p.z-c*distance+s*offset];
    const reach=M.clearFraction(pivot,eye,.16);
    for(let i=0;i<3;i++) eye[i]=pivot[i]+(eye[i]-pivot[i])*reach;
    const side=offset*reach;
    const t=[p.x+s*(armed?8:4)-c*side,p.y+targetY,p.z+c*(armed?8:4)+s*side];
    return perspective(eye,t,aspect,aspect>1?59:69);
  }
  function perspective(eye,t,aspect,fov) {
    const dx=t[0]-eye[0],dy=t[1]-eye[1],dz=t[2]-eye[2],len=Math.hypot(dx,dy,dz), ground=Math.hypot(dx,dz)||1;
    const d=[dx/len,dy/len,dz/len], s=dx/ground,c=dz/ground;
    const right=[-c,0,s], up=[-s*d[1],c*d[2]+s*d[0],-c*d[1]];
    const sy=1/Math.tan(fov*RAD/2), sx=sy/aspect;
    return { eye,d,right,up,sx,sy };
  }
  function clip(c,x,y,z) {
    const dx=x-c.eye[0],dy=y-c.eye[1],dz=z-c.eye[2];
    const w=dx*c.d[0]+dy*c.d[1]+dz*c.d[2];
    return {x:(dx*c.right[0]+dz*c.right[2])*c.sx/w,y:(dx*c.up[0]+dy*c.up[1]+dz*c.up[2])*c.sy/w,w};
  }
  const vertex='attribute vec3 p; attribute vec3 a; uniform vec3 eye,fw,rt,up; uniform vec2 scale; varying vec3 col; varying float depth; void main(){ vec3 v=p-eye; float w=dot(fw,v); depth=w; col=a; gl_Position=vec4(dot(rt,v)*scale.x,dot(up,v)*scale.y,w*1.003-0.30,w); }';
  const fragment='precision mediump float; varying vec3 col; varying float depth; uniform vec3 fog; uniform float reach; void main(){ float f=smoothstep(15.0,reach,depth)*0.83; gl_FragColor=vec4(mix(col,fog,f),1.0); }';
  function webGL(canvas,gl) {
    const program=gl.createProgram();
    function attach(type,src) {
      const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error('shader');
      gl.attachShader(program,s);gl.deleteShader(s);
    }
    attach(gl.VERTEX_SHADER,vertex);attach(gl.FRAGMENT_SHADER,fragment);
    gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('link');
    const pos=gl.getAttribLocation(program,'p'), tint=gl.getAttribLocation(program,'a');
    const uniforms={}; ['eye','fw','rt','up','scale','fog','reach'].forEach(k=>{uniforms[k]=gl.getUniformLocation(program,k);});
    const batches=world();
    let triangles=0;
    batches.forEach(b=>{
      b.buffer=gl.createBuffer();b.count=b.data.length/6;triangles+=b.count/3;
      gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.data),gl.STATIC_DRAW);b.data=null;
    });
    const dynamic=gl.createBuffer(), a=[], upload=new Float32Array(240000);
    gl.bindBuffer(gl.ARRAY_BUFFER,dynamic);gl.bufferData(gl.ARRAY_BUFFER,upload.byteLength,gl.DYNAMIC_DRAW);
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(tint);
    gl.clearColor(fog[0],fog[1],fog[2],1);gl.uniform3fv(uniforms.fog,fog);
    function draw(b,count) {
      gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(tint,3,gl.FLOAT,false,24,12);
      gl.drawArrays(gl.TRIANGLES,0,count);
    }
    return { label:'3D', draw(g,low) {
      const c=camera(g,canvas.width/canvas.height);
      gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform3fv(uniforms.eye,c.eye);gl.uniform3fv(uniforms.fw,c.d);gl.uniform3fv(uniforms.rt,c.right);
      gl.uniform3fv(uniforms.up,c.up);gl.uniform2f(uniforms.scale,c.sx,c.sy);gl.uniform1f(uniforms.reach,low?57:79);
      let calls=0, tris=0;
      if(low) gl.clearColor(.045,.067,.123,1);
      for(let i=0;i<batches.length;i++) {
        const b=batches[i],x=b.x-c.eye[0],z=b.z-c.eye[2],d=x*c.d[0]+z*c.d[2];
        if(d< -43||Math.hypot(x,z)>(low?87:119)||(b.detail&&low&&Math.hypot(x,z)>39)) continue;
        if(calls+1 >= (low?50:100) || tris+b.count/3 > (low?36000:86000)) continue;
        draw(b.buffer,b.count); calls++; tris+=b.count/3;
      }
      actors(a,g,low);
      const n=Math.min(a.length,upload.length);
      for(let i=0;i<n;i++) upload[i]=a[i];
      gl.bindBuffer(gl.ARRAY_BUFFER,dynamic);gl.bufferSubData(gl.ARRAY_BUFFER,0,upload.subarray(0,n));
      draw(dynamic,n/6); calls++;tris+=n/18;
      return {camera:c,calls,triangles:tris,meshTriangles:triangles};
    }};
  }
  function planar(canvas) {
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx) return null;
    const staticMap=canvas.ownerDocument.createElement('canvas');
    staticMap.width=staticMap.height=672;
    const map=staticMap.getContext('2d');
    if(!map) return null;
    const W=672,D=W/168;
    function rect(x,z,w,h,t) {map.fillStyle=t;map.fillRect((x+84)*D,(z+84)*D,w*D,h*D);}
    rect(-84,-84,168,168,'#363b54');rect(-84,-84,10,168,'#25526b');rect(-74,30,6,47,'#50828a');
    [-54,54,0].forEach(z=>{rect(-61,z-6,122,12,'#252941');for(let x=-59;x<59;x+=5) rect(x,z-.09,2.8,.18,'#a4a29c');});
    [-54,54].forEach(x=>{rect(x-6,-82,12,164,'#252941');for(let z=-81;z<81;z+=5) rect(x-.09,z,.18,2.8,'#a4a29c');});
    M.alleys.forEach(l=>rect(l.x-2.3,l.entries[0],4.6,l.entries[1]-l.entries[0],'#60777b'));
    M.buildings.concat(M.stalls,M.bollards).forEach(b=>rect(b.x0,b.z0,b.x1-b.x0,b.z1-b.z0,b.color));
    rect(23,12,20,20,'#697595');rect(M.ramp.x0,M.ramp.z0,M.ramp.x1-M.ramp.x0,M.ramp.z1-M.ramp.z0,'#636981');rect(19.5,13,3.5,19,'#8295ab');
    for(let z=13;z<32;z+=1) rect(19.5,z,3.5,.13,'#535d79');
    for(let z=M.ramp.z0+1;z<M.ramp.z1-1;z+=2) rect(35.4,z,.19,.8,'#e5c9a3');
    rect(-84,50,20,8,'#80819b');rect(-73.6,50,.23,8,'#273e55');
    function dot(e,fill,r) {ctx.fillStyle=fill;ctx.beginPath();ctx.arc(e.x,e.z,r,0,Math.PI*2);ctx.fill();}
    return {label:'简图',draw(g) {
      const p=g.player, w=canvas.width,h=canvas.height,s=Math.min(w/42,h/56), y=g.view.yaw;
      ctx.fillStyle='#191e32';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w*.5,h*.55);ctx.scale(s,s);
      ctx.rotate(y-Math.PI);ctx.translate(-p.x,-p.z);ctx.drawImage(staticMap,-84,-84,168,168);
      if(p.y< -1.5) {ctx.fillStyle='#426877';ctx.fillRect(-74,50,6,8);}
      M.paintings.forEach((f,i)=>{if(p.y<-.9) dot(f,['#f59aaf','#babeff','#6df4d9'][i],.59);});
      M.junctions.forEach((j,i)=>[-1,1].forEach(d=>{
        dot({x:j.x+6.6*d,z:j.z+8.6*d},M.signal(g.time,i,'x')?'#8bf4bb':'#f0778e',.49);
        dot({x:j.x+8.6*d,z:j.z+6.6*d},M.signal(g.time,i,'z')?'#8bf4bb':'#f0778e',.49);
      }));
      g.people.concat(g.officers).forEach(e=>dot(e,e.until>g.time?'#a6d7ff':e.tint,.50));
      g.free.concat(g.traffic,g.policeCars).forEach(c=>{
        if(Math.abs(p.y-c.y)>1.8&&M.distance(p,c)<12) return;
        ctx.save();ctx.translate(c.x,c.z);ctx.rotate(-c.a);ctx.fillStyle=c.color;ctx.fillRect(-1,-1.9,2,3.8);
        ctx.fillStyle=c.police?'#dc90bb':'#212e46';ctx.fillRect(-.68,-.91,1.36,1.76);
        ctx.fillStyle='#ffe6b7';ctx.fillRect(-.88,1.5,1.76,.23);ctx.restore();
      });
      markers(g).forEach(e=>dot(e,'#ffd59a',.72));
      if(g.strike&&g.strike.hit&&g.strike.end>g.time) dot(g.strike,'#ffd59a',.95);
      [g.shot,g.reply].forEach(e=>{if(e&&e.end>g.time){ctx.strokeStyle='#f1be9d';ctx.lineWidth=.13;ctx.beginPath();ctx.moveTo(e.x,e.z);ctx.lineTo(e.x1,e.z1);ctx.stroke();}});
      ctx.save();ctx.translate(p.x,p.z);ctx.rotate(-p.a);ctx.fillStyle='#fff0bb';ctx.beginPath();ctx.moveTo(0,1.21);ctx.lineTo(-.66,-.64);ctx.lineTo(.66,-.64);ctx.fill();ctx.restore();
      ctx.restore();return null;
    }};
  }
  function create(canvas,alternate,onChange) {
    let renderer=null, active=canvas, low=false, fallback=false;
    function replace() {
      if(fallback) return;
      fallback=true;
      try { renderer=planar(alternate); } catch(e) { renderer=null; }
      active=alternate;canvas.hidden=true;alternate.hidden=false;
      if(onChange) onChange(renderer?'简图模式':'画面不可用');
    }
    try {
      const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:true,stencil:false,preserveDrawingBuffer:false});
      if(gl) renderer=webGL(canvas,gl);
    } catch(e) { renderer=null; }
    if(!renderer) replace();
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();replace();});
    return {
      draw(g,width,height,dpr) {
        if(!renderer) return {ok:false};
        function paint() {
          const size=pixelSize(width,height,dpr,low||fallback);
          if(active.width!==size.w) active.width=size.w;
          if(active.height!==size.h) active.height=size.h;
          const stats=renderer.draw(g,low);
          return {ok:true,stats};
        }
        try{return paint();}catch(e){replace();if(renderer){try{return paint();}catch(e){renderer=null;}}return {ok:false};}
      },
      lower() { if(fallback) return; if(low) replace(); else { low=true;if(onChange) onChange('3D · 轻量画质'); } },
      get mode() { return renderer ? renderer.label : ''; }
    };
  }
  function qualityMonitor(lower) {
    let elapsed=0, frames=0, slow=0;
    function reset() { elapsed=frames=slow=0; }
    return {reset, sample(ms) {
      if(ms<=0) return;
      elapsed+=ms;frames++;
      if(ms>42) slow++;
      if(elapsed>=3000 && frames>=4) {
        const downgrade=slow/frames>.52;
        reset();
        if(downgrade) lower();
      }
    }};
  }
  N.Render={create,pixelSize,camera,clip,world,markers,qualityMonitor};
  if(typeof module!=='undefined' && module.exports) module.exports=N.Render;
})(typeof window==='undefined'?global:window);
