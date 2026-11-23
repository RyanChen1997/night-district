(function (out) {
  'use strict';
  const N=out.District=out.District||{};
  const keys=['delivery','graffiti','garage'];
  const storageKey='night-district:completed:v1';
  function version(options) {
    const v=options&&options.miniToolEnv&&options.miniToolEnv.buildVersion;
    if((typeof v!=='number'&&typeof v!=='string')||!/^[1-9]\d{6,}$/.test(String(v))||!Number.isSafeInteger(Number(v))) return null;
    return Math.floor(Number(v)/1000);
  }
  function invoke(owner,name,args,timeout) {
    return new Promise((resolve,reject)=>{
      const id=setTimeout(()=>reject(new Error('timeout')),timeout);
      Promise.resolve().then(()=>args===undefined?owner[name]():owner[name](args)).then(v=>{clearTimeout(id);resolve(v);},e=>{clearTimeout(id);reject(e);});
    });
  }
  function connect(xhs,timeout) {
    const api=xhs&&xhs.miniTool, sync=xhs&&xhs.launchOptions;
    const limit=timeout||1700;
    const context=version(sync)!==null || !api || typeof api.getLaunchOptions!=='function' ? Promise.resolve(sync) :
      invoke(api,'getLaunchOptions',undefined,limit).then(v=>version(v)!==null?v:sync,()=>sync);
    return {api, sync, context, limit};
  }
  function rect(v) {
    return v && ['left','right','top','bottom','width','height'].every(k=>Number.isFinite(v[k])) &&
      v.width>0 && v.height>0 && v.right>v.left && v.bottom>v.top;
  }
  function spacing(info,ver,base,width,height) {
    let top=base.top,left=base.left,right=base.right,bottom=base.bottom,dpr=0;
    if(info) {
      const ww=info.windowWidth,wh=info.windowHeight;
      const valid=Number.isFinite(ww)&&ww>0&&Number.isFinite(wh)&&wh>0&&Math.abs(ww-width)<12&&Math.abs(wh-height)<12;
      if(valid) {
        const safe=info.safeArea;
        if(rect(safe)) {
          top=Math.max(top,safe.top);left=Math.max(left,safe.left);right=Math.max(right,ww-safe.right);bottom=Math.max(bottom,wh-safe.bottom);
        }
        const area=info.gestureArea;
        if(rect(area)&&area.left<12&&area.right<ww*.35) left=Math.max(left,area.right);
        const menu=info.menuButtons||{};
        const blocks=ver!==null&&ver>=9550&&rect(menu.capsule)?[menu.capsule]:[menu.back,menu.me,menu.share].filter(rect);
        blocks.forEach(r=>{if(r.top>=-2&&r.bottom<wh*.35&&r.right>0&&r.left<ww) top=Math.max(top,r.bottom);});
        if(Number.isFinite(info.pixelRatio)&&info.pixelRatio>0) dpr=info.pixelRatio;
      }
    }
    return {top,left,right,bottom,dpr};
  }
  function landscapeInsets(dim,turned) {
    if(!turned) return dim;
    return {top:dim.right,right:dim.bottom,bottom:dim.left,left:dim.top,dpr:dim.dpr};
  }
  function windowInsets(conn,view,root,probe,viewport,turned) {
    let options=conn.sync, snapshot=options&&options.miniToolEnv&&options.miniToolEnv.windowInfo;
    let pending=null, generation=0, observed=null, pixel=1;
    function apply() {
      const style=view.getComputedStyle(probe);
      const baseline={top:parseFloat(style.paddingTop)||0,left:parseFloat(style.paddingLeft)||0,right:parseFloat(style.paddingRight)||0,bottom:parseFloat(style.paddingBottom)||0};
      const measured=viewport||root;
      const dim=landscapeInsets(spacing(snapshot,version(options),baseline,measured.clientWidth,measured.clientHeight),turned&&turned());
      ['top','left','right','bottom'].forEach(k=>root.style.setProperty('--room-'+k,dim[k]+'px'));
      pixel=dim.dpr || view.devicePixelRatio || 1;
    }
    async function refresh() {
      const ticket=++generation;
      options=await conn.context;
      if(ticket!==generation) return;
      const launch=options&&options.miniToolEnv&&options.miniToolEnv.windowInfo;
      if(launch&&!observed) { snapshot=launch; apply(); }
      const v=version(options);
      if(v===null||v<9490||!conn.api||typeof conn.api.getWindowInfo!=='function') return;
      try {
        const info=await invoke(conn.api,'getWindowInfo',undefined,conn.limit);
        if(ticket===generation&&info&&(info.errMsg===undefined||info.errMsg==='getWindowInfo:ok')) {
          snapshot=info;observed=info;apply();
        }
      } catch(e) { if(ticket===generation) apply(); }
    }
    function schedule() { apply();clearTimeout(pending);pending=setTimeout(refresh,90); }
    apply(); schedule();
    view.addEventListener('resize',schedule);
    view.addEventListener('pageshow',schedule);
    view.document.addEventListener('visibilitychange',()=>{ if(!view.document.hidden) schedule(); });
    return { get dpr(){return pixel;} };
  }
  function storage(conn,onLoad,onStatus) {
    const done={}, saved={};
    let mode='loading', writing=false;
    function state(next) { mode=next; if(onStatus) onStatus(next); }
    function decode(result) {
      if(!result||result.errMsg!=='getStorage:ok') throw new Error('read');
      if(result.data===null) return {};
      if(typeof result.data!=='string') throw new Error('data');
      const data=JSON.parse(result.data);
      if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!keys.includes(k)||data[k]!==true)) throw new Error('schema');
      return data;
    }
    async function persist() {
      if(mode!=='ready'||writing) return;
      writing=true;
      try {
        while(keys.some(k=>done[k]&&!saved[k])) {
          const copy={};keys.forEach(k=>{if(done[k])copy[k]=true;});
          const response=await invoke(conn.api,'setStorage',{key:storageKey,data:JSON.stringify(copy)},conn.limit);
          if(!response||response.errMsg!=='setStorage:ok') throw new Error('write');
          Object.assign(saved,copy);
        }
      } catch(e) { state('write-failed'); }
      finally { writing=false; }
    }
    const ready=conn.context.then(async options=>{
      const ver=version(options), tool=conn.api;
      if(ver===null||ver<9460||!tool||typeof tool.getStorage!=='function'||typeof tool.setStorage!=='function') { state('unavailable');return; }
      let old;
      try { old=decode(await invoke(tool,'getStorage',{key:storageKey},conn.limit)); }
      catch(e) { state('read-failed');return; }
      Object.assign(saved,old);Object.assign(done,old);
      if(onLoad) onLoad(Object.assign({},done));
      state('ready'); await persist();
    });
    return { ready, complete(id) { if(keys.includes(id)){done[id]=true;return persist();} }, get mode(){return mode;} };
  }
  N.Platform={version,connect,spacing,landscapeInsets,windowInsets,storage};
  if(typeof module!=='undefined'&&module.exports) module.exports=N.Platform;
})(typeof window==='undefined'?global:window);
