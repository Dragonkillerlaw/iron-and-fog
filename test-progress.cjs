const assert=require('node:assert/strict'),E=require('./engine'),D=require('./scenario');
const init=E.newGame();let origin;
for(let r=8;r<55&&!origin;r++)for(let q=8;q<70;q++)if(E.ring({q,r},6).every(p=>E.terrain(p.q,p.r)==='plain')){origin={q,r};break;}
function fixture(roles){const s=E.newGame();s.units=roles.map(([side,role],i)=>({...init.units.find(u=>u.side===side&&u.role===role),id:'test'+i,q:origin.q+i,r:origin.r}));s.cities={};s.logs=[];E.invalidate(s);E.updateSight(s);return s;}
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('experience bonus caps without changing base stats or compounding on reload',()=>{
 let s=E.newGame();const u=s.units.find(u=>u.role==='armor'),base=[u.attack,u.defense];u.xp=200;
 assert.equal(E.veteran(u).bonus,.12);assert.equal(E.veteran(u).next,null);
 for(let i=0;i<3;i++){s=E.restore(E.serialize(s));assert.ok(s);const v=s.units.find(v=>v.id===u.id);assert.deepEqual([v.attack,v.defense],base);assert.equal(v.xp,200);}
 const f=fixture([['de','armor'],['su','rifle']]),[a,b]=f.units,old=E.damage(f,a,b);a.xp=200;assert.ok(E.damage(f,a,b)>old);
});
test('old saves migrate and preserve battle identity while transient events are discarded',()=>{
 const raw=JSON.parse(E.serialize(init));delete raw.battleId;delete raw.battleStats;raw.units.forEach(u=>{delete u.xp;delete u.kills;});raw._events=[{type:'hit',amount:999}];
 const s=E.restore(JSON.stringify(raw));assert.ok(s);assert.ok(s.battleId);assert.ok(s.units.every(u=>u.xp===0&&u.kills===0));assert.equal(s.battleStats.de.damage,0);assert.deepEqual(E.drainEvents(s),[]);
 const r=E.restore(E.serialize(s));assert.equal(r.battleId,s.battleId);assert.notEqual(E.newGame().battleId,s.battleId);
});
test('attack credits actual damage and one kill, failed repeat adds nothing',()=>{
 const s=fixture([['de','armor'],['su','rifle']]),[a,b]=s.units;b.hp=1;
 assert.ok(E.attack(s,a.id,b.id).ok);assert.equal(s.battleStats.de.damage,1);assert.equal(s.battleStats.de.kills,1);assert.equal(a.kills,1);assert.equal(a.xp,13);
 const stats=JSON.stringify(s.battleStats);assert.equal(E.attack(s,a.id,b.id).ok,false);assert.equal(JSON.stringify(s.battleStats),stats);assert.equal(a.xp,13);
 const hits=E.drainEvents(s).filter(e=>e.type==='hit');assert.equal(hits.length,1);assert.equal(hits[0].amount,1);assert.deepEqual(E.drainEvents(s),[]);
});
test('healing counts actual hp and no-op supply cannot farm XP',()=>{
 const s=fixture([['de','medic'],['de','rifle']]),[m,u]=s.units;u.hp-=3;
 assert.ok(E.ability(s,m.id,'heal',u.q,u.r).ok);assert.equal(s.battleStats.de.healed,3);assert.equal(m.xp,6);
 const t=fixture([['de','supply'],['de','engineer']]),[supply,eng]=t.units;eng.ammo=eng.maxAmmo;eng.fuel=eng.maxFuel;eng.stock=3;
 E.ability(t,supply.id,'resupply',eng.q,eng.r);assert.equal(supply.xp,0);assert.equal(t.battleStats.de.resupplied,0);
});
test('automatic medical support uses same reward and healing accounting',()=>{
 const s=fixture([['de','medic'],['de','rifle']]),[m,u]=s.units;u.hp-=10;assert.ok(E.autoSupportUnit(s,m));assert.equal(m.xp,6);assert.equal(s.battleStats.de.healed,10);
});
test('airstrike and mines credit actual damage but grant no unit XP',()=>{
 const s=fixture([['de','armor'],['su','rifle']]),[a,b]=s.units;b.hp=2;
 assert.ok(E.airMission(s,'de','strike',b.q,b.r).ok);assert.equal(s.battleStats.de.damage,2);assert.equal(s.battleStats.de.kills,1);assert.equal(a.xp,0);
 const t=fixture([['de','armor']]),u=t.units[0],dest=E.neighbors(u)[0];u.hp=2;t.forts[E.key(dest.q,dest.r)]={...dest,type:'mine',side:'su'};
 assert.ok(E.move(t,u.id,dest.q,dest.r).ok);assert.equal(t.battleStats.su.damage,2);assert.equal(t.battleStats.su.kills,1);assert.equal(u.xp,0);
});
test('fog-hidden artillery source is excluded from victim source audience',()=>{
 const s=fixture([['de','artillery'],['su','rifle']]),[a,b]=s.units;b.q=a.q+5;s.airRecon.de.push({q:b.q,r:b.r});E.invalidate(s);E.updateSight(s);
 assert.equal(E.canSee(s,a,'su'),false);assert.ok(E.attack(s,a.id,b.id).ok);
 const hit=E.drainEvents(s).find(e=>e.type==='hit');assert.ok(hit.audience.includes('su'));assert.ok(!hit.sourceAudience.includes('su'));
});
test('movement does not award XP or expose a concealed destination',()=>{
 const s=fixture([['de','recon'],['su','rifle']]),[a,b]=s.units;b.q=a.q+4;E.invalidate(s);E.updateSight(s);
 const dst={q:a.q-2,r:a.r};assert.ok(E.move(s,a.id,dst.q,dst.r).ok);assert.equal(a.xp,0);
 const move=E.drainEvents(s).find(e=>e.type==='move');assert.ok(move);assert.ok(!move.audience.includes('su'));
});
test('city captures counted once and result keeps a frozen battle-stat snapshot',()=>{
 const s=E.newGame(),town=D.towns.find(t=>s.cities[t.id]==='su'),u=s.units.find(u=>u.side==='de'&&u.role==='rifle');
 for(const v of s.units)if(v!==u)v.status='routed';Object.assign(u,E.neighbors(town).find(p=>E.terrain(p.q,p.r)!=='river'),{mp:10});E.invalidate(s);E.updateSight(s);
 assert.ok(E.move(s,u.id,town.q,town.r).ok);assert.equal(s.battleStats.de.captures,1);E.checkOutcome(s);assert.ok(s.result);
 assert.equal(s.result.battleStats.de.captures,1);s.battleStats.de.captures=99;assert.equal(s.result.battleStats.de.captures,1);
});
const P=require('./progress');const storage=new Map();global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
test('completed games are archived once across reloads and modes remain distinct',()=>{
 const s=E.newGame('tutorial');s.units.filter(u=>u.side==='su').forEach(u=>u.status='routed');E.invalidate(s);E.checkOutcome(s);
 P.recordGameResult(s);P.recordGameResult(E.restore(E.serialize(s)));assert.equal(P.getArchiveRecords().length,1);
 const r=P.getArchiveRecords()[0];assert.equal(r.mode,'tutorial');assert.equal(r.winner,'de');assert.ok(r.medals.includes('迅速制胜'));
 const c=E.newGame();c.units.filter(u=>u.side==='de').forEach(u=>u.status='routed');E.invalidate(c);E.checkOutcome(c);P.recordGameResult(c);
 assert.equal(P.getArchiveRecords().length,2);assert.equal(P.getArchiveRecords()[0].mode,'campaign');
 assert.equal(E.newGame().units[0].xp,0);
});
test('malformed archive entries and denied browser storage never break recording',()=>{
 storage.set('iron-fog-battle-archive','[null,42,{"battleId":"bad"}]');assert.deepEqual(P.getArchiveRecords(),[]);
 const s=E.newGame('tutorial');s.units.filter(u=>u.side==='su').forEach(u=>u.status='routed');E.invalidate(s);E.checkOutcome(s);assert.doesNotThrow(()=>P.recordGameResult(s));
 global.localStorage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};assert.doesNotThrow(()=>P.recordGameResult(s));assert.deepEqual(P.getArchiveRecords(),[]);
});
console.log(count+' progression tests passed');
