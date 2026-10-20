const assert=require('node:assert/strict'),E=require('./engine.js'),D=require('./scenario.js');
let count=0;function test(name,fn){fn();console.log('PASS '+name);count++;}
test('campaign objective requires Minsk, two western cities and Soviet losses',()=>{
 const s=E.newGame();s.cities.minsk='de';s.cities.brest='de';s.cities.grodno='de';
 assert.equal(E.checkOutcome(s),null);const su=s.units.filter(u=>u.side==='su');su.slice(0,Math.ceil(su.length*.35)).forEach(u=>u.status='captured');
 E.checkOutcome(s);assert.equal(s.result.winner,'de');const frozen=JSON.stringify(s.result);s.cities.minsk='su';E.checkOutcome(s);assert.equal(JSON.stringify(s.result),frozen);
 const before=E.serialize(s),u=s.units.find(u=>u.side==='de');E.move(s,u.id,u.q+1,u.r);E.waitUnit(s,u.id);E.airMission(s,'de','recon',u.q,u.r);E.endTurn(s);assert.equal(E.serialize(s),before);
});
test('deadline is after Soviet round24, not before',()=>{
 const s=E.newGame();s.round=24;E.checkOutcome(s);assert.equal(s.result,null);E.endTurn(s);assert.equal(s.result,null);assert.equal(s.active,'su');E.endTurn(s);assert.equal(s.result.winner,'su');assert.equal(s.result.round,24);
});
test('support survivors cannot prevent combat elimination',()=>{
 const s=E.newGame();for(const u of s.units)if(u.side==='de'&&!['medic','supply','hq'].includes(u.role))u.status='destroyed';E.checkOutcome(s);assert.equal(s.result.winner,'su');assert(s.result.stats.de.active>0);
});
test('old campaign saves keep damage and gain mission defaults',()=>{
 const s=E.newGame();s.units[0].hp-=12;const raw=JSON.parse(E.serialize(s));delete raw.mode;delete raw.initialCounts;delete raw.result;delete raw.tutorialProgress;delete raw.lastTurnReport;const r=E.restore(JSON.stringify(raw));assert(r);assert.equal(r.mode,'campaign');assert.equal(r.units[0].hp,s.units[0].hp);assert.equal(r.result,null);
});
test('waiting consumes action, disables automatic support and resets next turn',()=>{
 const s=E.newGame(),u=s.units.find(u=>u.side==='de'&&u.role==='medic');assert(E.waitUnit(s,u.id).ok);assert(u.acted);assert.equal(u.mp,0);assert.equal(E.autoSupportUnit(s,u),false);E.endTurn(s);E.endTurn(s);assert.equal(u.waiting,false);assert.equal(u.acted,false);
});
test('tutorial deploys fourteen valid units, separate objective and bounded moves',()=>{
 const s=E.newGame('tutorial');assert.equal(s.mode,'tutorial');assert.equal(s.units.length,14);assert.equal(s.units.filter(u=>u.side==='de').length,8);assert.equal(new Set(s.units.map(u=>E.key(u.q,u.r))).size,14);assert(E.restore(E.serialize(s)));
 assert.equal(E.checkOutcome(s),null);for(const u of s.units.filter(u=>u.side==='de'))for(const p of E.reachable(s,u).values())assert(E.inMission?E.inMission(s,p.q,p.r):p.q>=10&&p.q<=35&&p.r>=43&&p.r<=64);
 s.cities.kobryn='de';E.checkOutcome(s);assert.equal(s.result.winner,'de');
});
test('tutorial deadline and saved finished result survive reload',()=>{
 const s=E.newGame('tutorial');s.round=12;s.active='su';E.endTurn(s);assert.equal(s.result.winner,'su');const r=E.restore(E.serialize(s));assert(r);assert.equal(r.result.winner,'su');assert.equal(r.mode,'tutorial');
});
console.log(count+' mission checks passed');
