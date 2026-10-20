const assert=require('node:assert/strict'),E=require('./engine');
let origin;for(let r=8;r<55&&!origin;r++)for(let q=8;q<70;q++)if(E.ring({q,r},7).every(p=>E.terrain(p.q,p.r)==='plain')){origin={q,r};break;}
if(!origin)throw Error('plain fixture unavailable');
function fixture(roles){const s=E.newGame(),all=s.units;s.units=roles.map(([side,role],i)=>({...all.find(u=>u.side===side&&u.role===role),id:'test'+i,q:origin.q+i,r:origin.r}));s.logs=[];s.cities={};s.explored={de:new Set(),su:new Set()};E.invalidate(s);E.updateSight(s);return s;}
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('AI air respects visibility, quota and terminal result',()=>{
 const s=fixture([['de','rifle'],['su','artillery']]);s.air.de.recon=0;
 const r=E.aiAirStep(s);assert(r?.ok);assert.equal(r.kind,'strike');assert.equal(s.air.de.strike,1);assert(s.units[1].hp<s.units[1].maxHp);
 E.aiAirStep(s);assert.equal(s.air.de.strike,0);assert.equal(E.aiAirStep(s),null);
 s.result={winner:'de'};const before=E.serialize(s);E.aiAirStep(s);E.aiStep(s,s.units[0].id);assert.equal(E.serialize(s),before);
});
test('AI recon choice does not use hidden enemy coordinates',()=>{
 const a=fixture([['de','rifle'],['su','rifle']]),b=fixture([['de','rifle'],['su','rifle']]);
 Object.assign(a.units[1],{q:70,r:60});Object.assign(b.units[1],{q:60,r:60});for(const s of [a,b]){s.air.de.strike=0;E.invalidate(s);E.updateSight(s);assert(!E.canSee(s,s.units[1],'de'));}
 const x=E.aiAirStep(a),y=E.aiAirStep(b);assert.deepEqual(x&&[x.kind,x.q,x.r],y&&[y.kind,y.q,y.r]);
});
test('wounded combat unit withdraws from an exposed firing lane',()=>{
 const s=fixture([['de','rifle'],['su','rifle'],['de','medic']]),[u,e,m]=s.units;u.hp=12;u.morale=20;e.q=u.q+2;m.q=u.q-3;E.invalidate(s);E.updateSight(s);const before=E.distance(u,e);E.aiStep(s,u.id);assert(E.distance(u,e)>before,'unit should retreat instead of attacking into danger');
});
console.log(n+' AI checks passed');
