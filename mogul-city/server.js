'use strict';
const express=require('express');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const QRCode=require('qrcode');
const {Server}=require('socket.io');
const G=require('./game');
const PORT=Number(process.env.PORT||3000);
const app=express();
const httpServer=http.createServer(app);
const io=new Server(httpServer,{pingTimeout:20000,pingInterval:24000,maxHttpBufferSize:16384});
const rooms=new Map(),auctionTimers=new Map(),botTimers=new Map();
let redis=null,saveTimer=null;
const storeFile=path.join(__dirname,'.sessions.json');
const socketRoom=(code)=>`room:${code}`;
const playerRoom=(code,id)=>`player:${code}:${id}`;
function reply(ack,answer){if(typeof ack==='function')ack(answer);}
function fail(ack,error){reply(ack,{ok:false,error:String(error?.message||error).slice(0,160)});}
function checkHost(socket,room){if(!room||socket.data.role!=='host'||socket.data.code!==room.code||socket.data.key!==room.hostToken)throw Error('Host access required.');}
function checkPlayer(socket,room){const player=room?.players.find(p=>p.id===socket.data.id&&p.token===socket.data.key);if(!player||socket.data.code!==room.code||socket.data.role!=='player')throw Error('Join this room on your phone first.');return player;}
function roomFor(socket){const room=rooms.get(socket.data.code);if(!room)throw Error('Room is no longer available.');return room;}
function connected(room,p){return !!io.sockets.adapter.rooms.get(playerRoom(room.code,p.id))?.size;}
function broadcast(room){
  room.players.forEach(p=>{if(!p.bot)p.connected=connected(room,p);});
  io.to(socketRoom(room.code)).emit('room:state',G.publicState(room));
  room.players.filter(p=>!p.bot).forEach(p=>io.to(playerRoom(room.code,p.id)).emit('player:state',G.privateState(room,p)));
}
function snapshot(){return JSON.stringify(Array.from(rooms.values()).map(room=>({...room,offers:room.offers.slice(-20)})));}
function persist(){
  if(saveTimer)clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    saveTimer=null;const data=snapshot();
    try{fs.writeFileSync(storeFile,data);}catch(e){console.warn('Snapshot file:',e.message);}
    if(redis){try{await redis.set('mogul-city:rooms',data);}catch(e){console.warn('Redis save:',e.message);}}
  },220);
}
function changed(room){room.updatedAt=Date.now();broadcast(room);persist();if(room.phase==='auction')scheduleAuction(room);else if(room.status==='playing')scheduleBot(room);}
function scheduleAuction(room){
  const a=room.auction;if(!a)return;
  const key=`${room.code}:${a.tileId}:${a.endsAt}`;if(auctionTimers.has(key))return;
  const timeout=setTimeout(()=>{auctionTimers.delete(key);if(room.auction?.endsAt===a.endsAt&&room.phase==='auction'){G.settleAuction(room);changed(room);}},Math.max(50,a.endsAt-Date.now()+90));
  auctionTimers.set(key,timeout);
}
function botAuction(room){
  if(!room.auction)return;
  const tileId=room.auction.tileId;
  for(const bot of room.players.filter(p=>p.bot&&!p.bankrupt)){
    const amount=G.botBid(room,bot,tileId);if(amount>=G.auctionPrice(G.TILES[tileId]))room.auction.bids[bot.id]=amount;
  }
}
function scheduleBot(room){
  if(room.status!=='playing'||room.phase==='auction')return;
  const bot=G.current(room);
  if(!bot?.bot||botTimers.has(room.code))return;
  const timer=setTimeout(()=>{
    botTimers.delete(room.code);
    if(room.status!=='playing'||G.current(room)?.id!==bot.id)return;
    try{
      if(room.phase==='await_roll')G.roll(room,bot);
      else if(room.phase==='buy'){
        if(G.botWants(room,bot,room.pendingTile))G.buy(room,bot);
        else {G.beginAuction(room);botAuction(room);}
      }else if(room.phase==='end')G.nextTurn(room);
      changed(room);
    }catch(err){console.warn('Bot error:',err.message);}
  },room.phase==='await_roll'?1200:900);
  botTimers.set(room.code,timer);
}
function getRoom(code){return rooms.get(String(code||'').toUpperCase().trim());}
function setupSocket(socket,room,role,key,id){
  if(socket.data.code){socket.leave(socketRoom(socket.data.code));if(socket.data.id)socket.leave(playerRoom(socket.data.code,socket.data.id));}
  socket.data={code:room.code,role,key,id,lastCommandAt:0,cmdCount:0};
  socket.join(socketRoom(room.code));if(id)socket.join(playerRoom(room.code,id));
}
async function restore(){
  let data;
  if(process.env.REDIS_URL){
    try{const Redis=require('ioredis');redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,lazyConnect:true,connectTimeout:5000});await redis.connect();data=await redis.get('mogul-city:rooms');console.log('Redis room persistence active.');}
    catch(err){console.warn('Redis not connected:',err.message);redis?.disconnect();redis=null;}
  }
  if(!data){try{data=fs.readFileSync(storeFile,'utf8');}catch{}}
  if(data){try{const recovered=JSON.parse(data);for(const room of recovered){if(room.updatedAt>Date.now()-1000*60*60*24&&room.code&&room.hostToken){rooms.set(room.code,room);room.players.forEach(p=>{if(!p.bot)p.connected=false;});}}console.log('Recovered rooms:',rooms.size);}catch(err){console.warn('Could not recover snapshot:',err.message);}}
  for(const room of rooms.values()){if(room.phase==='auction')scheduleAuction(room);if(room.status==='playing')scheduleBot(room);}
}
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cache-Control','no-store');next();});
app.get('/health',(req,res)=>res.json({ok:true,game:'mogul-city',activeRooms:rooms.size,storage:redis?'redis':'ephemeral'}));
app.get('/qr/:code.png',async(req,res)=>{const room=getRoom(req.params.code);if(!room){res.status(404).end();return;}try{const url=`${req.protocol}://${req.get('host')}/?room=${room.code}`;const png=await QRCode.toBuffer(url,{width:360,margin:2,color:{dark:'#13243d',light:'#ffffff'}});res.type('png').send(png);}catch{res.status(500).end();}});
app.use(express.static(path.join(__dirname,'public'),{extensions:['html'],maxAge:0}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

io.on('connection',socket=>{
  function action(event,handler){socket.on(event,(payload={},ack)=>{
    try{
      const now=Date.now();if(now-(socket.data.lastCommandAt||0)>1000){socket.data.lastCommandAt=now;socket.data.cmdCount=0;}if(++socket.data.cmdCount>14)throw Error('Too many requests.');
      const result=handler(payload||{});reply(ack,{ok:true,...(result||{})});
    }catch(e){fail(ack,e);}
  });}
  action('host:create',({maxRounds=12}={})=>{
    let code;do{code=G.newCode();}while(rooms.has(code));
    const room=G.createRoom(code);room.settings.maxRounds=[8,12,16].includes(Number(maxRounds))?Number(maxRounds):12;rooms.set(code,room);setupSocket(socket,room,'host',room.hostToken,null);changed(room);
    return {code,hostToken:room.hostToken};
  });
  action('host:resume',({code,hostToken})=>{
    const room=getRoom(code);if(!room||room.hostToken!==hostToken)throw Error('Cannot restore host session.');
    setupSocket(socket,room,'host',hostToken,null);broadcast(room);return {code:room.code};
  });
  action('host:bot',({name,strategy}={})=>{
    const room=roomFor(socket);checkHost(socket,room);if(room.status!=='lobby')throw Error('Bots may only join before the game.');if(room.players.length>=6)throw Error('The room is full.');
    const presets=[['NOVA','🤖','aggressive'],['ATLAS','🦊','conservative'],['BYTE','🐼','balanced'],['ECHO','🦁','aggressive']];
    const entry=presets[room.players.filter(p=>p.bot).length%presets.length];const p=G.makePlayer(name||entry[0],entry[1],true,strategy||entry[2]);room.players.push(p);G.log(room,`${p.name}, an AI investor, joined the table.`);changed(room);return {id:p.id};
  });
  action('host:removeBot',({id})=>{const room=roomFor(socket);checkHost(socket,room);if(room.status!=='lobby')throw Error('Game has started.');const p=room.players.find(p=>p.id===id&&p.bot);if(!p)throw Error('No such bot.');room.players=room.players.filter(x=>x.id!==id);changed(room);});
  action('host:settings',({maxRounds})=>{const room=roomFor(socket);checkHost(socket,room);if(room.status!=='lobby')throw Error('Game already started.');const n=Number(maxRounds);if(![8,12,16].includes(n))throw Error('Pick 8, 12, or 16 rounds.');room.settings.maxRounds=n;changed(room);});
  action('host:start',()=>{
    const room=roomFor(socket);checkHost(socket,room);if(room.status!=='lobby')throw Error('Game is already started.');if(room.players.length<2)throw Error('Need at least 2 players (humans or bots).');
    room.players.forEach(p=>{p.cash=1400;p.position=0;p.properties=[];p.upgrades={};p.bankrupt=false;p.skip=0;p.turns=0;});
    room.status='playing';room.phase='await_roll';room.round=1;room.turn=0;room.currentIndex=0;room.pendingTile=null;room.auction=null;room.offers=[];room.lastRoll=null;room.news=null;room.winnerIds=[];
    G.log(room,`Welcome to Mogul City! ${room.players.length} investors, ${room.settings.maxRounds} rounds, one crown.`);changed(room);
  });
  action('host:restart',()=>{
    const room=roomFor(socket);checkHost(socket,room);room.status='lobby';room.phase='await_roll';room.auction=null;room.offers=[];room.winnerIds=[];room.round=1;room.currentIndex=0;room.pendingTile=null;G.log(room,'The mayor has opened a new game lobby.');changed(room);
  });
  action('player:join',({code,name,avatar,token})=>{
    const room=getRoom(code);if(!room)throw Error('Room not found. Check the code on the TV.');
    if(token){const prior=room.players.find(p=>!p.bot&&p.token===token);if(prior){setupSocket(socket,room,'player',prior.token,prior.id);changed(room);return {code:room.code,token:prior.token,playerId:prior.id};}}
    if(room.status!=='lobby')throw Error('This game has already started. Rejoin with your original phone.');if(room.players.length>=6)throw Error('This room has reached six players.');
    const p=G.makePlayer(name,avatar,false);room.players.push(p);setupSocket(socket,room,'player',p.token,p.id);G.log(room,`${p.name} has arrived in the city.`);changed(room);return {code:room.code,token:p.token,playerId:p.id};
  });
  action('player:resume',({code,token})=>{
    const room=getRoom(code),p=room?.players.find(x=>!x.bot&&x.token===token);if(!p)throw Error('Your session expired. Use the room code to join a new game.');setupSocket(socket,room,'player',p.token,p.id);changed(room);return {code:room.code,token:p.token,playerId:p.id};
  });
  action('game:roll',()=>{const room=roomFor(socket),p=checkPlayer(socket,room);G.roll(room,p);if(p.bankrupt&&room.phase==='end')G.nextTurn(room);changed(room);});
  action('game:buy',()=>{const room=roomFor(socket),p=checkPlayer(socket,room);G.buy(room,p);changed(room);});
  action('game:decline',()=>{const room=roomFor(socket),p=checkPlayer(socket,room);if(room.phase!=='buy'||G.current(room).id!==p.id)throw Error('Not your property decision.');G.beginAuction(room);botAuction(room);changed(room);});
  action('game:end',()=>{const room=roomFor(socket),p=checkPlayer(socket,room);if(room.status!=='playing'||room.phase!=='end'||G.current(room).id!==p.id)throw Error('Finish your active decision first.');G.nextTurn(room);changed(room);});
  action('game:upgrade',({id})=>{const room=roomFor(socket),p=checkPlayer(socket,room);G.upgrade(room,p,id);changed(room);});
  action('auction:bid',({amount})=>{const room=roomFor(socket),p=checkPlayer(socket,room);G.bid(room,p,amount);changed(room);});
  action('trade:offer',data=>{
    const room=roomFor(socket),p=checkPlayer(socket,room);const offer=G.makeOffer(room,p,data);
    const to=room.players.find(x=>x.id===offer.to);
    if(to?.bot){setTimeout(()=>{
      if(!room.offers.some(o=>o.id===offer.id))return;
      try{
        const giveVal=offer.want===null?0:G.TILES[offer.want].price*(1+.3*(to.upgrades[offer.want]||0));
        const gainVal=offer.give===null?0:G.TILES[offer.give].price*(1+.3*(p.upgrades[offer.give]||0));
        const accept=gainVal+offer.pay>=giveVal+offer.receive+(to.strategy==='conservative'?35:0);
        G.respondOffer(room,to,offer.id,accept);changed(room);
      }catch(e){console.warn('Bot trade:',e.message);}
    },1100);}changed(room);return {offerId:offer.id};
  });
  action('trade:respond',({offerId,accept})=>{const room=roomFor(socket),p=checkPlayer(socket,room);G.respondOffer(room,p,offerId,accept===true);changed(room);});
  socket.on('disconnect',()=>{
    const room=rooms.get(socket.data.code);
    if(room){setTimeout(()=>{if(rooms.get(room.code)===room){broadcast(room);persist();}},50);}
  });
});

setInterval(()=>{
  const cutoff=Date.now()-24*60*60*1000;
  for(const [code,room] of rooms){if(room.updatedAt<cutoff&&!io.sockets.adapter.rooms.get(socketRoom(code))?.size){rooms.delete(code);}}
  for(const room of rooms.values())room.offers=room.offers.filter(o=>Date.now()-o.createdAt<180000);
},60000).unref();
restore().then(()=>httpServer.listen(PORT,'0.0.0.0',()=>console.log(`Mogul City serving on http://0.0.0.0:${PORT}`))).catch(err=>{console.error(err);process.exit(1);});
module.exports={app,httpServer,rooms};