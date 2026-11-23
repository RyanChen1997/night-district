'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Audio=require('../app/audio.js');

function rig() {
  const sources=[];
  const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}});
  class Context {
    constructor(){this.state='running';this.destination={};this.currentTime=0;this.sampleRate=44100;}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}
    createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
    createBufferSource(){
      const source={loop:false,started:false,connect(){},disconnect(){},start(){this.started=true;}};
      sources.push(source);return source;
    }
  }
  return {sources,view:{AudioContext:Context}};
}

test('entering and standing still does not start a noise loop; shots are bounded one-shots',()=>{
  const {view,sources}=rig(), states=[];
  const audio=Audio.create(view,state=>states.push(state));
  audio.wake('start');audio.traffic(0,false);
  assert.equal(sources.length,0);assert.equal(states.at(-1),'on');
  audio.effect('shot');audio.effect('shot');audio.effect('reply');
  assert.equal(sources.length,3);
  const wave=sources[0].buffer.getChannelData(0);
  assert(sources.every(s=>s.started&&!s.loop));
  assert(wave.some(v=>Math.abs(v)>.4));assert(wave.every(v=>Number.isFinite(v)&&Math.abs(v)<.93));
  assert(wave.slice(-4000).every(v=>v===0));
  assert.notDeepEqual(wave,sources[1].buffer.getChannelData(0));
  audio.toggle();audio.effect('shot');assert.equal(sources.length,3);
});
