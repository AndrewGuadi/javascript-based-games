'use strict';
const express=require('express');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const QRCode=require('qrcode');
const {Server}=require('socket.io');
const G=require('./game');
const app=express();const server=http.createServer(app);
const io=new Server(server,{pingTimeout:20000,pingInterval:24000,maxHttpBufferSize:12288});
const PORT=Number(process.env.PORT||3000);
const rooms=new Map(),botTimers=new Map();
const savePath=path.join(__dirname,'.island-sessions.json');
let redis=null,saveTimer=null;
const publicChannel=c=>`h:${c}`;
const privateChannel=(c,p)=>`h:${c}:${p}`;
function fail(reply,error){if(typeof reply==='function')reply({ok:false,error:String(error?.message||error).slice(0,180)});}
function ok(reply,data){if(typeof reply==='function')reply({ok:true,...data});}
function lookup(code){return rooms.get(String(code||'').trim().toUpperCase());}
function roomFor(socket){const r=rooms.get(socket.data.code);G.ensure(r,'Room no longer exists.');return r;}
function checkHost(socket,r){G.ensure(socket.data.role==='host'&&socket.data.code===r.code&&socket.data.token===r.hostToken,'Host permissions required.');}
function checkPlayer(socket,r){G.ensure(socket.data.role==='player'&&socket.data.code===r.code,'Join on your phone first.');const p=r.players.find(p=>!p.bot&&p.id===socket.data.playerId&&p.token===socket.data.token);G.ensure(p,'Player session not found.');return p;}
function connected(r,p){return Boolean(io.sockets.adapter.rooms.get(privateChannel(r.code,p.id))?.size);}
function announce(r){for(const p of r.players){if(!p.bot)p.connected=connected(r,p);}io.to(publicChannel(r.code)).emit('room:state',G.publicState(r));for(const p of r.players.filter(p=>!p.bot))io.to(privateChannel(r.code,p.id)).emit('player:state',G.privateState(r,p));}
function scheduleSave(){if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{saveTimer=null;const data=JSON.stringify([...rooms.values()]);try{fs.writeFileSync(savePath,data);}catch(e){console.warn('Local save:',e.message);}if(redis){try{await redis.set('hex-harbor:rooms',data);}catch(e){console.warn('Remote save:',e.message);}}},200);}
function changed(r){r.updatedAt=Date.now();announce(r);scheduleSave();scheduleBot(r);}
function scheduleBot(r){if(r.status!=='playing'||botTimers.has(r.code))return;
 const pending=r.phase==='discard'?r.players.find(p=>p.bot&&r.discardNeeds[p.id]):null;
 const recipient=r.offer?r.players.find(p=>p.id===r.offer.to&&p.bot):null;
 const actor=pending||recipient||G.current(r)?.bot&&G.current(r);
 if(!actor)return;
 const timer=setTimeout(()=>{botTimers.delete(r.code);if(r.status!=='playing')return;
  try{if(r.offer&&r.offer.to===actor.id){const give=G.sum(r.offer.give),want=G.sum(r.offer.want);G.answerOffer(r,actor,give>want||(give===want&&Math.random()>.3));changed(r);return;}
   if(G.botAction(r,actor))changed(r);
  }catch(err){console.warn('Explorer AI:',err.message);if(r.phase==='action'&&G.current(r)?.id===actor.id){try{G.end(r,actor);changed(r);}catch{}}}
 },r.phase.startsWith('setup')?530:850);botTimers.set(r.code,timer);
}
function bind(socket,r,role,token,playerId=null){if(socket.data.code){socket.leave(publicChannel(socket.data.code));if(socket.data.playerId)socket.leave(privateChannel(socket.data.code,socket.data.playerId));}
 socket.data={code:r.code,role,token,playerId,rateAt:0,rateCount:0};socket.join(publicChannel(r.code));if(playerId)socket.join(privateChannel(r.code,playerId));}
async function restore(){let raw=null;
 if(process.env.REDIS_URL){try{const Redis=require('ioredis');redis=new Redis(process.env.REDIS_URL,{lazyConnect:true,connectTimeout:5000,maxRetriesPerRequest:1});await redis.connect();raw=await redis.get('hex-harbor:rooms');console.log('Persistent key-value connected.');}catch(e){console.warn('Redis unavailable:',e.message);redis?.disconnect();redis=null;}}
 if(!raw){try{raw=fs.readFileSync(savePath,'utf8');}catch{}}
 if(raw){try{for(const r of JSON.parse(raw))if(r.code&&r.hostToken&&r.updatedAt>Date.now()-86400000){r.players.forEach(p=>{if(!p.bot)p.connected=false;});rooms.set(r.code,r);}console.log(`Restored ${rooms.size} rooms.`);}catch(e){console.warn('Failed to restore:',e.message);}}
 for(const r of rooms.values())scheduleBot(r);
}
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cache-Control','no-store');next();});
app.get('/health',(req,res)=>res.json({ok:true,app:'hex-harbor',rooms:rooms.size,persistence:redis?'redis':'ephemeral'}));
app.get('/qr/:code.png',async(req,res)=>{const r=lookup(req.params.code);if(!r)return res.status(404).end();try{let url=`${req.protocol}://${req.get('host')}/?room=${r.code}`;res.type('png').send(await QRCode.toBuffer(url,{width:380,margin:2,color:{dark:'#163647',light:'#ffffff'}}));}catch{res.status(500).end();}});
app.use(express.static(path.join(__dirname,'public'),{maxAge:0}));app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));
io.on('connection',socket=>{
 function action(event,handler){socket.on(event,(data={},reply)=>{try{
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid request.');
  const now=Date.now();if(now-(socket.data.rateAt||0)>=1000){socket.data.rateAt=now;socket.data.rateCount=0;}G.ensure(++socket.data.rateCount<=16,'Too many requests.');
  const result=handler(data)||{};ok(reply,result);
 }catch(e){fail(reply,e);}});}
 action('host:create',()=>{G.ensure(rooms.size<1000,'Room capacity reached.');let roomCode;do{roomCode=G.code();}while(rooms.has(roomCode));const r=G.createRoom(roomCode);rooms.set(roomCode,r);bind(socket,r,'host',r.hostToken);changed(r);return {code:r.code,hostToken:r.hostToken};});
 action('host:resume',({code,hostToken})=>{const r=lookup(code);G.ensure(r&&r.hostToken===hostToken,'Host key not found.');bind(socket,r,'host',hostToken);announce(r);return {code:r.code};});
 action('host:bot',({name,avatar,style})=>{const r=roomFor(socket);checkHost(socket,r);G.ensure(r.status==='lobby','Add bots before starting.');G.ensure(r.players.length<4,'Four explorer maximum.');const patterns=[['Captain Birch','🦊','balanced'],['Mist Wren','🦉','greedy'],['Old Marlow','🐻','cautious']];const [n,a,s]=patterns[r.players.filter(p=>p.bot).length%3];const p=G.makePlayer(name||n,avatar||a,true,style||s);r.players.push(p);G.log(r,`${p.avatar} ${p.name} entered as a computer explorer.`);changed(r);return {id:p.id};});
 action('host:removeBot',({id})=>{const r=roomFor(socket);checkHost(socket,r);G.ensure(r.status==='lobby','Cannot remove during play.');G.ensure(r.players.some(p=>p.bot&&p.id===id),'Unknown computer player.');r.players=r.players.filter(p=>p.id!==id);changed(r);});
 action('host:start',()=>{const r=roomFor(socket);checkHost(socket,r);G.start(r);changed(r);});
 action('host:restart',()=>{const r=roomFor(socket);checkHost(socket,r);r.status='lobby';r.phase='lobby';r.board=null;r.offer=null;r.winner=null;r.feed=[];G.log(r,'The island awaits a fresh expedition.');changed(r);});
 action('host:takeover',({id})=>{const r=roomFor(socket);checkHost(socket,r);G.ensure(r.status==='playing','Game has not started.');const p=r.players.find(p=>p.id===id&&!p.bot);G.ensure(p&&!connected(r,p),'You can take over only disconnected players.');p.bot=true;p.token=G.code()+G.code();G.log(r,`${p.avatar} ${p.name}'s abandoned seat is now AI controlled.`);changed(r);});
 action('player:join',({code,name,avatar,token})=>{const r=lookup(code);G.ensure(r,'Room not found. Check the TV code.');
  if(token){const p=r.players.find(x=>!x.bot&&x.token===token);if(p){bind(socket,r,'player',p.token,p.id);changed(r);return {code:r.code,token:p.token,id:p.id};}}
  G.ensure(r.status==='lobby','Match underway. Rejoin from the original phone.');G.ensure(r.players.length<4,'The island is full.');const p=G.makePlayer(name,avatar);r.players.push(p);G.log(r,`${p.avatar} ${p.name} joined the expedition.`);bind(socket,r,'player',p.token,p.id);changed(r);return {code:r.code,token:p.token,id:p.id};
 });
 action('player:resume',({code,token})=>{const r=lookup(code);const p=r?.players.find(x=>!x.bot&&x.token===token);G.ensure(p,'Your seat is not available.');bind(socket,r,'player',p.token,p.id);changed(r);return {code:r.code,token:p.token,id:p.id};});
 action('player:leave',()=>{const r=roomFor(socket),p=checkPlayer(socket,r);G.ensure(r.status==='lobby','Cannot leave an active match.');r.players=r.players.filter(x=>x.id!==p.id);socket.leave(privateChannel(r.code,p.id));socket.leave(publicChannel(r.code));socket.data={};changed(r);});
 function playerAction(event,handler){action(event,data=>{const r=roomFor(socket),p=checkPlayer(socket,r);const result=handler(r,p,data);changed(r);return result;});}
 playerAction('game:settlement',(r,p,{vertex})=>G.settlement(r,p,vertex));
 playerAction('game:road',(r,p,{edge})=>G.road(r,p,edge));
 playerAction('game:city',(r,p,{vertex})=>G.city(r,p,vertex));
 playerAction('game:roll',(r,p)=>({roll:G.roll(r,p)}));
 playerAction('game:discard',(r,p,{resources})=>G.discard(r,p,resources));
 playerAction('game:robber',(r,p,{hex,victim})=>G.robber(r,p,hex,victim||null));
 playerAction('game:end',(r,p)=>G.end(r,p));
 playerAction('bank:trade',(r,p,{give,take})=>G.bankTrade(r,p,give,take));
 playerAction('trade:offer',(r,p,{target,give,want})=>({offerId:G.makeOffer(r,p,target,give,want)}));
 playerAction('trade:respond',(r,p,{accept})=>G.answerOffer(r,p,accept===true));
 playerAction('trade:cancel',(r,p)=>{G.ensure(r.offer?.from===p.id,'No outgoing offer.');r.offer=null;G.log(r,`${p.name} canceled their offer.`);});
 playerAction('dev:buy',(r,p)=>G.buyDev(r,p));
 playerAction('dev:play',(r,p,{cardId,options})=>G.playDev(r,p,cardId,options||{}));
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.code);if(r)setTimeout(()=>{announce(r);scheduleSave();},80);});
});
setInterval(()=>{const cutoff=Date.now()-24*3600000;for(const [code,r] of rooms)if(r.updatedAt<cutoff&&!io.sockets.adapter.rooms.get(publicChannel(code))?.size)rooms.delete(code);},60000).unref();
restore().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`Hex Harbor serving on 0.0.0.0:${PORT}`))).catch(e=>{console.error(e);process.exit(1)});
module.exports={app,server,rooms};