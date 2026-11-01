'use strict';
const crypto = require('node:crypto');

const AVATARS = ['🚀','🦊','🐼','🦄','🦁','🐸','🐙','🐧','🐱','🐻','🦋','🤖'];
const COLORS = ['#7cebb9','#ffbc71','#b5a2ff','#ff89aa','#7dc8fc','#ffe17e'];
const TILES = [
  {type:'start',name:'Central Square',icon:'✦'},
  {type:'property',name:'Maple Heights',group:'Neighborhood',price:80,rent:12,icon:'⌂'},
  {type:'news',name:'City Signal',icon:'✳'},
  {type:'property',name:'Canal District',group:'Neighborhood',price:100,rent:16,icon:'⌂'},
  {type:'tax',name:'City Services',amount:90,icon:'◆'},
  {type:'property',name:'Metro Loop',group:'Transit',price:150,rent:24,icon:'↗'},
  {type:'property',name:'Creative Quarter',group:'Culture',price:120,rent:20,icon:'◇'},
  {type:'property',name:'Arts Avenue',group:'Culture',price:140,rent:24,icon:'✧'},
  {type:'news',name:'Market Pulse',icon:'✳'},
  {type:'property',name:'Innovation Park',group:'Innovation',price:160,rent:28,icon:'⬡'},
  {type:'audit',name:'City Audit',icon:'⚑'},
  {type:'property',name:'Tech Row',group:'Innovation',price:180,rent:32,icon:'⬡'},
  {type:'property',name:'Skyline Labs',group:'Innovation',price:200,rent:35,icon:'⬡'},
  {type:'rest',name:'City Park',icon:'❀'},
  {type:'property',name:'Waterfront',group:'Waterfront',price:220,rent:38,icon:'≋'},
  {type:'news',name:'Breaking News',icon:'✳'},
  {type:'property',name:'Harbor Point',group:'Waterfront',price:240,rent:42,icon:'≋'},
  {type:'property',name:'Midtown East',group:'Commerce',price:260,rent:46,icon:'▣'},
  {type:'tax',name:'Luxury Levy',amount:140,icon:'◆'},
  {type:'property',name:'Gold Plaza',group:'Commerce',price:280,rent:50,icon:'▣'},
  {type:'property',name:'Union Station',group:'Transit',price:160,rent:26,icon:'↗'},
  {type:'property',name:'Emerald Mile',group:'Luxury',price:300,rent:56,icon:'✦'},
  {type:'news',name:'World Market',icon:'✳'},
  {type:'property',name:'Crown Heights',group:'Luxury',price:340,rent:64,icon:'✦'}
];
const GROUPS = {Neighborhood:'#76cfad',Transit:'#9ed2ef',Culture:'#e6a4d5',Innovation:'#9aa5ff',Waterfront:'#77cddd',Commerce:'#e7aa67',Luxury:'#e3ce70'};
const MARKET_EVENTS = [
  {headline:'The city approves a small-business grant.',detail:'Your portfolio receives a $120 boost.',effect:'cash',value:120},
  {headline:'A sudden supply-chain squeeze hits the market.',detail:'Pay $75 in operating costs.',effect:'cash',value:-75},
  {headline:'A neighborhood festival draws thousands downtown.',detail:'Collect $90 in new revenue.',effect:'cash',value:90},
  {headline:'The planning commission updates infrastructure.',detail:'Pay $45 in maintenance fees.',effect:'cash',value:-45},
  {headline:'Tourism is booming across Mogul City.',detail:'Every active player collects a $50 bonus.',effect:'all',value:50},
  {headline:'A citywide technology grant is approved.',detail:'Collect $110 in innovation incentives.',effect:'cash',value:110},
  {headline:'A surprise inspection closes a loophole.',detail:'Pay $60 in compliance costs.',effect:'cash',value:-60},
  {headline:'Good press sends your brand valuation higher.',detail:'Collect $130 in surprise earnings.',effect:'cash',value:130},
  {headline:'Public improvements lift the local economy.',detail:'Every active player collects $35.',effect:'all',value:35},
  {headline:'A temporary energy shortage drives up costs.',detail:'Pay $85 for utilities.',effect:'cash',value:-85}
];
const random = (n)=> crypto.randomInt(n);
const uid = ()=>crypto.randomBytes(12).toString('hex');
const newCode = ()=>Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[random(32)]).join('');
const safeName = (v)=>String(v||'').trim().replace(/[<>\x00-\x1f]/g,'').slice(0,18)||'Player';
const cash = (n)=> Math.max(0,Math.floor(Number(n)||0));
const auctionPrice = (tile)=> Math.ceil(tile.price*0.6/10)*10;
const isProperty = (id)=> TILES[id] && TILES[id].type==='property';
function createRoom(code=newCode(),hostToken=uid()){
  return {code,hostToken,players:[],status:'lobby',settings:{maxRounds:12},currentIndex:0,round:1,turn:0,phase:'await_roll',pendingTile:null,auction:null,offers:[],lastRoll:null,news:null,log:[{text:'Welcome to Mogul City. Your empire begins here.',at:Date.now()}],createdAt:Date.now(),updatedAt:Date.now(),winnerIds:[]};
}
function makePlayer(name,avatar,bot=false,strategy='balanced'){
  return {id:uid(),token:uid(),name:safeName(name),avatar:AVATARS.includes(avatar)?avatar:AVATARS[random(AVATARS.length)],bot,strategy,cash:1400,position:0,properties:[],upgrades:{},bankrupt:false,skip:0,connected:!!bot,turns:0};
}
function ownerOf(room,tileId){return room.players.find(p=>p.properties.includes(tileId))||null;}
function assetValue(p){return p.properties.reduce((sum,id)=>sum+TILES[id].price+Math.round(TILES[id].price*.5*(p.upgrades[id]||0)),0);}
function netWorth(p){return p.cash+assetValue(p);}
function ownedSet(p,group){return TILES.filter(t=>t.group===group).length===p.properties.filter(i=>TILES[i].group===group).length;}
function rentFor(room,id,owner){const tile=TILES[id];let rent=tile.rent*(1+2*(owner.upgrades[id]||0));if(ownedSet(owner,tile.group))rent=Math.round(rent*1.5);return rent;}
function upgradeCost(id){return Math.ceil(TILES[id].price*.55/10)*10;}
function log(room,message){room.log.unshift({text:message,at:Date.now()});room.log.length=Math.min(room.log.length,12);room.updatedAt=Date.now();}
function current(room){return room.players[room.currentIndex];}
function validPlayer(room,id){return room.players.find(p=>p.id===id&&!p.bankrupt);}
function settlePayment(room,p,amount,to){
  // Liquidate upgrades and then property at half book value before bankruptcy.
  let due=Math.max(0,Math.floor(amount));
  if(p.cash<due){
    for(const id of [...p.properties]){
      while((p.upgrades[id]||0)>0 && p.cash<due){p.upgrades[id]--;p.cash+=Math.floor(upgradeCost(id)*.5);log(room,`${p.name} sold a building to cover costs.`);}
    }
  }
  if(p.cash<due){
    for(const id of [...p.properties]){
      if(p.cash>=due)break;
      p.properties=p.properties.filter(x=>x!==id);delete p.upgrades[id];p.cash+=Math.floor(TILES[id].price*.5);log(room,`${p.name} liquidated ${TILES[id].name}.`);
    }
  }
  if(p.cash<due){
    const paid=p.cash;p.cash=0;p.bankrupt=true;
    p.properties.forEach(id=>{delete p.upgrades[id]});p.properties=[];
    if(to)to.cash+=paid;
    log(room,`${p.name} has gone bankrupt!`);
    return {paid,bankrupt:true};
  }
  p.cash-=due;if(to)to.cash+=due;return {paid:due,bankrupt:false};
}
function newsEvent(room,player){
  const evt=MARKET_EVENTS[random(MARKET_EVENTS.length)];
  room.news={headline:evt.headline,detail:evt.detail,at:Date.now()};
  if(evt.effect==='all')room.players.filter(p=>!p.bankrupt).forEach(p=>p.cash+=evt.value);
  else if(evt.value>=0)player.cash+=evt.value;
  else settlePayment(room,player,-evt.value);
  log(room,`CITY SIGNAL · ${evt.headline} ${evt.detail}`);
}
function finishIfReady(room){
  const survivors=room.players.filter(p=>!p.bankrupt);
  if(room.status!=='playing')return false;
  if(survivors.length<=1 || room.round>room.settings.maxRounds){
    room.status='finished';room.phase='finished';room.auction=null;room.pendingTile=null;
    const scores=survivors.length ? survivors : room.players;
    const best=Math.max(...scores.map(netWorth));room.winnerIds=scores.filter(p=>netWorth(p)===best).map(p=>p.id);
    log(room,`Game over! ${room.players.filter(p=>room.winnerIds.includes(p.id)).map(p=>p.name).join(' & ')} wins with the largest empire.`);return true;
  }
  return false;
}
function nextTurn(room){
  if(room.status!=='playing')return;
  room.turn++;
  let safety=0;
  do{
    room.currentIndex=(room.currentIndex+1)%room.players.length;
    if(room.currentIndex===0)room.round++;
    if(finishIfReady(room))return;
    safety++;
  }while(room.players[room.currentIndex].bankrupt&&safety<room.players.length+1);
  room.phase='await_roll';room.pendingTile=null;room.lastRoll=null;room.news=null;
  const p=current(room);p.turns++;
  log(room,`It's ${p.name}'s turn. The city is watching.`);
}
function roll(room,p,forcedDice){
  if(room.status!=='playing'||room.phase!=='await_roll'||current(room)?.id!==p.id||p.bankrupt)throw Error('Not your turn to roll.');
  if(p.skip>0){p.skip--;log(room,`${p.name} sat through a city audit. Their next turn is clear.`);nextTurn(room);return;}
  const dice=forcedDice||[random(6)+1,random(6)+1];
  if(!Array.isArray(dice)||dice.length!==2||dice.some(x=>!Number.isInteger(x)||x<1||x>6))throw Error('Invalid dice.');
  const old=p.position,pips=dice[0]+dice[1];p.position=(old+pips)%TILES.length;
  if(old+pips>=TILES.length){p.cash+=200;log(room,`${p.name} passed Central Square and collected $200.`);}
  room.lastRoll={playerId:p.id,dice,at:Date.now(),landed:p.position};
  const tile=TILES[p.position];log(room,`${p.name} rolled ${pips} and landed on ${tile.name}.`);
  if(tile.type==='property'){
    const owner=ownerOf(room,p.position);
    if(!owner){room.phase='buy';room.pendingTile=p.position;return;}
    if(owner.id!==p.id){const amount=rentFor(room,p.position,owner);settlePayment(room,p,amount,owner);log(room,`${p.name} paid ${owner.name} $${amount} in rent.`);}
  } else if(tile.type==='tax') {settlePayment(room,p,tile.amount);log(room,`${p.name} paid $${tile.amount} in city taxes.`);}
  else if(tile.type==='news'){newsEvent(room,p);}
  else if(tile.type==='audit') {settlePayment(room,p,60);log(room,`${p.name} paid a $60 audit penalty.`);}
  else if(tile.type==='rest'){p.cash+=50;log(room,`${p.name} took a breather at City Park and collected $50.`);}
  room.phase='end';finishIfReady(room);
}
function buy(room,p){
  if(room.status!=='playing'||room.phase!=='buy'||current(room)?.id!==p.id||room.pendingTile===null)throw Error('No property to buy.');
  const id=room.pendingTile,tile=TILES[id];if(ownerOf(room,id))throw Error('Already owned.');
  if(p.cash<tile.price)throw Error('Not enough money. Try an auction.');
  p.cash-=tile.price;p.properties.push(id);room.pendingTile=null;room.phase='end';log(room,`${p.name} acquired ${tile.name} for $${tile.price}!`);finishIfReady(room);
}
function beginAuction(room){
  if(room.status!=='playing'||room.phase!=='buy'||room.pendingTile===null)throw Error('Nothing to auction.');
  const id=room.pendingTile;room.pendingTile=null;room.phase='auction';
  room.auction={tileId:id,bids:{},endsAt:Date.now()+20000};log(room,`${TILES[id].name} is up for sealed auction. Place your best bid!`);
}
function bid(room,p,amount){
  if(room.status!=='playing'||room.phase!=='auction'||!room.auction||Date.now()>room.auction.endsAt)throw Error('Auction is closed.');
  if(p.bankrupt)throw Error('Bankrupt investors cannot bid.');
  const n=Math.floor(Number(amount));if(!Number.isSafeInteger(n)||n<auctionPrice(TILES[room.auction.tileId])||n>p.cash)throw Error(`Bid at least $${auctionPrice(TILES[room.auction.tileId])}, up to your balance.`);
  room.auction.bids[p.id]=n;log(room,`${p.name} submitted a sealed bid.`);
}
function settleAuction(room){
  if(room.phase!=='auction'||!room.auction)return;
  const {tileId,bids}=room.auction;
  const options=Object.entries(bids).map(([id,value])=>({player:validPlayer(room,id),value})).filter(x=>x.player&&x.player.cash>=x.value).sort((a,b)=>b.value-a.value);
  const winner=options[0];room.auction=null;room.phase='end';
  if(winner){winner.player.cash-=winner.value;winner.player.properties.push(tileId);log(room,`${winner.player.name} won ${TILES[tileId].name} for $${winner.value}!`);}
  else log(room,`No qualified bids. ${TILES[tileId].name} remains on the market.`);
}
function upgrade(room,p,id){
  id=Number(id);if(room.status!=='playing'||p.bankrupt)throw Error('Game is not active.');
  if(!p.properties.includes(id))throw Error('You do not own that location.');
  const level=p.upgrades[id]||0,cost=upgradeCost(id);if(level>=3)throw Error('Maximum development reached.');
  if(p.cash<cost)throw Error(`You need $${cost} to develop this location.`);
  p.cash-=cost;p.upgrades[id]=level+1;log(room,`${p.name} developed ${TILES[id].name} to level ${level+1}.`);
}
function makeOffer(room,p,details){
  if(room.status!=='playing'||p.bankrupt)throw Error('Game is not active.');
  const to=validPlayer(room,String(details.to||''));if(!to||to.id===p.id)throw Error('Choose another active investor.');
  const give=details.give===''||details.give==null?null:Number(details.give);
  const want=details.want===''||details.want==null?null:Number(details.want);
  const pay=cash(details.pay),receive=cash(details.receive);
  if((give===null&&want===null&&pay===0&&receive===0)||(give===null&&want===null&&pay===receive))throw Error('Add at least one meaningful exchange.');
  if(give!==null&&!p.properties.includes(give))throw Error('You do not own that property.');
  if(want!==null&&!to.properties.includes(want))throw Error('They do not own that property.');
  if(pay>p.cash||receive>to.cash)throw Error('Cash offer exceeds an available balance.');
  if(room.offers.some(o=>o.from===p.id&&o.to===to.id))throw Error('You already have an outstanding offer to this player.');
  const offer={id:uid(),from:p.id,to:to.id,give,want,pay,receive,createdAt:Date.now()};room.offers.push(offer);
  log(room,`${p.name} sent a private deal to ${to.name}.`);return offer;
}
function respondOffer(room,p,offerId,accept){
  const offer=room.offers.find(o=>o.id===offerId&&o.to===p.id);if(!offer)throw Error('Offer no longer available.');
  room.offers=room.offers.filter(o=>o.id!==offerId);
  const from=validPlayer(room,offer.from);if(!from)throw Error('The other player left the market.');
  if(!accept){log(room,`${p.name} declined an offer from ${from.name}.`);return;}
  if(offer.give!==null&&!from.properties.includes(offer.give)||offer.want!==null&&!p.properties.includes(offer.want)||from.cash<offer.pay||p.cash<offer.receive)throw Error('That offer is no longer affordable or valid.');
  from.cash=from.cash-offer.pay+offer.receive;p.cash=p.cash-offer.receive+offer.pay;
  if(offer.give!==null){from.properties=from.properties.filter(id=>id!==offer.give);p.properties.push(offer.give);p.upgrades[offer.give]=from.upgrades[offer.give]||0;delete from.upgrades[offer.give];}
  if(offer.want!==null){p.properties=p.properties.filter(id=>id!==offer.want);from.properties.push(offer.want);from.upgrades[offer.want]=p.upgrades[offer.want]||0;delete p.upgrades[offer.want];}
  log(room,`${p.name} and ${from.name} closed a property trade.`);
}
function advice(room,p){
  if(room.status!=='playing')return 'Your city is almost ready. Invite friends and plan your opening move.';
  const open=TILES.map((t,id)=>({t,id})).filter(x=>x.t.type==='property'&&!ownerOf(room,x.id));
  const owned=p.properties.map(i=>({id:i,t:TILES[i]}));
  const up=owned.filter(x=>(p.upgrades[x.id]||0)<3&&upgradeCost(x.id)<=p.cash-180).sort((a,b)=>rentFor(room,b.id,p)/upgradeCost(b.id)-rentFor(room,a.id,p)/upgradeCost(a.id));
  if(p.bankrupt)return 'Your empire has closed. Spectate the surviving investors and study their positions.';
  if(p.cash<200)return `Protect your liquidity. You have $${p.cash}, so focus on rent, passing Central Square, or negotiating a trade.`;
  if(up.length)return `Consider developing ${up[0].t.name} for $${upgradeCost(up[0].id)}. Development raises rent, and you'll still have a cash buffer.`;
  if(open.length)return `There are ${open.length} unowned locations. Keep roughly $200 available for surprise taxes and rent while you expand.`;
  return `Your portfolio is worth $${netWorth(p)}. Look for smart trades, full district ownership, and upgrades before the final round.`;
}
function botWants(room,p,id){const t=TILES[id];const reserve=p.strategy==='conservative'?480:p.strategy==='aggressive'?130:280;const premium=t.rent/t.price;if(p.cash-t.price<reserve)return false;return p.strategy==='aggressive'||premium>.12||ownedSet(p,t.group);}
function botBid(room,p,id){const t=TILES[id];const value=t.price*(p.strategy==='aggressive'?1.03:p.strategy==='conservative'?.7:.87);return Math.min(p.cash-180,Math.floor(value/10)*10);}
function publicState(room){
  return {code:room.code,status:room.status,settings:room.settings,players:room.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,color:COLORS[room.players.indexOf(p)%COLORS.length],cash:p.cash,position:p.position,properties:p.properties,upgrades:p.upgrades,bankrupt:p.bankrupt,connected:p.connected,bot:p.bot,netWorth:netWorth(p)})),currentId:room.status==='playing'?current(room)?.id:null,phase:room.phase,round:room.round,turn:room.turn,pendingTile:room.pendingTile,auction:room.auction?{tileId:room.auction.tileId,endsAt:room.auction.endsAt,bidCount:Object.keys(room.auction.bids).length}:null,lastRoll:room.lastRoll,news:room.news,log:room.log.slice(0,8),winnerIds:room.winnerIds,tiles:TILES,groups:GROUPS,limits:{players:6}};
}
function privateState(room,p){return {you:{id:p.id,properties:p.properties,upgrades:p.upgrades,cash:p.cash,netWorth:netWorth(p)},offers:room.offers.filter(o=>o.to===p.id||o.from===p.id),bid:room.auction?.bids[p.id]||null,advice:advice(room,p)};}
module.exports={AVATARS,COLORS,TILES,GROUPS,MARKET_EVENTS,random,uid,newCode,safeName,cash,auctionPrice,createRoom,makePlayer,ownerOf,assetValue,netWorth,ownedSet,rentFor,upgradeCost,log,current,validPlayer,settlePayment,newsEvent,finishIfReady,nextTurn,roll,buy,beginAuction,bid,settleAuction,upgrade,makeOffer,respondOffer,advice,botWants,botBid,publicState,privateState};