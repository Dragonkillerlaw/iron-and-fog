(function(root){'use strict';
const RECORD_STORAGE_KEY='iron-fog-battle-archive';
const SETTINGS_KEY='iron-fog-settings';

function getSettings(){
 const prefersReduced=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let s={sound:false,anim:prefersReduced?'off':'normal'};
 try{
  const raw=localStorage.getItem(SETTINGS_KEY);
  if(raw){
   const p=JSON.parse(raw);
   if(typeof p.sound==='boolean')s.sound=p.sound;
   if(['normal','fast','off'].includes(p.anim))s.anim=p.anim;
  }
 }catch{}
 return s;
}

function saveSettings(s){
 try{
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({sound:!!s.sound,anim:s.anim}));
 }catch{}
}

function calculateMedals(s){
 if(!s||!s.result)return [];
 const medals=[];
 const res=s.result;
 const isTut=s.mode==='tutorial';
 
 // Medal 1: Victory
 medals.push(isTut?'入门通关':'完成战役');
 
 // Medal 2: 迅速制胜 (deadline with >=4 rounds remaining)
 const deadline=isTut?12:24;
 if(deadline - res.round >= 4){
  medals.push('迅速制胜');
 }
 
 // Medal 3: 保存实力 (<=20% winning-side inactive: destroyed+captured+routed <= initial*0.2)
 const winner=res.winner;
 const winnerStats=res.stats?.[winner];
 const initialCount=s.initialCounts?.[winner]||s.units?.filter(u=>u.side===winner).length||0;
 if(winnerStats&&initialCount>0){
  const inactive=(winnerStats.destroyed||0)+(winnerStats.captured||0)+(winnerStats.routed||0);
  if(inactive/initialCount<=0.20001){
   medals.push('保存实力');
  }
 }
 return medals;
}

function getArchiveRecords(){
 try{
  const raw=localStorage.getItem(RECORD_STORAGE_KEY);
  if(!raw)return [];
  const list=JSON.parse(raw);
  if(Array.isArray(list)){
   const ids=new Set();
   return list.filter(r=>{
    if(!r||typeof r!=='object'||typeof r.battleId!=='string'||!r.battleId||ids.has(r.battleId)||!['tutorial','campaign'].includes(r.mode)||!['de','su'].includes(r.winner)||!Number.isInteger(r.round)||r.round<1||typeof r.date!=='string'||!Array.isArray(r.medals))return false;
    ids.add(r.battleId);return true;
   }).slice(0,100).map(r=>({...r,medals:r.medals.filter(m=>['入门通关','完成战役','迅速制胜','保存实力'].includes(m))}));
  }
 }catch{}
 return [];
}

function saveArchiveRecord(record){
 if(!record||!record.battleId)return false;
 const records=getArchiveRecords();
 if(records.some(r=>r.battleId===record.battleId))return false; // deduplicate
 records.unshift(record);
 if(records.length>100)records.splice(100);
 try{
  localStorage.setItem(RECORD_STORAGE_KEY,JSON.stringify(records));
  return true;
 }catch{
  return false;
 }
}

function recordGameResult(s){
 if(!s||!s.result||!s.battleId)return null;
 const medals=calculateMedals(s);
 const now=new Date();
 const dateStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
 const record={
  battleId:s.battleId,
  mode:s.mode==='tutorial'?'tutorial':'campaign',
  winner:s.result.winner,
  round:s.result.round,
  reason:s.result.reason||'',
  date:dateStr,
  medals
 };
 saveArchiveRecord(record);
 return record;
}

const api={
 getSettings,
 saveSettings,
 calculateMedals,
 getArchiveRecords,
 saveArchiveRecord,
 recordGameResult
};

if(typeof module!=='undefined')module.exports=api;
root.BARB_PROGRESS=api;
})(typeof globalThis!=='undefined'?globalThis:this);
