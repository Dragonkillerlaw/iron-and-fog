(function(root){'use strict';
const D=typeof module!=='undefined'?require('./scenario.js'):root.BARBAROSSA;

let audioCtx=null;
let audioAllowed=false; // resume/enable ONLY from user gesture
let lastSoundTime=0;
const activeTimers=new Set();

function registerTimer(fn,ms){
 const id=setTimeout(()=>{
  activeTimers.delete(id);
  fn();
 },ms);
 activeTimers.add(id);
 return id;
}

function clearAll(){
 for(const id of activeTimers){
  clearTimeout(id);
 }
 activeTimers.clear();
 if(typeof document!=='undefined'){
  const fxOverlay=document.getElementById('fxOverlay');
  if(fxOverlay)fxOverlay.innerHTML='';
  const airOverlay=document.getElementById('airOverlay');
  if(airOverlay)airOverlay.innerHTML='';
  const fx=document.getElementById('fx');
  if(fx)fx.innerHTML='';
  const wrap=document.getElementById('mapWrap');
  if(wrap){
   wrap.querySelectorAll('.fx-floating-notice, .fx-floating-banner, .fx-center-banner').forEach(el=>el.remove());
  }
 }
}

function userAudioGesture(){
 audioAllowed=true;
 if(!audioCtx){
  try{
   const AC=window.AudioContext||window.webkitAudioContext;
   if(AC)audioCtx=new AC();
  }catch{}
 }
 if(audioCtx&&audioCtx.state==='suspended'){
  audioCtx.resume().catch(()=>{});
 }
}

function playTone(freq,type,dur,gainVal=0.04){
 if(!audioAllowed||!audioCtx)return;
 try{
  if(audioCtx.state!=='running')return;
  const t=audioCtx.currentTime;
  const osc=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(freq,t);
  gain.gain.setValueAtTime(gainVal,t);
  gain.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t+dur);
 }catch{}
}

function playNoise(dur,gainVal=0.04,isBurst=false){
 if(!audioAllowed||!audioCtx)return;
 try{
  if(audioCtx.state!=='running')return;
  const bufferSize=Math.max(1,Math.floor(audioCtx.sampleRate*dur));
  const buffer=audioCtx.createBuffer(1,bufferSize,audioCtx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++){
   data[i]=(Math.random()*2-1)*(isBurst?(Math.sin(i*0.05)>0?1:0.2):1);
  }
  const noise=audioCtx.createBufferSource();
  noise.buffer=buffer;
  const gain=audioCtx.createGain();
  const t=audioCtx.currentTime;
  gain.gain.setValueAtTime(gainVal,t);
  gain.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  noise.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(t);
 }catch{}
}

function playCue(type,soundEnabled){
 if(!soundEnabled||!audioAllowed)return;
 const now=Date.now();
 if(now-lastSoundTime<80)return; // throttle sounds >=80ms
 lastSoundTime=now;

 try{
  if(type==='mg'){
   playNoise(0.2,0.035,true);
  }else if(type==='heavy'||type==='artillery'||type==='armor'||type==='at'){
   playTone(110,'triangle',0.25,0.05);
   playNoise(0.18,0.03);
  }else if(type==='impact'){
   playTone(140,'triangle',0.18,0.04);
   playNoise(0.12,0.025);
  }else if(type==='heal'||type==='resupply'){
   playTone(440,'sine',0.1,0.03);
   registerTimer(()=>playTone(660,'sine',0.15,0.03),90);
  }else if(type==='city'||type==='promotion'||type==='bridge'){
   playTone(330,'triangle',0.1,0.035);
   registerTimer(()=>playTone(495,'triangle',0.12,0.035),100);
   registerTimer(()=>playTone(660,'triangle',0.16,0.035),200);
  }else if(type==='defeated'){
   playTone(220,'sawtooth',0.2,0.03);
   registerTimer(()=>playTone(147,'sawtooth',0.25,0.03),130);
  }else if(type==='move'){
   playTone(180,'sine',0.06,0.02);
  }
 }catch{}
}

function addTransientOverlay(svgGroup,contentHtml,durMs){
 if(!svgGroup)return;
 while(svgGroup.childNodes.length>=24){
  svgGroup.removeChild(svgGroup.firstChild);
 }
 const g=document.createElementNS('http://www.w3.org/2000/svg','g');
 g.innerHTML=contentHtml;
 svgGroup.appendChild(g);
 if(durMs>0){
  registerTimer(()=>{
   if(g&&g.parentNode)g.parentNode.removeChild(g);
  },durMs);
 }
}

function showFloatingNotice(mapWrapEl,x,y,text,cls,durMs=1000){
 if(!mapWrapEl)return;
 const notices=mapWrapEl.querySelectorAll('.fx-floating-notice, .fx-floating-banner');
 if(notices.length>=24){
  notices[0].remove();
 }
 const el=document.createElement('div');
 el.className='fx-floating-banner fx-floating-notice '+cls;
 el.textContent=text;
 el.style.left=x+'px';
 el.style.top=y+'px';
 mapWrapEl.appendChild(el);
 registerTimer(()=>{
  if(el&&el.parentNode)el.parentNode.removeChild(el);
 },durMs);
}

function screenCoordsForHex(svgEl,q,r){
 try{
  const pos=D.position(q,r);
  const p=svgEl.createSVGPoint();
  p.x=pos.x;
  p.y=pos.y;
  const ctm=svgEl.getScreenCTM();
  if(!ctm)return {x:0,y:0,svgX:pos.x,svgY:pos.y};
  const screenP=p.matrixTransform(ctm);
  const wrap=svgEl.closest('#mapWrap')||svgEl.parentElement;
  const rect=wrap.getBoundingClientRect();
  return {
   x:screenP.x-rect.left,
   y:screenP.y-rect.top,
   svgX:pos.x,
   svgY:pos.y
  };
 }catch{
  return {x:100,y:100,svgX:0,svgY:0};
 }
}

function renderBannerNotice(mapWrapEl,text,cls='notice-city',durMs=2200){
 if(!mapWrapEl)return;
 while(mapWrapEl.querySelectorAll('.fx-center-banner').length>=3){
  mapWrapEl.querySelector('.fx-center-banner').remove();
 }
 const banner=document.createElement('div');
 banner.className='fx-center-banner '+cls;
 banner.textContent=text;
 mapWrapEl.appendChild(banner);
 mapWrapEl.querySelectorAll('.fx-center-banner').forEach((el,i)=>{el.style.top=(20+i*48)+'px';});
 registerTimer(()=>{
  if(banner&&banner.parentNode)banner.parentNode.removeChild(banner);
 },durMs);
}

const api={
 userAudioGesture,
 playCue,
 clearAll,
 addTransientOverlay,
 showFloatingNotice,
 screenCoordsForHex,
 renderBannerNotice
};

if(typeof module!=='undefined')module.exports=api;
root.BARB_EFFECTS=api;
})(typeof globalThis!=='undefined'?globalThis:this);
