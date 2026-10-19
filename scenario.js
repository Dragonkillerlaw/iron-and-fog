(function(root){'use strict';
// A deployment study, not a combat simulation. Coordinates are schematic.
const board={cols:81,rows:67,width:4960,height:3630};
const bounds={west:21.6,east:30.4,south:51.4,north:55.2};
const palette={plain:'#ddd9b8',forest:'#879b74',marsh:'#9c8aa4',hill:'#c3b485',river:'#5995b2',bridge:'#dfbd75',town:'#bdad91'};
const terrainNames={plain:'平原与农田',forest:'林区',marsh:'沼泽湿地',hill:'缓丘',river:'河流',bridge:'桥渡节点',town:'城镇'};
const key=(q,r)=>q+','+r;
const position=(q,r)=>({x:50+q*60+(r&1)*30,y:50+r*53});
const geo=(lon,lat)=>({x:50+(lon-bounds.west)/(bounds.east-bounds.west)*4800,y:50+(bounds.north-lat)/(bounds.north-bounds.south)*3498});
function grid(lon,lat){const p=geo(lon,lat),r=Math.max(0,Math.min(board.rows-1,Math.round((p.y-50)/53))),q=Math.max(0,Math.min(board.cols-1,Math.round((p.x-50-(r&1)*30)/60)));return {q,r};}
const towns=[
 ['suwalki','苏瓦乌基','SUWAŁKI',22.93,54.10,2],['alytus','阿利图斯','ALYTUS',24.04,54.40,1],['kaunas','考纳斯','KAUNAS',23.90,54.90,1],['vilnius','维尔纽斯','VILNIUS',25.28,54.69,2],
 ['grodno','格罗德诺','GRODNO',23.83,53.68,2],['bialystok','比亚韦斯托克','BIAŁYSTOK',23.16,53.13,3],['lida','利达','LIDA',25.30,53.89,1],['volkovysk','沃尔科维斯克','VOLKOVYSK',24.46,53.15,1],
 ['brest','布列斯特','BREST',23.68,52.10,3],['kobryn','科布林','KOBRYN',24.35,52.21,1],['pruzhany','普鲁扎内','PRUZHANY',24.46,52.56,1],['slonim','斯洛尼姆','SLONIM',25.32,53.09,2],
 ['baranovichi','巴拉诺维奇','BARANOVICHI',26.03,53.13,2],['novogrudok','新格鲁多克','NOVOGRUDOK',25.83,53.59,1],['molodechno','莫洛杰奇诺','MOLODECHNO',26.83,54.31,2],
 ['minsk','明斯克','MINSK',27.56,53.90,3],['slutsk','斯卢茨克','SLUTSK',27.55,53.03,1],['pinsk','平斯克','PINSK',26.10,52.12,1],['borisov','鲍里索夫','BORISOV',28.51,54.22,2],['orsha','奥尔沙方向','ORSHA →',30.28,54.50,1]
].map(([id,name,latin,lon,lat,importance])=>({id,name,latin,lon,lat,importance,...grid(lon,lat)}));
const rivers=[
 {name:'涅曼河',label:[24.65,54.00],points:[[22,55.12],[22.8,55.05],[23.5,55.04],[23.90,54.9],[23.94,54.65],[24.04,54.4],[24.0,54.18],[23.85,53.95],[23.83,53.68],[24.18,53.55],[24.55,53.59],[24.9,53.69],[25.3,53.69],[25.8,53.53],[26.3,53.42],[27.0,53.42]]},
 {name:'西布格河',label:[22.8,52.23],points:[[24.1,51.4],[23.72,51.65],[23.56,51.9],[23.68,52.1],[23.47,52.28],[23.05,52.38],[22.65,52.48],[22.3,52.66],[21.6,52.57]]},
 {name:'沙拉河',label:[25.4,52.83],points:[[24.95,53.63],[25.07,53.42],[25.3,53.15],[25.32,53.09],[25.6,52.94],[25.9,52.89],[26.15,53.07]]},
 {name:'别列津纳河',label:[28.8,53.65],points:[[28.55,55.2],[28.05,54.83],[28.15,54.58],[28.51,54.22],[28.65,53.93],[28.8,53.65],[29.03,53.3],[29.25,53.15],[29.2,52.7],[29.4,52.4]]},
 {name:'普里皮亚季河',label:[27.3,51.67],points:[[25.4,51.82],[26.10,52.12],[26.65,51.98],[27.3,51.91],[28.0,52.04],[28.5,51.96],[29.3,52.01],[30.4,51.75]]}
];
const routes=[
 {name:'北线公路',towns:['suwalki','alytus','vilnius','molodechno','minsk','borisov','orsha']},
 {name:'中央公路',towns:['bialystok','volkovysk','slonim','baranovichi','minsk']},
 {name:'南线公路',towns:['brest','kobryn','pruzhany','slonim']},
 {name:'格罗德诺—利达',towns:['bialystok','grodno','lida','molodechno']},
 {name:'南部支线',towns:['brest','kobryn','pinsk','slutsk','minsk']}
];
const rail=['brest','kobryn','baranovichi','minsk','borisov','orsha'];
const border=[[22.65,55.2],[22.7,54.82],[22.85,54.5],[23.32,54.06],[23.2,53.9],[22.64,53.63],[22.38,53.3],[22.41,53.0],[22.65,52.78],[23.08,52.48],[23.68,52.1],[23.58,51.4]];
const plans=[
 {name:'第3装甲集群 · 北翼计划轴线',points:[[22.9,54.32],[24.04,54.4],[25.28,54.69],[26.83,54.31],[27.98,53.97]]},
 {name:'第2装甲集群 · 南翼计划轴线',points:[[23.35,51.9],[24.35,52.21],[25.32,53.09],[26.03,53.13],[27.98,53.80]]}
];
function lineCells(points){const cells=new Set();for(let i=1;i<points.length;i++){const a=geo(...points[i-1]),b=geo(...points[i]),n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/12);for(let j=0;j<=n;j++){const f=j/n,lon=points[i-1][0]+(points[i][0]-points[i-1][0])*f,lat=points[i-1][1]+(points[i][1]-points[i-1][1])*f;const p=grid(lon,lat);cells.add(key(p.q,p.r));}}return cells;}
const town=id=>towns.find(t=>t.id===id),roadPoints=route=>route.towns.map(id=>[town(id).lon,town(id).lat]);
const water=new Set(rivers.flatMap(r=>[...lineCells(r.points)])),roads=new Set(routes.flatMap(r=>[...lineCells(roadPoints(r))])),townCells=new Set(towns.map(t=>key(t.q,t.r)));
const ellipses={forest:[[24.0,52.65,.40,.31],[23.35,53.84,.3,.28],[24.1,54.04,.25,.3],[25.0,54.45,.65,.28],[26.0,54.0,.5,.25],[28.1,54.6,.85,.32],[28.5,53.1,.8,.30]],marsh:[[25.4,51.92,1.6,.31],[27.0,51.96,1.5,.34],[28.5,51.89,1.3,.35],[24.8,52.10,.6,.24]],hill:[[26.7,54.0,.7,.30],[27.45,54.02,.65,.24],[25.8,53.55,.38,.26]]};
const inside=(lon,lat,a)=>((lon-a[0])/a[2])**2+((lat-a[1])/a[3])**2<1;
function terrain(q,r){const k=key(q,r);if(water.has(k))return roads.has(k)?'bridge':'river';if(townCells.has(k))return 'town';const lon=bounds.west+(q+(r&1)*.5)/80*(bounds.east-bounds.west),lat=bounds.north-r/66*(bounds.north-bounds.south);for(const type of ['marsh','forest','hill'])if(ellipses[type].some(a=>inside(lon,lat,a)))return type;return 'plain';}
const groups=[
 {id:'p3',side:'de',name:'第3装甲集群',short:'PzGr. 3',commander:'赫尔曼·霍特',area:'苏瓦乌基北翼',lon:22.9,lat:54.43,description:'北翼装甲突击群。箭线指示经涅曼河、维尔纽斯方向向明斯克迂回的计划轴线。'},
 {id:'a9',side:'de',name:'第9集团军',short:'AOK 9',commander:'阿道夫·施特劳斯',area:'突出部西北缘',lon:22.28,lat:53.60,description:'步兵主力位于突出部西北缘，配合装甲部队压迫与包围突出部。'},
 {id:'a4',side:'de',name:'第4集团军',short:'AOK 4',commander:'京特·冯·克鲁格',area:'突出部西南缘',lon:22.70,lat:52.62,description:'步兵主力沿突出部西南缘展开；布列斯特要塞是本方向的重要节点。'},
 {id:'p2',side:'de',name:'第2装甲集群',short:'PzGr. 2',commander:'海因茨·古德里安',area:'布列斯特以西、南侧',lon:23.20,lat:51.88,description:'南翼装甲突击群。通过布格河地带后，经斯洛尼姆、巴拉诺维奇方向趋向明斯克。'},
 {id:'s11',side:'su',name:'第11集团军南翼',short:'11 A · NW',commander:'瓦西里·莫罗佐夫',area:'阿利图斯—维尔纽斯',lon:24.5,lat:54.55,description:'西北方面军相邻防区，仅展示与中央集团军北翼相接的部分部队，不纳入西方面军编制。'},
 {id:'s3',side:'su',name:'第3集团军',short:'3 A',commander:'瓦西里·库兹涅佐夫',area:'格罗德诺地带',lon:23.9,lat:53.75,description:'苏军突出部北肩，包含第11机械化军的机动部队。'},
 {id:'s10',side:'su',name:'第10集团军',short:'10 A',commander:'康斯坦丁·戈卢别夫',area:'比亚韦斯托克突出部',lon:23.55,lat:53.15,description:'突出部主力区，配属第6、第13机械化军及第6骑兵军等部队。'},
 {id:'s4',side:'su',name:'第4集团军',short:'4 A',commander:'亚历山大·科罗布科夫',area:'布列斯特—科布林',lon:24.03,lat:52.24,description:'苏军南翼防区；第14机械化军位于布列斯特—科布林地区。'},
 {id:'reserve',side:'su',name:'西方面军后方',short:'FRONT',commander:'德米特里·巴甫洛夫',area:'斯洛尼姆—明斯克纵深',lon:26.5,lat:53.65,description:'方面军直属与纵深部队分别展开。第13集团军在开战时仅以司令部标记表示，未虚构为齐装满员的防线。'}
];
// Manually inspected source rectangles: these concept sheets are not uniform spritesheets.
const art={
 deInf:{file:'02-specialists.png',rect:[997,817,253,423],note:'复用德军机动步兵形象；步兵装备细分待补齐。'},
 suInf:{file:'01-infantry.png',rect:[650,25,295,375],note:'复用苏军步兵概念形象，不能据持枪姿势推断全师武器配比。'},
 mg:{file:'01-infantry.png',rect:[4,480,377,295],note:'德军机枪组概念形象。'},
 mortar:{file:'01-infantry.png',rect:[642,440,294,330],note:'苏军迫击炮组概念形象。'},
 light:{file:'04-armor-artillery.png',rect:[5,145,303,255],note:'通用轻坦概念占位，原图为美式轮廓；不代表本编队实际型号。'},
 medium:{file:'04-armor-artillery.png',rect:[316,150,305,255],note:'苏式中坦概念占位，炮塔与炮管不作为1941年型号考据。'},
 assault:{file:'04-armor-artillery.png',rect:[5,515,310,240],note:'短管突击炮概念形象；涂装为占位。'},
 gun:{file:'04-armor-artillery.png',rect:[941,549,312,211],note:'通用牵引反坦克炮，非精确口径、型号复原。'},
 howitzer:{file:'04-armor-artillery.png',rect:[10,915,300,270],note:'通用牵引火炮形象；以编制说明为准。'},
 aa:{file:'04-armor-artillery.png',rect:[948,827,303,349],note:'通用高射炮形象，非具体高炮营的型号复原。'},
 recon:{file:'02-specialists.png',rect:[324,874,350,348],note:'德军摩托侦察队概念形象。'},
 cavalry:{file:'02-specialists.png',rect:[13,809,311,413],note:'骑兵概念占位，原图为波兰骑兵形象。'},
 engineer:{file:'03-command-support.png',rect:[972,4,278,418],note:'工兵概念占位，原图为苏式制服。'},
 supply:{file:'03-command-support.png',rect:[5,823,305,415],note:'补给人员概念占位，原图为意式制服；用于表示辎重节点。'}
};
Object.assign(art,{
 medic:{file:'03-command-support.png',rect:[672,420,232,398],note:'战地医疗兵'},
 medicSu:{file:'03-command-support.png',rect:[979,423,253,399],note:'战地医疗兵'},
 officer:{file:'03-command-support.png',rect:[38,5,260,415],note:'指挥员'},
 officerSu:{file:'03-command-support.png',rect:[664,3,239,415],note:'前线指挥员'},
 airRecon:{file:'05-aircraft.png',rect:[309,850,315,300],note:'侦察联络机'},
 airStrike:{file:'05-aircraft.png',rect:[5,485,310,290],note:'俯冲轰炸机'}
});
const categories={infantry:'步兵',armor:'装甲',artillery:'火炮',recon:'侦察／骑兵',support:'工兵／后勤',hq:'指挥部'};
const units=[],occupied=new Set();
function borderX(y){const points=border.map(p=>geo(...p));for(let i=1;i<points.length;i++)if(y>=points[i-1].y&&y<=points[i].y){const a=points[i-1],b=points[i],f=(y-a.y)/(b.y-a.y);return a.x+(b.x-a.x)*f;}return points[points.length-1].x;}
function place(lon,lat,side){const origin=grid(lon,lat),options=[];for(let dr=-8;dr<=8;dr++)for(let dq=-8;dq<=8;dq++){const q=origin.q+dq,r=origin.r+dr,p=position(q,r),west=p.x<borderX(p.y);if(q<1||q>=80||r<1||r>=66||occupied.has(key(q,r))||['river','marsh','town'].includes(terrain(q,r))||(side==='de'?!west:west))continue;options.push({q,r,score:dq*dq+dr*dr+(terrain(q,r)==='forest'?1:0)});}options.sort((a,b)=>a.score-b.score||a.r-b.r||a.q-b.q);if(!options.length)throw Error('No deployment cell');const p=options[0];occupied.add(key(p.q,p.r));return {q:p.q,r:p.r};}
function add(group,name,category,asset,lon,lat,equipment,designation='缩编部署示意'){
 const g=groups.find(x=>x.id===group);units.push({id:'b'+units.length,group,side:g.side,name,category,asset,...place(lon,lat,g.side),equipment,designation});
}
const equipment={deInf:'步枪、机枪、迫击炮；一个标记代表师／军内的缩编作战群。',suInf:'步枪、轻重机枪、迫击炮；一个标记代表缩编步兵群。',deArmor:'1941年德军装甲混合编制：Pz I/II、Pz III/IV及部分捷制坦克；具体配比未在本版量化。',suArmor:'T-26、BT系列为主要旧式装备；部分机械化部队另有T-34与KV。图标不表示库存数量。',gun:'牵引反坦克火炮与牵引运输；型号与口径暂未逐营还原。',howitzer:'牵引式野战炮、榴弹炮与弹药保障；本版只摆放位置。',supply:'油料、弹药、运输与维修保障节点；位置为关卡预设。'};
function cluster(group,kind,count,asset,lon,lat,spread=.22){const g=groups.find(x=>x.id===group),name=({mg:'机枪',mortar:'迫击炮',gun:'反坦克炮',assault:'突击炮',recon:'摩托侦察'})[asset]||categories[kind],description=kind==='infantry'?equipment[g.side==='de'?'deInf':'suInf']:asset==='assault'?'1941年短管StuG III类步兵支援突击炮，聚合支援标记。':asset==='recon'?'摩托车与侦察人员，负责联络和前沿侦察。':asset==='mortar'?'步兵迫击炮与弹药保障，支援编队示意。':equipment[kind==='artillery'?(asset==='gun'?'gun':'howitzer'):'supply'];for(let i=0;i<count;i++){const row=Math.floor(i/3),col=i%3;add(group,g.name+' · '+name+'群 '+(i+1),kind,asset,lon+(col-1)*spread,lat-row*.15,description);}}
// Historic named formations are a selection; supporting markers are explicitly aggregated.
for(const [group,divs,lon,lat] of [['p3',[7,20,12,19],23.03,54.60],['p2',[3,4,10,17,18],23.18,52.04]]){
 divs.forEach((n,i)=>add(group,'第'+n+'装甲师','armor','light',lon+(i%3)*.18,lat-Math.floor(i/3)*.15,equipment.deArmor,'历史师番号 · 大致集结区'));
 cluster(group,'infantry',3,'deInf',lon-.25,lat-.28,.17);cluster(group,'recon',2,'recon',lon+.18,lat+.1,.20);
 cluster(group,'artillery',2,'howitzer',lon-.38,lat+.06,.16);cluster(group,'support',2,'supply',lon-.58,lat-.10,.18);
 add(group,'装甲集群 · 渡河工兵','support','engineer',lon+.30,lat-.24,'架桥、舟桥与渡河器材；桥位为设计示意。');
 if(group==='p2')cluster(group,'armor',2,'assault',lon-.15,lat-.38,.2);
}
for(const [id,lon,lat,count] of [['a9',22.47,53.72,8],['a4',22.72,52.69,9]]){
 cluster(id,'infantry',count,'deInf',lon,lat,.17);cluster(id,'infantry',2,'mg',lon+.25,lat-.12,.18);cluster(id,'artillery',3,'howitzer',lon-.25,lat+.04,.17);cluster(id,'artillery',2,'gun',lon+.18,lat-.34,.18);cluster(id,'support',2,'supply',lon-.48,lat-.1,.18);
}
for(const [id,lon,lat,count] of [['s3',23.76,53.85,5],['s10',23.26,53.25,7],['s4',23.94,52.27,5]]){
 cluster(id,'infantry',count,'suInf',lon,lat,.20);cluster(id,'artillery',2,'mortar',lon+.15,lat-.10,.20);cluster(id,'artillery',2,'howitzer',lon+.48,lat+.05,.20);cluster(id,'artillery',2,'gun',lon-.08,lat-.31,.20);cluster(id,'support',2,'supply',lon+.55,lat-.23,.20);
}
cluster('s11','infantry',5,'suInf',24.15,54.53,.24);cluster('s11','artillery',2,'gun',24.55,54.62,.25);
for(const [group,n,lon,lat,medium] of [['s3',11,24.06,53.83,true],['s10',6,23.65,53.12,true],['s10',13,23.3,52.80,false],['s4',14,24.2,52.25,false],['reserve',17,25.28,52.94,false],['reserve',20,27.04,53.59,false]]){
 add(group,'第'+n+'机械化军 · 坦克部','armor',medium?'medium':'light',lon,lat,equipment.suArmor,'历史军番号 · 坦克部缩编');
 add(group,'第'+n+'机械化军 · 摩托化部','infantry','suInf',lon+.24,lat-.12,'机械化军所属摩托化步兵及运输；实际完备程度并不相同。','历史军番号 · 摩托化部缩编');
}
add('s10','第6骑兵军 · 骑兵部','recon','cavalry',23.84,53.20,'骑乘机动、下马作战；原图为通用骑兵占位。','历史军番号 · 缩编');
add('s4','布列斯特要塞守备','infantry','suInf',23.73,52.07,'要塞守备部队聚合标记；并非独立满编师。','历史地点 · 聚合标记');
add('reserve','第100步兵师','infantry','suInf',27.39,53.95,equipment.suInf,'历史师番号 · 明斯克地区示意');
add('reserve','第161步兵师','infantry','suInf',27.10,54.05,equipment.suInf,'历史师番号 · 明斯克地区示意');
cluster('reserve','infantry',3,'suInf',26.35,53.88,.35);cluster('reserve','support',3,'supply',27.96,54.05,.22);
add('reserve','明斯克 · 防空节点','artillery','aa',27.66,53.95,'城市防空预设节点；没有绑定未经核对的团、营番号。');
for(const g of groups)add(g.id,g.name+' · 指挥部','hq',null,g.lon-.18,g.lat+.18,g.commander+'指挥；图上为便于查阅而设置的指挥标记。','真实指挥关系 · 位置示意');
add('reserve','第13集团军 · 司令部','hq',null,27.25,53.82,'彼得·菲拉托夫；开战时只有司令部框架，本版不为其虚设所属作战师。','历史司令部 · 未展开集团军');
// Reinforcements for the asymmetric playable scenario.
for(const g of groups){
 const count=g.side==='de'?1:2;
 for(let i=0;i<count;i++)for(const role of ['medic','engineer']){
  add(g.id,g.name+' · '+(role==='medic'?'医疗队':'工兵队')+' '+(i+1),'support',null,g.lon+.15+i*.22,g.lat-.25-(role==='medic'?.12:0),'');
  units[units.length-1].role=role;
 }
 if(g.side==='su'){
  for(let i=0;i<2;i++){add(g.id,g.name+' · 机枪队 '+(i+1),'infantry',null,g.lon+.35+i*.2,g.lat+.20,'');units[units.length-1].role='mg';}
  cluster(g.id,'infantry',9,'suInf',g.lon+.55,g.lat+.05,.27);
 }
}
for(const g of groups.filter(g=>g.side==='su'&&g.id!=='s11'))add(g.id,g.name+' · 轻坦预备队','armor','light',g.lon+.7,g.lat-.18,'');
const regions=[
 {id:'all',name:'全战区',view:{x:0,y:0,w:4960,h:3630}},
 {id:'north',name:'苏瓦乌基—格罗德诺',view:{x:200,y:150,w:1950,h:1500}},
 {id:'salient',name:'突出部',view:{x:130,y:1050,w:1950,h:1500}},
 {id:'south',name:'布列斯特',view:{x:250,y:2100,w:1950,h:1500}},
 {id:'rear',name:'明斯克纵深',view:{x:2450,y:700,w:2050,h:1550}}
];
const api={board,bounds,palette,terrainNames,key,position,geo,grid,towns,town,rivers,routes,rail,border,borderX,plans,roadPoints,terrain,groups,art,categories,units,regions};
if(typeof module!=='undefined')module.exports=api;root.BARBAROSSA=api;
})(typeof globalThis!=='undefined'?globalThis:this);
