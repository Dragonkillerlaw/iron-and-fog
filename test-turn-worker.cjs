const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const path=require('node:path');
const E=require('./engine');
const T=require('./turn-worker');
const worker=new Worker(`
 const {parentPort,workerData}=require('node:worker_threads');
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const context=vm.createContext({performance,postMessage:m=>parentPort.postMessage(m)});
 context.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.join(workerData,f.split('?')[0]),'utf8'),context);};
 vm.runInContext(fs.readFileSync(path.join(workerData,'turn-worker.js'),'utf8'),context);
 parentPort.on('message',data=>context.onmessage({data}));
`,{eval:true,workerData:__dirname});
function request(state,task){return new Promise((resolve,reject)=>{
 const fail=e=>{worker.off('message',receive);reject(e);};
 const receive=data=>{worker.off('error',fail);data.error?reject(Error(data.error)):resolve(data);};
 worker.once('error',fail);worker.once('message',receive);worker.postMessage({state:T.snapshot(state),task});
});}
async function round(s,side,background){
 const allEvents=[];
 const run=async task=>{
  let p=background?await request(s,task):T.runTask(s,task);
  s=p.state;allEvents.push(...p.events);return p;
 };
 if(s.active===side||side==='god')await run({kind:'endTurn'});
 if(side!=='god'&&s.active!==side&&!s.result){
  for(let i=0;i<4&&!s.result;i++)if(!(await run({kind:'air'})).result?.ok)break;
  const ids=s.units.filter(u=>E.alive(u)&&u.side===s.active).map(u=>u.id);
  for(let i=0;i<ids.length&&!s.result;){
   const p=await run({kind:'units',ids:ids.slice(i,i+(background?8:1))});
   i+=p.consumed;if(!p.consumed)break;
  }
  if(!s.result)await run({kind:'endTurn'});
 }
 return {state:JSON.parse(E.serialize(s)),events:allEvents};
}
(async()=>{
 try{
  for(const [mode,side] of [['campaign','de'],['campaign','su'],['tutorial','de'],['tutorial','god']]){
   const raw=E.serialize(E.newGame(mode));
   const expected=await round(E.restore(raw),side,false);
   let ticks=0;const timer=setInterval(()=>ticks++,5);
   const actual=await round(E.restore(raw),side,true);clearInterval(timer);
   assert.deepEqual(actual,expected);
   assert(E.restore(JSON.stringify(actual.state)),'result must load as a save');
   if(mode==='campaign')assert(ticks>10,'main thread must stay responsive');
   console.log('PASS worker/fallback state and events match:',mode,side,'UI heartbeat ticks:',ticks);
  }
 }finally{await worker.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
