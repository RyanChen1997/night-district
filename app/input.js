(function (out) {
  'use strict';
  const N=out.District=out.District||{};
  const clamp=(a,b,c)=>Math.min(c,Math.max(b,a));
  function create(view,root,pad,thumb,surface,gas,brake,turned) {
    const ids=new Map(), roles={}, keys={}, actions={};
    let x=0,z=0,lookX=0,lookY=0,enabled=false,lastTouch=-Infinity;
    function local(x,y) {
      if(!turned) return {x,y};
      const r=root.getBoundingClientRect();
      return turned()?{x:y-r.top,y:r.right-x}:{x:x-r.left,y:y-r.top};
    }
    function stick(point,p) {
      const dx=(point.x-p.x)/p.radius, dz=(p.y-point.y)/p.radius, length=Math.max(1,Math.hypot(dx,dz));
      x=dx/length; z=dz/length;
      thumb.style.transform='translate('+x*28+'px,'+(-z*28)+'px)';
    }
    function press(id,e) {
      if(!enabled||ids.has(id)) return false;
      let role;
      const pos=local(e.clientX,e.clientY);
      if(pad.contains(e.target)) role='pad';
      else if(gas.contains(e.target)&&!gas.hidden) role='gas';
      else if(brake.contains(e.target)&&!brake.hidden) role='brake';
      else if(surface.contains(e.target)&&pos.x>=root.clientWidth*.46) role='view';
      if(!role||roles[role]) return false;
      const p={ id,x:pos.x,y:pos.y,role };
      if(role==='pad') {
        const r=pad.getBoundingClientRect(),center=local(r.left+r.width/2,r.top+r.height/2);
        p.x=center.x;p.y=center.y;p.radius=Math.max(24,r.width*.38);stick(pos,p);
      }
      roles[role]=p;ids.set(id,p);
      if(role==='gas'||role==='brake') (role==='gas'?gas:brake).classList.add('held');
      return true;
    }
    function drag(id,e) {
      const p=ids.get(id);
      if(!p) return false;
      const pos=local(e.clientX,e.clientY);
      if(p.role==='pad') stick(pos,p);
      if(p.role==='view') {
        lookX+=clamp((pos.x-p.x)*.0105,-.8,.8);
        lookY+=clamp((pos.y-p.y)*.007,-.54,.54);
        p.x=pos.x;p.y=pos.y;
      }
      return true;
    }
    function end(id) {
      const p=ids.get(id);
      if(!p) return false;
      delete roles[p.role];ids.delete(id);
      if(p.role==='pad') {x=z=0;thumb.style.transform='';}
      if(p.role==='gas'||p.role==='brake') (p.role==='gas'?gas:brake).classList.remove('held');
      return true;
    }
    function clear() {
      ids.forEach((p,id)=>end(id));
      Object.keys(keys).forEach(k=>delete keys[k]);Object.keys(actions).forEach(k=>delete actions[k]);
      lookX=lookY=0;
    }
    function consume() {
      const kx=Number(!!(keys.d||keys.ArrowRight))-Number(!!(keys.a||keys.ArrowLeft));
      const kz=Number(!!(keys.w||keys.ArrowUp))-Number(!!(keys.s||keys.ArrowDown));
      const mag=Math.max(1,Math.hypot(kx,kz)), scale=keys.Shift?1:.62;
      const frame=Object.assign({ x:roles.pad?x:kx/mag*scale,z:roles.pad?z:kz/mag*scale,
        gas:!!roles.gas||!!(keys.w||keys.ArrowUp||keys['gas-key']),brake:!!roles.brake||!!(keys.s||keys.ArrowDown||keys['brake-key']),
        lookX:clamp(lookX,-1.5,1.5),lookY:clamp(lookY,-.8,.8),looking:!!roles.view },actions);
      if(!roles.pad && kx) frame.steer=kx;
      lookX=lookY=0;Object.keys(actions).forEach(k=>delete actions[k]);
      return frame;
    }
    function action(name) { if(enabled) actions[name]=true; }
    const pointer=typeof view.PointerEvent==='function' && typeof root.setPointerCapture==='function';
    if(pointer) {
      root.addEventListener('pointerdown',e=>{
        if((e.button===0||e.pointerType==='touch')&&press(e.pointerId,e)) {
          e.preventDefault();try { root.setPointerCapture(e.pointerId); } catch(err) { /* window listeners still own the pointer */ }
        }
      });
      view.addEventListener('pointermove',e=>{
        if(e.pointerType==='mouse'&&e.buttons===0) {end(e.pointerId);return;}
        if(drag(e.pointerId,e)&&e.cancelable) e.preventDefault();
      },{passive:false});
      ['pointerup','pointercancel','lostpointercapture'].forEach(name=>view.addEventListener(name,e=>end(e.pointerId),true));
      view.addEventListener('pointerout',e=>{if(!e.relatedTarget&&e.pointerType==='mouse')end(e.pointerId);});
    } else {
      const touch=(name,fn,where)=>where.addEventListener(name,e=>{
        let used=false; lastTouch=Date.now();
        for(let i=0;i<e.changedTouches.length;i++) {const t=e.changedTouches[i];if(fn('t'+t.identifier,t)) used=true;}
        if(used&&e.cancelable) e.preventDefault();
      },{passive:false});
      touch('touchstart',press,root);touch('touchmove',drag,view);
      touch('touchend',end,view);touch('touchcancel',end,view);
      root.addEventListener('mousedown',e=>{if(e.button===0&&Date.now()-lastTouch>650&&press('mouse',e))e.preventDefault();});
      view.addEventListener('mousemove',e=>{if(e.buttons===0)end('mouse');else if(drag('mouse',e))e.preventDefault();});
      view.addEventListener('mouseup',()=>end('mouse'));
      view.addEventListener('mouseout',e=>{if(!e.relatedTarget)end('mouse');});
    }
    [gas,brake].forEach((button,i)=>{
      const id=i===0?'gas-key':'brake-key';
      button.addEventListener('keydown',e=>{if(enabled&&(e.key===' '||e.key==='Enter')){keys[id]=true;e.preventDefault();}});
      button.addEventListener('keyup',()=>delete keys[id]);button.addEventListener('blur',()=>delete keys[id]);
    });
    const hot={e:'door',f:'task',q:'arm',r:'punch',' ':'fire'};
    const motion=['w','a','s','d','Shift','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
    function key(e) { return e.key&&e.key.length===1?e.key.toLowerCase():e.key; }
    view.addEventListener('keydown',e=>{
      if(!enabled||e.ctrlKey||e.altKey||e.metaKey) return;
      const k=key(e);
      if((e.target.tagName==='BUTTON')&&(k===' '||k==='Enter')) return;
      if(motion.includes(k)) {keys[k]=true;e.preventDefault();}
      if(hot[k]) {if(!e.repeat) action(hot[k]); e.preventDefault();}
    });
    view.addEventListener('keyup',e=>delete keys[key(e)]);
    view.addEventListener('blur',clear);view.addEventListener('pagehide',clear);
    view.document.addEventListener('visibilitychange',()=>{if(view.document.hidden)clear();});
    return {pointer,consume,action,clear,endDrive(){if(roles.gas)end(roles.gas.id);if(roles.brake)end(roles.brake.id);delete keys['gas-key'];delete keys['brake-key'];},enable(value){enabled=value;if(!value)clear();}};
  }
  // Handle only discrete gameplay buttons here. Held pedals and both continuous pointers stay independent.
  function discreteTaps(root) {
    const presses=new Map();
    function button(target) {
      return target&&typeof target.closest==='function'?target.closest('[data-game-tap]'):null;
    }
    root.addEventListener('touchstart',e=>{
      for(let i=0;i<e.changedTouches.length;i++) {
        const t=e.changedTouches[i],target=button(t.target);
        if(target) presses.set(t.identifier,{target,x:t.clientX,y:t.clientY});
      }
    },{passive:true});
    root.addEventListener('touchmove',e=>{
      for(let i=0;i<e.changedTouches.length;i++) {
        const t=e.changedTouches[i],start=presses.get(t.identifier);
        if(start&&Math.hypot(t.clientX-start.x,t.clientY-start.y)>=18) start.moved=true;
      }
    },{passive:true});
    function release(e,fire) {
      const taps=[];
      for(let i=0;i<e.changedTouches.length;i++) {
        const t=e.changedTouches[i],start=presses.get(t.identifier);
        presses.delete(t.identifier);
        if(!start||!fire||!e.cancelable) continue;
        e.preventDefault(); // Prevent the WebView's zoom/delayed click, not the game's command.
        if(!start.moved&&!start.target.hidden&&!start.target.disabled&&Math.hypot(t.clientX-start.x,t.clientY-start.y)<18) taps.push(start.target);
      }
      taps.forEach(target=>target.click());
    }
    root.addEventListener('touchend',e=>release(e,true),{passive:false});
    root.addEventListener('touchcancel',e=>release(e,false),{passive:true});
    return ()=>presses.clear();
  }
  N.Input={create,discreteTaps};
  if(typeof module!=='undefined'&&module.exports) module.exports=N.Input;
})(typeof window==='undefined'?global:window);
