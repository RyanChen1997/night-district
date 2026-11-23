(function (out) {
  'use strict';
  const N=out.District=out.District||{};
  const sounds={start:[440,660,.21,.15,'sine'],door:[156,67,.12,.18,'triangle'],step:[92,43,.075,.075,'triangle'],
    horn:[255,240,.24,.13,'triangle'],swing:[138,83,.09,.068,'triangle'],punch:[114,47,.115,.23,'triangle'],
    impact:[112,33,.19,.30,'triangle'],arrested:[233,116,.45,.24,'triangle'],downed:[98,39,.54,.29,'triangle']};
  // Original one-shot effects. The noise has an envelope and is never played as a loop.
  function burst(rate,variant,distant) {
    const samples=new Float32Array(Math.round(rate*.42));
    const first=Math.round(rate*.14), bounce=Math.round(rate*.058), far=Math.round(rate*.119);
    let rng=(7739+417*variant)>>>0, low=0, upper=0;
    for(let i=0;i<first;i++) {
      rng=(Math.imul(rng,1664525)+1013904223)>>>0;
      const n=(rng/4294967296-.5)*2,t=i/rate;
      low+=.092*(n-low);upper+=.52*(n-upper);
      const attack=Math.min(1,t/.0019), tail=Math.min(1,(.14-t)/.02);
      const crack=upper*Math.exp(-t*93)*(distant?.26:.79);
      const body=(low*.7+Math.sin(t*(640-530*t))*.51)*Math.exp(-t*49);
      const sample=(crack+body)*attack*tail;
      samples[i]+=sample;
      samples[i+bounce]+=sample*.22;
      samples[i+far]+=sample*.11;
    }
    let peak=.92;
    for(const v of samples) peak=Math.max(peak,Math.abs(v));
    if(peak>.92) for(let i=0;i<samples.length;i++) samples[i]*=.92/peak;
    return samples;
  }
  function create(view,onState) {
    const Context=view.AudioContext||view.webkitAudioContext;
    let ac=null,mix=null,burstBank=[],shotIndex=0,exhaust=null,exhaustGain=null,muted=false,idle=false,pending=null;
    function state() {
      onState(muted?'muted':!Context?'unavailable':ac&&ac.state==='running'?'on':'tap');
    }
    function setLevel(node,gain,seconds) {
      if(node&&ac) node.gain.setTargetAtTime(gain,ac.currentTime,seconds||.06);
    }
    function levels() {
      setLevel(mix,muted||idle?0:.72);
      if(exhaustGain&&(muted||idle)) setLevel(exhaustGain,0);
    }
    function build() {
      ac=new Context();mix=ac.createGain();mix.gain.value=0;mix.connect(ac.destination);
      burstBank=[];
      exhaust=ac.createOscillator();exhaust.type='triangle';exhaust.frequency.value=38;
      exhaustGain=ac.createGain();exhaustGain.gain.value=0;exhaust.connect(exhaustGain);exhaustGain.connect(mix);exhaust.start();
      if(typeof ac.addEventListener==='function') ac.addEventListener('statechange',state);
      levels();
    }
    function wake(name) {
      idle=false;
      if(muted||!Context) {state();return;}
      try {
        if(ac&&ac.state==='closed') ac=mix=exhaust=exhaustGain=pending=null;
        if(!ac) build();
        levels();
        if(ac.state==='running') {state();if(name) effect(name);return;}
        if(pending) return;
        const attempt=Promise.resolve(ac.resume());pending=attempt;
        attempt.then(()=>{if(pending===attempt){pending=null;state();if(name) effect(name);}},()=>{if(pending===attempt){pending=null;state();}});
      } catch(e) {
        if(ac&&typeof ac.close==='function') Promise.resolve(ac.close()).catch(()=>{});
        ac=mix=exhaust=exhaustGain=null;state();
      }
    }
    function playBurst(name) {
      const distant=name==='reply', index=distant?3:shotIndex++%3;
      if(!burstBank[index]) {
        const samples=burst(ac.sampleRate,index,distant), buffer=ac.createBuffer(1,samples.length,ac.sampleRate);
        buffer.getChannelData(0).set(samples);burstBank[index]=buffer;
      }
      const src=ac.createBufferSource(), amp=ac.createGain();
      src.buffer=burstBank[index];amp.gain.value=distant?.42:.68;
      src.connect(amp);amp.connect(mix);src.onended=()=>{src.disconnect();amp.disconnect();};src.start();
    }
    function effect(name) {
      if(!ac||ac.state!=='running'||muted||idle||!mix) return;
      try {
        if(name==='shot'||name==='reply') {playBurst(name);return;}
        const params=sounds[name];if(!params) return;
        const [from,to,length,loud,type]=params, t=ac.currentTime;
        const osc=ac.createOscillator(), amp=ac.createGain();osc.type=type;
        osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+length);
        amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(loud,t+.009);
        amp.gain.exponentialRampToValueAtTime(.0001,t+length);osc.connect(amp);amp.connect(mix);
        osc.onended=()=>{osc.disconnect();amp.disconnect();};osc.start(t);osc.stop(t+length+.01);
      } catch(e) { /* audio must not interrupt the game */ }
    }
    function traffic(speed,driving) {
      if(!ac||!exhaust||ac.state!=='running'||muted||idle) return;
      const s=Math.abs(speed||0);
      exhaust.frequency.setTargetAtTime(37+s*6.2,ac.currentTime,.10);
      setLevel(exhaustGain,driving?.047+s*.0034:0,.12);
    }
    function toggle() {
      if(!Context) {state();return;}
      if(!muted&&(!ac||ac.state!=='running')) {wake('start');return;}
      muted=!muted;levels();state();if(!muted) wake('start');
    }
    function quiet(suspend) {
      idle=true;levels();
      if(suspend&&ac&&typeof ac.suspend==='function') Promise.resolve(ac.suspend()).catch(()=>{});
    }
    state();
    return {wake,quiet,toggle,effect,traffic};
  }
  N.Audio={create,burst};
  if(typeof module!=='undefined'&&module.exports) module.exports=N.Audio;
})(typeof window==='undefined'?global:window);
