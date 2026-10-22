(()=>{'use strict';const D=window.BARBAROSSA,E=window.BARB_ENGINE,P=window.BARB_PROGRESS,FX=window.BARB_EFFECTS,$=id=>document.getElementById(id);
const MODE_KEY='iron-fog-mode';
let currentMode='campaign';try{currentMode=localStorage.getItem(MODE_KEY)||'campaign';}catch{}
if(currentMode!=='tutorial'&&currentMode!=='campaign')currentMode='campaign';

let settings=P?P.getSettings():{sound:false,anim:'normal'};
applySettingsToDom();

function applySettingsToDom(){
 document.body.classList.toggle('anim-off',settings.anim==='off');
 document.body.classList.toggle('anim-fast',settings.anim==='fast');
 if($('soundToggle'))$('soundToggle').checked=settings.sound;
 if($('animSelect'))$('animSelect').value=settings.anim;
}

function saveKey(m=currentMode){return m==='tutorial'?'iron-fog-tutorial':'barbarossa-v2';}
function loadSave(m=currentMode){
 try{
  const raw=localStorage.getItem(saveKey(m));
  if(raw){
   const parsed=E.restore(raw);
   if(parsed&&parsed.mode===m){
    const sWithProgress=E.ensureProgress(parsed);
    // If battleId was missing in raw save, persist upgraded save immediately to prevent duplicate archives on refresh
    if(!parsed.battleId||raw.indexOf(sWithProgress.battleId)===-1||JSON.parse(raw).autoSupportVersion!==1){
     try{localStorage.setItem(saveKey(m),E.serialize(sWithProgress));}catch{}
    }
    return sWithProgress;
   }
  }
 }catch{}
 return E.ensureProgress(E.newGame(m));
}

let S=loadSave(currentMode);
let perspective='de',actionMode=null,busy=false,pendingTarget=null;let sight=E.vision(S,'de');
let view={...D.regions[0].view},selected=null,side='all',type='all',query='',suppressClick=false;
let mobileLayout=false,mobileCollapsed=false,mobileUnitId=null;
let unitPickerContext=null;
let undoSnapshot=null; // serialize string before move
let undoDisabledReason='';
let humanTurnReport=null;
let outcomeDialogShownFor=null; // track result shown once

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coord=u=>{let n=u.q+1,c='';while(n){c=String.fromCharCode(65+(n-1)%26)+c;n=Math.floor((n-1)/26);}return c+(u.r+1);};
const color=side=>side==='de'?'#536c7c':'#a35143',group=u=>D.groups.find(g=>g.id===u.group);
const poly=(x,y,size=34)=>Array.from({length:6},(_,i)=>{const a=(i*60-30)*Math.PI/180;return (x+Math.cos(a)*size).toFixed(1)+','+(y+Math.sin(a)*size).toFixed(1);}).join(' ');
const pts=geoPoints=>geoPoints.map(p=>{const v=D.geo(...p);return v.x+','+v.y;}).join(' ');
function sprite(asset,x,y,w,h){const a=D.art[asset];if(!a)return '';return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${a.rect[2]} ${a.rect[3]}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><svg width="${a.rect[2]}" height="${a.rect[3]}" viewBox="${a.rect.join(' ')}" overflow="hidden"><image href="assets/${a.file}" width="1254" height="1254"/></svg></svg>`;}

function inMissionArea(u){
 if(!S||S.mode!=='tutorial'||!S.missionArea)return true;
 return u.q>=S.missionArea.minQ&&u.q<=S.missionArea.maxQ&&u.r>=S.missionArea.minR&&u.r<=S.missionArea.maxR;
}
const matches=u=>(side==='all'||u.side===side)&&(type==='all'||u.role===type)&&(!query||[u.name,group(u).name,group(u).commander,group(u).area,E.profiles[u.role].name].join(' ').toLowerCase().includes(query));
const visible=u=>E.alive(u)&&inMissionArea(u)&&E.canSee(S,u,perspective)&&matches(u);

function urbanIcon(t,x,y){const factory=t==='factory',station=t==='station',center=t==='center';return '<g transform="translate('+x+' '+y+')" class="building"><path d="M-23 14V-7L-12-17 0-7V14Z" fill="#d5c1a0" stroke="#766b5c" stroke-width="2"/><path d="M-23-7L-12-17 0-7" stroke="#a56c51" stroke-width="5" fill="none"/><path d="M4 15V-13H22V15Z" fill="'+(factory?'#a09b8c':'#c5b08e')+'" stroke="#766b5c" stroke-width="2"/><path d="M-16 1h6m-6 7h6M9-6h7m-7 8h7" stroke="#656c62" stroke-width="4"/>'+(factory?'<path d="M18-13V-26h7V-6" fill="#8b826e" stroke="#655f53" stroke-width="2"/>':station?'<path d="M-26 21h54M-20 17v9m12-9v9m12-9v9m12-9v9m12-9v9" stroke="#766c58" stroke-width="2"/>':center?'<path d="M-6-16V-34h4v18m0-17h14l-3 6H-2" fill="#9b6c45"/>':'')+'</g>';}
function scenery(t,x,y,seed){if(E.urbanNames[t])return urbanIcon(t,x,y);if(t==='forest')return `<g transform="translate(${x} ${y})" opacity=".62"><path d="M-21 13L-11-15 0 13ZM-2 12L9-19 22 12Z" fill="#536f50"/><path d="M-11-15L-9 13H-21ZM9-19L11 12H-2Z" fill="#bac6a0"/></g>`;if(t==='marsh')return `<g transform="translate(${x} ${y})" opacity=".7"><path d="M-22 13h15m5-11h22M-15 9V-9m4 18V-3M10 1V-16m4 17V-8" fill="none" stroke="#645a78" stroke-width="2"/></g>`;if(t==='hill')return `<path d="M${x-23} ${y+9}Q${x-2} ${y-17} ${x+22} ${y+8}M${x-18} ${y+15}Q${x} ${y-4} ${x+17} ${y+14}" stroke="#8c845f" stroke-width="1.4" fill="none" opacity=".4"/>`;if(t==='bridge')return `<g transform="translate(${x} ${y})"><path d="M-22-7L22 7M-22 1L22 15" stroke="#675d45" stroke-width="3"/><path d="M-18-8l-4 12m13-9l-4 12m13-9l-4 12m13-9l-4 12m13-9l-4 12" stroke="#f2e0aa" stroke-width="3"/></g>`;if(t==='plain'&&seed%7===0)return `<path d="M${x-19} ${y+7}h12m12-13h9" stroke="#eae5cb" stroke-width="1" opacity=".7"/>`;return '';}

function buildMap(){
 let cells='',decor='',roads='';for(let r=0;r<D.board.rows;r++)for(let q=0;q<D.board.cols;q++){const p=D.position(q,r),t=E.terrain(q,r);cells+=`<polygon class="cell" data-q="${q}" data-r="${r}" points="${poly(p.x,p.y)}" fill="${(D.palette[t]||({center:"#b6a180",residential:"#cbbb9c",factory:"#b3b09e",station:"#c9b181"})[t])}"/>`;decor+=scenery(t,p.x,p.y,q*13+r*7);}
 for(const route of D.routes)roads+=`<polyline points="${pts(D.roadPoints(route))}" fill="none" stroke="#c4ae7d" stroke-width="13" stroke-linejoin="round"/><polyline points="${pts(D.roadPoints(route))}" fill="none" stroke="#eee1b4" stroke-width="6" stroke-linejoin="round"/>`;
 const railway=pts(D.rail.map(id=>{const t=D.town(id);return [t.lon,t.lat-.045];}));roads+=`<polyline points="${railway}" stroke="#77715f" stroke-width="5" fill="none"/><polyline points="${railway}" stroke="#77715f" stroke-width="12" stroke-dasharray="2 16" fill="none"/>`;
 let places='';for(const t of D.towns){const p=D.position(t.q,t.r),large=t.importance>=2;places+=`<g data-city="${t.id}" role="button" tabindex="0" aria-label="${t.name}，城镇节点"><circle cx="${p.x}" cy="${p.y}" r="${t.importance===3?13:9}" fill="#f0e4bf" stroke="#6c7257" stroke-width="4"/><text class="place-label" x="${p.x}" y="${p.y-28}" font-size="${large?28:22}">${t.name}</text><text class="place-label city-latin" x="${p.x}" y="${p.y-8}" font-size="${large?13:10}">${t.latin}</text></g>`;}
 for(const river of D.rivers){const p=D.geo(...river.label);places+=`<text class="terrain-text" x="${p.x}" y="${p.y}">${river.name}</text>`;}
 const forest=D.geo(24.05,52.70),marsh=D.geo(26.3,51.65);places+=`<text class="terrain-text" x="${forest.x}" y="${forest.y}">比亚沃维耶扎林区</text><text class="terrain-text" x="${marsh.x}" y="${marsh.y}" font-size="27">普里皮亚季沼泽 · 南部屏障</text>`;
 let formations='';for(const g of D.groups){const p=D.geo(g.lon,g.lat+.43);formations+=`<text class="formation-label" x="${p.x}" y="${p.y}" fill="${color(g.side)}">${g.short}</text>`;}
 const axes=D.plans.map(p=>`<polyline points="${pts(p.points)}" fill="none" stroke="#886741" stroke-width="10" stroke-dasharray="22 18" opacity=".72" stroke-linejoin="round" marker-end="url(#axis-arrow)"/>`).join('');
 $('map').innerHTML=`<defs><marker id="axis-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5 0 10 2 5Z" fill="#886741"/></marker><pattern id="paper" width="180" height="180" patternUnits="userSpaceOnUse"><path d="M1 10h30m120 60h20m-100 80h18" stroke="#ffffff" opacity=".10"/></pattern></defs><rect width="4960" height="3630" fill="#ddd9b8"/><g id="cells">${cells}</g><g pointer-events="none">${decor}${roads}</g><g id="border" pointer-events="none"><polyline points="${pts(D.border)}" fill="none" stroke="#ab7565" stroke-width="5" stroke-dasharray="16 12"/></g><g id="axes" pointer-events="none">${axes}</g><g id="places">${places}</g><g id="formations" pointer-events="none">${formations}</g><g id="forts"></g><g id="overlays" pointer-events="none"></g><g id="moves" pointer-events="none"></g><g id="fog" pointer-events="none"></g><g id="units"></g><g id="targetOverlay" pointer-events="none"></g><g id="fxOverlay" pointer-events="none"></g><g id="airOverlay" pointer-events="none"></g><g id="fx" pointer-events="none"></g>`;
 $('legend').innerHTML=Object.entries(D.palette).map(([t,c])=>`<span><i style="background:${c}"></i>${D.terrainNames[t]}</span>`).join('')+'<span><i style="background:#cbbb9c"></i>城市街区</span><span>⚒ 堑壕 · ✹ 雷区</span><span><i class="line-key"></i>公路 / 轨道线为铁路</span><span><i class="border-key"></i>开战边界</span>';
 let mini=cells.replaceAll('class="cell"','').replace(/ data-q="\d+" data-r="\d+"/g,'');mini+=`<polyline points="${pts(D.border)}" fill="none" stroke="#ab7565" stroke-width="10"/>`;for(const t of D.towns){const p=D.position(t.q,t.r);mini+=`<circle cx="${p.x}" cy="${p.y}" r="17" fill="#6c7257"/>`;}
 $('minimap').innerHTML=mini+'<g id="miniFog"></g><g id="miniUnits"></g><rect id="miniView" fill="#ffffff10" stroke="#fff8dc" stroke-width="18" pointer-events="none"/>';
}

function cameraBounds(){return S.mode==='tutorial'&&S.missionView?S.missionView:{x:0,y:0,w:D.board.width,h:D.board.height};}
function clampInputView(next){return window.BARB_MAP_INPUT.clampCamera(next,cameraBounds(),mobileLayout?320:850,mobileLayout?200:620);}
function clampView(){
 if(mobileLayout){view=clampInputView(view);return;}
 if(S.mode==='tutorial'&&S.missionView){
  const mv=S.missionView;
  view.w=Math.max(450,Math.min(mv.w,view.w));
  view.h=Math.max(320,Math.min(mv.h,view.h));
  view.x=Math.max(mv.x,Math.min(mv.x+mv.w-view.w,view.x));
  view.y=Math.max(mv.y,Math.min(mv.y+mv.h-view.h,view.y));
 }else{
  view.w=Math.max(850,Math.min(D.board.width,view.w));
  view.h=Math.max(620,Math.min(D.board.height,view.h));
  view.x=Math.max(0,Math.min(D.board.width-view.w,view.x));
  view.y=Math.max(0,Math.min(D.board.height-view.h,view.y));
 }
}
let viewFrame=0;
function scheduleView(){if(!viewFrame)viewFrame=requestAnimationFrame(()=>{viewFrame=0;applyView();});}
function applyView(){clampView();$('map').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);for(const [attr,val]of Object.entries({x:view.x,y:view.y,width:view.w,height:view.h}))$('miniView').setAttribute(attr,val);}
function setRegion(id){
 if(S.mode==='tutorial'&&id!=='south'){return;}
 const r=D.regions.find(x=>x.id===id);if(!r)return;
 view={...r.view};$('viewName').textContent=r.name;
 $('regions').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.region===id));
 applyView();renderUnits();
}
function focusUnit(u){const p=D.position(u.q,u.r),rect=$('mapWrap').getBoundingClientRect(),w=mobileLayout?700:1480,h=mobileLayout?w*rect.height/Math.max(1,rect.width):1130;view={x:p.x-w/2,y:p.y-h/2,w,h};$('viewName').textContent=group(u).area;$('regions').querySelectorAll('button').forEach(b=>b.classList.remove('active'));applyView();renderUnits();}
function zoom(f,point){const old={...view},maxW=S.mode==='tutorial'&&S.missionView?S.missionView.w:D.board.width,w=Math.max(mobileLayout?320:450,Math.min(maxW,view.w*f)),ratio=w/view.w,maxH=S.mode==='tutorial'&&S.missionView?S.missionView.h:D.board.height,h=Math.max(mobileLayout?200:320,Math.min(maxH,view.h*ratio));const px=point?Math.max(0,Math.min(1,(point.x-view.x)/view.w)):.5,py=point?Math.max(0,Math.min(1,(point.y-view.y)/view.h)):.5;view={x:old.x+px*(old.w-w),y:old.y+py*(old.h-h),w,h};applyView();}
function pointIn(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
function shortName(u){return u.name.replace('装甲集群 · ','').replace('集团军 · ','军·').replace('第','').replace('机械化军 · ','机·').replace(' · 指挥部',' HQ').replace('西方面军后方 · ','后方·');}

function isGameFinished(){return !!(S&&S.result);}
const controllable=u=>!busy&&!isGameFinished()&&u&&E.alive(u)&&inMissionArea(u)&&u.side===S.active&&(perspective==='god'||u.side===perspective);
function specialIcon(u){const c=color(u.side);return `<g><rect x="-22" y="-29" width="44" height="36" rx="5" fill="${c}" stroke="#f3e9ca" stroke-width="2"/><text y="-3" text-anchor="middle" fill="#fff8df" font-size="25">${E.profiles[u.role].symbol}</text></g>`;}

function nextReadyId(units, currentId, activeSide) {
 if (!Array.isArray(units) || units.length === 0) return null;
 function isEligible(u) {
  return !!(u && inMissionArea(u) && u.side === activeSide && u.status === 'active' && u.hp > 0 && !u.acted);
 }
 var len = units.length;
 var startIdx = 0;
 if (currentId !== null && currentId !== undefined) {
  for (var i = 0; i < len; i++) {
   if (units[i] && units[i].id === currentId) {
    startIdx = i + 1;
    break;
   }
  }
 }
 for (var step = 0; step < len; step++) {
  var candidate = units[(startIdx + step) % len];
  if (isEligible(candidate)) {
   return candidate.id;
  }
 }
 return null;
}

function renderNextReadyButton() {
 var btn = $('nextReady');
 if (!btn) return;
 var isOpponentTurn = perspective !== 'god' && perspective !== S.active;
 var count = 0;
 if (!isGameFinished() && !isOpponentTurn && Array.isArray(S.units)) {
  for (var i = 0; i < S.units.length; i++) {
   var u = S.units[i];
   if (u && inMissionArea(u) && u.side === S.active && u.status === 'active' && u.hp > 0 && !u.acted) {
    count++;
   }
  }
 }
 btn.disabled = !!(busy || isGameFinished() || isOpponentTurn || count === 0);
 btn.textContent = '下一支未行动（' + count + '）';
}

function selectNextReadyUnit() {
 if (busy || isGameFinished() || (perspective !== 'god' && perspective !== S.active)) return;
 var targetId = nextReadyId(S.units, selected, S.active);
 if (targetId === null) {
  var hintEl = $('actionHint');
  if (hintEl) hintEl.textContent = '本回合没有未行动部队';
  return;
 }
 var targetUnit = S.units.find(u=>u.id===targetId);
 if (!targetUnit) return;
 if (!visible(targetUnit)) {
  side = 'all';
  type = 'all';
  query = '';
  var sFilter = $('sideFilter');
  var tFilter = $('typeFilter');
  var qInput = $('search');
  if (sFilter) sFilter.value = 'all';
  if (tFilter) tFilter.value = 'all';
  if (qInput) qInput.value = '';
 }
 showUnit(targetId, true);
 var hint = $('actionHint');
 if (hint) hint.textContent = '已定位未行动部队：' + (targetUnit.name || '');
}

function updateRegionsForMode(){
 const isTut=S.mode==='tutorial';
 $('regions').querySelectorAll('button').forEach(b=>{
  const regId=b.dataset.region;
  if(isTut){
   if(regId==='south'){b.disabled=false;b.style.display='';b.textContent='布列斯特教学区';}
   else{b.disabled=true;b.style.display='none';}
  }else{
   b.disabled=false;b.style.display='';
   const r=D.regions.find(x=>x.id===regId);
   if(r)b.textContent=r.name;
  }
 });
 if(isTut){
  $('regions').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.region==='south'));
 }
}

// Keep unchanged SVG sprites alive instead of reparsing every unit on every AI update.
const svgChildren=new WeakMap();
function syncSvgChildren(container, items) {
  let cache = svgChildren.get(container);
  if (!cache) { cache = new Map(); svgChildren.set(container, cache); }
  const present = new Set();
  for (const [id, markup] of items) {
    present.add(id);
    const old = cache.get(id);
    if (old?.markup === markup) continue;
    const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    holder.innerHTML = markup;
    const node = holder.firstElementChild;
    if (old) old.node.replaceWith(node); else container.appendChild(node);
    cache.set(id, { markup, node });
  }
  for (const [id, entry] of cache) if (!present.has(id)) { entry.node.remove(); cache.delete(id); }
  let cursor = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const node = cache.get(items[i][0]).node;
    if (node.nextSibling !== cursor) container.insertBefore(node, cursor);
    cursor = node;
  }
}
function renderUnits(){
 if(!$('units'))return;
 const artOn=$('artToggle').checked;
 const unitItems=[],miniItems=[];
 // Ground positions determine depth; selection and sprite height never lift a unit.
 const orderedUnits = S.units.filter(visible).map(u => ({ u, pos: D.position(u.q, u.r) })).sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x || (a.u.id < b.u.id ? -1 : a.u.id > b.u.id ? 1 : 0)).map(item => item.u);
 for(const u of orderedUnits){
  const p=D.position(u.q,u.r),c=color(u.side),chosen=u.id===selected,symbol=E.profiles[u.role].symbol;
  const vet=E.veteran(u);
  const badgeText=vet.level>0?('★'.repeat(vet.level)):null;
  const badgeSvg=badgeText?`<text class="unit-badge" x="18" y="24">${badgeText}</text>`:'';
  const html=`<g class="unit ${u.acted?'spent':''}" data-unit="${u.id}" transform="translate(${p.x} ${p.y})" role="button" tabindex="0" aria-label="${esc((u.side==='de'?'德军 ':'苏军 ')+u.name+'，'+coord(u))}"><title>${esc(u.name+' · '+E.profiles[u.role].name+' · '+vet.name+' · 兵力'+u.hp+' · 士气'+u.morale)}</title>${chosen?'<ellipse class="selected-ring" cy="5" rx="39" ry="28"/>':''}<ellipse class="unit-base" cy="13" rx="30" ry="13" fill="${c}" stroke="#e8dfbf" stroke-width="2"/>${artOn&&u.asset?'<g class="unit-art">'+sprite(u.asset,-41,-55,82,70)+'</g>':specialIcon(u)}<rect x="-31" y="9" width="21" height="18" rx="2" fill="${c}" stroke="#e8dfbf"/><text x="-20.5" y="22" font-size="12" fill="#fff6dc" text-anchor="middle">${symbol}</text>${badgeSvg}<path d="M-27 31h54" stroke="#544d3e" stroke-width="5"/><path d="M-27 31h${54*u.hp/u.maxHp}" stroke="${u.morale<25?'#c46a4c':'#c4d29b'}" stroke-width="5"/>${chosen?`<text class="unit-label" y="50">${esc(shortName(u))}</text>`:''}</g>`;
  const mini=`<circle cx="${p.x}" cy="${p.y}" r="${chosen?35:23}" fill="${c}" ${chosen?'stroke="#f7ce6d" stroke-width="12"':''}/>`;
  unitItems.push([u.id,html]);miniItems.push([u.id,mini]);
 }
 syncSvgChildren($('units'),unitItems);syncSvgChildren($('miniUnits'),miniItems);
 const all=S.units.filter(u=>E.alive(u)&&inMissionArea(u)&&E.canSee(S,u,perspective));
 $('filteredCount').textContent='当前显示 '+S.units.filter(visible).length+' / 已知 '+all.length+' 队';
 for(const side of ['de','su']){
  const own=perspective==='god'||perspective===side;
  const list=S.units.filter(u=>u.side===side&&inMissionArea(u)&&(own||E.canSee(S,u,perspective)));
  $(side+'Count').textContent=list.filter(E.alive).length;
  $(side+'Caption').textContent=own?'在场':'已发现';
 }
 $('phase').textContent='第 '+S.round+' 回合 · '+(S.active==='de'?'德军':'苏军')+(S.result?'（已结束）':'');
 $('endTurn').textContent=perspective!=='god'&&perspective!==S.active?'推进敌军回合':'结束回合';
 $('endTurn').disabled=busy||isGameFinished();
 renderAirButtons();renderNextReadyButton();
 $('perspective').disabled=busy;
 $('reset').disabled=busy;
 $('modeSelect').value=S.mode;
 $('modeSelect').disabled=busy;

 const seenLogs=S.logs.filter(e=>perspective==='god'||e.audience.includes(perspective)).slice(0,8);
 $('battleLog').innerHTML=seenLogs.map(e=>`<li><small>R${e.round}</small>${esc(e.text)}</li>`).join('')||'<li>选择己方部队开始行动。</li>';
 const ownLoss=S.units.filter(u=>u.side===(perspective==='god'?S.active:perspective)&&inMissionArea(u)&&!E.alive(u));
 $('losses').textContent='己方退场 '+ownLoss.length+' · 被俘 '+ownLoss.filter(u=>u.status==='captured').length;
 updateUndoButton();
 renderObjectives();
 renderBattleStatsPanel();
 renderTurnReport();
 checkAndShowOutcomeDialog();
 renderMobileControls();
}

// Three compound paths replace thousands of fog polygons in both maps.
let fogGeometry=null,lastFogMarkup=null;
function renderFog(){
 sight=perspective==='god'?null:E.vision(S,perspective);
 const minQ=S.mode==='tutorial'&&S.missionArea?S.missionArea.minQ:0;
 const maxQ=S.mode==='tutorial'&&S.missionArea?S.missionArea.maxQ:D.board.cols-1;
 const minR=S.mode==='tutorial'&&S.missionArea?S.missionArea.minR:0;
 const maxR=S.mode==='tutorial'&&S.missionArea?S.missionArea.maxR:D.board.rows-1;
 if(!fogGeometry){
  fogGeometry=[];
  for(let r=0;r<D.board.rows;r++)for(let q=0;q<D.board.cols;q++){
   const p=D.position(q,r);
   fogGeometry.push({q,r,key:E.key(q,r),path:'M'+poly(p.x,p.y,35).replaceAll(' ','L')+'Z'});
  }
 }
 const paths=['','',''];
 for(const cell of fogGeometry){
  const outside=cell.q<minQ||cell.q>maxQ||cell.r<minR||cell.r>maxR;
  if(S.mode==='tutorial'&&outside)paths[2]+=cell.path;
  else if(sight&&!sight.has(cell.key))paths[S.explored[perspective].has(cell.key)?1:0]+=cell.path;
 }
 const fills=['#23342e','#3e4c43','#19221d'],opacity=[.88,.48,.95];
 const fog=paths.map((d,i)=>d?'<path d="'+d+'" fill="'+fills[i]+'" opacity="'+opacity[i]+'"/>':'').join('');
 if(fog!==lastFogMarkup){
  $('fog').innerHTML=fog;$('miniFog').innerHTML=fog;lastFogMarkup=fog;
 }
 $('formations').style.display=perspective==='god'?'':'none';
 for(const t of D.towns){
  const el=$('places').querySelector('[data-city="'+t.id+'"] circle');
  if(el)el.setAttribute('fill',perspective==='god'||sight.has(E.key(t.q,t.r))?color(S.cities[t.id]):'#b7ae90');
 }
 let forts='';
 for(const f of Object.values(S.forts)){
  if(S.mode==='tutorial'&&S.missionArea&&(f.q<minQ||f.q>maxQ||f.r<minR||f.r>maxR))continue;
  if(E.fortVisible(S,f,perspective)){
   const p=D.position(f.q,f.r);
   forts+=`<g transform="translate(${p.x} ${p.y})" pointer-events="none">${f.type==='mine'?'<path d="M0-24L25 18H-25Z" fill="#c09054" stroke="#643f28" stroke-width="3"/><text y="11" text-anchor="middle" font-size="24" fill="#3f342a">✹</text>':'<path d="M-26-10h16v13H5V-10h20M-26 2h10v14H11V2h14" fill="none" stroke="#75614c" stroke-width="8"/><path d="M-26-10h16v13H5V-10h20" fill="none" stroke="#e0c48c" stroke-width="3"/>'}</g>`;
  }
 }
 for(const b of Object.values(S.bridges)){
  if(S.mode==='tutorial'&&S.missionArea&&(b.q<minQ||b.q>maxQ||b.r<minR||b.r>maxR))continue;
  if(perspective!=='god'&&b.side!==perspective&&!sight.has(E.key(b.q,b.r)))continue;
  const p=D.position(b.q,b.r);
  forts+='<g transform="translate('+p.x+' '+p.y+')" pointer-events="none"><path d="M-23-12L23 12M-23 0L23 24" stroke="'+(b.progress>=2?'#e0c48c':'#9c9480')+'" stroke-width="6" stroke-dasharray="'+(b.progress<2?'7 5':'none')+'"/><path d="M-18-11l-7 13m18-7l-7 13m18-7l-7 13m18-7l-7 13" stroke="#695a46" stroke-width="3"/><rect x="-27" y="-37" width="54" height="18" rx="3" fill="'+(b.paused?'#a75e3e':color(b.side))+'"/><text y="-23" text-anchor="middle" fill="#fff6db" font-size="13">'+(b.paused?'暂停 ':b.progress===3?'重桥 ':'架桥 ')+b.progress+'/3</text></g>';
 }
 $('forts').innerHTML=forts;
 renderOverlays();
}

function renderOverlays(){
 const container=$('overlays');
 if(!container)return;
 let out='';
 const showSupply=$('supplyToggle')&&$('supplyToggle').checked;
 const showThreat=$('threatToggle')&&$('threatToggle').checked;

 const minQ=S.mode==='tutorial'&&S.missionArea?S.missionArea.minQ:0;
 const maxQ=S.mode==='tutorial'&&S.missionArea?S.missionArea.maxQ:D.board.cols-1;
 const minR=S.mode==='tutorial'&&S.missionArea?S.missionArea.minR:0;
 const maxR=S.mode==='tutorial'&&S.missionArea?S.missionArea.maxR:D.board.rows-1;

 const ownSide=perspective==='god'?S.active:perspective;
 const ownVision=perspective==='god'?null:E.vision(S,ownSide);

 if(showSupply){
  const supMap=E.supplyMap(S,ownSide);
  for(let r=minR;r<=maxR;r++)for(let q=minQ;q<=maxQ;q++){
   const k=E.key(q,r);
   if(ownVision&&!ownVision.has(k))continue;
   const isConnected=supMap.has(k);
   const p=D.position(q,r);
   out+=`<polygon points="${poly(p.x,p.y,33)}" fill="${isConnected?'#348c4a33':'#c96c2e33'}" stroke="${isConnected?'#348c4a':'#c96c2e'}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  }
 }

 if(showThreat){
  const enemySide=ownSide==='de'?'su':'de';
  const enemies=S.units.filter(u=>E.alive(u)&&inMissionArea(u)&&u.side===enemySide&&u.ammo>0&&E.isCombat(u)&&(perspective==='god'||E.canSee(S,u,ownSide)));
  const threatened=new Set();
  for(const e of enemies){
   const rng=E.profiles[e.role].range;
   for(const p of E.ring(e,rng)){
    if(p.q<minQ||p.q>maxQ||p.r<minR||p.r>maxR)continue;
    if(e.role==='artillery'||E.lineClear(e,p)){
     threatened.add(E.key(p.q,p.r));
    }
   }
  }
  for(const k of threatened){
   const [q,r]=k.split(',').map(Number);
   const p=D.position(q,r);
   out+=`<polygon points="${poly(p.x,p.y,33)}" fill="#d63f272a" stroke="#d63f27" stroke-width="1.8"/>`;
  }
 }
 container.innerHTML=out;
}

function renderMoves(){
 const u=S.units.find(u=>u.id===selected);
 let out='';
 if(controllable(u)&&!u.acted){
  const ability=actionMode&&actionMode!=='move';
  const nodes=ability?E.ring(u,1).filter(p=>!E.abilityReason(S,u,actionMode,p)):[...E.reachable(S,u,true).values()].filter(p=>p.path.length);
  for(const p of nodes){
   const xy=D.position(p.q,p.r);
   out+=`<polygon points="${poly(xy.x,xy.y,31)}" fill="${ability&&!['heal','resupply'].includes(actionMode)?'#dfb24d33':'#b7d99444'}" stroke="${ability&&!['heal','resupply'].includes(actionMode)?'#cf9d35':'#9cbd77'}" stroke-width="3"/>`;
  }
 }
 if(controllable(u)&&!actionMode)for(const enemy of S.units.filter(v=>visible(v)&&v.side!==u.side&&!E.attackReason(S,u,v))){
  const xy=D.position(enemy.q,enemy.r);
  out+='<polygon points="'+poly(xy.x,xy.y,32)+'" fill="#d65c4122" stroke="#cf593d" stroke-width="4"/>';
 }
 if(controllable(u)&&u.advance&&!E.advanceReason(S,u)){
  const xy=D.position(u.advance.q,u.advance.r);
  out+='<polygon points="'+poly(xy.x,xy.y,32)+'" fill="#55bfaa44" stroke="#329c87" stroke-width="5"/>';
 }
 $('moves').innerHTML=out;
 renderTarget();
}

function renderRoster(){
 const list=S.units.filter(visible);
 $('roster').innerHTML=D.groups.map(g=>{
  const units=list.filter(u=>u.group===g.id);
  if(!units.length)return '';
  return `<details ${query||units.some(u=>u.id===selected)?'open':''}><summary><span style="border-left:3px solid ${color(g.side)};padding-left:6px">${g.side==='de'?'德':'苏'} · ${g.name}</span><b>${units.length}</b></summary>${units.map(u=>`<button data-roster="${u.id}" class="${u.id===selected?'active':''}">${esc(u.name)}<small>${E.profiles[u.role].name} · ${coord(u)} · ${u.hp}/${u.maxHp}</small></button>`).join('')}</details>`;
 }).join('')||'<p class="empty">没有已发现的匹配编队。</p>';
}

function renderDetail(){
 const u=S.units.find(u=>u.id===selected);
 if(!u||!visible(u)){
  selected=null;
  $('detail').innerHTML='<p class="empty">选择己方部队，点击绿格移动；点击红框敌军预览并确认攻击。</p>';
  return;
 }
 const g=group(u),p=E.profiles[u.role],own=controllable(u);
 const isConn=E.connected(S,u);
 const supply=perspective==='god'||u.side===perspective?(isConn?'畅通':'已切断'):'未知';
 const vet=E.veteran(u);
 const bonusPct=Math.round(vet.bonus*100);
 const nextXpText=vet.next!==null?`距下一级还需 ${vet.next-vet.xp} XP`:'已达最高等级';
 const prevThreshold=[0,0,40,100][vet.level];
 const currentNextDiff=vet.next!==null?(vet.next-prevThreshold):1;
 const currentXpProgress=vet.next!==null?Math.max(0,Math.min(100,Math.round(((vet.xp-prevThreshold)/currentNextDiff)*100))):100;

 let warningHtml='';
 if(own&&!isConn){
  const penalty=u.side==='su'?14:10;
  const nextMorale=Math.max(0,u.morale-penalty);
  const captureRisk=nextMorale<=15?'，士气降至'+nextMorale+'将触发被俘退场！':'（下轮士气降至'+nextMorale+'）';
  warningHtml=`<div class="supply-warning">⚠️ 补给线已断！回合末士气 −${penalty}${captureRisk}</div>`;
 }

 const veteranHtml=`<div class="veteran-bar">
  <div style="display:flex;justify-content:space-between;font-size:10px;">
   <strong>${vet.name}（经验 ${vet.xp}/200 · 战功 ${u.kills||0} 击毁）</strong>
   <span style="color:#8a6e38;">攻防加成 +${bonusPct}%</span>
  </div>
  <div class="veteran-bar-track" title="经验进度: ${vet.xp} / ${vet.next||200}">
   <div class="veteran-bar-fill" style="width:${currentXpProgress}%"></div>
  </div>
  <div style="font-size:9px;color:var(--muted);margin-top:2px;">${nextXpText}</div>
 </div>`;

 $('detail').innerHTML=`<div class="detail-art">${u.asset?'<svg viewBox="0 0 280 150">'+sprite(u.asset,0,0,280,145)+'</svg>':'<span class="hq-symbol">'+p.symbol+'</span>'}</div><div class="detail-kicker"><span class="side-tag ${u.side}">${u.side==='de'?'德军':'苏军'} · ${p.name} · ${vet.name}</span><span>${coord(u)} · ${u.acted?(u.waiting?'待命':'已行动'):'未行动'}</span></div><h3>${esc(u.name)}</h3>${veteranHtml}<div class="unit-stats"><span>兵力<b>${u.hp} / ${u.maxHp}</b></span><span>士气<b class="${u.morale<30?'danger':''}">${u.morale}</b></span><span>攻击 / 防御<b>${u.attack} <small style="font-size:11px;font-weight:normal;color:#8a6e38;">(+${bonusPct}%)</small> / ${u.defense} <small style="font-size:11px;font-weight:normal;color:#8a6e38;">(+${bonusPct}%)</small></b></span><span>移动 / 射程<b>${u.mp} / ${p.range}</b></span><span>弹药<b>${u.ammo} / ${u.maxAmmo}</b></span><span>${u.role==='armor'?'燃油':'物资'}<b>${u.role==='armor'?u.fuel:u.stock}</b></span></div><p class="role-tip">${p.tip}</p>${warningHtml}<dl><dt>所属</dt><dd>${esc(g.name)}</dd><dt>指挥</dt><dd>${esc(g.commander)}</dd><dt>地形</dt><dd>${E.terrainName(u.q,u.r)}</dd><dt>补给线</dt><dd>${supply}${u.isolated&&supply!=='未知'?' · '+u.isolated+'回合':''}</dd></dl><div class="detail-actions"><button id="focusSelected">定位</button><button id="showFormation">所属编队</button>${own&&!u.acted?'<button id="waitUnitBtn">原地待命</button>':''}</div>${own?'<div class="abilities">'+(u.role==='medic'?'<button data-action="heal">✚ 救护友军</button>':u.role==='supply'?'<button data-action="resupply">▣ 补给 / 维修</button>':u.role==='engineer'?'<button data-action="trench">⚒ 修筑堑壕</button><button data-action="mine">✹ 布设雷区</button><button data-action="clear">⌁ 排雷</button><button data-action="bridge">▤ 架桥 / 恢复施工</button>':'')+'</div>':''}`;

 $('focusSelected').onclick=()=>focusUnit(u);
 $('showFormation').onclick=()=>{
  $('search').value=g.name;query=g.name.toLowerCase();side=u.side;type='all';
  $('sideFilter').value=u.side;$('typeFilter').value='all';
  renderUnits();renderRoster();
 };
 const waitBtn=$('waitUnitBtn');
 if(waitBtn){
  waitBtn.onclick=()=>{
   clearUndo();
   cancelAction();
   const res=E.waitUnit(S,u.id);
   perform(res);
  };
 }
 if(own&&['medic','supply'].includes(u.role)){
  $('detail').insertAdjacentHTML('beforeend','<label class="auto-support"><input id="autoSupportToggle" type="checkbox" '+(u.autoSupport?'checked':'')+'>未操作时自动'+(u.role==='medic'?'安全救护':'安全补给 / 维修')+'</label>');
  $('autoSupportToggle').onchange=()=>{clearUndo();E.setAuto(S,u.id,$('autoSupportToggle').checked);save();};
 }
 if(own&&u.advance){
  const reason=E.advanceReason(S,u);
  $('detail').insertAdjacentHTML('beforeend','<div class="detail-actions"><button id="advanceUnit" '+(reason?'disabled':'')+'>➜ 战后突进</button><button id="stayUnit">原地停留</button></div><p>'+esc(reason||('可突进至 '+coord(u.advance)+'，消耗'+(E.moveCost(S,u,u.advance)*5)+'燃油，不恢复行动'))+'</p>');
  $('advanceUnit').onclick=()=>prepareAdvance(u);
  $('stayUnit').onclick=()=>{clearUndo();cancelAction();perform(E.declineAdvance(S,u.id));};
 }
 if(u.project){
  const b=S.bridges[u.project];
  if(b)$('detail').insertAdjacentHTML('beforeend','<p class="project-status">架桥 '+b.progress+'/3 · '+(b.paused?'已暂停：选择架桥恢复':'本轮未操作则继续施工')+'</p>');
 }
 $('detail').querySelectorAll('[data-action]').forEach(b=>{
  b.disabled=u.acted||busy||isGameFinished();
  b.onclick=()=>beginAbility(b.dataset.action);
 });
}

function showUnit(id,focus=false){if(mobileLayout){mobileCollapsed=false;closeMobilePanels();}const u=S.units.find(u=>u.id===id);if(!u||!visible(u))return;selected=id;cancelAction();renderDetail();if(focus)focusUnit(u);else renderUnits();renderRoster();renderMoves();}
function cancelAction(){
 closeUnitPicker();
 actionMode=null;pendingTarget=null;
 if($('attackPanel'))$('attackPanel').hidden=true;
 if($('targetOverlay'))$('targetOverlay').innerHTML='';
 $('cancelAction').hidden=true;
 $('actionHint').textContent=perspective==='god'?'上帝视角：双方轮流操作，全部可见。':'指挥'+(perspective==='de'?'德军':'苏军')+'：己方视野外的敌军隐藏，结束回合后敌军自动行动。';
}

function processEngineEvents(events, {isAi=false}={}){
 if(!Array.isArray(events)||!events.length)return;
 const fxGroup=$('fxOverlay')||$('fx');
 const mapWrap=$('mapWrap');
 const mapSvg=$('map');
 const currentPersp=perspective;
 const canHear=settings.sound;
 const animMode=settings.anim;
 const isOff=animMode==='off';
 const isFast=animMode==='fast';
 const maxDuration=isAi?(isFast?120:200):(isFast?180:350);

 for(const ev of events){
  // 1. Filter by event audience BEFORE any sound/banner/FX
  const aud=ev.audience||[];
  const inAudience=currentPersp==='god'||aud.includes(currentPersp);
  if(!inAudience){
   continue;
  }

  // 2. City ownership banner: naming city/new owner, own city-loss notices allowed even if lost vision
  if(ev.type==='city'){
   if(FX)FX.playCue('city',canHear);
   const ownerName=ev.side==='de'?'德军':'苏军';
   const bannerText=`【据点变动】${ownerName} 占领了 ${ev.name}`;
   if(FX)FX.renderBannerNotice(mapWrap,bannerText,'notice-city',isFast?1400:2200);
   continue;
  }

  // Defeated event for own units allowed even if lost vision at the moment
  const isOwnDefeated=ev.type==='defeated'&&(currentPersp==='god'||ev.side===currentPersp);

  // Check destination visibility to current viewer vision too (except city events and own defeated events)
  const atPos=ev.at||ev.to;
  if(atPos&&currentPersp!=='god'&&!isOwnDefeated){
   const k=E.key(atPos.q,atPos.r);
   if(!E.vision(S,currentPersp).has(k)){
    continue; // unseen destination
   }
  }

  // 3. Movement trail / pulse
  if(ev.type==='move'){
   if(FX)FX.playCue('move',canHear);
   if(!isOff&&ev.from&&ev.to){
    const p1=D.position(ev.from.q,ev.from.r);
    const p2=D.position(ev.to.q,ev.to.r);
    const durSec=(maxDuration/1000).toFixed(2);
    const trailSvg=`<g>
     <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#cfb677" stroke-width="6" stroke-dasharray="10 8" opacity="0.8"/>
     <circle cx="${p2.x}" cy="${p2.y}" r="32" fill="none" stroke="#e8d197" stroke-width="4">
      <animate attributeName="r" from="10" to="40" dur="${durSec}s" fill="freeze"/>
      <animate attributeName="opacity" from="1" to="0" dur="${durSec}s" fill="freeze"/>
     </circle>
    </g>`;
    if(FX)FX.addTransientOverlay(fxGroup,trailSvg,maxDuration);
   }
   continue;
  }

  // 4. Hit / Damage
  if(ev.type==='hit'){
   const hasSourceVisibility=!!ev.source&&(currentPersp==='god'||(ev.sourceAudience&&ev.sourceAudience.includes(currentPersp)));
   const displayRole=hasSourceVisibility?ev.role:'impact';
   let cueType='impact';
   if(hasSourceVisibility){
    const role=ev.role;
    cueType=(role==='mg'?'mg':['artillery','mortar','howitzer','armor','at'].includes(role)?'heavy':'heavy');
   }
   if(FX)FX.playCue(cueType,canHear);
   
   if(atPos&&mapSvg){
    const sc=FX?FX.screenCoordsForHex(mapSvg,atPos.q,atPos.r):{x:100,y:100,svgX:0,svgY:0};
    if(ev.amount>0&&FX){
     FX.showFloatingNotice(mapWrap,sc.x,sc.y,`-${ev.amount}`,'notice-dmg',isOff?1200:(isFast?550:800));
    }
    if(!isOff){
     // Tracer ONLY if sourceAudience includes current perspective
     let tracerSvg='';
     if(ev.source&&hasSourceVisibility){
      const sPos=D.position(ev.source.q,ev.source.r);
      const isMg=ev.role==='mg';
      tracerSvg=`<line x1="${sPos.x}" y1="${sPos.y}" x2="${sc.svgX}" y2="${sc.svgY}" stroke="${isMg?'#ffe37a':'#ff6e3d'}" stroke-width="${isMg?3:6}" stroke-dasharray="${isMg?'8 6':'none'}"><animate attributeName="opacity" from="1" to="0" dur="${(maxDuration/1000).toFixed(2)}s"/></line>`;
     }
     const hitAnimSvg=`<g>
      ${tracerSvg}
      <circle cx="${sc.svgX}" cy="${sc.svgY}" r="38" fill="${displayRole==='mg'?'#ffda6b55':'#f46b4055'}" stroke="${displayRole==='mg'?'#f5be38':'#d64124'}" stroke-width="5">
       <animate attributeName="r" from="15" to="52" dur="${(maxDuration/1000).toFixed(2)}s"/>
       <animate attributeName="opacity" from="1" to="0" dur="${(maxDuration/1000).toFixed(2)}s"/>
      </circle>
     </g>`;
     if(FX)FX.addTransientOverlay(fxGroup,hitAnimSvg,maxDuration);
    }
   }
   continue;
  }

  // 5. Heal / Resupply
  if(ev.type==='heal'){
   if(FX)FX.playCue('heal',canHear);
   if(atPos&&mapSvg){
    const sc=FX?FX.screenCoordsForHex(mapSvg,atPos.q,atPos.r):{x:100,y:100,svgX:0,svgY:0};
    if(ev.amount>0&&FX){
     FX.showFloatingNotice(mapWrap,sc.x,sc.y,`+${ev.amount}`,'notice-heal',isOff?1200:(isFast?550:800));
    }
    if(!isOff&&FX){
     const healSvg=`<circle cx="${sc.svgX}" cy="${sc.svgY}" r="35" fill="none" stroke="#68b87a" stroke-width="5"><animate attributeName="r" from="15" to="48" dur="${(maxDuration/1000).toFixed(2)}s"/><animate attributeName="opacity" from="1" to="0" dur="${(maxDuration/1000).toFixed(2)}s"/></circle>`;
     FX.addTransientOverlay(fxGroup,healSvg,maxDuration);
    }
   }
   continue;
  }

  // 6. Defeated / Captured / Routed
  if(ev.type==='defeated'){
   if(FX)FX.playCue('defeated',canHear);
   if(atPos&&mapSvg){
    const sc=FX?FX.screenCoordsForHex(mapSvg,atPos.q,atPos.r):{x:100,y:100};
    const label=ev.status==='captured'?'被俘':ev.status==='routed'?'溃散':'覆灭';
    if(FX)FX.showFloatingNotice(mapWrap,sc.x,sc.y,label,'notice-defeat',isFast?900:1400);
   }
   continue;
  }

  // 7. Bridge completion / progress
  if(ev.type==='bridge'){
   if(FX)FX.playCue('bridge',canHear);
   if(atPos&&mapSvg){
    const sc=FX?FX.screenCoordsForHex(mapSvg,atPos.q,atPos.r):{x:100,y:100};
    const bText=ev.progress===3?'重桥完工':ev.progress===2?'轻桥接通':`架桥 ${ev.progress}/3`;
    if(FX)FX.showFloatingNotice(mapWrap,sc.x,sc.y,bText,'notice-bridge',isFast?900:1300);
   }
   continue;
  }

  // 8. Promotion
  if(ev.type==='promotion'){
   if(FX)FX.playCue('promotion',canHear);
   if(atPos&&mapSvg){
    const sc=FX?FX.screenCoordsForHex(mapSvg,atPos.q,atPos.r):{x:100,y:100};
    if(FX)FX.showFloatingNotice(mapWrap,sc.x,sc.y,`晋升 · ${ev.rank}`,'notice-promo',isFast?900:1400);
   }
   continue;
  }
 }
}

function showTerrain(q,r){
 selected=null;cancelAction();
 const bridge=S.bridges[E.key(q,r)];
 const t=E.terrain(q,r),district=E.urban.get(E.key(q,r)),fort=S.forts[E.key(q,r)],known=perspective==='god'||sight.has(E.key(q,r));
 $('detail').innerHTML=`<p class="eyebrow">${coord({q,r})} / TERRAIN</p><h3>${district?D.town(district.city).name+' · ':''}${E.terrainName(q,r)}</h3><p>${E.urbanNames[t]?'步兵受到伤害 −35%；装甲攻击 −30%、防御 −20%，进入消耗3移动点。':({forest:'消耗2移动；阻挡远处视野与直射，防守减伤15%。',hill:'消耗2移动；视野+1，防守减伤15%。',marsh:'步兵移动消耗3，装甲消耗5。',river:'不可直接通过，请寻找桥渡。',bridge:'连接河流两岸的通行节点。',plain:'开阔地，移动消耗1。',town:'城镇交通节点。'})[t]}</p>${fort&&E.fortVisible(S,fort,perspective)?'<p>'+ (fort.type==='trench'?'堑壕：步兵额外减伤40%，装甲进入额外消耗2移动。':'雷区：敌军经过损失25兵力，装甲损失35；士气−12并停止行军。')+'</p>':''}${bridge&&(perspective==='god'||known||bridge.side===perspective)?'<p>架桥 '+bridge.progress+'/3 · '+(bridge.progress===3?'重装备可通行':bridge.progress===2?'步兵类可通行':'尚不可通行')+(bridge.paused?' · 施工暂停':'')+'</p>':''}${!known?'<p>当前未侦察</p>':''}`;
 renderUnits();renderRoster();renderMoves();
}

function save(){
 E.checkOutcome(S);
 try{
  localStorage.setItem(saveKey(),E.serialize(S));
  localStorage.setItem(MODE_KEY,S.mode);
 }catch{
  $('actionHint').textContent='浏览器无法保存；本次战局仍可继续。';
 }
}

function refresh(){
 E.checkOutcome(S);
 if(selected&&!S.units.some(u=>u.id===selected&&visible(u)))selected=null;
 renderFog();renderUnits();renderRoster();renderDetail();renderMoves();
}

function perform(result){
 const evs=E.drainEvents(S);
 if(evs.length)processEngineEvents(evs,{isAi:false});
 if(result.ok){save();refresh();}
 $('actionHint').textContent=result.message;
}

function filterChanged(){side=$('sideFilter').value;type=$('typeFilter').value;query=$('search').value.trim().toLowerCase();cancelAction();refresh();}
function expanded(){const on=document.body.classList.toggle('expanded');$('fullscreen').textContent=on?'收起':'展开';$('fullscreen').setAttribute('aria-pressed',String(on));}

// Undo Move logic
function clearUndo(reason=''){
 undoSnapshot=null;
 undoDisabledReason=reason;
 updateUndoButton();
}
function updateUndoButton(){
 const btn=$('undoMove');
 if(!btn)return;
 btn.disabled=!undoSnapshot||busy||isGameFinished();
 btn.title=undoSnapshot?'撤销上一步移动':(undoDisabledReason||'无可撤销的安全移动');
}

function performUndo(){
 if(!undoSnapshot||busy||isGameFinished())return;
 if(FX)FX.clearAll();
 if(S)E.drainEvents(S);
 const restored=E.restore(undoSnapshot);
 if(restored){
  S=restored;
  clearUndo();
  cancelAction();
  save();
  refresh();
  $('actionHint').textContent='已撤销上一步移动';
 }else{
  clearUndo('存档恢复失败');
 }
}

function isSafeMove(beforeS, afterS, unitId){
 if(!beforeS)return {safe:false,reason:'无法保存本次移动'};
 if(JSON.stringify(beforeS.bridges)!==JSON.stringify(afterS.bridges)||beforeS.units.some(u=>u.project!==afterS.units.find(v=>v.id===u.id)?.project))return {safe:false,reason:'施工状态发生变化，不可撤销'};
 const movingSide=beforeS.active;
 // Compare explored and vision for movingSide
 const v1=E.vision(beforeS,movingSide),v2=E.vision(afterS,movingSide);
 for(const k of v2)if(!v1.has(k))return {safe:false,reason:'移动发现了新迷雾区域，不可撤销'};
 for(const k of afterS.explored[movingSide])if(!beforeS.explored[movingSide].has(k))return {safe:false,reason:'移动揭示了新地图探索，不可撤销'};

 // Mine changes
 const beforeFortCount=Object.keys(beforeS.forts).length,afterFortCount=Object.keys(afterS.forts).length;
 if(beforeFortCount!==afterFortCount)return {safe:false,reason:'触发或排除了地雷，不可撤销'};

 // Enemy discovered
 const beforeEnemies=beforeS.units.filter(u=>E.alive(u)&&u.side!==movingSide&&E.canSee(beforeS,u,movingSide)).map(u=>u.id).sort().join(',');
 const afterEnemies=afterS.units.filter(u=>E.alive(u)&&u.side!==movingSide&&E.canSee(afterS,u,movingSide)).map(u=>u.id).sort().join(',');
 if(beforeEnemies!==afterEnemies)return {safe:false,reason:'发现了新敌军部队，不可撤销'};

 // City ownership
 for(const [c,side]of Object.entries(beforeS.cities)){
  if(afterS.cities[c]!==side)return {safe:false,reason:'占领了据点或城市，不可撤销'};
 }

 // Other unit changes
 for(const u1 of beforeS.units){
  const u2=afterS.units.find(x=>x.id===u1.id);
  if(!u2)return {safe:false,reason:'编制状态发生变化，不可撤销'};
  if(u1.id===unitId){
   if(u1.status!==u2.status||u1.hp!==u2.hp||u1.morale!==u2.morale){
    return {safe:false,reason:'部队状态受损，不可撤销'};
   }
  }else{
   if(u1.status!==u2.status||u1.hp!==u2.hp||u1.morale!==u2.morale||u1.mp!==u2.mp||u1.acted!==u2.acted||u1.q!==u2.q||u1.r!==u2.r){
    return {safe:false,reason:'其他单位发生变动，不可撤销'};
   }
  }
 }
 return {safe:true};
}

function handleMove(currentUnit, p){
 const snapshotBefore=E.serialize(S);
 const beforeState=E.restore(snapshotBefore);
 const result=E.move(S,currentUnit.id,p.q,p.r);
 const evs=E.drainEvents(S);
 if(evs.length)processEngineEvents(evs,{isAi:false});
 if(result.ok){
  const safety=isSafeMove(beforeState, S, currentUnit.id);
  if(safety.safe){
   undoSnapshot=snapshotBefore;
   undoDisabledReason='';
  }else{
   clearUndo(safety.reason);
  }
  save();
  refresh();
 }
 $('actionHint').textContent=result.message;
}

function activate(el){
 if(busy)return;
 const target=el.dataset.unit?S.units.find(u=>u.id===el.dataset.unit):null;
 const city=el.dataset.city?D.town(el.dataset.city):null;
 const p=target||city||(el.dataset.q!==undefined?{q:+el.dataset.q,r:+el.dataset.r}:null);
 if(!p)return;
 if(!inMissionArea(p))return;
 if(isGameFinished()){if(target)showUnit(target.id);else showTerrain(p.q,p.r);return;}
 const current=S.units.find(u=>u.id===selected);

 if(actionMode==='move'){
  if(controllable(current))prepareMove(current,p);
  return;
 }

 if(actionMode==='airRecon'||actionMode==='airStrike'){
  clearUndo();
  prepareAir(p);
  return;
 }
 if(actionMode&&controllable(current)){
  if(mobileLayout){prepareAbility(current,actionMode,p);return;}
  clearUndo();
  const action=actionMode;
  const result=E.ability(S,current.id,action,p.q,p.r);
  if(result.ok)cancelAction();
  perform(result);
  return;
 }
 if(!actionMode&&controllable(current)&&current.advance&&p.q===current.advance.q&&p.r===current.advance.r){
  clearUndo();
  prepareAdvance(current);
  return;
 }
 if(target){
  if(controllable(current)&&!current.acted&&current.side!==target.side){
   prepareAttack(current,target);
   return;
  }
  showUnit(target.id);
  return;
 }
 if(controllable(current)&&E.reachable(S,current,true).get(E.key(p.q,p.r))?.path.length){
  if(mobileLayout){prepareMove(current,p);return;}
  cancelAction();
  handleMove(current, p);
  return;
 }
 showTerrain(p.q,p.r);
}

function countUnactedFriendly(){
 if(!S||!S.units)return 0;
 return S.units.filter(u=>E.alive(u)&&inMissionArea(u)&&u.side===S.active&&!u.acted).length;
}
function countPendingAdvances(){
 if(!S||!S.units)return 0;
 return S.units.filter(u=>E.alive(u)&&inMissionArea(u)&&u.side===S.active&&u.advance&&!E.advanceReason(S,u)).length;
}

function requestEndTurn(){
 if(busy||isGameFinished())return;
 closeMobilePanels();
 const isOpponentTurn=perspective!=='god'&&perspective!==S.active;
 if(isOpponentTurn){
  executeNextTurn();
  return;
 }
 const unactedCount=countUnactedFriendly();
 const advanceCount=countPendingAdvances();
 if(unactedCount>0||advanceCount>0){
  const parts=[];
  if(unactedCount>0)parts.push(`尚有 <strong>${unactedCount}</strong> 支己方部队未行动`);
  if(advanceCount>0)parts.push(`<strong>${advanceCount}</strong> 支装甲部队待突进`);
  $('endTurnSummary').innerHTML=parts.join('，')+'。确定要结束本回合吗？';
  $('endTurnDialog').showModal();
 }else{
  executeNextTurn();
 }
}

// Yield past a paint before accepting another snapshot (also works in hidden tabs).
function yieldToBrowser(){return new Promise(resolve=>setTimeout(resolve,16));}
function createTurnExecutor(){
 let worker=null;
 try{if(typeof Worker!=='undefined')worker=new Worker('turn-worker.js?v=0.5.2');}catch{}
 const stop=()=>{if(worker)worker.terminate();worker=null;};
 const local=async task=>{
  await yieldToBrowser();
  return window.BARB_TURN.runTask(S,task.kind==='units'?{...task,ids:task.ids.slice(0,1)}:task);
 };
 return {
  close:stop,
  async run(task){
   if(!worker)return local(task);
   return new Promise((resolve,reject)=>{
    let settled=false;
    const fallback=()=>{
     if(settled)return;settled=true;clearTimeout(timer);stop();
     // Worker results are atomic: an unacknowledged task can safely be retried.
     local(task).then(resolve,reject);
    };
    const timer=setTimeout(fallback,15000);
    worker.onerror=e=>{e.preventDefault();fallback();};
    worker.onmessageerror=fallback;
    worker.onmessage=({data})=>{
     if(settled)return;
     if(data.error){fallback();return;}
     settled=true;clearTimeout(timer);resolve(data);
    };
    try{worker.postMessage({state:window.BARB_TURN.snapshot(S),task});}catch{fallback();}
   });
  }
 };
}
async function executeNextTurn(){
 if(busy||isGameFinished())return;
 busy=true;clearUndo();cancelAction();selected=null;
 renderUnits();renderMoves();renderDetail();
 $('actionHint').textContent='正在结算回合…';
 const executor=createTurnExecutor();
 let turnError=false;
 const run=async task=>{
  const packet=await executor.run(task);
  S=packet.state;
  return packet;
 };
 try{
  await yieldToBrowser();
  if(perspective==='god'||S.active===perspective){
   const packet=await run({kind:'endTurn'});
   if(S.lastTurnReport){
    humanTurnReport=S.lastTurnReport;
    S.turnReports=S.turnReports||{};S.turnReports[humanTurnReport.side]=humanTurnReport;
   }
   renderFog();renderUnits();
   processEngineEvents(packet.events,{isAi:false});
   if(S.result){save();return;}
  }
  if(perspective!=='god'&&S.active!==perspective){
   $('actionHint').textContent='敌军行动中…';
   for(let i=0;i<4&&!S.result;i++){
    const packet=await run({kind:'air'}),air=packet.result;
    if(!air?.ok)break;
    renderFog();renderUnits();
    processEngineEvents(packet.events,{isAi:true});
    if(E.vision(S,perspective).has(E.key(air.q,air.r)))await animateFlight(air.kind,air);
    await yieldToBrowser();
   }
   const ids=S.units.filter(u=>E.alive(u)&&inMissionArea(u)&&u.side===S.active).map(u=>u.id);
   for(let i=0;i<ids.length&&!S.result;){
    const packet=await run({kind:'units',ids:ids.slice(i,i+8)});
    i+=packet.consumed;
    renderFog();renderUnits();
    processEngineEvents(packet.events,{isAi:true});
    $('actionHint').textContent='敌军行动中… '+i+' / '+ids.length;
    await yieldToBrowser();
    if(!packet.consumed)break;
   }
   if(!S.result){
    const packet=await run({kind:'endTurn'});
    renderFog();renderUnits();
    processEngineEvents(packet.events,{isAi:true});
    if(S.lastTurnReport){S.turnReports=S.turnReports||{};S.turnReports[S.lastTurnReport.side]=S.lastTurnReport;}
   }
  }
  save();
 }catch(error){
  save();
  turnError=true;
  console.error('Turn calculation failed',error);
 }finally{
  executor.close();busy=false;cancelAction();refresh();
  if(turnError)$('actionHint').textContent='回合计算中断，已保留当前进度，可继续推进回合。';
 }
}

function airSide(){return perspective==='god'?S.active:perspective;}
function renderAirButtons(){
 for(const kind of ['recon','strike']){
  const b=$('air'+kind);
  if(!b)continue;
  const side=airSide();
  b.innerHTML=sprite(kind==='recon'?'airRecon':'airStrike',0,0,52,34)+'<span>'+(kind==='recon'?'空中侦察':'战斗支援')+' <b>'+S.air[side][kind]+'/'+E.AIR_LIMITS[kind]+'</b></span>';
  b.disabled=busy||isGameFinished()||S.active!==side||S.air[side][kind]<=0;
 }
}

function renderTarget(){
 let html='';
 if(pendingTarget){
  const p=pendingTarget.kind==='ground'?S.units.find(u=>u.id===pendingTarget.target):pendingTarget;
  const xy=D.position(p.q,p.r);
  html='<g class="target-pulse"><polygon points="'+poly(xy.x,xy.y,40)+'" fill="#d6423226" stroke="#e15b3c" stroke-width="6"/><path d="M'+(xy.x-51)+' '+xy.y+'h25m52 0h25M'+xy.x+' '+(xy.y-51)+'v25m0 52v25" stroke="#fff1bc" stroke-width="5"/></g>';
  if(pendingTarget.kind==='ground'){
   const a=S.units.find(u=>u.id===pendingTarget.attacker),start=D.position(a.q,a.r);
   html+='<path d="M'+start.x+' '+start.y+'L'+xy.x+' '+xy.y+'" stroke="#e7603f" stroke-width="5" stroke-dasharray="12 9"/>';
  }else if(pendingTarget.kind==='recon')for(const cell of E.ring(p,4)){
   const c=D.position(cell.q,cell.r);
   html+='<polygon points="'+poly(c.x,c.y,32)+'" fill="#e1cc7922" stroke="#d7b868" stroke-width="1"/>';
  }
 }
 if(pendingTarget?.kind==='advance')html=html.replaceAll('#e15b3c','#329c87').replaceAll('#d6423226','#55bfaa33');
 if(pendingTarget?.kind==='move'){
  const a=S.units.find(u=>u.id===pendingTarget.attacker),route=[a,...pendingTarget.path].map(p=>D.position(p.q,p.r));
  const end=route[route.length-1];
  html='<polyline points="'+route.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="#fff8de" stroke-width="8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><polyline points="'+route.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="#286b56" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>';
  for(const p of route.slice(1))html+='<circle cx="'+p.x+'" cy="'+p.y+'" r="6" fill="#fff8de" stroke="#286b56" stroke-width="2"/>';
  html+='<polygon points="'+poly(end.x,end.y,33)+'" fill="#55bfaa55" stroke="#286b56" stroke-width="4" vector-effect="non-scaling-stroke"/><text x="'+end.x+'" y="'+(end.y+5)+'" text-anchor="middle" fill="#173d30" stroke="#fff8de" stroke-width="3" paint-order="stroke" font-size="18" font-weight="bold">'+coord(pendingTarget)+'</text>';
 }
 if(pendingTarget?.kind==='ability')html=html.replaceAll('#e15b3c','#2a6f97').replaceAll('#d6423226','#73bfd433');
 $('targetOverlay').innerHTML=html;
 renderMobileControls();
}

function panel(title,body){
 $('attackPanel').dataset.kind=pendingTarget?.kind||'';
 $('attackPanel').setAttribute('aria-label','行动确认');
 $('confirmAttack').textContent=pendingTarget?.kind==='move'?'确认移动':pendingTarget?.kind==='advance'?'确认突进':pendingTarget?.kind==='ground'?'确认攻击':'确认执行';
 $('cancelAttack').textContent=pendingTarget?.kind==='advance'?'原地停留':'取消';
 $('attackPanel').hidden=false;
 $('attackTitle').textContent=title;
 $('attackSummary').textContent=body;
 renderTarget();
}
function beginMove(u){
 if(!controllable(u)||u.acted||u.mp<=0)return;
 cancelAction();actionMode='move';closeMobilePanels();
 $('actionHint').textContent='移动：点绿色格预览路线，再点「确认移动」；可拖动地图调整位置。';
 renderMoves();
}
function prepareMove(u,p){
 const route=E.reachable(S,u,true).get(E.key(p.q,p.r));
 closeUnitPicker();pendingTarget=null;$('attackPanel').hidden=true;actionMode='move';
 if(!route?.path.length){
  $('actionHint').textContent=p.q===u.q&&p.r===u.r?'这是部队当前位置，请点绿色格选择目的地。':'此格无法到达，请选择绿色范围内的空地。';
  renderMoves();return;
 }
 pendingTarget={kind:'move',attacker:u.id,q:p.q,r:p.r,path:route.path,cost:route.cost,origin:{q:u.q,r:u.r},round:S.round,active:S.active,mp:u.mp,fuel:u.fuel};
 const knownMine=route.path.some(c=>{const f=S.forts[E.key(c.q,c.r)];return f?.type==='mine'&&f.side!==u.side&&E.fortVisible(S,f,perspective);});
 const knownZoc=S.units.some(v=>E.alive(v)&&v.side!==u.side&&!['medic','supply'].includes(v.role)&&E.canSee(S,v,u.side)&&E.distance(v,p)<=1);
 const unseen=perspective!=='god'&&route.path.some(c=>!sight.has(E.key(c.q,c.r)));
 const warning=(knownMine?' · 已知雷区：触雷即停':knownZoc?' · 进入敌军控制区：停止移动':'')+(unseen?' · 含未侦察路段':'');
 $('actionHint').textContent='路线已预览；可点其他格调整，确认后才会移动。';
 panel(u.name+' → '+coord(p)+' · '+E.terrainName(p.q,p.r),'计划 '+route.path.length+'格 · 移动点 '+u.mp+' → '+(knownMine||knownZoc?0:u.mp-route.cost)+(u.role==='armor'?(knownMine?' · 燃油最多消耗 '+route.cost*5:' · 燃油 '+u.fuel+' → '+(u.fuel-route.cost*5)):'')+warning);
 renderMoves();
}
function prepareAbility(u,action,p){
 const reason=E.abilityReason(S,u,action,p);
 if(reason){pendingTarget=null;$('attackPanel').hidden=true;$('actionHint').textContent=reason;renderTarget();return;}
 const labels={heal:'救护',resupply:'补给 / 维修',trench:'挖壕',mine:'布雷',clear:'排雷',bridge:'架桥'};
 const target=S.units.find(v=>visible(v)&&v.q===p.q&&v.r===p.r);
 pendingTarget={kind:'ability',attacker:u.id,action,q:p.q,r:p.r,round:S.round,active:S.active};
 $('actionHint').textContent='目标已选定；确认后执行，可点其他格更换目标。';
 panel(labels[action]+' · '+coord(p),(['heal','resupply'].includes(action)&&target?target.name+' · 兵力 '+target.hp+'/'+target.maxHp:'施工位置：'+E.terrainName(p.q,p.r))+' · 消耗本队本回合行动');
}
function prepareAdvance(u){
 const reason=E.advanceReason(S,u);
 if(reason){$('actionHint').textContent=reason;return;}
 clearUndo();
 cancelAction();
 pendingTarget={kind:'advance',attacker:u.id,...u.advance};
 const mine=S.forts[E.key(u.advance.q,u.advance.r)],warning=mine?.type==='mine'&&mine.side!==u.side&&E.fortVisible(S,mine,perspective)?' · 已知敌方雷区！':'';
 panel(u.name+' · 战后突进至 '+coord(u.advance),'消耗'+(E.moveCost(S,u,u.advance)*5)+'燃油 · 不恢复移动或攻击次数'+warning);
}
function prepareAttack(a,b){
 const reason=E.attackReason(S,a,b);
 if(reason){cancelAction();$('actionHint').textContent=reason;return;}
 clearUndo();
 actionMode=null;
 pendingTarget={kind:'ground',attacker:a.id,target:b.id};
 const hit=E.damage(S,a,b);
 panel(a.name+' → '+b.name,'预计兵力 −'+Math.min(hit,b.hp)+' · 目标 '+b.hp+' → '+Math.max(0,b.hp-hit)+' · 消耗1弹药');
}
function prepareAir(p){
 const kind=actionMode==='airRecon'?'recon':'strike',side=airSide(),reason=E.airReason(S,side,kind,p.q,p.r);
 if(reason){$('actionHint').textContent=reason;return;}
 clearUndo();
 pendingTarget={kind,side,q:p.q,r:p.r};
 const target=E.occupied(S,p);
 panel((kind==='recon'?'空中侦察':'战斗支援')+' · '+coord(p),kind==='recon'?'揭示半径4格，持续至己方下回合；消耗1次侦察':(target?'目标：'+target.name+' · 预计损失'+Math.min(target.hp,target.role==='armor'?30:42):'对该格实施空袭')+'；消耗1次战斗支援');
}
function animateFlight(kind,p){
 if(settings.anim==='off')return Promise.resolve();
 const isFast=settings.anim==='fast';
 const dur=isFast?500:1000;
 return new Promise(resolve=>{
  const overlay=$('airOverlay')||$('fx');
  const xy=D.position(p.q,p.r),planeSize=Math.min(600,Math.max(220,view.w*.14));
  overlay.innerHTML='<g><circle cx="'+xy.x+'" cy="'+xy.y+'" r="'+(kind==='recon'?80:36)+'" fill="none" stroke="'+(kind==='recon'?'#eed17a':'#ef8448')+'" stroke-width="8"><animate attributeName="r" from="15" to="'+(kind==='recon'?180:85)+'" dur="'+(dur/1000)+'s"/><animate attributeName="opacity" from="1" to="0" dur="'+(dur/1000)+'s"/></circle><g class="aircraft-pass"><animateTransform attributeName="transform" type="translate" from="'+(xy.x-440)+' '+(xy.y-330)+'" to="'+(xy.x+440)+' '+(xy.y+330)+'" dur="'+(dur/1000)+'s" fill="freeze"/>'+sprite(kind==='recon'?'airRecon':'airStrike',-planeSize/2,-planeSize*.4,planeSize,planeSize*.8)+'</g></g>';
  setTimeout(()=>{overlay.innerHTML='';resolve();},dur+50);
 });
}
async function confirmAttack(){
 if(busy||!pendingTarget)return;
 const target={...pendingTarget};
 if(target.kind==='move'){
  const u=S.units.find(u=>u.id===target.attacker);
  const route=controllable(u)?E.reachable(S,u,true).get(E.key(target.q,target.r)):null;
  if(!route?.path.length||S.round!==target.round||S.active!==target.active||u.q!==target.origin.q||u.r!==target.origin.r){cancelAction();renderMoves();$('actionHint').textContent='部队状态已变化，请重新选择目的地。';return;}
  if(route.cost!==target.cost||u.mp!==target.mp||u.fuel!==target.fuel||JSON.stringify(route.path)!==JSON.stringify(target.path)){prepareMove(u,target);return;}
  cancelAction();handleMove(u,target);return;
 }
 clearUndo();
 cancelAction();
 if(target.kind==='ability'){
  const u=S.units.find(u=>u.id===target.attacker);
  if(!controllable(u)||S.round!==target.round||S.active!==target.active){renderMoves();return;}
  perform(E.ability(S,u.id,target.action,target.q,target.r));return;
 }
 if(target.kind==='advance'){
  perform(E.advance(S,target.attacker));
  return;
 }
 if(target.kind==='ground'){
  const result=E.attack(S,target.attacker,target.target);
  perform(result);
  if(result.ok){
   const attacker=S.units.find(u=>u.id===target.attacker);
   if(attacker.advance&&!E.advanceReason(S,attacker))prepareAdvance(attacker);
  }
  return;
 }
 const result=E.airMission(S,target.side,target.kind,target.q,target.r);
 if(!result.ok){perform(result);return;}
 const airEvents=E.drainEvents(S);
 busy=true;save();refresh();$('actionHint').textContent='航空支援执行中…';
 try{await animateFlight(target.kind,target);processEngineEvents(airEvents);}finally{busy=false;refresh();$('actionHint').textContent=result.message;}
}

// Mode switching
function switchMode(newMode){
 if(busy||!['campaign','tutorial'].includes(newMode)||newMode===S.mode)return;
 if(FX)FX.clearAll();
 if(S)E.drainEvents(S);
 save(); // save current mode progress first
 currentMode=newMode;
 try{localStorage.setItem(MODE_KEY,newMode);}catch{}
 S=loadSave(newMode);
 if(S)E.drainEvents(S);
 humanTurnReport=S.lastTurnReport||null;
 clearUndo();
 cancelAction();
 selected=null;
 side='all';type='all';query='';$('sideFilter').value='all';$('typeFilter').value='all';$('search').value='';
 outcomeDialogShownFor=null;
 if(S.mode==='tutorial'&&S.missionView){
  view={...S.missionView};
  $('viewName').textContent='布列斯特教学区';
 }else{
  view={...D.regions[0].view};
  $('viewName').textContent='全战区';
 }
 updateRegionsForMode();
 applyView();
 save();
 refresh();
}

// Objectives & Tutorial Hints
function renderObjectives(){
 const container=$('objectivePanel');
 if(!container)return;
 const statusSide=perspective==='god'?S.active:perspective;
 const obj=E.objectiveStatus(S,statusSide);
 if(!obj){container.innerHTML='';return;}

 const modeTag=S.mode==='tutorial'?'<span class="objective-tag tutorial">入门教学</span>':'<span class="objective-tag campaign">完整战役</span>';
 let itemsHtml='<ul class="objective-list">';
 for(const item of obj.items){
  itemsHtml+=`<li><span>${esc(item.label)}</span><span class="${item.done?'done':'pending'}">${esc(item.current)} / ${esc(item.target)}</span></li>`;
 }
 itemsHtml+='</ul>';

 let hintsHtml='';
 if(S.mode==='tutorial'){
  const hints=E.tutorialHints(S);
  hintsHtml='<div class="tutorial-checklist"><h4>教学指导进度</h4><ul>';
  for(const h of hints){
   hintsHtml+=`<li class="${h.done?'done':''}">[${h.done?'✓':' '}] ${esc(h.text)}</li>`;
  }
  hintsHtml+='</ul></div>';
 }

 let outcomeBanner='';
 if(S.result){
  const won=(perspective==='god'||S.result.winner===perspective);
  outcomeBanner=`<div class="outcome-banner ${won?'win':'loss'}">战役已结算：${esc(S.result.reason)}</div>`;
 }

 container.innerHTML=`${modeTag}<h3>${esc(obj.title)} <small>期限：${obj.roundLimit}回合</small></h3>${itemsHtml}${hintsHtml}${outcomeBanner}`;
}

// Battle Stats Panel (in-progress)
function renderBattleStatsPanel(){
 const container=$('battleStatsPanel');
 if(!container)return;
 const stats=S.battleStats||{de:{damage:0,healed:0,resupplied:0,captures:0,kills:0},su:{damage:0,healed:0,resupplied:0,captures:0,kills:0}};
 const showBoth=perspective==='god';
 const sides=showBoth?['de','su']:[perspective];
 
 let html='<h3>战况战功统计</h3><div class="battle-stats-grid">';
 for(const sd of sides){
  const sideName=sd==='de'?'德军':'苏军';
  const st=stats[sd]||{damage:0,healed:0,resupplied:0,captures:0,kills:0};
  const prefix=showBoth?`[${sideName}] `:'' ;
  html+=`
   <div class="battle-stat-item"><span>${prefix}造成兵力伤害</span><strong>${st.damage||0}</strong></div>
   <div class="battle-stat-item"><span>${prefix}救治与抢修 HP</span><strong>${st.healed||0}</strong></div>
   <div class="battle-stat-item"><span>${prefix}成功补给</span><strong>${st.resupplied||0} 次</strong></div>
   <div class="battle-stat-item"><span>${prefix}夺取城市据点</span><strong>${st.captures||0} 次</strong></div>
   <div class="battle-stat-item" style="grid-column: span 2;"><span>${prefix}完全击毁敌方编制</span><strong>${st.kills||0} 队</strong></div>
  `;
 }
 html+='</div>';
 container.innerHTML=html;
}

// Turn Report
function renderTurnReport(){
 const container=$('turnReportPanel');
 if(!container)return;
 const reportSide=perspective==='god'?S.active:perspective;
 const rep=S.turnReports?.[reportSide]||(humanTurnReport?.side===reportSide?humanTurnReport:null)||(S.lastTurnReport?.side===reportSide?S.lastTurnReport:null);
 if(!rep){
  container.innerHTML='<h3>上回合战况</h3><p>战役刚刚展开，尚无上回合统计报告。</p>';
  return;
 }
 const isoCount=rep.isolated?rep.isolated.length:0;
 const losses=rep.losses||[];
 let lossesHtml='';
 if(losses.length){
  lossesHtml='<ul>'+losses.map(l=>`<li>${esc(l.name)}：${l.status==='captured'?'被俘':'溃散'}（${esc(l.reason)}）</li>`).join('')+'</ul>';
 }else{
  lossesHtml='<p>无非战斗减员。</p>';
 }
 container.innerHTML=`<h3>上回合战况（第 ${rep.round} 回合 · ${rep.side==='de'?'德军':'苏军'}）</h3><p>补给断绝：<strong>${isoCount}</strong> 队部队断供</p>${lossesHtml}`;
}

// Result Modal
function checkAndShowOutcomeDialog(){
 const btn=$('viewResultBtn');
 if(!S.result){
  if(btn)btn.hidden=true;
  return;
 }
 if(btn)btn.hidden=false;
 const outcomeKey=S.result.winner+'_'+S.result.round+'_'+S.mode;
 if(outcomeDialogShownFor!==outcomeKey){
  outcomeDialogShownFor=outcomeKey;
  showOutcomeModal();
 }
}

function showOutcomeModal(){
 if(!S.result)return;
 const res=S.result;
 const won=(perspective==='god'||res.winner===perspective);
 $('outcomeTitle').textContent=(perspective==='god'?'战役结束':won?'战役胜利':'战役失利')+' · '+(res.winner==='de'?'德军获胜':'苏军获胜');
 $('outcomeReason').textContent='结算原因：'+res.reason+'（第 '+res.round+' 回合）';

 if(P){
  P.recordGameResult(S);
  const medals=P.calculateMedals(S);
  if($('outcomeMedals')){
   $('outcomeMedals').innerHTML=medals.length?`<p>胜方战功 · ${res.winner==='de'?'德军':'苏军'}</p>`+medals.map(m=>`<span class="medal-badge">🎖️ ${esc(m)}</span>`).join(''):'';
  }
 }

 const deS=res.stats?.de||{active:0,destroyed:0,captured:0,routed:0,lostHp:0};
 const suS=res.stats?.su||{active:0,destroyed:0,captured:0,routed:0,lostHp:0};
 const deBS=res.battleStats?.de||S.battleStats?.de||{damage:0,healed:0,resupplied:0,captures:0,kills:0};
 const suBS=res.battleStats?.su||S.battleStats?.su||{damage:0,healed:0,resupplied:0,captures:0,kills:0};

 function findTopVeteran(side){
  const units=S.units.filter(u=>u.side===side&&E.alive(u));
  if(!units.length)return '无存活部队';
  units.sort((a,b)=>(b.xp||0)-(a.xp||0)||((b.kills||0)-(a.kills||0)));
  const top=units[0];
  if(!top.xp)return '尚无经验记录';
  const vet=E.veteran(top);
  return `${top.name}（${vet.name} · ${top.xp} XP · ${top.kills||0} 击毁）`;
 }

 $('outcomeStats').innerHTML=`<div class="outcome-stats-grid">
  <div class="outcome-stats-col">
   <h4>德军战损与战功统计</h4>
   <p>在场残余：${deS.active} 队</p>
   <p>阵亡摧毁：${deS.destroyed} 队</p>
   <p>被俘部队：${deS.captured} 队</p>
   <p>溃散减员：${deS.routed} 队</p>
   <p>兵力缺额：${deS.lostHp} HP</p>
   <hr style="border:0;border-top:1px dashed #cfcbba;margin:6px 0;">
   <p>造成伤害：${deBS.damage||0} HP</p>
   <p>治疗抢修：${deBS.healed||0} HP</p>
   <p>成功补给：${deBS.resupplied||0} 次</p>
   <p>夺取据点：${deBS.captures||0} 次</p>
   <p>击毁编制：${deBS.kills||0} 队</p>
   <p><strong>头号功勋部队：</strong><br>${esc(findTopVeteran('de'))}</p>
  </div>
  <div class="outcome-stats-col">
   <h4>苏军战损与战功统计</h4>
   <p>在场残余：${suS.active} 队</p>
   <p>阵亡摧毁：${suS.destroyed} 队</p>
   <p>被俘部队：${suS.captured} 队</p>
   <p>溃散减员：${suS.routed} 队</p>
   <p>兵力缺额：${suS.lostHp} HP</p>
   <hr style="border:0;border-top:1px dashed #cfcbba;margin:6px 0;">
   <p>造成伤害：${suBS.damage||0} HP</p>
   <p>治疗抢修：${suBS.healed||0} HP</p>
   <p>成功补给：${suBS.resupplied||0} 次</p>
   <p>夺取据点：${suBS.captures||0} 次</p>
   <p>击毁编制：${suBS.kills||0} 队</p>
   <p><strong>头号功勋部队：</strong><br>${esc(findTopVeteran('su'))}</p>
  </div>
 </div>`;
 $('outcomeDialog').showModal();
}

function restartCurrentMode(){
 if(FX)FX.clearAll();
 S=E.newGame(S.mode);
 if(S)E.drainEvents(S);
 humanTurnReport=null;
 clearUndo();
 cancelAction();
 selected=null;
 outcomeDialogShownFor=null;
 if(S.mode==='tutorial'&&S.missionView){
  view={...S.missionView};
  $('viewName').textContent='布列斯特教学区';
 }else{
  view={...D.regions[0].view};
  $('viewName').textContent='全战区';
 }
 updateRegionsForMode();
 applyView();
 save();
 refresh();
}


function closeMobilePanels(){
 closeUnitPicker();
 for(const id of ['mobileMenuDialog','mobileInfoDialog'])if($(id)?.open)$(id).close();
}
function closeUnitPicker(){
 unitPickerContext=null;
 document.body.classList.remove('picking-units');
 if($('unitPicker'))$('unitPicker').hidden=true;
 if($('pickOverlay'))$('pickOverlay').remove();
}
function showUnitPicker(units,point){
 pendingTarget=null;$('attackPanel').hidden=true;renderTarget();
 unitPickerContext={ids:units.map(u=>u.id),point,selected,actionMode};
 const support=['heal','resupply'].includes(actionMode);
 $('unitPickerTitle').textContent=support?'选择支援目标':'选择附近部队';
 $('unitPickerList').innerHTML=units.map((u,i)=>'<button type="button" class="unit-pick" data-pick-unit="'+u.id+'"><span class="unit-pick-symbol '+u.side+'">'+(i+1)+'</span><span class="unit-pick-copy"><strong>'+esc(u.name)+'</strong><small>'+esc((u.side==='de'?'德军':'苏军')+' · '+E.profiles[u.role].name+' · '+coord(u)+' · 兵力 '+u.hp+'/'+u.maxHp+' · '+(u.acted?'已行动':'未行动'))+'</small></span></button>').join('');
 $('unitPicker').hidden=false;$('unitPickerList').scrollTop=0;
 document.body.classList.add('picking-units');
 if($('pickOverlay'))$('pickOverlay').remove();
 const scale=$('map').getScreenCTM().a;
 $('map').insertAdjacentHTML('beforeend','<g id="pickOverlay" pointer-events="none">'+units.map((u,i)=>{const p=D.position(u.q,u.r);return '<g transform="translate('+p.x+' '+p.y+') scale('+(1/scale)+')"><circle r="11" fill="'+color(u.side)+'" stroke="#fff8de" stroke-width="2"/><text y="4" text-anchor="middle" fill="white" font-size="12" font-weight="bold">'+(i+1)+'</text></g>';}).join('')+'</g>');
}
function mobileMapTap(target,e){
 if(busy)return;
 const world=pointIn($('map'),e),cell=window.BARB_MAP_INPUT.nearestCell(world,D.board,D.position);
 // Destination and engineering commands use the grid, never a nearby sprite.
 if(actionMode&&!['heal','resupply'].includes(actionMode)){
  if(cell&&inMissionArea(cell))activate({dataset:{q:cell.q,r:cell.r}});return;
 }
 const current=S.units.find(u=>u.id===selected),support=['heal','resupply'].includes(actionMode),matrix=$('map').getScreenCTM();
 const candidates=S.units.filter(u=>visible(u)&&(!support||!E.abilityReason(S,current,actionMode,u)));
 const points=candidates.map(u=>{const p=D.position(u.q,u.r);return {id:u.id,x:p.x*matrix.a+matrix.e,y:(p.y+8)*matrix.d+matrix.f,top:(p.y-40)*matrix.d+matrix.f,bottom:(p.y+13)*matrix.d+matrix.f};});
 const near=window.BARB_MAP_INPUT.nearbyUnits(points,{x:e.clientX,y:e.clientY});
 const directId=target.closest('[data-unit]')?.dataset.unit,direct=points.find(p=>p.id===directId);
 if(direct&&!near.some(p=>p.id===direct.id)&&Math.hypot(direct.x-e.clientX,direct.y-e.clientY)<=52)near.push(direct);
 const units=near.map(p=>candidates.find(u=>u.id===p.id));
 if(units.length>1){showUnitPicker(units,world);return;}
 closeUnitPicker();
 if(units.length===1){activate({dataset:{unit:units[0].id}});return;}
 if(cell&&inMissionArea(cell))activate({dataset:{q:cell.q,r:cell.r}});
}
function openMobilePanel(id){
 closeMobilePanels();$(id).showModal();
 if(id==='mobileInfoDialog'&&selected)$('detail').scrollIntoView({block:'start'});
}
function beginAbility(action){
 const u=S.units.find(u=>u.id===selected);
 if(!controllable(u)||u.acted)return;
 clearUndo();cancelAction();actionMode=action;closeMobilePanels();
 const targets=E.ring(u,1).filter(p=>!E.abilityReason(S,u,action,p));
 $('actionHint').textContent=targets.length?({heal:'点选绿色范围内的友军步兵进行救护',resupply:'点选绿色范围内的友军补给；坦克同时维修',trench:'点选金色格修筑堑壕',mine:'点选金色空格铺设雷区',clear:'点选相邻已发现雷区排雷',bridge:'点选相邻河格：2轮通步兵，3轮通坦克'})[action]:({heal:'附近没有可救护的友军，请先移动靠近需要救护的部队。',resupply:'附近没有需要补给或维修的友军，请先移动靠近。'})[action]||'当前没有可执行此工程的地块，请检查物资和相邻地形。';
 renderMoves();
}
function updateMobileHint(){
 const hint=$('actionHint').textContent,defaultHint=hint.startsWith('指挥')||hint.startsWith('上帝视角');
 $('mobileHint').textContent=busy||actionMode||pendingTarget||!defaultHint?hint:selected?'点绿色格预览移动 · 密集区域可用「移动」精确选格':'单指拖动 · 双指缩放 · 部队密集时从卡片选择';
}
function renderMobileControls(){
 const bar=$('mobileUnitBar');if(!bar)return;
 updateMobileHint();
 $('mobilePhase').textContent=$('phase').textContent;
 $('mobileEndTurn').textContent=S.active===perspective||perspective==='god'?'结束回合':'推进敌军';
 $('mobileEndTurn').disabled=busy||isGameFinished();
 $('mobileNextReady').disabled=$('nextReady').disabled;
 $('mobileNextReady').title=$('nextReady').textContent;
 const u=S.units.find(u=>u.id===selected);
 bar.hidden=!mobileLayout||!u||!visible(u)||busy||!!pendingTarget;
 if(bar.hidden)return;
 if(mobileUnitId!==u.id){mobileUnitId=u.id;mobileCollapsed=false;}
 bar.classList.toggle('collapsed',mobileCollapsed);
 const button=(cmd,label,disabled=false,extra='')=>'<button type="button" data-mobile-command="'+cmd+'" '+(disabled?'disabled':'')+' '+extra+'>'+label+'</button>';
 if(mobileCollapsed){bar.innerHTML=button('expand','部队指令 · '+esc(E.profiles[u.role].name),false,'class="mobile-unit-reopen"');return;}
 let buttons='',auto='';
 const own=controllable(u);
 if(actionMode){
  bar.innerHTML='<p class="mobile-unit-message">'+esc($('actionHint').textContent)+'</p><div class="mobile-unit-actions">'+button('cancel','取消指令')+'</div>';return;
 }
 if(own){
  buttons+=button('move','移动',u.acted||u.mp<=0||(u.role==='armor'&&u.fuel<5));
  if(u.role==='medic')buttons+=button('heal','救护',u.acted||u.stock<1);
  if(u.role==='supply')buttons+=button('resupply','补给 / 维修',u.acted||u.stock<1);
  if(u.role==='engineer')for(const [a,label]of [['trench','挖壕'],['mine','布雷'],['clear','排雷'],['bridge','架桥']])buttons+=button(a,label,u.acted);
  if(u.advance)buttons+=button('advance','突进',!!E.advanceReason(S,u));
  if(!u.acted)buttons+=button('wait','待命');
  if(['medic','supply'].includes(u.role))auto=button('auto',u.autoSupport?'自动支援：开':'自动支援：关',false,'class="mobile-auto" aria-pressed="'+u.autoSupport+'"');
 }
 buttons+=button('details','详情');
 if(undoSnapshot)buttons+=button('undo','撤销',busy);
 bar.innerHTML='<div class="mobile-unit-heading"><strong>'+esc(u.name)+'</strong>'+button('collapse','收起')+'</div><p class="mobile-unit-stats">'+esc(E.profiles[u.role].name)+' · '+coord(u)+' · 移动 '+u.mp+' · 兵力 '+u.hp+'/'+u.maxHp+(u.role==='armor'?' · 油 '+u.fuel:['medic','supply','engineer'].includes(u.role)?' · 物资 '+u.stock:' · 弹药 '+u.ammo)+'</p><div class="mobile-unit-actions">'+buttons+'</div>'+auto;
}
function setupMobileLayout(){
 const small=matchMedia('(max-width:820px)'),landscape=matchMedia('(pointer:coarse) and (max-width:1100px) and (max-height:600px)');
 const moves=[['header nav','mobileMenuBody'],['.command-bar','mobileMenuBody'],['.controls','mobileMenuBody'],['#legend','mobileMenuBody'],['.workbench > aside','mobileInfoBody']].map(([selector,dest])=>{
  const node=document.querySelector(selector),anchor=document.createComment('mobile layout slot');node.before(anchor);return {node,anchor,dest};
 });
 const update=()=>{
  const enabled=small.matches||landscape.matches;
  if(enabled===mobileLayout)return;
  closeMobilePanels();mobileLayout=enabled;
  document.body.classList.toggle('mobile-layout',enabled);
  if(enabled&&document.body.classList.contains('expanded'))expanded();
  for(const {node,anchor,dest}of moves)if(enabled)$(dest).appendChild(node);else anchor.after(node);
  if(enabled&&view.w>2000){
   const u=S.units.find(u=>E.alive(u)&&u.side===(perspective==='god'?S.active:perspective)&&E.isCombat(u));
   if(u){const p=D.position(u.q,u.r);view={x:p.x-400,y:p.y-500,w:800,h:1000};}
  }
  renderMobileControls();requestAnimationFrame(()=>{resizeMobileCamera();applyView();});
 };
 small.addEventListener('change',update);landscape.addEventListener('change',update);
 $('mobileMenuOpen').onclick=()=>openMobilePanel('mobileMenuDialog');
 $('mobileLandscapeMenuOpen').onclick=()=>openMobilePanel('mobileMenuDialog');
 $('mobileInfoOpen').onclick=()=>openMobilePanel('mobileInfoDialog');
 for(const b of document.querySelectorAll('[data-close-mobile]'))b.onclick=()=>$(b.dataset.closeMobile).close();
 $('mobileEndTurn').onclick=requestEndTurn;
 $('mobileNextReady').onclick=selectNextReadyUnit;
 $('unitPicker').onclick=e=>{
  const context=unitPickerContext;
  if(!context)return;
  if(e.target.closest('[data-pick-close]')){closeUnitPicker();return;}
  if(e.target.closest('[data-pick-zoom]')){closeUnitPicker();zoom(.65,context.point);return;}
  const b=e.target.closest('[data-pick-unit]');
  if(!b||!context.ids.includes(b.dataset.pickUnit))return;
  const u=S.units.find(u=>u.id===b.dataset.pickUnit);
  closeUnitPicker();
  if(busy||selected!==context.selected||actionMode!==context.actionMode||!u||!visible(u))return;
  activate({dataset:{unit:u.id}});
 };
 $('mobileUnitBar').onclick=e=>{
  const b=e.target.closest('[data-mobile-command]');if(!b||b.disabled)return;
  const cmd=b.dataset.mobileCommand,u=S.units.find(u=>u.id===selected);
  if(cmd==='details'){renderDetail();openMobilePanel('mobileInfoDialog');return;}
  if(cmd==='collapse'||cmd==='expand'){mobileCollapsed=cmd==='collapse';renderMobileControls();return;}
  if(cmd==='cancel'){cancelAction();renderMoves();return;}
  if(cmd==='undo'){performUndo();return;}
  if(!controllable(u))return;
  if(cmd==='move'){beginMove(u);return;}
  if(cmd==='auto'){clearUndo();E.setAuto(S,u.id,!u.autoSupport);save();renderDetail();renderMobileControls();return;}
  if(cmd==='advance'){prepareAdvance(u);return;}
  if(cmd==='wait'){clearUndo();cancelAction();perform(E.waitUnit(S,u.id));return;}
  beginAbility(cmd);
 };
 new MutationObserver(updateMobileHint).observe($('actionHint'),{childList:true,characterData:true,subtree:true});
 // Keep the camera useful when the phone rotates or the compact commands open.
 new ResizeObserver(()=>{if(mobileLayout)resizeMobileCamera();}).observe($('mapWrap'));
 update();
}
function resizeMobileCamera(){
 if(!mobileLayout)return;
 const rect=$('mapWrap').getBoundingClientRect();if(rect.width<1||rect.height<1)return;
 const cy=view.y+view.h/2,h=view.w*rect.height/rect.width;
 view={...view,y:cy-h/2,h};applyView();
}

function onMapClick(e){if(suppressClick){suppressClick=false;return;}if(mobileLayout&&e.detail!==0){mobileMapTap(e.target,e);return;}const el=e.target.closest('[data-unit],[data-city],[data-q]');if(el)activate(el);}
function onKey(e){if(['Enter',' '].includes(e.key)){const el=e.target.closest('[data-unit],[data-city]');if(el){e.preventDefault();activate(el);}}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();view.x+=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*view.w*.08;view.y+=(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)*view.h*.08;applyView();}}

buildMap();
$('regions').innerHTML=D.regions.map(r=>`<button data-region="${r.id}" class="${r.id==='all'?'active':''}">${r.name}</button>`).join('');
$('regions').onclick=e=>{const b=e.target.closest('[data-region]');if(b&&!b.disabled)setRegion(b.dataset.region);};

for(const [id,p]of Object.entries(E.profiles))$('typeFilter').insertAdjacentHTML('beforeend',`<option value="${id}">${p.name}</option>`);
for(const id of ['sideFilter','typeFilter'])$(id).onchange=filterChanged;$('search').oninput=filterChanged;
$('boardStats').textContent='81 × 67 · 城市街区 / 工事 / 战争迷雾';
for(const [input,target]of [['gridToggle','cells'],['planToggle','axes'],['borderToggle','border']])$(input).onchange=()=>{if(input==='gridToggle')$('map').classList.toggle('no-grid',!$(input).checked);else $(target).style.display=$(input).checked?'':'none';};
$('supplyToggle').onchange=renderOverlays;
$('threatToggle').onchange=renderOverlays;

$('confirmAttack').onclick=confirmAttack;
$('cancelAttack').onclick=()=>{
 const id=pendingTarget?.kind==='advance'?pendingTarget.attacker:null;
 cancelAction();
 if(id)perform(E.declineAdvance(S,id));
 else renderMoves();
};

for(const kind of ['recon','strike'])$('air'+kind).onclick=()=>{
 if(busy||isGameFinished())return;
 cancelAction();selected=null;
 closeMobilePanels();
 actionMode=kind==='recon'?'airRecon':'airStrike';
 $('cancelAction').hidden=false;
 $('actionHint').textContent='点击地图选择'+(kind==='recon'?'侦察区域':'已发现的空袭目标')+'，再确认派遣';
 renderDetail();renderUnits();renderMoves();
};

$('artToggle').onchange=renderUnits;
$('perspective').onchange=()=>{
 if(FX)FX.clearAll();
 perspective=$('perspective').value;
 clearUndo();
 selected=null;
 cancelAction();
 refresh();
};

$('modeSelect').onchange=e=>switchMode(e.target.value);
if($('undoMove'))$('undoMove').onclick=performUndo;
if($('nextReady'))$('nextReady').onclick=selectNextReadyUnit;
$('endTurn').onclick=requestEndTurn;
$('confirmEndTurn').onclick=()=>{
 $('endTurnDialog').close();
 executeNextTurn();
};
$('cancelEndTurn').onclick=()=>$('endTurnDialog').close();

$('cancelAction').onclick=()=>{cancelAction();renderMoves();};
$('reset').onclick=()=>{
 closeMobilePanels();
 $('restartPrompt').textContent=`恢复初始部署，仅清空当前【${S.mode==='tutorial'?'入门教学':'完整战役'}】的战局进度。`;
 $('restartDialog').showModal();
};
$('cancelReset').onclick=()=>$('restartDialog').close();
$('confirmReset').onclick=()=>{
 restartCurrentMode();
 $('restartDialog').close();
};

if($('viewResultBtn'))$('viewResultBtn').onclick=showOutcomeModal;
$('closeOutcome').onclick=()=>$('outcomeDialog').close();
$('restartFromOutcome').onclick=()=>{
 $('outcomeDialog').close();
 restartCurrentMode();
};

const map=$('map');
map.onclick=onMapClick;
map.onkeydown=onKey;
map.onpointerover=e=>{
 const el=e.target.closest('[data-unit],[data-city],[data-q]');
 if(!el)return;
 if(el.dataset.unit){
  const u=S.units.find(u=>u.id===el.dataset.unit);
  $('hoverInfo').textContent=(u.side==='de'?'德军 · ':'苏军 · ')+u.name+' / '+coord(u);
 }else if(el.dataset.q!==undefined){
  $('hoverInfo').textContent=coord({q:+el.dataset.q,r:+el.dataset.r})+' · '+E.terrainName(+el.dataset.q,+el.dataset.r);
 }
};
map.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?.86:1.16,pointIn(map,e));},{passive:false});
window.BARB_MAP_INPUT.attach(map,{
 getView:()=>{applyView();return view;},
 setView:next=>{view=next;scheduleView();},
 clamp:clampInputView,
 onStart:closeUnitPicker,
 onTap:(target,e)=>{if(mobileLayout){mobileMapTap(target,e);return;}const el=target.closest('[data-unit],[data-city],[data-q]');if(el)activate(el);},
 onEnd:consumed=>{suppressClick=consumed;if(consumed)setTimeout(()=>{suppressClick=false;},400);}
});

$('minimap').onclick=e=>{const p=pointIn($('minimap'),e);view.x=p.x-view.w/2;view.y=p.y-view.h/2;applyView();};
$('roster').onclick=e=>{const b=e.target.closest('[data-roster]');if(b)showUnit(b.dataset.roster,true);};
$('zoomIn').onclick=()=>zoom(.8);$('zoomOut').onclick=()=>zoom(1.25);
$('fit').onclick=()=>{
 if(S.mode==='tutorial'&&S.missionView){
  view={...S.missionView};
  applyView();renderUnits();
 }else{
  setRegion('all');
 }
};
function openArchiveDialog(){
 closeMobilePanels();
 const container=$('archiveList');
 if(!container)return;
 const records=P?P.getArchiveRecords():[];
 if(!records.length){
  container.innerHTML='<p class="empty" style="padding:15px 0;">暂无战绩档案记录。完成战役后自动收录。</p>';
 }else{
  container.innerHTML=records.map(r=>{
   const modeLabel=r.mode==='tutorial'?'入门教学':'完整战役';
   const winLabel=r.winner==='de'?'德军胜利':'苏军胜利';
   const medalsHtml=Array.isArray(r.medals)&&r.medals.length?r.medals.map(m=>`<span class="medal-badge" style="margin-right:5px;font-size:10px;">🎖️ ${esc(m)}</span>`).join(''):'<span style="color:var(--muted);font-size:10px;">无战功勋章</span>';
   return `<div class="archive-item">
    <div class="archive-item-header">
     <strong>${esc(modeLabel)} · ${esc(winLabel)}</strong>
     <small>${esc(r.date||'未知日期')}</small>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">结算：第 ${r.round} 回合 · ${esc(r.reason||'')}</div>
    <div style="margin-top:4px;">${medalsHtml}</div>
   </div>`;
  }).join('');
 }
 if($('archiveDialog'))$('archiveDialog').showModal();
}

if($('archiveBtn'))$('archiveBtn').onclick=openArchiveDialog;
if($('closeArchive'))$('closeArchive').onclick=()=>$('archiveDialog').close();

if($('soundToggle'))$('soundToggle').onchange=e=>{
 settings.sound=!!e.target.checked;
 if(!settings.sound&&FX)FX.clearAll();
 if(settings.sound&&FX)FX.userAudioGesture();
 if(P)P.saveSettings(settings);
};

if($('animSelect'))$('animSelect').onchange=e=>{
 if(FX)FX.clearAll();
 settings.anim=e.target.value;
 applySettingsToDom();
 if(P)P.saveSettings(settings);
};

function resumeSavedSound(){if(settings.sound&&FX)FX.userAudioGesture();}
document.addEventListener('pointerdown',resumeSavedSound,{once:true});
document.addEventListener('keydown',resumeSavedSound,{once:true});

$('fullscreen').onclick=expanded;
$('historyBtn').onclick=()=>{closeMobilePanels();$('history').showModal();};
$('closeHistory').onclick=()=>$('history').close();
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
  if($('mobileMenuDialog').open||$('mobileInfoDialog').open){closeMobilePanels();return;}
  if($('archiveDialog')&&$('archiveDialog').open){$('archiveDialog').close();return;}
  if($('endTurnDialog').open){$('endTurnDialog').close();return;}
  if($('restartDialog').open){$('restartDialog').close();return;}
  if($('outcomeDialog').open){$('outcomeDialog').close();return;}
  cancelAction();renderMoves();
  if(document.body.classList.contains('expanded'))expanded();
 }
});

if(S.mode==='tutorial'&&S.missionView){
 view={...S.missionView};
}
setupMobileLayout();
if(S.mode==='tutorial')$('viewName').textContent='布列斯特教学区';
updateRegionsForMode();
cancelAction();
refresh();
applyView();
})();
