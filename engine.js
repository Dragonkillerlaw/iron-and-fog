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
 armor:{name:'装甲',symbol:'甲',attack:37,defense:22,move:7,range:1,sight:4,tip:'平原突破；城区移动消耗3、攻防降低。'},
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
function newGame(){
 const s={version:3,balanceVersion:1,round:1,active:'de',units:[],forts:{},bridges:{},air:airBudget(),airRecon:{de:[],su:[]},cities:{},logs:[],explored:{de:new Set(),su:new Set()},revision:0};
 s.units=D.units.map(u=>{const ro=role(u),p=profiles[ro],su=u.side==='su',modern=su&&u.asset==='medium',hp=ro==='armor'?(modern?145:su?115:125):['supply','medic','hq'].includes(ro)?80:su?130:110;return {...u,role:ro,asset:unitArt(u),autoSupport:ro==='medic',project:null,hp,maxHp:hp,morale:su?(modern?60:48):86,ammo:su?5:8,maxAmmo:8,fuel:su?65:100,maxFuel:100,stock:ro==='engineer'?3:ro==='medic'?5:ro==='supply'?12:0,attack:unitAttack(u),defense:Math.round(p.defense*(su?.75:1.15)*(modern?1.65:1)),maxMove:Math.max(2,p.move-(su?1:0)),mp:Math.max(2,p.move-(su?1:0)),acted:false,moved:false,status:'active',isolated:0,modern};});
 for(const t of D.towns)s.cities[t.id]=D.position(t.q,t.r).x<D.borderX(D.position(t.q,t.r).y)?'de':'su';
 invalidate(s);updateSight(s);return s;
}
function invalidate(s){s.revision++;s._vision=null;s._supply=null;}
function occupied(s,p){return s.units.find(u=>alive(u)&&u.q===p.q&&u.r===p.r);}
function line(a,b){const ac=cube(a),bc=cube(b),n=distance(a,b),out=[];for(let i=1;i<n;i++){const t=i/n,x=ac.x+(bc.x-ac.x)*t+1e-6,y=ac.y+(bc.y-ac.y)*t+1e-6,z=ac.z+(bc.z-ac.z)*t-2e-6;let rx=Math.round(x),ry=Math.round(y),rz=Math.round(z);const dx=Math.abs(rx-x),dy=Math.abs(ry-y),dz=Math.abs(rz-z);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;out.push({q:rx+(rz-(rz&1))/2,r:rz});}return out;}
function lineClear(a,b){return !line(a,b).some(p=>['forest','hill','center','residential','factory'].includes(terrain(p.q,p.r)));}
function vision(s,side){if(!s._vision)s._vision={};if(s._vision[side])return s._vision[side];const seen=new Set();for(const u of s.units.filter(u=>alive(u)&&u.side===side))for(const p of ring(u,profiles[u.role].sight+(terrain(u.q,u.r)==='hill'?1:0)))if(distance(u,p)<=1||lineClear(u,p))seen.add(key(p.q,p.r));for(const mark of s.airRecon[side])for(const p of ring(mark,4))seen.add(key(p.q,p.r));s._vision[side]=seen;return seen;}
function updateSight(s){for(const side of ['de','su'])for(const k of vision(s,side))s.explored[side].add(k);}
const canSee=(s,u,side)=>side==='god'||u.side===side||vision(s,side).has(key(u.q,u.r));
function fortVisible(s,f,side){return side==='god'||f.side===side||(f.type==='trench'&&vision(s,side).has(key(f.q,f.r)))||s.units.some(u=>alive(u)&&u.side===side&&u.role==='engineer'&&distance(u,f)<=1);}
function log(s,text,at,owner){const audience=['de','su'].filter(side=>side===owner||!at||vision(s,side).has(key(at.q,at.r)));s.logs.unshift({text,audience,round:s.round});s.logs=s.logs.slice(0,60);}
function moveCost(s,u,p){const t=terrain(p.q,p.r);if(t==='river'){const b=s.bridges[key(p.q,p.r)];return b?.progress>=3?2:b?.progress>=2&&isFoot(u)?2:Infinity;}let c=t==='marsh'?(u.role==='armor'?5:3):t==='forest'||t==='hill'?2:1;if(urban.has(key(p.q,p.r)))c=u.role==='armor'?3:1;if(s.forts[key(p.q,p.r)]?.type==='trench'&&u.role==='armor')c+=2;return c;}
function zoc(s,p,side,known=false){return s.units.some(u=>alive(u)&&u.side!==side&&!['medic','supply'].includes(u.role)&&distance(u,p)<=1&&(!known||canSee(s,u,side)));}
function reachable(s,u,known=true){const result=new Map(),start=key(u.q,u.r),queue=[{q:u.q,r:u.r,cost:0}],budget=Math.min(u.mp,u.role==='armor'?Math.floor(u.fuel/5):u.mp);result.set(start,{q:u.q,r:u.r,cost:0,path:[]});if(!alive(u)||u.side!==s.active||u.acted)return result;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const current=queue.shift(),node=result.get(key(current.q,current.r));if(current.cost!==node.cost)continue;if(current.cost>0&&zoc(s,current,u.side,known))continue;
  for(const p of neighbors(current)){const target=occupied(s,p);if(target&&target.id!==u.id&&(!known||target.side===u.side||canSee(s,target,u.side)))continue;const cost=node.cost+moveCost(s,u,p),k=key(p.q,p.r);if(cost>budget||cost>=(result.get(k)?.cost??Infinity))continue;result.set(k,{...p,cost,path:[...node.path,p]});queue.push({...p,cost});}
 }return result;
}
function remove(s,u,status){if(u.project)pauseBridge(s,u,'部队退场');u.status=status;u.mp=0;u.acted=true;log(s,u.name+(status==='captured'?'被俘退场':status==='routed'?'溃散退场':'战斗力耗尽'),u,u.side);for(const other of s.units)if(alive(other)&&other.side===u.side&&distance(u,other)<=3)other.morale=Math.max(0,other.morale-(u.role==='hq'?18:8));invalidate(s);}
function move(s,id,q,r){const u=s.units.find(u=>u.id===id);if(!u||u.side!==s.active||!alive(u)||u.acted)return {ok:false,message:'该部队当前不能移动'};const route=reachable(s,u,true).get(key(q,r));if(!route||!route.path.length)return {ok:false,message:'超出移动范围或道路被阻挡'};let moved=0;
 for(const p of route.path){const blocker=occupied(s,p);if(blocker&&blocker.id!==u.id){log(s,'前方出现敌军，行军停止',p,u.side);break;}const c=moveCost(s,u,p);if(!moved&&u.project)pauseBridge(s,u,'转移');u.q=p.q;u.r=p.r;u.mp-=c;if(u.role==='armor')u.fuel=Math.max(0,u.fuel-c*5);u.moved=true;moved++;
  const f=s.forts[key(p.q,p.r)];if(f?.type==='mine'&&f.side!==u.side){const damage=u.role==='armor'?35:25;u.hp=Math.max(0,u.hp-damage);u.morale=Math.max(0,u.morale-12);u.mp=0;delete s.forts[key(p.q,p.r)];log(s,u.name+'触雷，损失'+damage,p,u.side);if(u.hp===0)remove(s,u,'destroyed');break;}
  if(zoc(s,u,u.side)){u.mp=0;break;}
 }
 for(const t of D.towns)if(u.q===t.q&&u.r===t.r&&alive(u)&&s.cities[t.id]!==u.side){s.cities[t.id]=u.side;u.morale=Math.min(100,u.morale+8);log(s,u.name+'占领'+t.name,u,u.side);}
 invalidate(s);updateSight(s);return {ok:moved>0,message:moved?'行军完成':'敌军阻挡了通路'};
}
function attackReason(s,a,b){if(!a||!b||!alive(a)||!alive(b)||a.side!==s.active||a.side===b.side)return '无法攻击';if(a.acted)return '本回合已行动';if(a.ammo<=0)return '弹药耗尽';if(!canSee(s,b,a.side))return '目标未被发现';if(distance(a,b)>profiles[a.role].range)return '目标超出射程';if(a.role!=='artillery'&&!lineClear(a,b))return '射线被建筑或地形遮挡';return '';}
function damage(s,a,b){let power=a.attack*(.6+.4*a.hp/a.maxHp)*(.55+a.morale/180),def=b.defense;
 if(a.role==='mg'&&isFoot(b))power*=1.6;if(a.role==='mg'&&b.role==='armor')power*=.4;
 if(a.role==='at')power*=b.role==='armor'?1.7:.65;
 if(a.role==='armor'&&urban.has(key(a.q,a.r)))power*=.7;
 if(b.role==='armor'&&urban.has(key(b.q,b.r)))def*=.8;
 let cover=1;const t=terrain(b.q,b.r);if(isFoot(b)&&urban.has(key(b.q,b.r)))cover*=.65;else if(t==='forest'||t==='hill')cover*=.85;
 if(isFoot(b)&&s.forts[key(b.q,b.r)]?.type==='trench')cover*=.6;
 return Math.max(3,Math.round((power-def*.45)*cover));
}
function attack(s,id,target){const a=s.units.find(u=>u.id===id),b=s.units.find(u=>u.id===target),reason=attackReason(s,a,b);if(reason)return {ok:false,message:reason};const hit=damage(s,a,b);if(a.project)pauseBridge(s,a,'执行攻击');if(b.project)pauseBridge(s,b,'遭到攻击');a.ammo--;a.acted=true;a.mp=0;b.hp=Math.max(0,b.hp-hit);b.morale=Math.max(0,b.morale-8-Math.floor(hit/5)-(a.role==='mg'&&isFoot(b)?12:a.role==='artillery'?8:0));log(s,a.name+'攻击'+b.name+'，损失'+hit,b,a.side);if(b.hp===0)remove(s,b,'destroyed');invalidate(s);updateSight(s);return {ok:true,message:'命中：兵力 −'+hit+'，士气受损'};}
function pauseBridge(s,u,why){const b=s.bridges[u.project];if(b&&b.builder===u.id&&b.progress<3){b.paused=true;log(s,u.name+'架桥暂停：'+why,b,u.side);} }
function bridgeReason(s,u,p){const b=s.bridges[key(p.q,p.r)];if(u.role!=='engineer')return '需要工兵';if(terrain(p.q,p.r)!=='river')return '请选择相邻河流格';if(b){if(b.side!==u.side)return '不能接管敌方施工';if(b.progress>=3)return '重型桥已经完工';if(b.lastWorked===phase(s))return '本轮已经施工';if(b.builder!==u.id&&!b.paused)return '另一支工兵正在施工';}else if(u.stock<2)return '架桥需要2份工程材料';if(occupied(s,p))return '桥面上有部队，请先移开';return '';}
function workBridge(s,u,p){const k=key(p.q,p.r);if(u.project&&u.project!==k)pauseBridge(s,u,'更换工地');let b=s.bridges[k];if(!b){u.stock-=2;b=s.bridges[k]={...p,side:u.side,progress:0,builder:u.id,paused:false,lastWorked:null};}if(b.builder!==u.id){const previous=s.units.find(v=>v.id===b.builder);if(previous)previous.project=null;}b.builder=u.id;b.paused=false;b.progress=Math.min(3,b.progress+1);b.lastWorked=phase(s);u.project=b.progress<3?k:null;u.acted=true;u.mp=0;log(s,u.name+'架桥 '+b.progress+'/3'+(b.progress===2?' · 步兵可通行':b.progress===3?' · 重装备可通行':''),b,u.side);invalidate(s);}
function progressBridges(s){for(const b of Object.values(s.bridges)){if(b.side!==s.active||b.paused||b.progress>=3||b.lastWorked===phase(s))continue;const u=s.units.find(x=>x.id===b.builder);if(!u||!alive(u)||distance(u,b)>1||u.project!==key(b.q,b.r)){b.paused=true;continue;}if(!u.acted&&!u.moved&&!occupied(s,b))workBridge(s,u,b);}}
function abilityReason(s,u,action,p){if(!u||!alive(u)||u.side!==s.active||u.acted)return '本回合无法执行';if(distance(u,p)>1)return '请选择本格或相邻格';const target=occupied(s,p),f=s.forts[key(p.q,p.r)];if(action==='bridge')return bridgeReason(s,u,p);
 if(action==='heal'){if(u.role!=='medic'||u.stock<1)return '需要医疗队与医疗物资';if(!target||target.id===u.id||target.side!==u.side||!isFoot(target))return '请选择相邻友军步兵类单位';if(target.hp===target.maxHp&&target.morale===100)return '目标无需治疗';}
 else if(action==='resupply'){if(u.role!=='supply'||u.stock<1)return '需要补给队与库存';if(!target||target.id===u.id||target.side!==u.side)return '请选择相邻友军';if(target.ammo===target.maxAmmo&&target.fuel===target.maxFuel&&(target.role!=='armor'||target.hp===target.maxHp)&&!['engineer','medic'].includes(target.role))return '目标无需补给';}
 else if(['mine','trench','clear'].includes(action)){if(u.role!=='engineer')return '需要工兵';if(action==='clear'){if(!f||f.type!=='mine'||!fortVisible(s,f,u.side))return '这里没有已发现的雷区';}
  else {if(u.stock<1)return '工程材料耗尽';if(f)return '已有工事';if(['river','bridge','marsh'].includes(terrain(p.q,p.r)))return '此处不能施工';if(target&&(action==='mine'||target.id!==u.id))return '请选择空地；堑壕也可在工兵脚下修筑';}}
 else return '未知行动';return '';
}
function ability(s,id,action,q,r){const u=s.units.find(u=>u.id===id),p={q,r},reason=abilityReason(s,u,action,p);if(reason)return {ok:false,message:reason};const target=occupied(s,p);
 if(action==='bridge'){workBridge(s,u,p);updateSight(s);return {ok:true,message:'架桥进度 '+s.bridges[key(q,r)].progress+'/3'};}if(u.project)pauseBridge(s,u,'执行其他任务');
 if(action==='heal'){target.hp=Math.min(target.maxHp,target.hp+25);target.morale=Math.min(100,target.morale+10);u.stock--;}
 else if(action==='resupply'){target.ammo=Math.min(target.maxAmmo,target.ammo+4);target.fuel=Math.min(target.maxFuel,target.fuel+35);if(target.role==='armor')target.hp=Math.min(target.maxHp,target.hp+20);if(['engineer','medic'].includes(target.role))target.stock=Math.min(target.role==='engineer'?3:5,target.stock+1);u.stock--;}
 else if(action==='clear')delete s.forts[key(q,r)];else {s.forts[key(q,r)]={q,r,type:action,side:u.side};u.stock--;}
 u.acted=true;u.mp=0;log(s,u.name+'完成'+({heal:'救护',resupply:'补给',mine:'布雷',trench:'挖壕',clear:'排雷'})[action],p,u.side);invalidate(s);updateSight(s);return {ok:true,message:'行动完成'};
}
function supplyMap(s,side){if(!s._supply)s._supply={};if(s._supply[side])return s._supply[side];const blocked=new Set();for(const u of s.units.filter(u=>alive(u)&&u.side!==side)){blocked.add(key(u.q,u.r));if(!['medic','supply'].includes(u.role))for(const p of neighbors(u))blocked.add(key(p.q,p.r));}const seen=new Set(),queue=[];const q=side==='de'?0:D.board.cols-1;for(let r=0;r<D.board.rows;r++)if((terrain(q,r)!=='river'||s.bridges[key(q,r)]?.progress>=3)&&!blocked.has(key(q,r))){queue.push({q,r});seen.add(key(q,r));}
 for(let i=0;i<queue.length;i++)for(const p of neighbors(queue[i])){const k=key(p.q,p.r);if(!seen.has(k)&&!blocked.has(k)&&(terrain(p.q,p.r)!=='river'||s.bridges[k]?.progress>=3)){seen.add(k);queue.push(p);}}
 s._supply[side]=seen;return seen;
}
const connected=(s,u)=>supplyMap(s,u.side).has(key(u.q,u.r))||neighbors(u).some(p=>supplyMap(s,u.side).has(key(p.q,p.r)));
function endTurn(s){autoSupport(s);progressBridges(s);const side=s.active,units=s.units.filter(u=>alive(u)&&u.side===side),sup=supplyMap(s,side);const losses=[];
 // Resolve against a fixed phase snapshot, then apply nearby morale shocks together.
 for(const u of units){const supplied=sup.has(key(u.q,u.r))||neighbors(u).some(p=>sup.has(key(p.q,p.r)));u.isolated=supplied?0:u.isolated+1;if(!supplied){u.morale=Math.max(0,u.morale-(side==='su'?14:10));u.ammo=Math.max(0,u.ammo-1);}else {u.morale=Math.min(100,u.morale+(side==='su'&&s.round<=3?0:3));if(u.role==='supply')u.stock=Math.min(12,u.stock+2);}
  if(s.units.some(h=>alive(h)&&h.side===side&&h.role==='hq'&&distance(u,h)<=3))u.morale=Math.min(100,u.morale+5);
  if(u.morale<=15&&u.isolated>=1)losses.push([u,'captured']);else if(u.morale<=8)losses.push([u,'routed']);
 }
 for(const [u,status]of losses)remove(s,u,status);
 s.active=side==='de'?'su':'de';if(s.active==='de')s.round++;s.air[s.active]={...AIR_LIMITS};s.airRecon[s.active]=[];
 for(const u of s.units.filter(u=>alive(u)&&u.side===s.active)){u.mp=u.maxMove;u.acted=false;u.moved=false;}
 invalidate(s);updateSight(s);return {ok:true,message:'第'+s.round+'回合 · '+(s.active==='de'?'德军':'苏军')};
}
function aiStep(s,id){const u=s.units.find(x=>x.id===id);if(!u||!alive(u)||u.side!==s.active||u.acted)return;if(u.project&&!s.bridges[u.project]?.paused)return;if(['medic','supply'].includes(u.role)){autoSupportUnit(s,u);return;}
 const friends=s.units.filter(v=>alive(v)&&v.side===u.side&&v.id!==u.id);
 for(const a of u.role==='medic'?['heal']:u.role==='supply'?['resupply']:[]){const targets=friends.filter(v=>!abilityReason(s,u,a,v)).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));if(targets.length){ability(s,u.id,a,targets[0].q,targets[0].r);return;}}
 let targets=s.units.filter(v=>alive(v)&&v.side!==u.side&&canSee(s,v,u.side));let fire=targets.filter(v=>!attackReason(s,u,v)).sort((a,b)=>damage(s,u,b)-damage(s,u,a));if(fire.length){attack(s,u.id,fire[0].id);return;}
 let goal;if(['medic','supply','hq'].includes(u.role)){goal=friends.filter(v=>isFoot(v)||v.role==='armor').sort((a,b)=>distance(u,a)-distance(u,b))[0];}
 else goal=targets.sort((a,b)=>distance(u,a)-distance(u,b))[0]||D.towns.filter(t=>s.cities[t.id]!==u.side).sort((a,b)=>distance(u,a)-distance(u,b))[0];
 if(goal){const nodes=[...reachable(s,u,true).values()].filter(p=>p.path.length).sort((a,b)=>distance(a,goal)-distance(b,goal)||a.cost-b.cost);if(nodes.length&&distance(nodes[0],goal)<distance(u,goal))move(s,u.id,nodes[0].q,nodes[0].r);}
 targets=s.units.filter(v=>alive(v)&&v.side!==u.side&&!attackReason(s,u,v));if(targets.length)attack(s,u.id,targets[0].id);
 else if(u.role==='engineer'&&!u.acted&&!abilityReason(s,u,'trench',u))ability(s,u.id,'trench',u.q,u.r);
}

function supportNeed(u,action){return action==='heal'?(isFoot(u)&&(u.hp<u.maxHp||u.morale<35)):(u.ammo<4||(u.role==='armor'&&(u.fuel<50||u.hp<u.maxHp))||(['engineer','medic'].includes(u.role)&&u.stock===0));}
function safeSupportTile(s,u,p){const f=s.forts[key(p.q,p.r)];if(f?.type==='mine'&&f.side!==u.side&&fortVisible(s,f,u.side))return false;return !s.units.some(e=>alive(e)&&e.side!==u.side&&canSee(s,e,u.side)&&distance(e,p)<=Math.max(2,profiles[e.role].range+1)&&(e.role==='artillery'||lineClear(e,p)));}
function autoSupportUnit(s,u){if(!alive(u)||u.side!==s.active||u.acted||u.moved||u.stock<1||!safeSupportTile(s,u,u))return false;const action=u.role==='medic'?'heal':u.role==='supply'?'resupply':null;if(!action)return false;const targets=s.units.filter(t=>alive(t)&&t.side===u.side&&t.id!==u.id&&supportNeed(t,action)).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));if(!targets.length)return false;const nodes=[...reachable(s,u,true).values()].filter(n=>safeSupportTile(s,u,n)&&n.path.every(p=>safeSupportTile(s,u,p)));let choice;for(const target of targets){const dest=nodes.filter(n=>distance(n,target)<=1&&!(n.q===target.q&&n.r===target.r)).sort((a,b)=>a.cost-b.cost)[0];if(dest){choice={target,dest};break;}}if(!choice)return false;if(choice.dest.path.length)move(s,u.id,choice.dest.q,choice.dest.r);if(!safeSupportTile(s,u,u))return false;return ability(s,u.id,action,choice.target.q,choice.target.r).ok;}
function autoSupport(s){for(const u of s.units)if(u.autoSupport&&u.side===s.active)autoSupportUnit(s,u);}
function setAuto(s,id,on){const u=s.units.find(x=>x.id===id);if(!u||!['medic','supply'].includes(u.role))return false;u.autoSupport=!!on;return true;}
function airReason(s,side,kind,q,r){if(side!==s.active)return '当前不是该阵营回合';if(!['recon','strike'].includes(kind)||!inside(q,r))return '无效航空任务';if(s.air[side][kind]<=0)return '本回合次数已用尽';if(kind==='strike'){if(!vision(s,side).has(key(q,r)))return '先侦察目标区域';const u=occupied(s,{q,r});if(u?.side===side)return '不能攻击友军';}return '';}
function airMission(s,side,kind,q,r){const reason=airReason(s,side,kind,q,r);if(reason)return {ok:false,message:reason};s.air[side][kind]--;let hit=0;if(kind==='recon'){s.airRecon[side].push({q,r});log(s,'侦察机展开空中侦察',{q,r},side);}else{const u=occupied(s,{q,r});if(u&&u.side!==side){hit=u.role==='armor'?30:42;u.hp=Math.max(0,u.hp-hit);u.morale=Math.max(0,u.morale-18);if(u.project)pauseBridge(s,u,'空袭');log(s,'航空支援命中'+u.name+'，损失'+hit,u,side);if(u.hp===0)remove(s,u,'destroyed');}else log(s,'航空支援完成对地攻击',{q,r},side);const b=s.bridges[key(q,r)];if(b&&b.side!==side&&b.progress<3){b.paused=true;log(s,'空袭打断敌军架桥',b,side);}}
 invalidate(s);updateSight(s);return {ok:true,message:kind==='recon'?'侦察完成，本轮持续揭示半径4格':'空袭完成'+(hit?' · 损失'+hit:''),kind,q,r,hit};}

function serialize(s){return JSON.stringify({...s,_vision:undefined,_supply:undefined,explored:{de:[...s.explored.de],su:[...s.explored.su]}});}
function restore(raw){try{const s=JSON.parse(raw);if(![2,3].includes(s.version)||!['de','su'].includes(s.active)||!Number.isInteger(s.round)||s.round<1||!Array.isArray(s.units)||s.units.length!==D.units.length)return null;s.bridges=s.bridges||{};s.air=s.air||airBudget();s.airRecon=s.airRecon||{de:[],su:[]};const ids=new Set(),cells=new Set();for(const u of s.units){if(!D.units.some(v=>v.id===u.id)||ids.has(u.id)||!profiles[u.role]||!['de','su'].includes(u.side)||!Number.isInteger(u.q)||!Number.isInteger(u.r)||!inside(u.q,u.r)||!['active','captured','routed','destroyed'].includes(u.status))return null;ids.add(u.id);u.asset=unitArt(u);u.autoSupport=u.autoSupport??(u.role==='medic');u.project=u.project||null;for(const n of ['hp','maxHp','morale','ammo','fuel','stock','mp','attack','defense','maxMove'])if(!Number.isFinite(u[n])||u[n]<0)return null;if(s.balanceVersion!==1&&u.role==='armor'&&u.side==='su')u.attack=unitAttack(D.units.find(v=>v.id===u.id));if(alive(u)){if(cells.has(key(u.q,u.r))||(terrain(u.q,u.r)==='river'&&!Number.isFinite(moveCost(s,u,u))))return null;cells.add(key(u.q,u.r));}}if(!s.forts||!s.cities||!Array.isArray(s.logs)||!s.explored)return null;for(const [k,f]of Object.entries(s.forts))if(!['mine','trench'].includes(f.type)||!['de','su'].includes(f.side)||!inside(f.q,f.r)||k!==key(f.q,f.r))return null;for(const side of ['de','su']){for(const kind of ['recon','strike'])if(!Number.isInteger(s.air[side]?.[kind])||s.air[side][kind]<0||s.air[side][kind]>AIR_LIMITS[kind])return null;if(!Array.isArray(s.airRecon[side])||s.airRecon[side].some(p=>!Number.isInteger(p.q)||!Number.isInteger(p.r)||!inside(p.q,p.r)))return null;}for(const [k,b]of Object.entries(s.bridges))if(k!==key(b.q,b.r)||!inside(b.q,b.r)||terrain(b.q,b.r)!=='river'||![1,2,3].includes(b.progress)||!['de','su'].includes(b.side)||!s.units.some(u=>u.id===b.builder&&u.role==='engineer'))return null;s.version=3;s.balanceVersion=1;s.explored={de:new Set(s.explored.de),su:new Set(s.explored.su)};invalidate(s);updateSight(s);return s;}catch{return null;}}
const api={unitArt,AIR_LIMITS,airReason,airMission,setAuto,autoSupport,autoSupportUnit,safeSupportTile,bridgeReason,workBridge,pauseBridge,progressBridges,newGame,terrain,terrainName,urban,urbanNames,profiles,role,isFoot,alive,key,inside,neighbors,distance,ring,occupied,vision,updateSight,canSee,fortVisible,moveCost,reachable,move,attackReason,damage,attack,abilityReason,ability,supplyMap,connected,endTurn,aiStep,serialize,restore,invalidate,lineClear};
if(typeof module!=='undefined')module.exports=api;root.BARB_ENGINE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
