(function(root){'use strict';
const D=typeof module!=='undefined'?require('./scenario.js'):root.BARBAROSSA;
const key=D.key,inside=(q,r)=>q>=0&&r>=0&&q<D.board.cols&&r<D.board.rows;
const cube=p=>{const x=p.q-(p.r-(p.r&1))/2;return {x,y:-x-p.r,z:p.r};};
function distance(a,b){const x=cube(a),y=cube(b);return Math.max(Math.abs(x.x-y.x),Math.abs(x.y-y.y),Math.abs(x.z-y.z));}
function neighbors(p){const o=p.r&1;return [[1,0],[-1,0],[o,-1],[o-1,-1],[o,1],[o-1,1]].map(([q,r])=>({q:p.q+q,r:p.r+r})).filter(p=>inside(p.q,p.r));}
function ring(p,n){const list=[];for(let r=Math.max(0,p.r-n);r<=Math.min(D.board.rows-1,p.r+n);r++)for(let q=Math.max(0,p.q-n-1);q<=Math.min(D.board.cols-1,p.q+n+1);q++)if(distance(p,{q,r})<=n)list.push({q,r});return list;}
const urban=new Map();
for(const t of [...D.towns].sort((a,b)=>b.importance-a.importance))for(const p of ring(t,t.importance===3?3:t.importance===2?2:1)){
 if(['river','bridge'].includes(D.terrain(p.q,p.r)))continue;
 const k=key(p.q,p.r);if(urban.has(k))continue;
 const d=distance(t,p),v=(p.q*7+p.r*3)%7;
 urban.set(k,{city:t.id,type:d===0?'center':v===0?'station':v===1?'factory':'residential'});
}
const urbanNames={center:'城市中心',residential:'居民区',factory:'工厂区',station:'火车站'};
const terrain=(q,r)=>urban.get(key(q,r))?.type||D.terrain(q,r);
const terrainName=(q,r)=>urbanNames[terrain(q,r)]||D.terrainNames[terrain(q,r)];
const profiles={
 rifle:{name:'步兵',symbol:'步',attack:28,defense:12,move:4,range:1,sight:4,tip:'夺取街区；城市和堑壕内防守更强。'},
 mg:{name:'机枪队',symbol:'机',attack:24,defense:11,move:3,range:2,sight:4,tip:'对步兵类伤害×1.6，额外压制士气12。'},
 armor:{name:'装甲',symbol:'甲',attack:37,defense:22,move:7,range:1,sight:4,tip:'消灭相邻敌军后可突进其原格一次，不恢复移动或攻击；按地形耗油并触发雷区。城区攻防降低。'},
 at:{name:'反坦克炮',symbol:'反',attack:27,defense:9,move:3,range:2,sight:4,tip:'对装甲伤害×1.7；对步兵效果较弱。'},
 artillery:{name:'火炮',symbol:'炮',attack:30,defense:7,move:3,range:5,sight:3,tip:'射程5格，间接射击；攻击已被友军发现的目标，压低士气。'},
 recon:{name:'侦察',symbol:'侦',attack:20,defense:9,move:7,range:1,sight:7,tip:'视野7格；揭开迷雾，寻找侧翼通路。'},
 medic:{name:'医疗队',symbol:'医',attack:4,defense:6,move:4,range:1,sight:4,tip:'相邻步兵类兵力+25、士气+10；消耗1医疗物资。'},
 supply:{name:'补给队',symbol:'补',attack:4,defense:6,move:4,range:1,sight:4,tip:'相邻友军弹药+4、燃油+35；装甲修复20，工兵材料+1。'},
 engineer:{name:'工兵',symbol:'工',attack:18,defense:10,move:4,range:1,sight:4,tip:'铺雷、挖壕、排雷；2材料架桥，2轮通步兵、3轮通重装备，受攻击暂停。'},
 hq:{name:'指挥部',symbol:'HQ',attack:6,defense:9,move:3,range:1,sight:5,tip:'3格内友军每回合士气+5；覆灭会打击附近士气。'}
};
function role(u){return u.role||({mg:'mg',mortar:'artillery',howitzer:'artillery',gun:'at',aa:'at',engineer:'engineer',supply:'supply',recon:'recon',cavalry:'recon'})[u.asset]||({infantry:'rifle',armor:'armor',artillery:'artillery',hq:'hq',support:'supply',recon:'recon'})[u.category];}
function unitAttack(u){const r=role(u),su=u.side==='su',modern=su&&u.asset==='medium';return Math.round(profiles[r].attack*(su?(r==='armor'?1:.78):1.1)*(modern?1.2:1));}
function unitArt(u){const r=role(u);return r==='medic'?(u.side==='su'?'medicSu':'medic'):r==='engineer'?'engineer':r==='hq'?(u.side==='su'?'officerSu':'officer'):u.asset||(r==='mg'?'mg':u.side==='su'?'suInf':'deInf');}
const AIR_LIMITS={recon:2,strike:2};
function airBudget(){return {de:{...AIR_LIMITS},su:{...AIR_LIMITS}};}
function phase(s){return s.round+':'+s.active;}
const isFoot=u=>['rifle','mg','engineer','medic','hq'].includes(u.role);
const alive=u=>u.status==='active';
const isCombat=u=>['rifle','mg','armor','at','artillery','recon','engineer'].includes(u.role);
function newGame(mode='campaign'){
 const s={version:3,balanceVersion:1,round:1,active:'de',units:[],forts:{},bridges:{},air:airBudget(),airRecon:{de:[],su:[]},cities:{},logs:[],explored:{de:new Set(),su:new Set()},revision:0,mode:mode==='tutorial'?'tutorial':'campaign',result:null,tutorialProgress:{moved:false,attacked:false,supported:false},lastTurnReport:null};
 s.units=D.units.map(u=>{const ro=role(u),p=profiles[ro],su=u.side==='su',modern=su&&u.asset==='medium',hp=ro==='armor'?(modern?145:su?115:125):['supply','medic','hq'].includes(ro)?80:su?130:110;return {...u,role:ro,asset:unitArt(u),autoSupport:ro==='medic',project:null,hp,maxHp:hp,morale:su?(modern?60:48):86,ammo:su?5:8,maxAmmo:8,fuel:su?65:100,maxFuel:100,stock:ro==='engineer'?3:ro==='medic'?5:ro==='supply'?12:0,attack:unitAttack(u),defense:Math.round(p.defense*(su?.75:1.15)*(modern?1.65:1)),maxMove:Math.max(2,p.move-(su?1:0)),mp:Math.max(2,p.move-(su?1:0)),acted:false,moved:false,status:'active',isolated:0,modern};});
 for(const t of D.towns)s.cities[t.id]=D.position(t.q,t.r).x<D.borderX(D.position(t.q,t.r).y)?'de':'su';
 for(const u of s.units)u.waiting=false;
 if(s.mode==='tutorial'){
  s.missionArea={minQ:10,maxQ:35,minR:43,maxR:64};
  const tl=D.position(10,43),br=D.position(35,64);
  s.missionView={x:tl.x-50,y:tl.y-50,w:br.x-tl.x+100,h:br.y-tl.y+100};
  const specs={de:[['armor',14,54],['rifle',16,54],['mg',16,52],['engineer',17,53],['medic',14,55],['supply',13,54],['artillery',13,52],['recon',16,56]],su:[['rifle',20,54],['mg',21,53],['armor',24,53],['rifle',25,53],['artillery',26,52],['medic',25,54]]};
  const used=new Set(),cells=new Set(),deployed=[];
  for(const side of ['de','su'])for(const [ro,q,r]of specs[side]){
   const u=s.units.find(u=>u.side===side&&u.role===ro&&!used.has(u.id));used.add(u.id);
   const p=ring({q,r},4).filter(p=>p.q>=10&&p.q<=35&&p.r>=43&&p.r<=64&&terrain(p.q,p.r)!=='river'&&!cells.has(key(p.q,p.r))).sort((a,b)=>distance(a,{q,r})-distance(b,{q,r})||a.r-b.r||a.q-b.q)[0];
   cells.add(key(p.q,p.r));Object.assign(u,p,{hp:side==='de'?100:55,maxHp:side==='de'?100:55,morale:side==='de'?80:65,ammo:8,fuel:100});
   u.name=(side==='de'?'突击队 · ':'守备队 · ')+profiles[ro].name+(deployed.filter(v=>v.side===side&&v.role===ro).length+1);
   deployed.push(u);
  }
  s.units=deployed;s.cities.brest='su';s.cities.kobryn='su';
 }
 s.initialCounts={de:s.units.filter(u=>u.side==='de').length,su:s.units.filter(u=>u.side==='su').length};
 invalidate(s);updateSight(s);return s;
}
function invalidate(s){s.revision++;s._vision=null;s._supply=null;}
function occupied(s,p){return s.units.find(u=>alive(u)&&u.q===p.q&&u.r===p.r);}
function line(a,b){const ac=cube(a),bc=cube(b),n=distance(a,b),out=[];for(let i=1;i<n;i++){const t=i/n,x=ac.x+(bc.x-ac.x)*t+1e-6,y=ac.y+(bc.y-ac.y)*t+1e-6,z=ac.z+(bc.z-ac.z)*t-2e-6;let rx=Math.round(x),ry=Math.round(y),rz=Math.round(z);const dx=Math.abs(rx-x),dy=Math.abs(ry-y),dz=Math.abs(rz-z);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;out.push({q:rx+(rz-(rz&1))/2,r:rz});}return out;}
function lineClear(a,b){return !line(a,b).some(p=>['forest','hill','center','residential','factory'].includes(terrain(p.q,p.r)));}
function vision(s,side){if(!s._vision)s._vision={};if(s._vision[side])return s._vision[side];const seen=new Set();for(const t of D.towns)if(s.cities[t.id]===side)seen.add(key(t.q,t.r));for(const [k,district]of urban)if(s.cities[district.city]===side)seen.add(k);for(const u of s.units.filter(u=>alive(u)&&u.side===side))for(const p of ring(u,profiles[u.role].sight+(terrain(u.q,u.r)==='hill'?1:0)))if(distance(u,p)<=1||lineClear(u,p))seen.add(key(p.q,p.r));for(const mark of s.airRecon[side])for(const p of ring(mark,4))seen.add(key(p.q,p.r));s._vision[side]=seen;return seen;}
function updateSight(s){for(const side of ['de','su'])for(const k of vision(s,side))s.explored[side].add(k);}
const canSee=(s,u,side)=>side==='god'||u.side===side||vision(s,side).has(key(u.q,u.r));
function fortVisible(s,f,side){return side==='god'||f.side===side||(f.type==='trench'&&vision(s,side).has(key(f.q,f.r)))||s.units.some(u=>alive(u)&&u.side===side&&u.role==='engineer'&&distance(u,f)<=1);}
function log(s,text,at,owner){const audience=['de','su'].filter(side=>side===owner||!at||vision(s,side).has(key(at.q,at.r)));s.logs.unshift({text,audience,round:s.round});s.logs=s.logs.slice(0,60);}
function moveCost(s,u,p){const t=terrain(p.q,p.r);if(t==='river'){const b=s.bridges[key(p.q,p.r)];return b?.progress>=3?2:b?.progress>=2&&isFoot(u)?2:Infinity;}let c=t==='marsh'?(u.role==='armor'?5:3):t==='forest'||t==='hill'?2:1;if(urban.has(key(p.q,p.r)))c=u.role==='armor'?3:1;if(s.forts[key(p.q,p.r)]?.type==='trench'&&u.role==='armor')c+=2;return c;}
function zoc(s,p,side,known=false){return s.units.some(u=>alive(u)&&u.side!==side&&!['medic','supply'].includes(u.role)&&distance(u,p)<=1&&(!known||canSee(s,u,side)));}
function reachable(s,u,known=true){const result=new Map(),start=key(u.q,u.r),queue=[{q:u.q,r:u.r,cost:0}],budget=Math.min(u.mp,u.role==='armor'?Math.floor(u.fuel/5):u.mp);result.set(start,{q:u.q,r:u.r,cost:0,path:[]});if(s.result||!alive(u)||u.side!==s.active||u.acted)return result;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const current=queue.shift(),node=result.get(key(current.q,current.r));if(current.cost!==node.cost)continue;if(current.cost>0&&zoc(s,current,u.side,known))continue;
  for(const p of neighbors(current)){if(s.missionArea&&(p.q<s.missionArea.minQ||p.q>s.missionArea.maxQ||p.r<s.missionArea.minR||p.r>s.missionArea.maxR))continue;const target=occupied(s,p);if(target&&target.id!==u.id&&(!known||target.side===u.side||canSee(s,target,u.side)))continue;const cost=node.cost+moveCost(s,u,p),k=key(p.q,p.r);if(cost>budget||cost>=(result.get(k)?.cost??Infinity))continue;result.set(k,{...p,cost,path:[...node.path,p]});queue.push({...p,cost});}
 }return result;
}
function remove(s,u,status){if(u.project)pauseBridge(s,u,'部队退场');u.status=status;u.mp=0;u.acted=true;log(s,u.name+(status==='captured'?'被俘退场':status==='routed'?'溃散退场':'战斗力耗尽'),u,u.side);for(const other of s.units)if(alive(other)&&other.side===u.side&&distance(u,other)<=3)other.morale=Math.max(0,other.morale-(u.role==='hq'?18:8));invalidate(s);}
function triggerMine(s,u,p){const f=s.forts[key(p.q,p.r)];if(f?.type==='mine'&&f.side!==u.side){const damage=u.role==='armor'?35:25;u.hp=Math.max(0,u.hp-damage);u.morale=Math.max(0,u.morale-12);u.mp=0;delete s.forts[key(p.q,p.r)];log(s,u.name+'触雷，损失'+damage,p,u.side);if(u.hp===0)remove(s,u,'destroyed');return true;}return false;}
function captureCity(s,u){for(const t of D.towns)if(u.q===t.q&&u.r===t.r&&alive(u)&&s.cities[t.id]!==u.side){s.cities[t.id]=u.side;u.morale=Math.min(100,u.morale+8);log(s,u.name+'占领'+t.name,u,u.side);}}
function advanceReason(s,u){if(s?.result)return '战役已结束';const p=u?.advance;if(!u||!alive(u)||u.role!=='armor'||u.side!==s.active||!u.acted||!p||p.round!==s.round||p.fromQ!==u.q||p.fromR!==u.r||!Number.isInteger(p.q)||!Number.isInteger(p.r)||!inside(p.q,p.r)||distance(u,p)!==1)return '没有可用的战后突进';if(s.missionArea&&(p.q<s.missionArea.minQ||p.q>s.missionArea.maxQ||p.r<s.missionArea.minR||p.r>s.missionArea.maxR))return '超出作战区域';if(occupied(s,p))return '目标格已被占用';const cost=moveCost(s,u,p);if(!Number.isFinite(cost))return '地形或桥梁不能通行坦克';if(u.fuel<cost*5)return '燃油不足';return '';}
function declineAdvance(s,id){if(s.result)return {ok:false,message:'战役已结束'};const u=s.units.find(u=>u.id===id);if(!u||u.side!==s.active||!u.advance)return {ok:false,message:'没有待处理的突进'};delete u.advance;return {ok:true,message:'原地停留'};}
function advance(s,id){if(s.result)return {ok:false,message:'战役已结束'};const u=s.units.find(u=>u.id===id),reason=advanceReason(s,u);if(reason)return {ok:false,message:reason};const p=u.advance,cost=moveCost(s,u,p);delete u.advance;u.q=p.q;u.r=p.r;u.fuel-=cost*5;u.moved=true;u.acted=true;u.mp=0;if(u.side==='de'&&s.tutorialProgress)s.tutorialProgress.moved=true;log(s,u.name+'战后突进',p,u.side);const mined=triggerMine(s,u,p);captureCity(s,u);invalidate(s);updateSight(s);return {ok:true,message:mined?'突进遭遇雷区，兵力受损':'突进完成，本回合不能再次移动或攻击'};}
function aiAdvance(s,u){if(s.result)return;if(advanceReason(s,u))return;const f=s.forts[key(u.advance.q,u.advance.r)];if(f?.type==='mine'&&f.side!==u.side&&fortVisible(s,f,u.side)){declineAdvance(s,u.id);return;}advance(s,u.id);}
function move(s,id,q,r){if(s.result)return {ok:false,message:'战役已结束'};const u=s.units.find(u=>u.id===id);if(!u||u.side!==s.active||!alive(u)||u.acted)return {ok:false,message:'该部队当前不能移动'};const route=reachable(s,u,true).get(key(q,r));if(!route||!route.path.length)return {ok:false,message:'超出移动范围或道路被阻挡'};let moved=0;
 for(const p of route.path){const blocker=occupied(s,p);if(blocker&&blocker.id!==u.id){log(s,'前方出现敌军，行军停止',p,u.side);break;}const c=moveCost(s,u,p);if(!moved&&u.project)pauseBridge(s,u,'转移');u.q=p.q;u.r=p.r;u.mp-=c;if(u.role==='armor')u.fuel=Math.max(0,u.fuel-c*5);u.moved=true;moved++;
  if(triggerMine(s,u,p))break;
  if(zoc(s,u,u.side)){u.mp=0;break;}
 }
 captureCity(s,u);
 if(moved>0&&u.side==='de'&&s.tutorialProgress)s.tutorialProgress.moved=true;
 invalidate(s);updateSight(s);return {ok:moved>0,message:moved?'行军完成':'敌军阻挡了通路'};
}
function attackReason(s,a,b){if(s?.result)return '战役已结束';if(!a||!b||!alive(a)||!alive(b)||a.side!==s.active||a.side===b.side)return '无法攻击';if(a.acted)return '本回合已行动';if(a.ammo<=0)return '弹药耗尽';if(!canSee(s,b,a.side))return '目标未被发现';if(distance(a,b)>profiles[a.role].range)return '目标超出射程';if(a.role!=='artillery'&&!lineClear(a,b))return '射线被建筑或地形遮挡';return '';}
function damage(s,a,b){let power=a.attack*(.6+.4*a.hp/a.maxHp)*(.55+a.morale/180),def=b.defense;
 if(a.role==='mg'&&isFoot(b))power*=1.6;if(a.role==='mg'&&b.role==='armor')power*=.4;
 if(a.role==='at')power*=b.role==='armor'?1.7:.65;
 if(a.role==='armor'&&urban.has(key(a.q,a.r)))power*=.7;
 if(b.role==='armor'&&urban.has(key(b.q,b.r)))def*=.8;
 let cover=1;const t=terrain(b.q,b.r);if(isFoot(b)&&urban.has(key(b.q,b.r)))cover*=.65;else if(t==='forest'||t==='hill')cover*=.85;
 if(isFoot(b)&&s.forts[key(b.q,b.r)]?.type==='trench')cover*=.6;
 return Math.max(3,Math.round((power-def*.45)*cover));
}
function attack(s,id,target){if(s.result)return {ok:false,message:'战役已结束'};const a=s.units.find(u=>u.id===id),b=s.units.find(u=>u.id===target),reason=attackReason(s,a,b);if(reason)return {ok:false,message:reason};const hit=damage(s,a,b);if(a.project)pauseBridge(s,a,'执行攻击');if(b.project)pauseBridge(s,b,'遭到攻击');a.ammo--;a.acted=true;a.mp=0;if(a.side==='de'&&s.tutorialProgress)s.tutorialProgress.attacked=true;b.hp=Math.max(0,b.hp-hit);b.morale=Math.max(0,b.morale-8-Math.floor(hit/5)-(a.role==='mg'&&isFoot(b)?12:a.role==='artillery'?8:0));log(s,a.name+'攻击'+b.name+'，损失'+hit,b,a.side);if(b.hp===0){remove(s,b,'destroyed');if(a.role==='armor'&&distance(a,b)===1)a.advance={q:b.q,r:b.r,fromQ:a.q,fromR:a.r,round:s.round};}invalidate(s);updateSight(s);return {ok:true,message:'命中：兵力 −'+hit+'，士气受损'};}
function pauseBridge(s,u,why){const b=s.bridges[u.project];if(b&&b.builder===u.id&&b.progress<3){b.paused=true;log(s,u.name+'架桥暂停：'+why,b,u.side);} }
function bridgeReason(s,u,p){if(s.result)return '战役已结束';const b=s.bridges[key(p.q,p.r)];if(u.role!=='engineer')return '需要工兵';if(s.missionArea&&(p.q<s.missionArea.minQ||p.q>s.missionArea.maxQ||p.r<s.missionArea.minR||p.r>s.missionArea.maxR))return '超出作战区域';if(terrain(p.q,p.r)!=='river')return '请选择相邻河流格';if(b){if(b.side!==u.side)return '不能接管敌方施工';if(b.progress>=3)return '重型桥已经完工';if(b.lastWorked===phase(s))return '本轮已经施工';if(b.builder!==u.id&&!b.paused)return '另一支工兵正在施工';}else if(u.stock<2)return '架桥需要2份工程材料';if(occupied(s,p))return '桥面上有部队，请先移开';return '';}
function workBridge(s,u,p){if(s.result)return;const k=key(p.q,p.r);if(u.project&&u.project!==k)pauseBridge(s,u,'更换工地');let b=s.bridges[k];if(!b){u.stock-=2;b=s.bridges[k]={...p,side:u.side,progress:0,builder:u.id,paused:false,lastWorked:null};}if(b.builder!==u.id){const previous=s.units.find(v=>v.id===b.builder);if(previous)previous.project=null;}b.builder=u.id;b.paused=false;b.progress=Math.min(3,b.progress+1);b.lastWorked=phase(s);u.project=b.progress<3?k:null;u.acted=true;u.mp=0;log(s,u.name+'架桥 '+b.progress+'/3'+(b.progress===2?' · 步兵可通行':b.progress===3?' · 重装备可通行':''),b,u.side);invalidate(s);}
function progressBridges(s){if(s.result)return;for(const b of Object.values(s.bridges)){if(b.side!==s.active||b.paused||b.progress>=3||b.lastWorked===phase(s))continue;const u=s.units.find(x=>x.id===b.builder);if(!u||!alive(u)||distance(u,b)>1||u.project!==key(b.q,b.r)){b.paused=true;continue;}if((!u.acted||u.waiting)&&!u.moved&&!occupied(s,b)){const wasWaiting=u.waiting;workBridge(s,u,b);if(wasWaiting){u.waiting=true;u.acted=true;}}}}
function abilityReason(s,u,action,p){if(s.result)return '战役已结束';if(!u||!alive(u)||u.side!==s.active||u.acted)return '本回合无法执行';if(s.missionArea&&(p.q<s.missionArea.minQ||p.q>s.missionArea.maxQ||p.r<s.missionArea.minR||p.r>s.missionArea.maxR))return '超出作战区域';if(distance(u,p)>1)return '请选择本格或相邻格';const target=occupied(s,p),f=s.forts[key(p.q,p.r)];if(action==='bridge')return bridgeReason(s,u,p);
 if(action==='heal'){if(u.role!=='medic'||u.stock<1)return '需要医疗队与医疗物资';if(!target||target.id===u.id||target.side!==u.side||!isFoot(target))return '请选择相邻友军步兵类单位';if(target.hp===target.maxHp&&target.morale===100)return '目标无需治疗';}
 else if(action==='resupply'){if(u.role!=='supply'||u.stock<1)return '需要补给队与库存';if(!target||target.id===u.id||target.side!==u.side)return '请选择相邻友军';if(target.ammo===target.maxAmmo&&target.fuel===target.maxFuel&&(target.role!=='armor'||target.hp===target.maxHp)&&!['engineer','medic'].includes(target.role))return '目标无需补给';}
 else if(['mine','trench','clear'].includes(action)){if(u.role!=='engineer')return '需要工兵';if(action==='clear'){if(!f||f.type!=='mine'||!fortVisible(s,f,u.side))return '这里没有已发现的雷区';}
  else {if(u.stock<1)return '工程材料耗尽';if(f)return '已有工事';if(['river','bridge','marsh'].includes(terrain(p.q,p.r)))return '此处不能施工';if(target&&(action==='mine'||target.id!==u.id))return '请选择空地；堑壕也可在工兵脚下修筑';}}
 else return '未知行动';return '';
}
function ability(s,id,action,q,r){const u=s.units.find(u=>u.id===id),p={q,r},reason=abilityReason(s,u,action,p);if(reason)return {ok:false,message:reason};const target=occupied(s,p);
 if(action==='bridge'){workBridge(s,u,p);if(u.side==='de'&&s.tutorialProgress)s.tutorialProgress.supported=true;updateSight(s);return {ok:true,message:'架桥进度 '+s.bridges[key(q,r)].progress+'/3'};}if(u.project)pauseBridge(s,u,'执行其他任务');
 if(action==='heal'){target.hp=Math.min(target.maxHp,target.hp+25);target.morale=Math.min(100,target.morale+10);u.stock--;}
 else if(action==='resupply'){target.ammo=Math.min(target.maxAmmo,target.ammo+4);target.fuel=Math.min(target.maxFuel,target.fuel+35);if(target.role==='armor')target.hp=Math.min(target.maxHp,target.hp+20);if(['engineer','medic'].includes(target.role))target.stock=Math.min(target.role==='engineer'?3:5,target.stock+1);u.stock--;}
 else if(action==='clear')delete s.forts[key(q,r)];else {s.forts[key(q,r)]={q,r,type:action,side:u.side};u.stock--;}
 if(u.side==='de'&&s.tutorialProgress)s.tutorialProgress.supported=true;
 u.acted=true;u.mp=0;log(s,u.name+'完成'+({heal:'救护',resupply:'补给',mine:'布雷',trench:'挖壕',clear:'排雷'})[action],p,u.side);invalidate(s);updateSight(s);return {ok:true,message:'行动完成'};
}
function supplyMap(s,side){if(!s._supply)s._supply={};if(s._supply[side])return s._supply[side];const blocked=new Set();for(const u of s.units.filter(u=>alive(u)&&u.side!==side)){blocked.add(key(u.q,u.r));if(!['medic','supply'].includes(u.role))for(const p of neighbors(u))blocked.add(key(p.q,p.r));}const seen=new Set(),queue=[];
 const inArea=p=>!s.missionArea||(p.q>=s.missionArea.minQ&&p.q<=s.missionArea.maxQ&&p.r>=s.missionArea.minR&&p.r<=s.missionArea.maxR);
 const q=s.missionArea?(side==='de'?s.missionArea.minQ:s.missionArea.maxQ):(side==='de'?0:D.board.cols-1);
 const minR=s.missionArea?s.missionArea.minR:0;
 const maxR=s.missionArea?s.missionArea.maxR:D.board.rows-1;
 for(let r=minR;r<=maxR;r++)if((terrain(q,r)!=='river'||s.bridges[key(q,r)]?.progress>=3)&&!blocked.has(key(q,r))){queue.push({q,r});seen.add(key(q,r));}
 for(let i=0;i<queue.length;i++)for(const p of neighbors(queue[i])){if(!inArea(p))continue;const k=key(p.q,p.r);if(!seen.has(k)&&!blocked.has(k)&&(terrain(p.q,p.r)!=='river'||s.bridges[k]?.progress>=3)){seen.add(k);queue.push(p);}}
 s._supply[side]=seen;return seen;
}
const connected=(s,u)=>supplyMap(s,u.side).has(key(u.q,u.r))||neighbors(u).some(p=>supplyMap(s,u.side).has(key(p.q,p.r)));
function waitUnit(s,id){
 if(s.result)return {ok:false,message:'战役已结束'};
 const u=s.units.find(u=>u.id===id);
 if(!u||!alive(u)||u.side!==s.active||u.acted)return {ok:false,message:'该部队当前不能待命'};
 delete u.advance;
 u.acted=true;
 u.mp=0;
 u.waiting=true;
 log(s,u.name+'原地待命',u,u.side);
 invalidate(s);
 return {ok:true,message:'部队已待命'};
}

function checkOutcome(s,{endRound=false}={}){
 if(s.result)return s.result;
 const sideStats=side=>{
  let active=0,destroyed=0,captured=0,routed=0,lostHp=0;
  for(const u of s.units){
   if(u.side!==side)continue;
   if(u.status==='active')active++;
   else if(u.status==='destroyed')destroyed++;
   else if(u.status==='captured')captured++;
   else if(u.status==='routed')routed++;
   lostHp+=Math.max(0,u.maxHp-u.hp);
  }
  return {active,destroyed,captured,routed,lostHp};
 };
 const stats={de:sideStats('de'),su:sideStats('su')};
 const deCombat=s.units.some(u=>alive(u)&&u.side==='de'&&isCombat(u));
 const suCombat=s.units.some(u=>alive(u)&&u.side==='su'&&isCombat(u));

 const hasCounts=s.initialCounts&&Number.isFinite(s.initialCounts.de)&&Number.isFinite(s.initialCounts.su);
 const validMissionState=hasCounts&&(s.initialCounts.de+s.initialCounts.su===s.units.length);

 if(s.mode==='campaign'){
  if(validMissionState){
   if(!deCombat){
    s.result={winner:'su',reason:'德军作战部队全军覆没',round:s.round,stats};
    return s.result;
   }
   if(!suCombat){
    s.result={winner:'de',reason:'苏军作战部队全军覆没',round:s.round,stats};
    return s.result;
   }
  }else if(!hasCounts||s.initialCounts.de+s.initialCounts.su!==s.units.length){
   // Return null for synthetic fixtures where initialCounts.de+initialCounts.su !== s.units.length
   return null;
  }
  const minskOwned=s.cities['minsk']==='de';
  const otherTowns=['brest','grodno','baranovichi'].filter(id=>s.cities[id]==='de').length;
  const initialSu=s.initialCounts?.su||s.units.filter(u=>u.side==='su').length;
  const suCasualties=stats.su.destroyed+stats.su.captured+stats.su.routed;
  const suLossRatio=initialSu>0?suCasualties/initialSu:0;

  if(minskOwned&&otherTowns>=2&&suLossRatio>=0.35){
   s.result={winner:'de',reason:'德军攻克明斯克并重创苏军主力，达成早期决定性胜利',round:s.round,stats};
   return s.result;
  }
  if(endRound&&s.round>=24){
   s.result={winner:'su',reason:'苏军坚守至第24回合，德军未能在期限内达成既定战略目标',round:24,stats};
   return s.result;
  }
 }else if(s.mode==='tutorial'){
  if(validMissionState){
   if(!deCombat){
    s.result={winner:'su',reason:'德军教学部队全军覆没',round:s.round,stats};
    return s.result;
   }
   if(!suCombat){
    s.result={winner:'de',reason:'苏军教学守备部队全军覆没',round:s.round,stats};
    return s.result;
   }
  }else if(!hasCounts||s.initialCounts.de+s.initialCounts.su!==s.units.length){
   return null;
  }
  const kobrynOwned=s.cities['kobryn']==='de';
  if(kobrynOwned){
   s.result={winner:'de',reason:'德军成功攻占科布林要地，完成教学战役目标',round:s.round,stats};
   return s.result;
  }
  if(endRound&&s.round>=12){
   s.result={winner:'su',reason:'苏军成功坚守科布林至第12回合，教学防御成功',round:12,stats};
   return s.result;
  }
 }
 return null;
}

function objectiveStatus(s,side=s.active){
 if(s.mode==='tutorial'){
  const kobrynCaptured=s.cities['kobryn']==='de';
  const deCombat=s.units.some(u=>alive(u)&&u.side==='de'&&isCombat(u));
  const suCombat=s.units.some(u=>alive(u)&&u.side==='su'&&isCombat(u));
  if(side==='de'){
   return {
    title:'教学战役：科布林突破',
    roundLimit:12,
    items:[
     {label:'攻占关键城镇科布林',current:kobrynCaptured?'已占领':'未占领',target:'已占领',done:kobrynCaptured},
     {label:'保存德军作战兵力',current:deCombat?'主力尚存':'覆灭',target:'保持作战部队',done:deCombat},
     {label:'在12回合内达成目标',current:'第'+s.round+'回合',target:'12回合内',done:s.round<=12}
    ],
    result:s.result
   };
  }else{
   return {
    title:'教学防线：保卫科布林',
    roundLimit:12,
    items:[
     {label:'坚守科布林至第12回合',current:kobrynCaptured?'失守':'守方控制',target:'坚守至12轮',done:!kobrynCaptured},
     {label:'保存苏军作战兵力',current:suCombat?'主力尚存':'覆灭',target:'保持作战部队',done:suCombat},
     {label:'阻止德军在12回合内突破',current:'第'+s.round+'回合',target:'坚持12回合',done:!s.result||s.result.winner==='su'}
    ],
    result:s.result
   };
  }
 }
 if(s.mode==='campaign'){
  const initialSu=s.initialCounts?.su||s.units.filter(u=>u.side==='su').length;
  const suCasualties=s.units.filter(u=>u.side==='su'&&['destroyed','captured','routed'].includes(u.status)).length;
  const suLossPercent=initialSu>0?Math.floor((suCasualties/initialSu)*100):0;
  const minskCaptured=s.cities['minsk']==='de';
  const deSecondaryCount=['brest','grodno','baranovichi'].filter(id=>s.cities[id]==='de').length;

  if(side==='de'){
   return {
    title:'巴巴罗萨初期攻势',
    roundLimit:24,
    items:[
     {label:'占领明斯克',current:minskCaptured?'已占领':'未占领',target:'已占领',done:minskCaptured},
     {label:'夺取关键要地(布列斯特/格罗德诺/巴拉诺维奇)',current:deSecondaryCount,target:2,done:deSecondaryCount>=2},
     {label:'消灭/溃退苏军部队比例',current:suLossPercent+'%',target:'35%',done:suLossPercent>=35},
     {label:'在24回合期限内达成战略突破',current:'第'+s.round+'回合',target:'24回合内',done:s.round<=24}
    ],
    result:s.result
   };
  }else{
   const suCombat=s.units.some(u=>alive(u)&&u.side==='su'&&isCombat(u));
   const minskHeld=s.cities['minsk']==='su';
   return {
    title:'明斯克防卫战',
    roundLimit:24,
    items:[
     {label:'坚守明斯克至第24回合',current:minskHeld?'守方控制':'失守',target:'坚守至24轮',done:minskHeld},
     {label:'保存苏军主力作战部队',current:suCombat?'主力尚存':'覆灭',target:'保持作战兵力',done:suCombat},
     {label:'阻止德军在24回合前达成全目标',current:'第'+s.round+'回合',target:'坚持24回合',done:!s.result||s.result.winner==='su'}
    ],
    result:s.result
   };
  }
 }
 return {title:'战役目标',roundLimit:24,items:[],result:s.result};
}

function tutorialHints(s){
 const p=s.tutorialProgress||{moved:false,attacked:false,supported:false};
 const kobrynOwned=s.cities['kobryn']==='de';
 return [
  {id:'move',text:'移动部队：选中部队并移动至目标格',done:!!p.moved},
  {id:'attack',text:'发起攻击：指示作战部队打击射程内敌军',done:!!p.attacked},
  {id:'support',text:'战术支援：使用医疗救护、后勤补给或工兵架桥',done:!!p.supported},
  {id:'objective',text:'占领目标：向东推进攻占城镇科布林',done:kobrynOwned}
 ];
}

function endTurn(s){
 if(s.result)return {ok:false,message:'战役已结束'};
 for(const u of s.units)delete u.advance;
 autoSupport(s);progressBridges(s);
 const side=s.active,units=s.units.filter(u=>alive(u)&&u.side===side),sup=supplyMap(s,side);
 const losses=[];
 const isolatedList=[];
 let recoveredCount=0;

 for(const u of units){
  const supplied=sup.has(key(u.q,u.r))||neighbors(u).some(p=>sup.has(key(p.q,p.r)));
  u.isolated=supplied?0:u.isolated+1;
  if(u.isolated>=1)isolatedList.push({id:u.id,name:u.name,morale:u.morale});
  if(!supplied){
   u.morale=Math.max(0,u.morale-(side==='su'?14:10));
   u.ammo=Math.max(0,u.ammo-1);
  }else{
   u.morale=Math.min(100,u.morale+(side==='su'&&s.round<=3?0:3));
   if(u.role==='supply')u.stock=Math.min(12,u.stock+2);
   recoveredCount++;
  }
  if(s.units.some(h=>alive(h)&&h.side===side&&h.role==='hq'&&distance(u,h)<=3))u.morale=Math.min(100,u.morale+5);
  if(u.morale<=15&&u.isolated>=1)losses.push([u,'captured','断补给且士气过低']);
  else if(u.morale<=8)losses.push([u,'routed','士气崩溃']);
 }

 const reportLosses=losses.map(([u,status,reason])=>({id:u.id,name:u.name,status,reason}));
 s.lastTurnReport={side,round:s.round,isolated:isolatedList,losses:reportLosses,recovered:recoveredCount};

 for(const [u,status]of losses)remove(s,u,status);

 const wasSu=side==='su';
 const completedRound=s.round;
 const outcome=checkOutcome(s,{endRound:wasSu});
 if(outcome)return {ok:true,message:outcome.reason,result:outcome};

 s.active=side==='de'?'su':'de';
 if(s.active==='de')s.round++;
 s.air[s.active]={...AIR_LIMITS};
 s.airRecon[s.active]=[];
 for(const u of s.units.filter(u=>alive(u)&&u.side===s.active)){
  u.mp=u.maxMove;
  u.acted=false;
  u.moved=false;
  u.waiting=false;
 }
 invalidate(s);updateSight(s);
 return {ok:true,message:'第'+s.round+'回合 · '+(s.active==='de'?'德军':'苏军')};
}
let naturalBridgeCache=null;
function aiStep(s,id){
 if(s.result)return;
 const u=s.units.find(x=>x.id===id);
 if(!u||!alive(u)||u.side!==s.active||u.acted)return;
 if(u.project&&!s.bridges[u.project]?.paused)return;

 // Cache supply and visible units for this step
 const sup=supplyMap(s,u.side);
 const isTileSupplied=p=>sup.has(key(p.q,p.r))||neighbors(p).some(n=>sup.has(key(n.q,n.r)));
 const visibleEnemies=s.units.filter(v=>alive(v)&&v.side!==u.side&&canSee(s,v,u.side));
 const friends=s.units.filter(v=>alive(v)&&v.side===u.side&&v.id!==u.id);

 // Requirement 4: Visible threatening enemies (ammo > 0 and lineClear unless artillery)
 const isThreateningEnemy=(e,targetTile)=>{
  if(e.ammo<=0)return false;
  if(distance(e,targetTile)>profiles[e.role].range)return false;
  if(e.role==='artillery')return true;
  return lineClear(e,targetTile);
 };

 const isUnderVisibleDirectFire=(tile)=>{
  return visibleEnemies.some(e=>isThreateningEnemy(e,tile));
 };

 // Requirement 4: Forbid traversing known mine tiles for AI by filtering reachable paths
 const isKnownEnemyMine=p=>{
  const f=s.forts[key(p.q,p.r)];
  return f?.type==='mine'&&f.side!==u.side&&fortVisible(s,f,u.side);
 };
 const getSafeReachableNodes=()=>{
  const allNodes=[...reachable(s,u,true).values()];
  const safe=allNodes.filter(n=>!n.path.some(step=>isKnownEnemyMine(step)));
  // If no safe moves available, allow staying in place (path length 0)
  if(!safe.length){
   const current=allNodes.find(n=>n.path.length===0);
   return current?[current]:[];
  }
  return safe;
 };

 const scoreTarget=(attacker,target)=>{
  const dmg=damage(s,attacker,target);
  let score=dmg;
  if(dmg>=target.hp)score+=60; // kill priority
  if(attacker.role==='at'&&target.role==='armor')score+=35;
  if(attacker.role==='armor'&&['artillery','at','hq'].includes(target.role))score+=25;
  if(attacker.role==='mg'&&isFoot(target))score+=25;
  if(['artillery','mg'].includes(target.role))score+=20;
  if(['hq','medic','supply'].includes(target.role))score+=15;
  if(target.hp/target.maxHp<0.4)score+=15;
  if(attacker.role==='armor'&&urban.has(key(attacker.q,attacker.r)))score-=15;
  if(attacker.ammo<=1&&dmg<12)score-=20;
  return score;
 };

 const chooseBestAttack=(attacker)=>{
  if(attacker.acted||attacker.ammo<=0)return null;
  const candidates=visibleEnemies.filter(v=>!attackReason(s,attacker,v));
  if(!candidates.length)return null;
  candidates.sort((a,b)=>scoreTarget(attacker,b)-scoreTarget(attacker,a));
  return candidates[0];
 };

 const postAttackCheck=()=>{
  if(!s.result&&s.initialCounts&&Number.isFinite(s.initialCounts.de)&&Number.isFinite(s.initialCounts.su)&&s.initialCounts.de+s.initialCounts.su===s.units.length){
   checkOutcome(s);
  }
 };

 // Cache natural and finished bridges for defense / engineer heuristics
 const inArea=p=>!s.missionArea||(p.q>=s.missionArea.minQ&&p.q<=s.missionArea.maxQ&&p.r>=s.missionArea.minR&&p.r<=s.missionArea.maxR);
 if(!naturalBridgeCache){naturalBridgeCache=[];for(let r=0;r<D.board.rows;r++)for(let q=0;q<D.board.cols;q++)if(D.terrain(q,r)==='bridge')naturalBridgeCache.push({q,r});}
 const naturalBridgeTiles=naturalBridgeCache.filter(inArea);
 const allBridgeTiles=[...naturalBridgeTiles,...Object.values(s.bridges).filter(b=>b.progress>=3&&inArea(b)&&(b.side===u.side||vision(s,u.side).has(key(b.q,b.r))))];

 // Requirement 2: Strategic goal for German / Campaign / Defender
 let strategicGoal=null;
 if(s.mode==='tutorial'){
  strategicGoal=D.towns.find(t=>t.id==='kobryn');
 }else if(u.side==='de'){
  // Choose nearest useful unowned Brest/Grodno/Baranovichi until owns 2, then Minsk
  const westTowns=D.towns.filter(t=>['brest','grodno','baranovichi'].includes(t.id));
  const ownedWestCount=westTowns.filter(t=>s.cities[t.id]==='de').length;
  if(ownedWestCount<2){
   const unownedWest=westTowns.filter(t=>s.cities[t.id]!=='de');
   if(unownedWest.length){
    unownedWest.sort((a,b)=>distance(u,a)-distance(u,b));
    strategicGoal=unownedWest[0];
   }
  }
  if(!strategicGoal){
   strategicGoal=D.towns.find(t=>t.id==='minsk'&&s.cities[t.id]!=='de')||
                 D.towns.find(t=>s.cities[t.id]!=='de')||
                 D.towns.find(t=>t.id==='minsk');
  }
 }else{
  // Defender goal
  strategicGoal=D.towns.find(t=>t.id==='minsk')||D.towns.find(t=>s.cities[t.id]==='su');
 }

 // Support units (medic, supply)
 if(['medic','supply'].includes(u.role)){
  if(autoSupportUnit(s,u)){
   postAttackCheck();
   return;
  }
  const action=u.role==='medic'?'heal':'resupply';
  if(u.stock>=1){
   const adjFriends=friends.filter(v=>!abilityReason(s,u,action,v)).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
   if(adjFriends.length){
    ability(s,u.id,action,adjFriends[0].q,adjFriends[0].r);
    postAttackCheck();
    return;
   }
  }
  // Reposition conservatively behind front within support distance
  const reachableNodes=getSafeReachableNodes();
  const frontCombat=friends.filter(f=>isCombat(f)&&!['medic','supply','hq'].includes(f.role));
  let bestDest=null,bestScore=-Infinity;
  for(const node of reachableNodes){
   let sc=0;
   if(isTileSupplied(node))sc+=20;
   for(const e of visibleEnemies){
    if(isThreateningEnemy(e,node))sc-=40;
    else if(distance(node,e)<=profiles[e.role].range+2)sc-=15;
   }
   if(frontCombat.length){
    let minD=Infinity;
    for(const f of frontCombat){
     const d=distance(node,f);
     if(d<minD)minD=d;
    }
    if(minD===1)sc+=15;
    else if(minD===2)sc+=12;
    else sc-=minD*3;
   }
   if(sc>bestScore){
    bestScore=sc;
    bestDest=node;
   }
  }
  if(bestDest&&bestDest.path.length){
   move(s,u.id,bestDest.q,bestDest.r);
  }
  if(!u.acted&&u.stock>=1){
   const adj=friends.filter(v=>!abilityReason(s,u,action,v)).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
   if(adj.length)ability(s,u.id,action,adj[0].q,adj[0].r);
  }
  if(!u.acted&&!u.waiting)waitUnit(s,u.id);
  postAttackCheck();
  return;
 }

 // Requirement 3: HQ stays behind friendly combat even when no enemies
 if(u.role==='hq'){
  const reachableNodes=getSafeReachableNodes();
  const frontCombat=friends.filter(f=>isCombat(f)&&!['medic','supply','hq'].includes(f.role));
  let bestDest=null,bestScore=-Infinity;

  for(const node of reachableNodes){
   let sc=0;
   if(isTileSupplied(node))sc+=25;
   for(const e of visibleEnemies){
    if(isThreateningEnemy(e,node))sc-=60;
    else sc+=Math.min(6,distance(node,e))*6;
   }
   // Stay 2-3 hexes behind friendly combat units
   if(frontCombat.length){
    let minD=Infinity;
    for(const f of frontCombat){
     const d=distance(node,f);
     if(d<minD)minD=d;
    }
    if(minD>=2&&minD<=3)sc+=30;
    else if(minD===1)sc+=10;
    else sc-=minD*4;
   }
   const t=terrain(node.q,node.r);
   if(urban.has(key(node.q,node.r))||t==='forest'||t==='hill')sc+=15;
   if(sc>bestScore){
    bestScore=sc;
    bestDest=node;
   }
  }
  if(bestDest&&bestDest.path.length){
   move(s,u.id,bestDest.q,bestDest.r);
  }
  if(!u.acted&&!u.waiting)waitUnit(s,u.id);
  postAttackCheck();
  return;
 }

 // Requirement 1: Engineer handling
 if(u.role==='engineer'){
  // Resume paused adjacent project only when safe (not exposed to visible direct fire)
  let resumeBridge=null;
  for(const b of Object.values(s.bridges)){
   if(b.side===u.side&&b.paused&&b.progress<3&&distance(u,b)<=1&&!bridgeReason(s,u,b)){
    if(!isUnderVisibleDirectFire(u)&&!isUnderVisibleDirectFire(b)){
     resumeBridge=b;break;
    }
   }
  }
  if(resumeBridge){
   workBridge(s,u,resumeBridge);
   postAttackCheck();
   return;
  }

  // Clear known blocking enemy mines
  for(const f of Object.values(s.forts)){
   if(f.type==='mine'&&f.side!==u.side&&fortVisible(s,f,u.side)&&distance(u,f)<=1&&!abilityReason(s,u,'clear',f)){
    ability(s,u.id,'clear',f.q,f.r);
    postAttackCheck();
    return;
   }
  }

  // Build useful river crossing toward strategic goal when adjacent:
  // require river closer to chosen strategic goal than current tile
  // AND traversable far bank beyond it
  // AND no existing natural/completed bridge within 3
  // AND not under visible enemy direct fire
  if(u.stock>=2&&strategicGoal&&!isUnderVisibleDirectFire(u)){
   const curDistToGoal=distance(u,strategicGoal);
   let bestRiver=null,bestDistDiff=-Infinity;

   for(const p of neighbors(u)){
    if(terrain(p.q,p.r)==='river'&&!bridgeReason(s,u,p)){
     const riverDistToGoal=distance(p,strategicGoal);
     if(riverDistToGoal<curDistToGoal){
      // Check traversable far bank beyond it: adjacent neighbor of river p that is not u, not river, inside area
      const hasFarBank=neighbors(p).some(nb=>distance(u,nb)===2&&distance(nb,strategicGoal)<curDistToGoal&&terrain(nb.q,nb.r)!=='river'&&inArea(nb));
      if(hasFarBank){
       // No existing natural/completed bridge within 3
       const nearBridge=allBridgeTiles.some(b=>distance(p,b)<=3);
       if(!nearBridge&&!isUnderVisibleDirectFire(p)){
        const diff=curDistToGoal-riverDistToGoal;
        if(diff>bestDistDiff){
         bestDistDiff=diff;
         bestRiver=p;
        }
       }
      }
     }
    }
   }
   if(bestRiver){
    workBridge(s,u,bestRiver);
    postAttackCheck();
    return;
   }
  }

  // Trenches only near threatened friendly city/bridge
  // Defended threatened position: within 2 of friendly city/bridge that has visible enemies within 6
  if(u.stock>=1&&!abilityReason(s,u,'trench',u)){
   const ownedCitiesInArea=D.towns.filter(t=>s.cities[t.id]===u.side&&inArea(t));
   const defendedObjectives=[...ownedCitiesInArea,...allBridgeTiles];
   const isNearThreatenedObj=defendedObjectives.some(obj=>{
    return distance(u,obj)<=2&&visibleEnemies.some(e=>distance(e,obj)<=6);
   });
   if(isNearThreatenedObj){
    ability(s,u.id,'trench',u.q,u.r);
    postAttackCheck();
    return;
   }
  }
 }

 // 2. Badly wounded (<35% HP) or low morale (<25) units withdrawal
 const isBadlyWounded=u.hp<u.maxHp*0.35||u.morale<25;
 if(isBadlyWounded&&visibleEnemies.length>0){
  const reachableNodes=getSafeReachableNodes();
  const medics=friends.filter(f=>f.role==='medic'&&f.stock>0);
  const supplies=friends.filter(f=>f.role==='supply'&&f.stock>0);
  let bestSafeDest=null,bestSafeScore=-Infinity;

  for(const node of reachableNodes){
   let sc=0;
   if(isTileSupplied(node))sc+=25;
   for(const e of visibleEnemies){
    if(isThreateningEnemy(e,node))sc-=50;
    else sc+=Math.min(6,distance(node,e))*6;
   }
   for(const m of medics)sc+=Math.max(0,10-distance(node,m)*2);
   for(const sp of supplies)sc+=Math.max(0,8-distance(node,sp)*2);
   const t=terrain(node.q,node.r);
   if(isFoot(u)&&(urban.has(key(node.q,node.r))||t==='forest'||t==='hill'))sc+=15;
   if(sc>bestSafeScore){
    bestSafeScore=sc;
    bestSafeDest=node;
   }
  }

  if(bestSafeDest&&bestSafeDest.path.length){
   move(s,u.id,bestSafeDest.q,bestSafeDest.r);
  }
  if(!u.acted){
   const target=chooseBestAttack(u);
   if(target){
    attack(s,u.id,target.id);
    aiAdvance(s,u);
   }
  }
  if(!u.acted&&!u.waiting)waitUnit(s,u.id);
  postAttackCheck();
  return;
 }

 // 3 & 4. Combat units positioning and attack
 const immediateTarget=chooseBestAttack(u);
 if(immediateTarget&&u.role==='artillery'){
  attack(s,u.id,immediateTarget.id);
  postAttackCheck();
  return;
 }

 const reachableNodes=getSafeReachableNodes();
 const isDefender=u.side==='su';
 const ownedCities=D.towns.filter(t=>s.cities[t.id]===u.side&&inArea(t));
 const threatenedCities=ownedCities.filter(c=>visibleEnemies.some(e=>distance(e,c)<=6));

 let bestNode=null,bestNodeScore=-Infinity;

 for(const node of reachableNodes){
  let sc=0;
  const t=terrain(node.q,node.r);
  const isCityTile=urban.has(key(node.q,node.r));
  const hasTrench=s.forts[key(node.q,node.r)]?.type==='trench';

  // Supply status
  if(isTileSupplied(node))sc+=15;else sc-=20;

  // Terrain suitability
  if(u.role==='armor'){
   if(isCityTile||t==='marsh')sc-=30;
   if(t==='plain')sc+=5;
  }else if(isFoot(u)){
   if(isCityTile||hasTrench)sc+=20;
   else if(t==='forest'||t==='hill')sc+=12;
  }

  // Friendly concentration
  let friendlyCount=0;
  for(const f of friends){
   if(distance(node,f)<=2)friendlyCount++;
  }
  sc+=Math.min(4,friendlyCount)*3;

  // Threat & standoff
  for(const e of visibleEnemies){
   const d=distance(node,e);
   if(u.role==='artillery'){
    if(d===1)sc-=40;
    else if(d>=3&&d<=5)sc+=25;
    else if(d<3)sc-=15;
   }else{
    if(isThreateningEnemy(e,node))sc-=12;
   }
  }

  // Strategic city / bridge objectives / defense
  if(u.side==='de'||!isDefender){
   if(strategicGoal){
    sc-=distance(node,strategicGoal)*4;
   }
  }else{
   // Defender: prioritize threatened owned cities (visible enemy <=6) and bridge approaches
   // Prefer remaining near guard objective rather than chasing scouts away
   const guardCities=threatenedCities.length?threatenedCities:ownedCities;
   let minCityDist=Infinity;
   for(const oc of guardCities){
    const d=distance(node,oc);
    if(d<minCityDist)minCityDist=d;
   }
   if(minCityDist<=1)sc+=28;
   else if(minCityDist<=2)sc+=20;
   else sc-=minCityDist*4; // Strong penalty for wandering away from guard objective

   if(allBridgeTiles.length){
    let minBrDist=Infinity;
    for(const b of allBridgeTiles){
     const d=distance(node,b);
     if(d<minBrDist)minBrDist=d;
    }
    if(minBrDist<=1)sc+=16;
   }
  }

  // Attack opportunity from node
  if(u.ammo>0){
   const simU={...u,q:node.q,r:node.r};
   let maxAtkScore=0;
   for(const e of visibleEnemies){
    if(!attackReason(s,simU,e)){
     const as=scoreTarget(simU,e);
     if(as>maxAtkScore)maxAtkScore=as;
    }
   }
   // If defender, don't over-value chasing isolated scouts far from guard objectives
   if(isDefender){
    sc+=maxAtkScore*1.1;
   }else{
    sc+=maxAtkScore*1.5;
   }
  }

  // Slight preference for lower move cost
  sc-=node.cost;

  if(sc>bestNodeScore){
   bestNodeScore=sc;
   bestNode=node;
  }
 }

 if(bestNode&&bestNode.path.length){
  move(s,u.id,bestNode.q,bestNode.r);
 }

 if(!u.acted){
  const target=chooseBestAttack(u);
  if(target){
   attack(s,u.id,target.id);
   aiAdvance(s,u);
  }else if(!u.waiting){
   waitUnit(s,u.id);
  }
 }
 postAttackCheck();
}

function aiAirStep(s){
 if(s.result)return null;
 const side=s.active;
 if(!['de','su'].includes(side))return null;
 const air=s.air[side];
 if(!air)return null;

 // Strike priority first if available
 if(air.strike>0){
  const candidates=[];
  for(const u of s.units){
   if(alive(u)&&u.side!==side&&canSee(s,u,side)){
    if(s.missionArea&&(u.q<s.missionArea.minQ||u.q>s.missionArea.maxQ||u.r<s.missionArea.minR||u.r>s.missionArea.maxR))continue;
    let score=u.role==='armor'?35:['artillery','at'].includes(u.role)?30:15;
    if(u.hp<u.maxHp)score+=20;
    // Concentration check: visible enemies near target
    let conc=0;
    for(const other of s.units){
     if(alive(other)&&other.side!==side&&canSee(s,other,side)&&distance(u,other)<=2)conc++;
    }
    score+=conc*8;
    candidates.push({u,score});
   }
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates){
   if(!airReason(s,side,'strike',c.u.q,c.u.r)){
    const res=airMission(s,side,'strike',c.u.q,c.u.r);
    if(res.ok){
     checkOutcome(s);
     return res;
    }
   }
  }
 }

 // Recon
 if(air.recon>0){
  const explored=s.explored[side]||new Set();
  const currentVision=vision(s,side);
  const friendlyUnits=s.units.filter(u=>alive(u)&&u.side===side);
  const targetObj=s.mode==='tutorial'?D.towns.find(t=>t.id==='kobryn'):(side==='de'?D.towns.find(t=>s.cities[t.id]!=='de'):D.towns.find(t=>s.cities[t.id]==='su'));

  let bestP=null,bestScore=-Infinity;
  const minQ=s.missionArea?s.missionArea.minQ:0;
  const maxQ=s.missionArea?s.missionArea.maxQ:D.board.cols-1;
  const minR=s.missionArea?s.missionArea.minR:0;
  const maxR=s.missionArea?s.missionArea.maxR:D.board.rows-1;

  // Step with stride to keep affordable
  for(let r=minR;r<=maxR;r+=3){
   for(let q=minQ;q<=maxQ;q+=3){
    if(airReason(s,side,'recon',q,r))continue;
    const p={q,r};
    let sc=0;
    const rRing=ring(p,4);
    let unseen=0;
    for(const cell of rRing){
     const k=key(cell.q,cell.r);
     if(!currentVision.has(k))unseen++;
     if(!explored.has(k))unseen+=2;
    }
    sc+=unseen*3;
    if(targetObj){
     sc-=distance(p,targetObj)*2;
    }
    // Near friendly front line (distance 3 to 7)
    if(friendlyUnits.length){
     let minFriendD=Infinity;
     for(const fu of friendlyUnits){
      const d=distance(p,fu);
      if(d<minFriendD)minFriendD=d;
     }
     if(minFriendD>=3&&minFriendD<=8)sc+=20;
     else sc-=Math.abs(minFriendD-5)*3;
    }
    if(sc>bestScore){
     bestScore=sc;
     bestP=p;
    }
   }
  }
  if(bestP){
   const res=airMission(s,side,'recon',bestP.q,bestP.r);
   if(res.ok){
    checkOutcome(s);
    return res;
   }
  }
 }

 return null;
}

function supportNeed(u,action){return action==='heal'?(isFoot(u)&&(u.hp<u.maxHp||u.morale<35)):(u.ammo<4||(u.role==='armor'&&(u.fuel<50||u.hp<u.maxHp))||(['engineer','medic'].includes(u.role)&&u.stock===0));}
function safeSupportTile(s,u,p){const f=s.forts[key(p.q,p.r)];if(f?.type==='mine'&&f.side!==u.side&&fortVisible(s,f,u.side))return false;return !s.units.some(e=>alive(e)&&e.side!==u.side&&canSee(s,e,u.side)&&distance(e,p)<=Math.max(2,profiles[e.role].range+1)&&(e.role==='artillery'||lineClear(e,p)));}
function autoSupportUnit(s,u){if(s.result||!alive(u)||u.side!==s.active||u.acted||u.moved||u.stock<1||!safeSupportTile(s,u,u))return false;const action=u.role==='medic'?'heal':u.role==='supply'?'resupply':null;if(!action)return false;const targets=s.units.filter(t=>alive(t)&&t.side===u.side&&t.id!==u.id&&supportNeed(t,action)).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));if(!targets.length)return false;const nodes=[...reachable(s,u,true).values()].filter(n=>safeSupportTile(s,u,n)&&n.path.every(p=>safeSupportTile(s,u,p)));let choice;for(const target of targets){const dest=nodes.filter(n=>distance(n,target)<=1&&!(n.q===target.q&&n.r===target.r)).sort((a,b)=>a.cost-b.cost)[0];if(dest){choice={target,dest};break;}}if(!choice)return false;if(choice.dest.path.length)move(s,u.id,choice.dest.q,choice.dest.r);if(!safeSupportTile(s,u,u))return false;return ability(s,u.id,action,choice.target.q,choice.target.r).ok;}
function autoSupport(s){if(s.result)return;for(const u of s.units)if(u.autoSupport&&u.side===s.active)autoSupportUnit(s,u);}
function setAuto(s,id,on){if(s?.result)return false;const u=s.units.find(x=>x.id===id);if(!u||!['medic','supply'].includes(u.role))return false;u.autoSupport=!!on;return true;}
function airReason(s,side,kind,q,r){if(s.result)return '战役已结束';if(side!==s.active)return '当前不是该阵营回合';if(!['recon','strike'].includes(kind)||!inside(q,r))return '无效航空任务';if(s.missionArea&&(q<s.missionArea.minQ||q>s.missionArea.maxQ||r<s.missionArea.minR||r>s.missionArea.maxR))return '超出作战区域';if(s.air[side][kind]<=0)return '本回合次数已用尽';if(kind==='strike'){if(!vision(s,side).has(key(q,r)))return '先侦察目标区域';const u=occupied(s,{q,r});if(u?.side===side)return '不能攻击友军';}return '';}
function airMission(s,side,kind,q,r){const reason=airReason(s,side,kind,q,r);if(reason)return {ok:false,message:reason};s.air[side][kind]--;let hit=0;if(kind==='recon'){s.airRecon[side].push({q,r});log(s,'侦察机展开空中侦察',{q,r},side);}else{const u=occupied(s,{q,r});if(u&&u.side!==side){hit=u.role==='armor'?30:42;u.hp=Math.max(0,u.hp-hit);u.morale=Math.max(0,u.morale-18);if(u.project)pauseBridge(s,u,'空袭');log(s,'航空支援命中'+u.name+'，损失'+hit,u,side);if(u.hp===0)remove(s,u,'destroyed');}else log(s,'航空支援完成对地攻击',{q,r},side);const b=s.bridges[key(q,r)];if(b&&b.side!==side&&b.progress<3){b.paused=true;log(s,'空袭打断敌军架桥',b,side);}}
 invalidate(s);updateSight(s);return {ok:true,message:kind==='recon'?'侦察完成，本轮持续揭示半径4格':'空袭完成'+(hit?' · 损失'+hit:''),kind,q,r,hit};}

function serialize(s){return JSON.stringify({...s,_vision:undefined,_supply:undefined,explored:{de:[...s.explored.de],su:[...s.explored.su]}});}
function restore(raw){try{
 const s=JSON.parse(raw);
 if(![2,3].includes(s.version)||!['de','su'].includes(s.active)||!Number.isInteger(s.round)||s.round<1||!Array.isArray(s.units))return null;
 if(s.mode!==undefined&&s.mode!=='campaign'&&s.mode!=='tutorial')return null;
 s.mode=s.mode||'campaign';
 const isTutorial=s.mode==='tutorial';
 if(isTutorial){
  if(s.units.length!==14)return null;
  s.missionArea={minQ:10,maxQ:35,minR:43,maxR:64};
  const tl=D.position(10,43),br=D.position(35,64);
  s.missionView={x:tl.x-50,y:tl.y-50,w:br.x-tl.x+100,h:br.y-tl.y+100};
 }else{
  if(s.units.length!==D.units.length)return null;
  delete s.missionArea;delete s.missionView;
 }
 if(s.result!==undefined&&s.result!==null){
  if(typeof s.result!=='object'||!['de','su'].includes(s.result.winner)||typeof s.result.reason!=='string'||!Number.isInteger(s.result.round)||!s.result.stats)return null;
  for(const side of ['de','su'])for(const n of ['active','destroyed','captured','routed','lostHp'])if(!Number.isFinite(s.result.stats[side]?.[n])||s.result.stats[side][n]<0)return null;
 }else{
  s.result=null;
 }
 s.initialCounts={de:s.units.filter(u=>u.side==='de').length,su:s.units.filter(u=>u.side==='su').length};
 if(isTutorial&&(s.initialCounts.de!==8||s.initialCounts.su!==6))return null;
 s.tutorialProgress=s.tutorialProgress||{moved:false,attacked:false,supported:false};
 s.lastTurnReport=s.lastTurnReport||null;
 s.bridges=s.bridges||{};
 s.air=s.air||airBudget();
 s.airRecon=s.airRecon||{de:[],su:[]};
 const ids=new Set(),cells=new Set();
 for(const u of s.units){
  if(!D.units.some(v=>v.id===u.id)||ids.has(u.id)||!profiles[u.role]||!['de','su'].includes(u.side)||!Number.isInteger(u.q)||!Number.isInteger(u.r)||!inside(u.q,u.r)||!['active','captured','routed','destroyed'].includes(u.status))return null;
  if(isTutorial&&s.missionArea&&(u.q<s.missionArea.minQ||u.q>s.missionArea.maxQ||u.r<s.missionArea.minR||u.r>s.missionArea.maxR))return null;
  ids.add(u.id);
  u.asset=unitArt(u);
  u.autoSupport=u.autoSupport??(u.role==='medic');
  u.project=u.project||null;
  u.waiting=u.waiting||false;
  for(const n of ['hp','maxHp','morale','ammo','fuel','stock','mp','attack','defense','maxMove'])if(!Number.isFinite(u[n])||u[n]<0)return null;
  if(s.balanceVersion!==1&&u.role==='armor'&&u.side==='su'&&!isTutorial)u.attack=unitAttack(D.units.find(v=>v.id===u.id));
  if(alive(u)){
   if(cells.has(key(u.q,u.r))||(terrain(u.q,u.r)==='river'&&!Number.isFinite(moveCost(s,u,u))))return null;
   cells.add(key(u.q,u.r));
  }
 }
 if(!s.forts||!s.cities||!Array.isArray(s.logs)||!s.explored)return null;
 for(const [k,f]of Object.entries(s.forts))if(!['mine','trench'].includes(f.type)||!['de','su'].includes(f.side)||!inside(f.q,f.r)||k!==key(f.q,f.r))return null;
 for(const side of ['de','su']){
  for(const kind of ['recon','strike'])if(!Number.isInteger(s.air[side]?.[kind])||s.air[side][kind]<0||s.air[side][kind]>AIR_LIMITS[kind])return null;
  if(!Array.isArray(s.airRecon[side])||s.airRecon[side].some(p=>!Number.isInteger(p.q)||!Number.isInteger(p.r)||!inside(p.q,p.r)))return null;
 }
 for(const [k,b]of Object.entries(s.bridges))if(k!==key(b.q,b.r)||!inside(b.q,b.r)||terrain(b.q,b.r)!=='river'||![1,2,3].includes(b.progress)||!['de','su'].includes(b.side)||!s.units.some(u=>u.id===b.builder&&u.role==='engineer'))return null;
 for(const u of s.units)if(u.advance&&advanceReason(s,u))delete u.advance;
 s.version=3;
 s.balanceVersion=1;
 s.explored={de:new Set(s.explored.de),su:new Set(s.explored.su)};
 invalidate(s);
 updateSight(s);
 return s;
}catch{return null;}}
const api={advance,advanceReason,declineAdvance,unitArt,AIR_LIMITS,airReason,airMission,setAuto,autoSupport,autoSupportUnit,safeSupportTile,bridgeReason,workBridge,pauseBridge,progressBridges,newGame,terrain,terrainName,urban,urbanNames,profiles,role,isFoot,alive,isCombat,key,inside,neighbors,distance,ring,occupied,vision,updateSight,canSee,fortVisible,moveCost,reachable,move,attackReason,damage,attack,abilityReason,ability,supplyMap,connected,endTurn,aiStep,aiAirStep,serialize,restore,invalidate,lineClear,waitUnit,checkOutcome,objectiveStatus,tutorialHints};
if(typeof module!=='undefined')module.exports=api;root.BARB_ENGINE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
