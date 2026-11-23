'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create,discreteTaps}=require('../app/input.js');
function element() {
  const set=new Set(), listeners={};
  return {hidden:false,style:{},tagName:'DIV',clientWidth:320, classList:{add:a=>set.add(a),remove:a=>set.delete(a),contains:a=>set.has(a)},
    contains(e){return e===this;},getBoundingClientRect:()=>({left:26,top:470,width:88,height:88}),
    addEventListener(name,e){(listeners[name]||(listeners[name]=[])).push(e);},
    emit(name,event){event=Object.assign({button:0,cancelable:true,preventDefault(){this.prevented=true;}},event);(listeners[name]||[]).forEach(f=>f(event));return event;}};
}
function make(pointer,turned) {
  const win=element(),room=element(),pad=element(),thumb=element(),scene=element(),gas=element(),brake=element();
  win.document=element();win.document.hidden=false;
  if(pointer) {win.PointerEvent=function (){};room.setPointerCapture=id=>{room.captured=id;};}
  const input=create(win,room,pad,thumb,scene,gas,brake,turned);input.enable(true);
  return {input,win,room,pad,thumb,scene,gas,brake};
}

test('pointer roles remain independent at edges; outside release, cancellation and pause clear held input',()=>{
  const {input,win,room,pad,thumb,scene,gas,brake}=make(true);
  assert(input.pointer);
  room.emit('pointerdown',{pointerType:'touch',pointerId:1,clientX:70,clientY:484,target:pad});assert.equal(room.captured,1);
  room.emit('pointerdown',{pointerType:'touch',pointerId:2,clientX:180,clientY:240,target:scene});
  room.emit('pointerdown',{pointerType:'touch',pointerId:3,clientX:260,clientY:540,target:gas});
  room.emit('pointerdown',{pointerType:'touch',pointerId:4,clientX:260,clientY:540,target:brake});
  const frame0=input.consume();assert(frame0.z>.8&&frame0.gas&&frame0.brake&&frame0.looking);
  win.emit('pointermove',{pointerId:1,pointerType:'touch',clientX:-50,clientY:500});
  win.emit('pointermove',{pointerId:2,pointerType:'touch',clientX:239,clientY:248});
  const frame1=input.consume();assert(frame1.x<-.9&&frame1.lookX>.4&&frame1.lookY>0);assert.equal(input.consume().lookX,0);
  win.emit('pointercancel',{pointerId:3});assert(!input.consume().gas);assert(!gas.classList.contains('held'));
  win.emit('lostpointercapture',{pointerId:1});assert.equal(input.consume().x,0);assert.equal(thumb.style.transform,'');
  win.document.hidden=true;win.document.emit('visibilitychange');assert(!input.consume().brake&&!input.consume().looking);
  input.enable(false);input.action('door');assert.equal(input.consume().door,undefined);
});

test('clockwise stage maps screen taps and left thumb motion into local axes',()=>{
  const {input,win,room,pad,scene}=make(true,()=>true);
  room.clientWidth=650;room.getBoundingClientRect=()=>({left:0,top:0,right:320,bottom:650});
  pad.getBoundingClientRect=()=>({left:14,top:14,width:72,height:72});
  room.emit('pointerdown',{pointerType:'touch',pointerId:1,clientX:50,clientY:50,target:pad});
  room.emit('pointerdown',{pointerType:'touch',pointerId:2,clientX:160,clientY:490,target:scene});
  win.emit('pointermove',{pointerType:'touch',pointerId:1,clientX:77,clientY:50});
  win.emit('pointermove',{pointerType:'touch',pointerId:2,clientX:160,clientY:530});
  const frame=input.consume();assert(frame.z>.9&&Math.abs(frame.x)<1e-8);
  assert(frame.looking&&frame.lookX>.4&&frame.lookY===0);
});

test('fast HUD taps block WebView zoom without swallowing the second click',()=>{
  const root=element();let clicks=0;
  const action={click:()=>clicks++};action.closest=()=>action;
  const t=(identifier,x=40)=>({identifier,target:action,clientX:x,clientY:40});
  const clear=discreteTaps(root);
  for(const id of [9,10]) {
    root.emit('touchstart',{changedTouches:[t(id)]});
    assert(root.emit('touchend',{changedTouches:[t(id)]}).prevented);
  }
  root.emit('touchstart',{changedTouches:[t(11)]});
  assert(root.emit('touchend',{changedTouches:[t(11,80)]}).prevented);
  root.emit('touchstart',{changedTouches:[t(12)]});clear();
  assert(!root.emit('touchend',{changedTouches:[t(12)]}).prevented);
  assert.equal(clicks,2);
});

test('touch fallback owns changed identifiers; mouse/keyboard remain usable separately',()=>{
  const {input,win,room,pad,scene}=make(false);
  const t=(identifier,target,clientX,clientY)=>({identifier,target,clientX,clientY});
  assert(!input.pointer);
  assert(room.emit('touchstart',{changedTouches:[t(3,pad,70,486),t(4,scene,235,250)]}).prevented);
  win.emit('touchmove',{changedTouches:[t(4,scene,255,265)]});
  assert(input.consume().lookX>.1);assert(input.consume().z>.75);
  win.emit('touchend',{changedTouches:[t(4,scene,255,265)]});assert(!input.consume().looking);assert(input.consume().z>.75);
  win.emit('touchcancel',{changedTouches:[t(3,pad,70,486)]});assert.equal(input.consume().z,0);
  win.emit('keydown',{key:'ArrowUp',target:room});assert(input.consume().gas);
  win.emit('pagehide');assert(!input.consume().gas);
  const mouse=make(false);
  mouse.room.emit('mousedown',{target:mouse.scene,clientX:200,clientY:320});assert(mouse.input.consume().looking);
  mouse.win.emit('mouseout',{relatedTarget:null});assert(!mouse.input.consume().looking);
});
