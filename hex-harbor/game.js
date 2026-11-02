'use strict';
const crypto = require('node:crypto');
const RES=['wood','brick','wool','grain','ore'];
const ICON={wood:'🌲',brick:'🧱',wool:'🐑',grain:'🌾',ore:'⛏️'};
const LABEL={wood:'Timber',brick:'Clay',wool:'Fleece',grain:'Grain',ore:'Ore'};
const COST={road:{wood:1,brick:1},settlement:{wood:1,brick:1,wool:1,grain:1},city:{ore:3,grain:2},dev:{ore:1,wool:1,grain:1}};
const PIPS={2:1,3:2,4:3,5:4,6:5,8:5,9:4,10:3,11:2,12:1};
const COLORS=['#e9a25d','#77c8c9','#c6a3ea','#eb8c9d'];
const TERRAIN=['wood','wood','wood','wood','brick','brick','brick','wool','wool','wool','wool','grain','grain','grain','grain','ore','ore','ore','desert'];
const NUMBERS=[2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12];
const DEV_DECK=['knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','point','point','point','point','point','roads','roads','harvest','harvest','monopoly','monopoly'];
const id=()=>crypto.randomBytes(12).toString('hex');
const code=()=>crypto.randomBytes(4).toString('hex').toUpperCase().slice(0,5);
function shuffle(list){let a=list.slice();for(let i=a.length-1;i>0;i--){let j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function ensure(yes,msg){if(!yes)throw Error(msg);}
function zero(){return Object.fromEntries(RES.map(x=>[x,0]));}
function sum(obj){return RES.reduce((s,r)=>s+Number(obj?.[r]||0),0);}
function normalize(obj){let out=zero();for(const r of RES){const n=Number(obj?.[r]||0);ensure(Number.isSafeInteger(n)&&n>=0&&n<=19,'Invalid resource count.');out[r]=n;}return out;}
function makeBoard(){
 const hexes=[];for(let r=-2;r<=2;r++)for(let q=-2;q<=2;q++)if(Math.abs(q+r)<=2)hexes.push({q,r,id:hexes.length});
 const vertexMap=new Map(),edgeMap=new Map(),vertices=[],edges=[];
 for(const h of hexes){const cx=390+Math.sqrt(3)*69*(h.q+h.r/2),cy=310+103.5*h.r;h.x=+cx.toFixed(2);h.y=+cy.toFixed(2);h.vertices=[];h.edges=[];
  for(let i=0;i<6;i++){const a=(-90+i*60)*Math.PI/180, x=+(cx+69*Math.cos(a)).toFixed(2),y=+(cy+69*Math.sin(a)).toFixed(2),k=`${x},${y}`;
   if(!vertexMap.has(k)){let v={id:vertices.length,x,y,adj:[],hexes:[],edges:[]};vertexMap.set(k,v.id);vertices.push(v);}
   const n=vertexMap.get(k);h.vertices.push(n);vertices[n].hexes.push(h.id);
  }
  for(let i=0;i<6;i++){const a=h.vertices[i],b=h.vertices[(i+1)%6],k=[a,b].sort((a,b)=>a-b).join(':');
    if(!edgeMap.has(k)){const e={id:edges.length,a,b,hexes:[]};edgeMap.set(k,e.id);edges.push(e);vertices[a].adj.push(b);vertices[b].adj.push(a);vertices[a].edges.push(e.id);vertices[b].edges.push(e.id);}
    const n=edgeMap.get(k);h.edges.push(n);edges[n].hexes.push(h.id);
  }
 }
 ensure(vertices.length===54&&edges.length===72,`Board graph mismatch: ${vertices.length} vertices, ${edges.length} edges`);
 const terrain=shuffle(TERRAIN);const nums=shuffle(NUMBERS);let ni=0;
 hexes.forEach((h,i)=>{h.terrain=terrain[i];h.number=h.terrain==='desert'?null:nums[ni++];});
 // Do not place adjacent high-yield (6/8) hexes when practical.
 for(let k=0;k<180;k++){const bad=hexes.find(h=>[6,8].includes(h.number)&&hexes.some(b=>b!==h&&[6,8].includes(b.number)&&hexDistance(h,b)===1));if(!bad)break;
  const others=hexes.filter(h=>h.number&&![6,8].includes(h.number)&&hexes.filter(x=>x!==h&&x!==bad&&[6,8].includes(x.number)&&hexDistance(h,x)===1).length===0);
  if(others.length){let swap=others[crypto.randomInt(others.length)];[bad.number,swap.number]=[swap.number,bad.number];}
 }
 const coast=edges.filter(e=>e.hexes.length===1).sort((a,b)=>{
   const va=vertices[a.a],vb=vertices[a.b],wa=vertices[b.a],wb=vertices[b.b];return Math.atan2((va.y+vb.y)/2-310,(va.x+vb.x)/2-390)-Math.atan2((wa.y+wb.y)/2-310,(wa.x+wb.x)/2-390);
 });
 const portTypes=shuffle([...RES,'any','any','any','any']);
 const ports=Array.from({length:9},(_,i)=>({edgeId:coast[(i*3+1)%coast.length].id,resource:portTypes[i]}));
 return {hexes,vertices,edges,ports,robber:hexes.find(h=>h.terrain==='desert').id};
}
function hexDistance(a,b){return (Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs((a.q+a.r)-(b.q+b.r)))/2;}
function makePlayer(name,avatar,bot=false,style='balanced'){
 const safe=String(name||'Explorer').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,18)||'Explorer';
 return {id:id(),token:id(),name:safe,avatar:['🦊','🐻','🐼','🦉','🐺','🦋','🦁','🐸','🐙','🐬'].includes(avatar)?avatar:'🦊',bot,style,color:null,hand:zero(),dev:[],roads:0,settlements:0,cities:0,army:0,devPlayed:false,freeRoads:0,bankrupt:false,connected:false};
}
function log(room,text){room.feed.unshift({id:id(),time:Date.now(),text});room.feed=room.feed.slice(0,48);}
function createRoom(roomCode){return {code:roomCode,hostToken:id(),status:'lobby',phase:'lobby',players:[],board:null,pieces:{settlements:{},roads:{}},bank:Object.fromEntries(RES.map(r=>[r,19])),deck:[],offer:null,turnIndex:0,setupOrder:[],setupStep:0,setupLastVertex:null,serialTurn:0,lastRoll:null,award:{road:null,army:null},winner:null,discardNeeds:{},robberReturn:'action',feed:[],updatedAt:Date.now()};}
function current(room){return room.players[room.turnIndex];}
function isCurrent(room,p){return room.status==='playing'&&current(room)?.id===p.id;}
function ready(room){ensure(room.status==='playing','The game has not started.');}
function playerById(room,id){const p=room.players.find(x=>x.id===id);ensure(p,'Unknown player.');return p;}
function start(room){ensure(room.status==='lobby','Game already in progress.');ensure(room.players.length>=2&&room.players.length<=4,'Requires two to four players.');
 room.board=makeBoard();room.pieces={settlements:{},roads:{}};room.bank=Object.fromEntries(RES.map(r=>[r,19]));room.deck=shuffle(DEV_DECK);room.offer=null;room.turnIndex=0;room.setupOrder=[...room.players.keys(),...[...room.players.keys()].reverse()];room.setupStep=0;room.setupLastVertex=null;room.serialTurn=0;room.lastRoll=null;room.winner=null;room.award={road:null,army:null};room.discardNeeds={};room.status='playing';room.phase='setup_settlement';
 room.players.forEach((p,i)=>{p.color=COLORS[i];p.hand=zero();p.dev=[];p.roads=0;p.settlements=0;p.cities=0;p.army=0;p.devPlayed=false;p.freeRoads=0;});
 room.turnIndex=room.setupOrder[0];log(room,`Welcome to Hex Harbor! ${room.players.length} explorers, one island, ten victory stars.`);
}
function ownSettlement(room,p,v){return room.pieces.settlements[v]?.owner===p.id;}
function has(room,p,cost){return RES.every(r=>p.hand[r]>=(cost[r]||0));}
function pay(room,p,cost){ensure(has(room,p,cost),'Not enough resources.');for(const r of RES){p.hand[r]-=cost[r]||0;room.bank[r]+=cost[r]||0;}}
function grant(room,p,r,qty=1){const n=Math.min(qty,room.bank[r]);p.hand[r]+=n;room.bank[r]-=n;return n;}
function legalSettlements(room,p){if(!isCurrent(room,p))return [];const phase=room.phase;if(!['setup_settlement','action'].includes(phase))return [];if(p.settlements>=5)return [];if(phase==='action'&&!has(room,p,COST.settlement))return [];
 return room.board.vertices.filter(v=>!room.pieces.settlements[v.id]&&v.adj.every(n=>!room.pieces.settlements[n])&&(phase==='setup_settlement'||v.edges.some(e=>room.pieces.roads[e]===p.id))).map(v=>v.id);
}
function legalRoads(room,p){if(!isCurrent(room,p))return [];const phase=room.phase;if(!['setup_road','action','roll'].includes(phase)||p.roads>=15)return [];
 if(phase==='action'&&!p.freeRoads&&!has(room,p,COST.road))return [];
 if(phase==='roll'&&!p.freeRoads)return [];
 return room.board.edges.filter(e=>!room.pieces.roads[e.id]&&(phase==='setup_road'?(e.a===room.setupLastVertex||e.b===room.setupLastVertex):[e.a,e.b].some(v=>{
  if(ownSettlement(room,p,v))return true;
  if(room.pieces.settlements[v]&&room.pieces.settlements[v].owner!==p.id)return false;
  return room.board.vertices[v].edges.some(other=>room.pieces.roads[other]===p.id);
 }))).map(e=>e.id);
}
function legalCities(room,p){if(!isCurrent(room,p)||room.phase!=='action'||p.cities>=4||!has(room,p,COST.city))return [];return Object.entries(room.pieces.settlements).filter(([,piece])=>piece.owner===p.id&&piece.level===1).map(([v])=>+v);}
function settlement(room,p,v){ready(room);v=Number(v);ensure(legalSettlements(room,p).includes(v),'You cannot found a village here.');
 const setup=room.phase==='setup_settlement';if(!setup)pay(room,p,COST.settlement);
 room.pieces.settlements[v]={owner:p.id,level:1};p.settlements++;
 if(setup){if(room.setupStep>=room.players.length){for(const h of room.board.vertices[v].hexes){let resource=room.board.hexes[h].terrain;if(resource!=='desert')grant(room,p,resource);}}
  room.setupLastVertex=v;room.phase='setup_road';
 }else{log(room,`${p.avatar} ${p.name} founded a new settlement.`);recalculate(room);}
}
function road(room,p,e){ready(room);e=Number(e);ensure(legalRoads(room,p).includes(e),'Road must connect to your existing network.');const setup=room.phase==='setup_road';
 if(!setup&&!p.freeRoads)pay(room,p,COST.road);else if(!setup)p.freeRoads--;
 room.pieces.roads[e]=p.id;p.roads++;
 if(setup){room.setupLastVertex=null;room.setupStep++;if(room.setupStep>=room.setupOrder.length){room.phase='roll';room.turnIndex=0;room.serialTurn=1;log(room,'Founding complete. Roll the dice to begin the first harvest.');}
  else {room.turnIndex=room.setupOrder[room.setupStep];room.phase='setup_settlement';}
 }else {log(room,`${p.avatar} ${p.name} extended their road network.`);recalculate(room);}
}
function city(room,p,v){v=Number(v);ensure(legalCities(room,p).includes(v),'This settlement cannot be upgraded.');pay(room,p,COST.city);room.pieces.settlements[v].level=2;p.settlements--;p.cities++;log(room,`${p.avatar} ${p.name} grew a village into a city!`);recalculate(room);}
function produce(room,die){let due={};for(const r of RES)due[r]=[];
 for(const [v,piece] of Object.entries(room.pieces.settlements)){
  for(const hid of room.board.vertices[+v].hexes){const h=room.board.hexes[hid];if(h.number===die&&hid!==room.board.robber)due[h.terrain].push({id:piece.owner,n:piece.level});}
 }
 const incomes=[];
 for(const r of RES){const total=due[r].reduce((s,d)=>s+d.n,0);if(total>room.bank[r]){if(total)log(room,`The ${LABEL[r]} bank ran short; no ${LABEL[r]} was distributed.`);continue;}
  for(const d of due[r]){grant(room,playerById(room,d.id),r,d.n);incomes.push(d.n+' '+LABEL[r]);}
 }
 return incomes;
}
function roll(room,p){ready(room);ensure(isCurrent(room,p)&&room.phase==='roll','It is not your turn to roll.');const a=crypto.randomInt(1,7),b=crypto.randomInt(1,7);const total=a+b;room.lastRoll={a,b,total};
 log(room,`${p.avatar} ${p.name} rolled ${a} + ${b} = ${total}.`);
 if(total===7){room.discardNeeds={};for(const other of room.players){const n=sum(other.hand);if(n>7)room.discardNeeds[other.id]=Math.floor(n/2);}
  room.phase=Object.keys(room.discardNeeds).length?'discard':'robber';room.robberReturn='action';log(room,'The Corsair sails! Discard excess cargo, then relocate the Corsair.');
 }else {const incomes=produce(room,total);room.phase='action';if(!incomes.length)log(room,'No port produced supplies this turn.');}
 return room.lastRoll;
}
function discard(room,p,items){ensure(room.phase==='discard','No discards pending.');const n=room.discardNeeds[p.id];ensure(n,'You do not need to discard.');const take=normalize(items);ensure(sum(take)===n,`Select exactly ${n} cards.`);ensure(has(room,p,take),'You do not have those cards.');pay(room,p,take);delete room.discardNeeds[p.id];log(room,`${p.avatar} ${p.name} secured their remaining cargo.`);
 if(!Object.keys(room.discardNeeds).length)room.phase='robber';
}
function victims(room,p,hid){const h=room.board.hexes[hid];if(!h)return [];return room.players.filter(x=>x.id!==p.id&&sum(x.hand)>0&&h.vertices.some(v=>room.pieces.settlements[v]?.owner===x.id)).map(x=>({id:x.id,name:x.name}));}
function robber(room,p,hid,victimId){ensure(isCurrent(room,p)&&room.phase==='robber','Not your Corsair action.');hid=Number(hid);ensure(Number.isInteger(hid)&&hid>=0&&hid<room.board.hexes.length&&hid!==room.board.robber,'Choose a different island tile.');
 const candidates=victims(room,p,hid);if(candidates.length)ensure(candidates.some(x=>x.id===victimId),'Choose an adjacent player to take a random resource from.');else ensure(!victimId,'No target is available.');
 room.board.robber=hid;
 if(victimId){const victim=playerById(room,victimId),holding=RES.flatMap(r=>Array(victim.hand[r]).fill(r));if(holding.length){const r=holding[crypto.randomInt(holding.length)];victim.hand[r]--;p.hand[r]++;log(room,`${p.avatar} ${p.name} commandeered cargo from ${victim.avatar} ${victim.name}.`);}}
 else log(room,`${p.avatar} ${p.name} moved the Corsair to a new coast.`);
 room.phase=room.robberReturn||'action';room.robberReturn='action';recalculate(room);
}
function bankRate(room,p,r){let rate=4;for(const port of room.board.ports){const e=room.board.edges[port.edgeId];if((ownSettlement(room,p,e.a)||ownSettlement(room,p,e.b))&&(port.resource===r||port.resource==='any'))rate=Math.min(rate,port.resource===r?2:3);}return rate;}
function bankTrade(room,p,give,take){ensure(isCurrent(room,p)&&room.phase==='action','You can trade with the bank only on your turn.');ensure(RES.includes(give)&&RES.includes(take)&&give!==take,'Pick two different resources.');let rate=bankRate(room,p,give);ensure(p.hand[give]>=rate,`You need ${rate} ${LABEL[give]}.`);ensure(room.bank[take]>0,`The bank has no ${LABEL[take]} left.`);
 p.hand[give]-=rate;room.bank[give]+=rate;grant(room,p,take);log(room,`${p.avatar} ${p.name} traded ${rate} ${LABEL[give]} for 1 ${LABEL[take]} at the harbor.`);
}
function makeOffer(room,p,target,give,want){ensure(isCurrent(room,p)&&room.phase==='action','Offer trades on your turn.');ensure(!room.offer,'Resolve the current offer first.');const recipient=playerById(room,target);ensure(recipient.id!==p.id,'Cannot trade with yourself.');const offered=normalize(give),requested=normalize(want);ensure(sum(offered)>0&&sum(requested)>0,'Exchange at least one card each.');ensure(has(room,p,offered),'You do not have those cards.');ensure(has(room,recipient,requested),'The recipient does not have the requested resources.');room.offer={id:id(),from:p.id,to:recipient.id,give:offered,want:requested,createdAt:Date.now()};log(room,`${p.avatar} ${p.name} offered a trade to ${recipient.avatar} ${recipient.name}.`);return room.offer.id;}
function answerOffer(room,p,accept){const o=room.offer;ensure(o&&o.to===p.id,'No trade offer for you.');const from=playerById(room,o.from);
 if(accept){ensure(has(room,from,o.give)&&has(room,p,o.want),'One player no longer has the listed cargo.');for(const r of RES){from.hand[r]-=o.give[r];p.hand[r]+=o.give[r];p.hand[r]-=o.want[r];from.hand[r]+=o.want[r];}log(room,`${p.avatar} ${p.name} accepted ${from.avatar} ${from.name}'s trade.`);}
 else log(room,`${p.avatar} ${p.name} declined ${from.avatar} ${from.name}'s trade.`);
 room.offer=null;
}
function buyDev(room,p){ensure(isCurrent(room,p)&&room.phase==='action','Buy cards on your turn.');ensure(room.deck.length,'The discovery deck is empty.');pay(room,p,COST.dev);const type=room.deck.pop();p.dev.push({id:id(),type,bought:room.serialTurn});log(room,`${p.avatar} ${p.name} bought a discovery card.`);recalculate(room);}
function playDev(room,p,cardId,options={}){ensure(isCurrent(room,p)&&['roll','action'].includes(room.phase),'Not your chance to play a card.');ensure(!p.devPlayed,'Only one discovery card may be played per turn.');
 const index=p.dev.findIndex(c=>c.id===cardId);ensure(index>=0,'You do not have that card.');const card=p.dev[index];ensure(card.bought<room.serialTurn,'New cards cannot be played on the turn they are purchased.');ensure(card.type!=='point','Victory stars are counted automatically.');
 const prev=room.phase;let effect;
 if(card.type==='monopoly'){const resource=options.resource;ensure(RES.includes(resource),'Select the resource to collect.');let n=0;for(const other of room.players.filter(x=>x.id!==p.id)){n+=other.hand[resource];p.hand[resource]+=other.hand[resource];other.hand[resource]=0;}effect=`claimed ${n} ${LABEL[resource]} via a trading charter`;}
 if(card.type==='harvest'){const a=options.first,b=options.second;ensure(RES.includes(a)&&RES.includes(b),'Choose two supplies.');ensure(room.bank[a]>=(a===b?2:1)&&room.bank[b]>=(a===b?2:1),'The bank does not have both supplies.');grant(room,p,a);grant(room,p,b);effect='collected a harvest windfall';}
 if(card.type==='roads'){p.freeRoads+=2;effect='unlocked two free roads';}
 if(card.type==='knight'){p.army++;room.phase='robber';room.robberReturn=prev;effect='dispatched a Corsair patrol';}
 p.dev.splice(index,1);p.devPlayed=true;log(room,`${p.avatar} ${p.name} ${effect}.`);recalculate(room);
}
function longRoad(room,p){const own=new Set(Object.keys(room.pieces.roads).filter(e=>room.pieces.roads[e]===p.id).map(Number));let best=0;
 const walk=(v,used)=>{best=Math.max(best,used.size);if(used.size&&room.pieces.settlements[v]&&room.pieces.settlements[v].owner!==p.id)return;
 for(const eid of room.board.vertices[v].edges){if(!own.has(eid)||used.has(eid))continue;const e=room.board.edges[eid];used.add(eid);walk(e.a===v?e.b:e.a,used);used.delete(eid);}
 };
 for(const e of own){walk(room.board.edges[e].a,new Set());walk(room.board.edges[e].b,new Set());}
 return best;
}
function awardHolder(room,kind){const old=room.award[kind];let leader=null,best=kind==='road'?4:2;
 for(const p of room.players){let score=kind==='road'?longRoad(room,p):p.army;if(score>best){leader=p.id;best=score;}else if(score===best&&leader!==p.id){if(old===p.id)leader=p.id;else if(leader!==old)leader=null;}}
 if(leader===null&&old){const incumbent=room.players.find(p=>p.id===old);if(incumbent&&(kind==='road'?longRoad(room,incumbent):incumbent.army)===best)leader=old;}
 return leader;
}
function points(room,p){let n=p.cities*2+p.settlements+p.dev.filter(d=>d.type==='point').length;if(room.award.road===p.id)n+=2;if(room.award.army===p.id)n+=2;return n;}
function visiblePoints(room,p){let n=p.cities*2+p.settlements;if(room.award.road===p.id)n+=2;if(room.award.army===p.id)n+=2;return n;}
function recalculate(room){for(const k of ['road','army']){const next=awardHolder(room,k);if(next!==room.award[k]){room.award[k]=next;if(next)log(room,`${playerById(room,next).name} claimed ${k==='road'?'the Great Highway':'Admiral of the Fleet'} (+2 stars)!`);}}
 for(const p of room.players){if(points(room,p)>=10){room.status='finished';room.phase='finished';room.winner=p.id;log(room,`🏆 ${p.avatar} ${p.name} has won Hex Harbor with ${points(room,p)} victory stars!`);break;}}
}
function end(room,p){ensure(isCurrent(room,p)&&room.phase==='action','Finish your current action first.');if(room.offer){room.offer=null;log(room,'An unanswered trade offer expired.');}
 p.freeRoads=0;p.devPlayed=false;room.turnIndex=(room.turnIndex+1)%room.players.length;room.serialTurn++;room.phase='roll';room.lastRoll=null;
 log(room,`${current(room).avatar} ${current(room).name}'s turn. The dice await.`);
}
function publicState(room){return {code:room.code,status:room.status,phase:room.phase,board:room.board,pieces:room.pieces,players:room.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,bot:p.bot,connected:p.connected,color:p.color,roads:p.roads,settlements:p.settlements,cities:p.cities,army:p.army,handCount:sum(p.hand),devCount:p.dev.length,score:room.board?visiblePoints(room,p):0})),turnIndex:room.turnIndex,setupStep:room.setupStep,setupTotal:room.setupOrder.length,lastRoll:room.lastRoll,award:room.award,winner:room.winner,offerPending:!!room.offer,discardCount:Object.keys(room.discardNeeds).length,feed:room.feed.slice(0,15),updatedAt:room.updatedAt};}
function advisor(room,p){if(room.status!=='playing')return 'The island awaits its first explorers.';
 if(room.phase==='setup_settlement'&&isCurrent(room,p))return 'Choose an open crossroads touching productive numbers and a mix of resources.';
 if(room.phase==='setup_road'&&isCurrent(room,p))return 'Extend toward an unoccupied crossroads with strong resource tiles.';
 if(room.phase==='discard'&&room.discardNeeds[p.id])return 'Discard the exact number shown; try to preserve complete building recipes.';
 if(room.phase==='robber'&&isCurrent(room,p))return 'Block a productive rival tile and target an explorer carrying supplies.';
 if(!isCurrent(room,p))return 'Watch rival expansion, plan offers, and protect rare materials for your next turn.';
 if(room.phase==='roll')return 'Roll for harvest. Discovery cards purchased earlier may be played before rolling.';
 if(legalCities(room,p).length)return 'A city is available. Upgrading doubles the adjacent tile production and earns an extra star.';
 if(legalSettlements(room,p).length)return 'Build a new village: each adjacent productive tile adds potential income.';
 if(legalRoads(room,p).length)return 'An extension is affordable. Roads create future settlement locations and can earn the Great Highway bonus.';
 if(has(room,p,COST.dev)&&room.deck.length)return 'A discovery card can give you useful actions or a hidden victory star.';
 const rich=RES.find(r=>p.hand[r]>=bankRate(room,p,r));if(rich)return `You can exchange ${bankRate(room,p,rich)} ${LABEL[rich]} with the bank. Consider buying the material you need most.`;
 return 'A lean turn is fine. Trade, save resources, and plan toward your next construction.';
}
function privateState(room,p){return {id:p.id,hand:p.hand,dev:p.dev,score:room.board?points(room,p):0,phase:room.phase,turn:isCurrent(room,p),legal:{settlements:room.board?legalSettlements(room,p):[],roads:room.board?legalRoads(room,p):[],cities:room.board?legalCities(room,p):[]},cost:COST,offer:room.offer&&(room.offer.to===p.id||room.offer.from===p.id)?room.offer:null,discard:room.discardNeeds[p.id]||0,serialTurn:room.serialTurn,bank:room.bank,rates:room.board?Object.fromEntries(RES.map(r=>[r,bankRate(room,p,r)])):null,freeRoads:p.freeRoads,devPlayed:p.devPlayed,advisor:advisor(room,p)};}
function vertexScore(room,v){const vv=room.board.vertices[v];const a=vv.hexes.map(h=>room.board.hexes[h]);let diversity=new Set(a.filter(x=>x.terrain!=='desert').map(x=>x.terrain)).size;return a.reduce((s,h)=>s+(PIPS[h.number]||0),0)+diversity*1.4+Math.random()*1.5;}
function botAction(room,p){if(room.phase==='discard'&&room.discardNeeds[p.id]){const required=room.discardNeeds[p.id],counts=zero();for(let k=0;k<required;k++){const r=RES.slice().sort((a,b)=>(p.hand[b]-counts[b])-(p.hand[a]-counts[a]))[0];counts[r]++;}discard(room,p,counts);return true;}if(!isCurrent(room,p))return false;
 if(room.phase==='setup_settlement'){const ids=legalSettlements(room,p);ids.sort((a,b)=>vertexScore(room,b)-vertexScore(room,a));settlement(room,p,ids[0]);return true;}
 if(room.phase==='setup_road'){const ids=legalRoads(room,p);ids.sort((a,b)=>{const score=e=>{const edge=room.board.edges[e];const far=edge.a===room.setupLastVertex?edge.b:edge.a;return room.board.vertices[far].adj.reduce((s,x)=>s+vertexScore(room,x)*(!room.pieces.settlements[x]?1:0),0);};return score(b)-score(a);});road(room,p,ids[0]);return true;}
 if(room.phase==='roll'){roll(room,p);return true;}
 if(room.phase==='discard'&&room.discardNeeds[p.id]){const required=room.discardNeeds[p.id],counts=zero();for(let k=0;k<required;k++){const r=RES.slice().sort((a,b)=>(p.hand[b]-counts[b])-(p.hand[a]-counts[a]))[0];counts[r]++;}discard(room,p,counts);return true;}
 if(room.phase==='robber'){const options=room.board.hexes.filter(h=>h.id!==room.board.robber).map(h=>({h,v:victims(room,p,h.id)}));options.sort((a,b)=>b.v.length-a.v.length+(PIPS[b.h.number]||0)-(PIPS[a.h.number]||0));const best=options[0];robber(room,p,best.h.id,best.v[0]?.id);return true;}
 if(room.phase==='action'){
  if(room.offer){if(room.offer.to!==p.id)return false;const offered=room.offer.give,requested=room.offer.want;const accept=sum(offered)>=sum(requested)&&(sum(offered)>sum(requested)||crypto.randomInt(2)===0);answerOffer(room,p,accept);return true;}
  const cards=p.dev.filter(c=>c.bought<room.serialTurn&&c.type!=='point');
  if(!p.devPlayed&&cards.length&&p.army<3){const knight=cards.find(c=>c.type==='knight');if(knight){playDev(room,p,knight.id);return true;}}
  if(legalCities(room,p).length){city(room,p,legalCities(room,p)[0]);return true;}
  if(legalSettlements(room,p).length){const vs=legalSettlements(room,p).sort((a,b)=>vertexScore(room,b)-vertexScore(room,a));settlement(room,p,vs[0]);return true;}
  if(legalRoads(room,p).length&&p.roads<11&&(p.roads<=p.settlements*2+3||p.freeRoads>0)){
   const es=legalRoads(room,p).sort((a,b)=>Math.random()-.5);road(room,p,es[0]);return true;}
  if(has(room,p,COST.dev)&&room.deck.length&&p.dev.length<5){buyDev(room,p);return true;}
  const priority=['grain','wood','brick','wool','ore'];
  for(const give of RES){const rate=bankRate(room,p,give);if(p.hand[give]>=rate+1){for(const take of priority)if(take!==give&&room.bank[take]>0&&p.hand[take]<2){bankTrade(room,p,give,take);return true;}}}
  if(!p.devPlayed&&cards.length){const c=cards[0];if(c.type==='roads'&&legalRoads(room,p).length){playDev(room,p,c.id);return true;}if(c.type==='harvest'){const least=RES.slice().sort((a,b)=>p.hand[a]-p.hand[b]);const available=least.filter(r=>room.bank[r]>=1);if(available.length>=2){playDev(room,p,c.id,{first:available[0],second:available[1]});return true;}}if(c.type==='monopoly'){const counts=RES.map(r=>({r,n:room.players.filter(x=>x.id!==p.id).reduce((s,x)=>s+x.hand[r],0)})).sort((a,b)=>b.n-a.n);if(counts[0].n>=2){playDev(room,p,c.id,{resource:counts[0].r});return true;}}}
  end(room,p);return true;
 }
 return false;
}
module.exports={RES,ICON,LABEL,COST,makeBoard,makePlayer,createRoom,start,current,code,log,settlement,road,city,roll,discard,robber,victims,bankTrade,bankRate,makeOffer,answerOffer,buyDev,playDev,end,legalSettlements,legalRoads,legalCities,has,points,longRoad,publicState,privateState,botAction,ensure,sum,zero,normalize};