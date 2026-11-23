(function (view) {
  'use strict';
  const doc=view.document, byId=id=>doc.getElementById(id);
  const boot=byId('boot'), bootStatus=byId('boot-status'), hud=byId('hud');
  function fail() {
    hud.hidden=true;boot.hidden=false;byId('start-game').disabled=true;
    bootStatus.textContent='未能启动游戏画面或控制。请关闭后重新进入；如果仍然卡住，当前环境可能不支持游戏画布。';
  }
  try { start(); } catch(e) { fail(); }
  function start() {
    const N=view.District, M=N.Map, G=N.Game, Render=N.Render, P=N.Platform;
    const room=byId('room'), surface=byId('surface'), pad=byId('stick'), gas=byId('gas'), brake=byId('brake'), pause=byId('pause');
    const arm=byId('arm'), fire=byId('fire'), punch=byId('punch'), task=byId('task'), door=byId('door'), popup=byId('pause-dialog'), resume=byId('resume');
    const area=byId('area'), wanted=byId('wanted'), phase=byId('phase'), goal=byId('task-status'), banner=byId('notice');
    const steer=byId('steer-label'), drive=byId('drive-label'), cross=byId('crosshair'), saveLabel=byId('save-status');
    const viewport=byId('viewport'), startButton=byId('start-game'), soundButton=byId('sound-toggle');
    const result=byId('result'), returned=byId('recover'), health=byId('health'), danger=byId('danger');
    const turned=()=>viewport.clientHeight>viewport.clientWidth;
    const conn=P.connect(view.xhs);
    const insets=P.windowInsets(conn,view,room,byId('safe-probe'),viewport,turned);
    const mini=byId('minimap'), ctx=mini.getContext('2d');
    const signs=M.signs.map(s=>{
      const label=doc.createElement('span');label.className='world-label';label.textContent=s.name;label.style.backgroundColor=s.tint;label.hidden=true;
      byId('skyline').appendChild(label);return {s,label};
    });
    const status={loading:'正在读取任务完成记录。',ready:'仅保存已完成的任务。',unavailable:'当前环境不支持存档；完成记录仅本局有效。',
      'read-failed':'读取存档失败，未覆盖旧记录；新完成的任务仅本局有效。','write-failed':'写入未获确认；本局完成的任务仍有效。'};
    let mode='', issue='', issueUntil=0, persistIssue=false, frameId=0, last=0, acc=0, dirtyUI=-1, dirtyMap=-1, playing=false, paused=false;
    let prevCar=false, fatal=false, lastFocus=null;
    let lastShot=null,lastReply=null,lastStrike=null,lastHorn=0,lastImpact=0,lastDoor=false,stepAt=0;
    let width=0,height=0;
    function fit() {
      viewport.style.setProperty('--physical-w',viewport.clientWidth+'px');
      viewport.style.setProperty('--physical-h',viewport.clientHeight+'px');
      width=room.clientWidth;height=room.clientHeight;
    }
    fit();
    const game=G.create(183049,{},id=>{
      store.complete(id);
      if(store.mode!=='ready'&&store.mode!=='loading') persistIssue=true;
    });
    const store=P.storage(conn,data=>G.restoreCompletions(game,data),state=>{
      text(saveLabel,status[state]);
      if(state==='read-failed'||state==='write-failed') {issue=status[state];issueUntil=game.time+5;}
      if(state==='write-failed') persistIssue=true;
    });
    game.title=true;
    const input=N.Input.create(view,room,pad,byId('thumb'),surface,gas,brake,turned);
    const clearTaps=N.Input.discreteTaps(byId('layout'));
    const audio=N.Audio.create(view,state=>{
      const label={on:'声音：开',muted:'声音：关',tap:'点按开启声音',unavailable:'当前设备不支持声音'};
      text(soundButton,label[state]);soundButton.disabled=state==='unavailable';
      soundButton.setAttribute('aria-pressed',String(state==='on'));
    });
    const renderer=Render.create(byId('view'),byId('simple-view'),label=>{mode=label;});
    const quality=Render.qualityMonitor(()=>renderer.lower());
    const request=typeof view.requestAnimationFrame==='function'?view.requestAnimationFrame.bind(view):null;
    if(!request) return fail();
    const cancel=view.cancelAnimationFrame.bind(view);
    function playSignals() {
      if(game.shot!==lastShot) {lastShot=game.shot;if(lastShot) audio.effect('shot');}
      if(game.reply!==lastReply) {lastReply=game.reply;if(lastReply) audio.effect('reply');}
      if(game.strike!==lastStrike) {lastStrike=game.strike;if(lastStrike) audio.effect(lastStrike.hit?'punch':'swing');}
      if(game.stats.horns!==lastHorn) {lastHorn=game.stats.horns;audio.effect('horn');}
      const impacts=game.stats.collisions+game.stats.impacts;
      if(impacts!==lastImpact) {lastImpact=impacts;audio.effect('impact');}
      if(!!game.car!==lastDoor) {lastDoor=!!game.car;audio.effect('door');}
      if(game.player.walking&&game.time>=stepAt) {stepAt=game.time+(game.player.run?.27:.42);audio.effect('step');}
      audio.traffic(game.car&&game.car.speed,!!game.car);
    }
    function showResult() {
      const arrested=game.outcome==='arrested';
      byId('result-title').textContent=arrested?'已被逮捕':'已被击倒';
      byId('result-detail').textContent=(arrested?'巡逻员已控制现场。':'体力耗尽，已失去行动能力。')+' 已完成的任务将保留。';
      audio.traffic(0,false);audio.effect(game.outcome);
      halt();input.enable(false);hud.setAttribute('aria-hidden','true');result.hidden=false;returned.focus();
    }
    function text(node,value) { if(node.textContent!==value) node.textContent=value; }
    function show(node,visible) { if(node.hidden===visible) node.hidden=!visible; }
    function interfaceState() {
      const powered=!!game.car, p=game.player, aimed=!powered&&p.armed;
      if(prevCar!==powered) {input.endDrive();prevCar=powered;}
      text(area,M.area(p));
      text(wanted,'★'.repeat(game.stars)+'☆'.repeat(3-game.stars));
      wanted.setAttribute('aria-label',game.stars+' 星通缉');
      const state={patrol:'自由漫游',investigate:'附近正在调查',pursuit:'巡逻车追踪',search:'失去视野 · 搜索中'};
      text(phase,(mode?mode+' · ':'')+state[game.phase]);
      health.value=p.health;show(byId('vitals'),p.health<100||game.pressure>.03);
      text(danger,game.pressure>.03?'正在被控制 '+Math.round(game.pressure*100)+'%':'体力 '+p.health+'%');
      const prompt=G.interaction(game);
      const ride=powered?null:G.nearRide(game);
      const doorLabel=powered&&prompt&&prompt.kind==='door'?'下车':ride?(ride.occupied?'抢车':'上车'):'';
      const taskLabel=prompt&&prompt.kind==='task'?prompt.label:'';
      show(task,!!taskLabel);if(taskLabel) text(task,taskLabel);
      show(door,!!doorLabel);if(doorLabel) text(door,doorLabel);
      show(gas,powered);show(brake,powered);show(arm,!powered);show(fire,aimed);show(punch,!powered&&!aimed);show(cross,aimed);
      text(arm,aimed?'收枪':'拔枪');
      text(fire,'发射 '+p.ammo);
      text(steer,powered?'左右转向':'走 / 跑');
      text(drive,powered?(game.car.speed<-.15?'倒车 ':'')+Math.round(Math.abs(game.car.speed)*3.6)+' 公里 / 时':aimed?'拖动空地 · 瞄准':'拖动空地 · 镜头');
      const active=G.taskText(game); text(goal,active);show(goal,!!active);
      const notice=game.noticeUntil>game.time?game.notice:issueUntil>game.time?issue:'';
      text(banner,notice+(persistIssue&&/完成 ·/.test(notice)?' · 本局有效':''));
    }
    function minimap() {
      if(!ctx) return;
      const s=176/168,p=game.player;
      ctx.setTransform(s,0,0,s,88,88);
      ctx.fillStyle='#262a42';ctx.fillRect(-84,-84,168,168);
      ctx.fillStyle='#304e65';ctx.fillRect(-84,-84,13,168);
      ctx.fillStyle='#6288a2';ctx.fillRect(-74,29,7,50);
      ctx.fillStyle='#6b657a';
      [-54,54,0].forEach(z=>ctx.fillRect(-61,z-6,122,12));
      [-54,54].forEach(x=>ctx.fillRect(x-6,-82,12,164));
      ctx.fillStyle='#c0a991'; M.junctions.forEach(j=>ctx.fillRect(j.x-2,j.z-2,4,4));
      ctx.fillStyle='#8ab6ae'; M.alleys.forEach(l=>ctx.fillRect(l.x-1.5,l.entries[0],3,l.entries[1]-l.entries[0]));
      ctx.fillStyle='#7276a6';ctx.fillRect(23,12,20,20);ctx.fillRect(M.ramp.x0,M.ramp.z0,M.ramp.x1-M.ramp.x0,M.ramp.z1-M.ramp.z0);
      ctx.fillStyle='#ffd39f'; Render.markers(game).forEach(m=>ctx.fillRect(m.x-4,m.z-4,8,8));
      ctx.fillStyle='#5bddce';
      if(!game.car) game.free.forEach(c=>ctx.fillRect(c.x-2.1,c.z-2.1,4.2,4.2));
      ctx.fillStyle='#f293ab';
      if(game.stars) game.policeCars.forEach(c=>ctx.fillRect(c.x-2.1,c.z-2.1,4.2,4.2));
      ctx.save();ctx.translate(p.x,p.z);ctx.rotate(-game.view.yaw);
      ctx.fillStyle='#f9f4d8';ctx.strokeStyle='#19203c';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(-4.9,-4.4);ctx.lineTo(4.9,-4.4);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();
      ctx.font='bold 17px sans-serif';ctx.fillStyle='#eee0cf';ctx.fillText('N',65,-62);
    }
    function drawSignboards(camera) {
      signs.forEach(({s,label})=>{
        if(!camera||M.distance(s,game.player)>31) {show(label,false);return;}
        const p=Render.clip(camera,s.x,s.y,s.z);
        const shown=p.w>2&&Math.abs(p.x)<.94&&Math.abs(p.y)<.94&&M.clearFraction(camera.eye,[s.x,s.y,s.z],0)>.995;
        show(label,shown);
        if(shown) {label.style.left=(50+50*p.x)+'%';label.style.top=(50-50*p.y)+'%';}
      });
    }
    function halt() { if(frameId) cancel(frameId);frameId=0;last=0;acc=0;quality.reset();clearTaps(); }
    function clock(now) {
      frameId=0;
      if(paused||doc.hidden||fatal||game.outcome) return;
      const ms=last?now-last:0;
      last=now;acc+=Math.min(ms*.001,.067);
      try {
        if(game.title) {
          const frame=renderer.draw(game,width,height,insets.dpr);
          if(!frame.ok) {fatal=true;fail();return;}
          startButton.disabled=false;
          text(bootStatus,turned()?'横向游玩 · 建议将手机横过来':'离线漫游');
          return;
        }
        let command=null;
        while(acc>=G.STEP&&!game.outcome) {
          if(!command) command=input.consume();
          G.step(game,command,G.STEP);acc-=G.STEP;
          command={x:command.x,z:command.z,steer:command.steer,gas:command.gas,brake:command.brake,looking:command.looking};
        }
        playSignals();
        const frame=renderer.draw(game,width,height,insets.dpr);
        if(!frame.ok) {fatal=true;input.enable(false);fail();return;}
        drawSignboards(frame.stats&&frame.stats.camera);
        if(game.time-dirtyUI>.075 || !playing) {dirtyUI=game.time;interfaceState();}
        if(game.time-dirtyMap>.115 || !playing) {dirtyMap=game.time;minimap();}
        if(!playing) {playing=true;input.enable(true);boot.hidden=true;hud.hidden=false;room.focus();}
        if(game.outcome) {showResult();return;}
        quality.sample(ms);
      } catch(e) {fatal=true;input.enable(false);fail();return;}
      kick();
    }
    function kick() { if(!paused&&!doc.hidden&&!fatal&&!game.outcome&&!frameId) frameId=request(clock); }
    startButton.addEventListener('click',()=>{
      if(startButton.disabled||!game.title||fatal) return;
      startButton.disabled=true;game.title=false;halt();audio.wake('start');kick();
    });
    returned.addEventListener('click',()=>{
      if(!G.recover(game)) return;
      result.hidden=true;hud.removeAttribute('aria-hidden');input.enable(true);audio.wake();room.focus();kick();
    });
    view.addEventListener('resize',()=>{
      fit();input.clear();halt();
      if(!paused&&!game.outcome) kick();
    });
    function openPause() {
      if(!playing||paused||fatal||game.outcome) return;
      lastFocus=doc.activeElement;
      if(!hud.contains(lastFocus)) lastFocus=room;
      paused=true;halt();audio.quiet();input.enable(false);popup.hidden=false;
      // The top layer escapes CSS transforms; keep the overlay inside the rotated game.
      popup.classList.add('fallback');popup.setAttribute('open','');hud.setAttribute('aria-hidden','true');
      resume.focus();
    }
    function closePause() {
      if(!paused) return;
      popup.removeAttribute('open');popup.classList.remove('fallback');popup.hidden=true;hud.removeAttribute('aria-hidden');
      paused=false; if(lastFocus&&!lastFocus.hidden) lastFocus.focus();else room.focus();
      input.enable(true);audio.wake();kick();
    }
    view.addEventListener('keydown',e=>{
      if(game.outcome) {if(e.key==='Tab'){e.preventDefault();returned.focus();}return;}
      if(e.key==='Escape') {e.preventDefault();if(paused)closePause();else openPause();}
      if(paused&&e.key==='Tab') {
        const items=popup.querySelectorAll('button:not([disabled]),summary'), first=items[0],lastItem=items[items.length-1];
        if(e.shiftKey&&doc.activeElement===first) {e.preventDefault();lastItem.focus();}
        else if(!e.shiftKey&&doc.activeElement===lastItem) {e.preventDefault();first.focus();}
      }
    });
    doc.addEventListener('focusin',e=>{if(game.outcome&&!result.contains(e.target))returned.focus();else if(paused&&!popup.contains(e.target))resume.focus();});
    pause.addEventListener('click',()=>{pause.focus();openPause();});resume.addEventListener('click',closePause);
    soundButton.addEventListener('click',audio.toggle);
    [[door,'door'],[task,'task'],[arm,'arm'],[fire,'fire'],[punch,'punch']].forEach(([button,name])=>button.addEventListener('click',()=>input.action(name)));
    ['pointerup','touchend','mouseup','keydown'].forEach(name=>view.addEventListener(name,e=>{
      if(playing&&!paused&&!game.outcome&&e.isTrusted&&!e.repeat) audio.wake();
    },true));
    function foreground() {if(playing&&!paused&&!game.outcome) audio.wake();kick();}
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden){halt();input.clear();audio.quiet(true);}else foreground();});
    view.addEventListener('pagehide',()=>{halt();input.clear();audio.quiet(true);});view.addEventListener('pageshow',foreground);
    kick();
  }
})(window);
