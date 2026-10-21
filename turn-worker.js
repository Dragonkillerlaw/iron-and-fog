// The same task implementation runs in a Worker, or one unit at a time as a fallback.
if(typeof importScripts==='function')importScripts('scenario.js','engine.js?v=0.5.2');
(function(root){'use strict';
 const E=typeof module!=='undefined'?require('./engine.js'):root.BARB_ENGINE;
 function snapshot(s){return {...s,_supply:undefined,_events:[]};}
 function runTask(s,task){
  let result=null,consumed=0;
  const events=[];
  if(task.kind==='endTurn')result=E.endTurn(s);
  else if(task.kind==='air'){
   result=E.aiAirStep(s);
   E.checkOutcome(s);
  }else if(task.kind==='units'){
   const start=performance.now();
   for(const id of task.ids){
    if(E.checkOutcome(s))break;
    E.aiStep(s,id);consumed++;
    events.push(...E.drainEvents(s));
    // Bound snapshot latency without occupying the UI thread.
    if(performance.now()-start>=60)break;
   }
  }else throw Error('Unknown turn task');
  events.push(...E.drainEvents(s));
  // Send ready-to-use vision caches so drawing never recomputes line of sight.
  E.vision(s,'de');E.vision(s,'su');
  return {state:snapshot(s),result,events,consumed};
 }
 const api={runTask,snapshot};
 if(typeof module!=='undefined')module.exports=api;
 root.BARB_TURN=api;
 if(typeof importScripts==='function')root.onmessage=({data})=>{
  try{root.postMessage(runTask(data.state,data.task));}
  catch(error){root.postMessage({error:String(error.message||error)});}
 };
})(typeof globalThis!=='undefined'?globalThis:this);
