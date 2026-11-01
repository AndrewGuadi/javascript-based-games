/* Mogul City · one game, two screens. All economic rules live on the server. */
'use strict';
(() => {
const $=s=>document.querySelector(s), app=$('#app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Math.round(Number(n)||0).toLocaleString('en-US');
const avatars=['🚀','🦊','🐼','🦄','🦁','🐸','🐙','🐧'];
const face=['⚀','⚁','⚂','⚃','⚄','⚅'];
const urlCode=new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5)||'';
let role='home',room=null,mine=null,connected=false,avatar='🚀',tab='play',audio=false,firstLog=null,toastTimer=null,gameSocket=null;
let session=null;
try{session=JSON.parse(localStorage.getItem('mogul:session')||'null');}catch{}
if(urlCode && session?.code!==urlCode)session=null;
const notify=(message)=>{let t=$('#toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3600);};
function emit(event,data={}){return new Promise((resolve)=>{
  if(!gameSocket?.connected){notify('Connecting to the city server…');resolve({ok:false,error:'Server offline.'});return;}
  gameSocket.timeout(8000).emit(event,data,(err,res)=>{
    if(err){notify('Server did not respond. Please retry.');resolve({ok:false,error:'Timeout'});return;}
    if(!res?.ok){notify(res?.error||'Action unavailable.');resolve(res||{ok:false});return;}
    resolve(res);
  });
});}
function storeSession(s){session=s;try{localStorage.setItem('mogul:session',JSON.stringify(s));}catch{}}
function shareLink(){return location.origin+'/?room='+encodeURIComponent(room?.code||urlCode);}
function current(){return room?.players?.find(p=>p.id===room.currentId);}
function self(){return room?.players?.find(p=>p.id===mine?.you?.id)||room?.players?.find(p=>p.id===session?.playerId);}
function tile(id){return room?.tiles?.[id];}
function owned(id){return room?.players?.find(p=>p.properties.includes(Number(id)));}
function groupColor(g){return room?.groups?.[g]||'#7296ac';}
function render(){
  if(!app)return;
  if(role==='host'&&room)app.innerHTML=renderHost();
  else if(role==='player'&&room)app.innerHTML=renderPlayer();
  else app.innerHTML=renderHome();
  updateTimer();
}
function header(extra=''){
  return `<header class="site-header"><a href="/" class="logo" data-action="home" aria-label="Mogul City home"><span class="crown">♛</span><span>MOGUL<span class="gold">CITY</span><small>THE PROPERTY PARTY GAME</small></span></a><div class="row wrap">${extra}<span class="chip"><span class="status-dot ${connected?'':'offline'}"></span>${connected?'LIVE':'CONNECTING'}</span></div></header>`;
}
function renderHome(){
  return `<main class="shell">${header()}<section class="landing"><div class="hero-text"><div class="kicker"><span class="pulse"></span> THIS CITY IS YOURS TO OWN</div><h1 class="h1">The board is on the <span class="gold">big screen.</span><br>Your empire is <span class="mint">in your hands.</span></h1><p>Gather your crew. Scan the code. Buy the city, outsmart your rivals, and make deals they'll remember. A new kind of property game—built for game night.</p><div class="row wrap"><span class="chip chip-green">✳ 2–6 investors</span><span class="chip chip-gold">♛ No downloads</span><span class="chip chip-purple">✦ AI rivals</span></div>
  <div class="hero-graphic" aria-hidden="true"><div class="skyline">${[38,58,43,82,52,95,73,60,90,49,65,39].map(h=>`<div class="skyscraper" style="height:${h}%"></div>`).join('')}</div><div class="floating one">🏘️&nbsp; MAPLE HEIGHTS<br><span class="mint">+ $320 revenue</span></div><div class="floating two">🤖 NOVA made an offer</div><div class="floating three">♛&nbsp; CITY OWNER</div></div></div>
  <div class="landing-card card"><div class="eyebrow">GAME NIGHT STARTS HERE</div><h2>Bring the city to life.</h2><p>Put the host on your TV or laptop. Every player joins with their own phone.</p><button class="btn btn-primary btn-block btn-lg" data-action="create">♛ &nbsp; Create a game room <span aria-hidden="true">↗</span></button><div class="divider"></div><div class="join-section"><h3 class="h3" style="margin-bottom:6px">Joining friends?</h3><p>Enter the five-character code from the TV.</p><label class="field-label" for="join-code">ROOM CODE</label><input id="join-code" class="field" maxlength="5" autocomplete="off" spellcheck="false" placeholder="E.G. AX74P" value="${esc(urlCode)}" style="font-weight:800;letter-spacing:3px;text-transform:uppercase"><div style="height:13px"></div><label class="field-label" for="join-name">YOUR NAME</label><input id="join-name" class="field" maxlength="18" autocomplete="nickname" placeholder="How should the city call you?" value="${esc(localStorage.getItem('mogul:lastName')||'')}"><div style="height:15px"></div><div class="field-label">CHOOSE YOUR INVESTOR</div><div class="avatar-grid">${avatars.map(a=>`<button type="button" class="avatar ${a===avatar?'active':''}" data-action="avatar" data-avatar="${a}" aria-label="Choose avatar ${a}" aria-pressed="${a===avatar}">${a}</button>`).join('')}</div><button class="btn btn-mint btn-block" data-action="join">Join the room →</button></div></div></section><div class="homepage-foot">An original, independently built property strategy party game. No registration needed.</div></main>`;
}
function renderPeople(lobby=false){
  return `<div class="player-grid">${room.players.map((p,i)=>`<div class="person-card" style="border-color:${esc(p.color)}43"><div class="person-avatar">${p.avatar}</div><div style="min-width:0;flex:1"><h4>${esc(p.name)}</h4><small>${p.bot?'🤖 AI investor':p.connected?'● Ready to play':'○ Reconnecting'}</small></div>${lobby&&p.bot&&role==='host'?`<button class="btn btn-ghost btn-sm" data-action="removebot" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>`:''}</div>`).join('')}${Array.from({length:Math.max(0,6-room.players.length)},()=>`<div class="slot-empty">＋ Open seat</div>`).join('')}</div>`;
}
function renderHost(){
  const extra=`<span class="room-pill">ROOM ${room.code}</span><button class="btn btn-ghost btn-sm" data-action="audio">${audio?'🔊 Audio on':'🔈 Audio off'}</button>`;
  return `<div class="shell">${header(extra)}${room.status==='lobby'?renderHostLobby():renderHostGame()}</div>`;
}
function renderHostLobby(){
  const n=room.players.length;
  return `<div style="margin:0 0 23px"><div class="eyebrow">YOUR LIVE GAME ROOM</div><h1 class="h2" style="margin-top:8px">Call the crew. <span class="gold">Build your empire.</span></h1><p class="muted" style="margin:10px 0 0">Keep this screen on your TV. Everyone else connects using their phone.</p></div>
  <div class="lobby-grid"><section class="card lobby-sidebar"><div><div class="label">SCAN TO JOIN</div><div class="room-code">${esc(room.code)}</div><p class="muted small" style="margin:6px 0">Or go to <strong>${esc(location.host)}</strong> and enter the code.</p></div><div class="qr-box"><img src="/qr/${encodeURIComponent(room.code)}.png" alt="QR code for joining room ${esc(room.code)}"></div><button class="btn btn-outline btn-block" data-action="copy">⧉ Copy invitation</button></section>
  <section class="card lobby-players"><div class="row between wrap"><div><div class="eyebrow">THE INVESTOR LOBBY</div><h2 class="h3" style="margin-top:8px">${n} / 6 seats filled</h2></div><span class="chip chip-green">● Room is open</span></div>${renderPeople(true)}<div class="lobby-action"><div><h3>Ready to take over?</h3><p>Play a quick match or invite more investors.</p></div><div class="stack" style="min-width:170px"><label class="field-label" for="round-count">GAME LENGTH</label><select class="field" id="round-count" data-action="rounds">${[[8,'Quick · 8 rounds'],[12,'Classic · 12 rounds'],[16,'Epic · 16 rounds']].map(([k,v])=>`<option value="${k}" ${room.settings.maxRounds===k?'selected':''}>${v}</option>`).join('')}</select><button class="btn btn-primary" data-action="start" ${n<2?'disabled':''}>Start the game →</button></div></div><div class="row wrap" style="margin-top:15px"><button class="btn btn-secondary btn-sm" data-action="addbot" ${n>=6?'disabled':''}>＋ Add AI rival</button><span class="muted tiny">Add computer opponents for solo testing or to fill a table.</span></div></section></div>`;
}
function boardPosition(i){
  if(i<=6)return [7,1+i];
  if(i<=12)return [7-(i-6),7];
  if(i<=18)return [1,7-(i-12)];
  return [i-17,1];
}
function renderBoard(){
  return `<div class="board-frame"><div class="board">${room.tiles.map((t,i)=>{
    const [r,c]=boardPosition(i);const holder=owned(i);const playersHere=room.players.filter(p=>!p.bankrupt&&p.position===i);
    const accent=t.group?groupColor(t.group):t.type==='news'?'#c1a6ec':t.type==='start'?'#82dec0':t.type==='tax'||t.type==='audit'?'#e59cb4':'#90c4c5';
    return `<div class="tile ${esc(t.type)} ${(room.lastRoll?.landed===i)?'highlighted':''}" style="grid-row:${r};grid-column:${c};--tile-color:${accent};--owner:${holder?.color||accent}" title="${esc(t.name)}${t.price?' — $'+t.price:''}"><span class="tile-top"></span><div class="tile-icon" aria-hidden="true">${esc(t.icon||'◇')}</div><div class="tile-name">${esc(t.name)}</div>${t.price?`<span class="tile-price">${fmt(t.price)}</span>`:''}${holder?'<span class="tile-owner"></span>':''}<div class="tile-tokens">${playersHere.map(p=>`<span class="token" title="${esc(p.name)}">${p.avatar}</span>`).join('')}</div></div>`;
  }).join('')}<div class="board-center"><div class="city-silhouette" aria-hidden="true">${[55,35,76,96,67,91,48,72].map(h=>`<span style="height:${h}%"></span>`).join('')}</div><div class="center-content"><div class="center-sub">THE CITY BELONGS TO</div><div class="brand-mark">MOGUL<br>CITY ♛</div><div class="center-sub">OWN THE NIGHT</div><div class="dice-display">${room.lastRoll?room.lastRoll.dice.map(v=>face[v-1]).join(' '):'⚀ ⚄'}</div><div class="turn-indicator">${room.status==='finished'?'🏆 The final standings':current()?`${current().avatar} ${esc(current().name)}'s turn`:'Waiting for the city…'}</div><div class="board-round">${room.status==='finished'?'The empire has been decided':`ROUND ${room.round} / ${room.settings.maxRounds}`}</div></div></div></div></div>`;
}
function renderHostGame(){
  const leaders=[...room.players].sort((a,b)=>b.netWorth-a.netWorth);
  const winner=room.players.filter(p=>room.winnerIds.includes(p.id));
  return `<div class="row between wrap" style="margin-bottom:17px"><div><div class="eyebrow">LIVE AT THE TABLE</div><h1 class="h2" style="margin:6px 0">The city is <span class="gold">in play.</span></h1></div><div class="row wrap"><span class="chip chip-green">${room.players.length} investors</span><span class="chip">Round ${Math.min(room.round,room.settings.maxRounds)} / ${room.settings.maxRounds}</span></div></div><div class="game-layout"><div class="game-board-wrap">${renderBoard()}</div><aside class="tv-sidebar"><section class="card tv-panel"><div class="row between"><h3>City leaderboard</h3><span class="label">NET WORTH</span></div>${leaders.map((p,i)=>`<div class="leader ${room.currentId===p.id?'active':''}" style="${p.bankrupt?'opacity:.4;':''}"><div class="leader-avatar">${p.avatar}</div><div><div class="leader-name">${i+1}. ${esc(p.name)} ${p.bot?'🤖':''}</div><div class="leader-count">${p.bankrupt?'Bankrupt':p.properties.length+' properties'}</div></div><div class="leader-money">${fmt(p.netWorth)}</div></div>`).join('')}</section>
  ${room.status==='finished'?`<section class="winner-panel"><div class="winner-icon">🏆</div><h2>${esc(winner.map(p=>p.name).join(' & '))} wins!</h2><p class="small">Congratulations on your new empire.</p><button class="btn btn-primary btn-block" data-action="restart">Play again</button></section>`:room.phase==='auction'&&room.auction?`<section class="auction-display"><div class="eyebrow">SEALED BID AUCTION</div><h3 class="h3" style="margin:8px 0">${esc(tile(room.auction.tileId)?.name)}</h3><div class="auction-timer" data-countdown="${room.auction.endsAt}">20s</div><div class="small muted">${room.auction.bidCount} confidential bids received</div><div class="timer-bar"><div class="fill" data-countdown-bar="${room.auction.endsAt}"></div></div></section>`:room.phase==='buy'?`<section class="event-card"><span class="eyebrow">DEAL OR AUCTION?</span><strong>${esc(current()?.name)} is considering ${esc(tile(room.pendingTile)?.name)}</strong><p>Purchase for ${fmt(tile(room.pendingTile)?.price)} or send it to a sealed auction.</p></section>`:room.news?`<section class="event-card"><div class="eyebrow">✳ CITY SIGNAL</div><strong>${esc(room.news.headline)}</strong><p>${esc(room.news.detail)}</p></section>`:`<section class="event-card"><div class="eyebrow">♛ MAYOR'S DESK</div><strong>${esc(room.status==='finished'?'The city is yours':`Next decision: ${current()?.name||'investors'}`)}</strong><p>${room.phase==='await_roll'?'Roll the dice on your phone to move through the city.':'Review your portfolio and finish your turn on your phone.'}</p></section>`}
  <section class="card tv-panel feed-panel"><div class="row between"><h3>City wire</h3><span class="label">LIVE UPDATES</span></div>${room.log.slice(0,5).map(l=>`<div class="feed-item">${esc(l.text)}</div>`).join('')}<div class="row wrap" style="margin-top:13px"><button class="btn btn-outline btn-sm" data-action="copy">⧉ Invite players</button><button class="btn btn-ghost btn-sm" data-action="restart">↻ New lobby</button></div></section></aside></div>`;
}
function renderPlayer(){
  const p=self();if(!p)return renderHome();
  return `<main class="phone-shell"><div class="phone-header"><a href="/" data-action="home" class="logo"><span class="crown" style="width:34px;height:34px">♛</span><span style="font-size:18px">MOGUL<span class="gold">CITY</span></span></a><div class="room-pill">${esc(room.code)}</div></div>${!connected?'<div class="offline-banner">Reconnecting to the game server…</div>':''}
  ${room.status==='lobby'?renderPlayerLobby(p):renderPlayerLive(p)}</main>`;
}
function renderPlayerLobby(p){return `<section class="card joining"><span class="chip chip-green">✓ You are in!</span><div class="waiting-animation">${p.avatar}</div><h2 class="h2" style="text-align:center">You're on the board, ${esc(p.name)}.</h2><p class="muted" style="text-align:center">Wait for the host to start the game on the big screen.</p><div class="progress-track"><span></span></div><div class="divider"></div><h3 class="h3" style="margin:18px 0 8px">At your table</h3>${room.players.map(pl=>`<div class="row between" style="padding:9px;border-bottom:1px solid #ffffff13"><span>${pl.avatar} &nbsp; ${esc(pl.name)}</span><span class="small muted">${pl.bot?'AI investor':pl.connected?'Ready':'Disconnected'}</span></div>`).join('')}<p class="small muted">You may close this tab and return—your seat will be saved on this phone.</p><button class="btn btn-outline btn-block" data-action="copy">Copy room invitation</button></section>`;}
function renderPlayerLive(p){
  const now=current();const isTurn=now?.id===p.id;const isGameOver=room.status==='finished';
  return `<section class="phone-hero"><div class="row between"><span class="bank-label">YOUR CITY ACCOUNT</span><span class="chip chip-gold">${p.bot?'BOT':'INVESTOR'}</span></div><h1><span class="hero-person">${p.avatar}</span>${fmt(p.cash)}</h1><div class="small" style="color:#b9dacf">${esc(p.name)} · ${esc(tile(p.position)?.name||'Central Square')}</div><div class="phone-stat-grid"><div class="phone-stat"><div class="label">NET WORTH</div><strong>${fmt(p.netWorth)}</strong></div><div class="phone-stat"><div class="label">OWNED ASSETS</div><strong>${p.properties.length} properties</strong></div></div></section>
  <nav class="phone-nav" aria-label="Game actions">${[['play','🎲','Play'],['portfolio','🏙️','Portfolio'],['trade','🤝','Trade'],['advisor','✨','Advisor']].map(([k,icon,label])=>`<button class="nav-tab ${tab===k?'active':''}" data-action="tab" data-tab="${k}" aria-pressed="${tab===k}"><span>${icon}</span>${label}</button>`).join('')}</nav><div class="phone-pane">${tab==='portfolio'?renderPortfolio(p):tab==='trade'?renderTrade(p):tab==='advisor'?renderAdvisor(p):renderPlay(p,isTurn,isGameOver)}</div><p class="homepage-foot">Round ${Math.min(room.round,room.settings.maxRounds)} of ${room.settings.maxRounds} · ${room.players.filter(x=>!x.bankrupt).length} investors active</p>`;
}
function renderPlay(p,isTurn,isOver){
  const now=current();const event=room.news;
  if(isOver){const won=room.winnerIds.includes(p.id);return `<div class="card action-card" style="text-align:center"><div style="font-size:60px">${won?'🏆':'🏙️'}</div><h2>${won?'You own the night!':'The final bell has rung.'}</h2><p>${won?'Your empire leads the city.':`The winner is ${room.players.filter(x=>room.winnerIds.includes(x.id)).map(x=>esc(x.name)).join(' & ')}.`}</p><div class="chip chip-gold">Your final net worth: ${fmt(p.netWorth)}</div><p class="small">Ask your host to start another round.</p></div>${standings()}`;}
  const a=room.auction;const bid=mine?.bid;
  const auctionActive=room.phase==='auction'&&a;
  return `${auctionActive?`<section class="card action-card" style="border-color:#dac887"><div class="action-eyebrow">🔒 SEALED AUCTION · ALL PLAYERS</div><h2>${esc(tile(a.tileId)?.name)}</h2><p>Secret bids reveal only when the clock expires. Highest eligible bid wins!</p><div class="row between"><div><div class="label">MINIMUM BID</div><div class="h3 gold">${fmt(Math.ceil(tile(a.tileId).price*.6/10)*10)}</div></div><div class="auction-timer" data-countdown="${a.endsAt}">20s</div></div><div class="timer-bar"><div class="fill" data-countdown-bar="${a.endsAt}"></div></div><label for="bid-input" class="field-label">YOUR SECRET BID ${bid?'· Current bid '+fmt(bid):''}</label><div class="row"><input type="number" class="field" id="bid-input" min="${Math.ceil(tile(a.tileId).price*.6/10)*10}" max="${p.cash}" value="${bid||Math.min(p.cash,Math.ceil(tile(a.tileId).price*.75/10)*10)}" step="10"><button class="btn btn-primary" data-action="bid" ${p.bankrupt||p.cash<Math.ceil(tile(a.tileId).price*.6/10)*10?'disabled':''}>Bid now</button></div><div class="small muted" style="margin-top:9px">${a.bidCount} bids in so far · Bids are confidential</div></section>`:''}
  <section class="card action-card"><div class="action-eyebrow">${isTurn?'✦ YOU CONTROL THE TURN':'THE CITY IS IN MOTION'}</div><h2>${isTurn?'Your move, mogul.':`${esc(now?.name||'Someone')} is playing.`}</h2><p>${isTurn?'This is your chance to make history.':'Keep an eye on your investments while they make their move.'}</p>
  ${room.phase==='await_roll'&&isTurn?`<div class="dice-number" aria-hidden="true">🎲 🎲</div><button class="btn btn-primary btn-lg btn-block" data-action="roll">Roll the dice →</button>`:''}
  ${room.phase==='buy'&&isTurn?`<div class="card-inset"><span class="chip chip-gold">AVAILABLE TO BUY</span><h2 style="margin-top:10px">${esc(tile(room.pendingTile)?.name)}</h2><div class="row between" style="margin:12px 0"><div><div class="label">PURCHASE PRICE</div><div class="h3 gold">${fmt(tile(room.pendingTile)?.price)}</div></div><div><div class="label">BASE RENT</div><div class="h3 mint">${fmt(tile(room.pendingTile)?.rent)}</div></div></div><button class="btn btn-mint btn-block" data-action="buy" ${p.cash<tile(room.pendingTile).price?'disabled':''}>Buy this property</button><button class="btn btn-outline btn-block" style="margin-top:10px" data-action="decline">Pass → sealed auction</button></div>`:''}
  ${room.phase==='end'&&isTurn?`<div class="card-inset"><div class="row"><span style="font-size:35px">${room.lastRoll?face[room.lastRoll.dice[0]-1]+face[room.lastRoll.dice[1]-1]:'✓'}</span><div><div class="bold">Landed on ${esc(tile(p.position)?.name)}</div><div class="small muted">Review your city portfolio before ending the turn.</div></div></div><button class="btn btn-primary btn-block" style="margin-top:17px" data-action="end">End turn →</button></div>`:''}
  ${(!isTurn||room.phase==='auction')?`<div class="card-inset"><div class="row"><span style="font-size:30px">${now?.avatar||'🕒'}</span><div class="small"><strong>${isTurn?'Auction in progress':`${esc(now?.name||'Someone')}'s turn`}</strong><div class="muted">${room.phase==='auction'?'Bidding is open on your phone.':room.phase==='buy'?'Deciding whether to buy or auction.':'Watch the board for their next move.'}</div></div></div></div>`:''}</section>
  ${event?`<section class="event-card"><div class="eyebrow">✳ BREAKING CITY NEWS</div><strong>${esc(event.headline)}</strong><p>${esc(event.detail)}</p></section>`:''}<section class="card action-card" style="margin-top:12px"><h2 style="font-size:20px">Latest city news</h2>${room.log.slice(0,4).map(x=>`<div class="feed-item">${esc(x.text)}</div>`).join('')}</section>`;
}
function standings(){return `<div class="card action-card"><h2>Final standings</h2>${[...room.players].sort((a,b)=>b.netWorth-a.netWorth).map((p,i)=>`<div class="row between" style="padding:9px 0;border-bottom:1px solid var(--line)"><span>${i+1}. ${p.avatar} ${esc(p.name)}</span><strong>${fmt(p.netWorth)}</strong></div>`).join('')}</div>`;}
function renderPortfolio(p){
  return `<section class="card action-card"><div class="action-eyebrow">YOUR HOLDINGS</div><h2>${p.properties.length} properties, one empire.</h2><p>Upgrades increase your rent. Owning an entire district also earns a rent bonus.</p>${p.properties.length?p.properties.map(id=>{
    const t=tile(id),level=p.upgrades[id]||0,cost=Math.ceil(t.price*.55/10)*10;
    return `<div class="property-row" style="--group-color:${groupColor(t.group)}"><div style="min-width:0"><h4>${esc(t.name)}</h4><small>${esc(t.group)} · Level ${level}/3</small><div class="small mint">${'◆'.repeat(level)||'◇'} ${fmt(t.rent*(1+2*level))} base rent</div></div><div class="property-right"><strong>${fmt(t.price+Math.round(t.price*.5*level))}</strong><button class="btn btn-secondary btn-sm" data-action="upgrade" data-id="${id}" ${p.cash<cost||level>=3||room.status!=='playing'?'disabled':''}>${level===3?'MAX':`Develop ${fmt(cost)}`}</button></div></div>`;
  }).join(''):`<div class="empty"><span class="empty-icon">🏙️</span>Your property collection is empty. The city is full of opportunity.</div>`}</section>`;
}
function offerText(o){const giver=room.players.find(p=>p.id===o.from),receiver=room.players.find(p=>p.id===o.to);return `<strong>${esc(giver?.name)} → ${esc(receiver?.name)}</strong><br>Offers ${o.give!==null?esc(tile(o.give)?.name):'no property'}${o.pay?' + '+fmt(o.pay):''}<br>For ${o.want!==null?esc(tile(o.want)?.name):'no property'}${o.receive?' + '+fmt(o.receive):''}`;}
function renderTrade(p){
  const offers=mine?.offers||[];const others=room.players.filter(x=>x.id!==p.id&&!x.bankrupt);
  return `<section class="card action-card"><div class="action-eyebrow">PRIVATE DEALS</div><h2>Every empire has a price.</h2><p>Send private offers to anyone. Trades only settle if both players still own what they promised.</p>${offers.length?offers.map(o=>`<div class="trade-offer"><p>${offerText(o)}</p>${o.to===p.id?`<div class="row"><button class="btn btn-mint btn-sm" data-action="accept" data-id="${o.id}">Accept offer</button><button class="btn btn-outline btn-sm" data-action="reject" data-id="${o.id}">Decline</button></div>`:'<span class="small muted">Awaiting their response…</span>'}</div>`).join(''):''}
  ${room.status!=='playing'?'<div class="empty">Deals unlock when the game begins.</div>':!others.length?'<div class="empty">No investors available for trades.</div>':`<div class="trade-grid"><div class="full"><label class="field-label" for="trade-to">OFFER TO</label><select id="trade-to" class="field">${others.map(pl=>`<option value="${pl.id}">${pl.avatar} ${esc(pl.name)} ${pl.bot?'(AI)':''}</option>`).join('')}</select></div><div><label class="field-label" for="trade-give">YOUR PROPERTY</label><select class="field" id="trade-give"><option value="">No property</option>${p.properties.map(id=>`<option value="${id}">${esc(tile(id).name)}</option>`).join('')}</select></div><div><label class="field-label" for="trade-want">THEIR PROPERTY</label><select class="field" id="trade-want"></select></div><div><label class="field-label" for="trade-pay">YOU PAY ($)</label><input class="field" id="trade-pay" min="0" max="${p.cash}" value="0" type="number" step="10"></div><div><label class="field-label" for="trade-receive">THEY PAY ($)</label><input class="field" id="trade-receive" min="0" value="0" type="number" step="10"></div><button class="btn btn-primary btn-block full" data-action="trade">Send private offer →</button></div>`}</section>`;
}
function renderAdvisor(p){const text=mine?.advice||'Researching the city…';return `<section class="card action-card"><div class="action-eyebrow">✨ YOUR AI STRATEGY DESK</div><h2>Make smarter moves.</h2><p>This is a private, rule-aware recommendation based on your visible portfolio and the city's current market.</p><div class="event-card"><div class="eyebrow">YOUR NEXT MOVE</div><strong>${esc(text)}</strong><p>The advisory model uses deterministic strategy so it cannot alter dice or rules.</p></div><div class="howto"><div><strong>1 · Acquire</strong>Buy with cash reserves.</div><div><strong>2 · Develop</strong>Grow rental income.</div><div><strong>3 · Negotiate</strong>Trade for districts.</div></div><p class="small muted">Advice is strategic guidance, not a guarantee. AI rivals make their own decisions with limited information.</p></section>`;}
function updateTradeWant(){
  const pick=$('#trade-to'),want=$('#trade-want');if(!pick||!want||!room)return;
  const p=room.players.find(p=>p.id===pick.value);if(!p)return;
  if(want.dataset.lastTo===pick.value)return;
  want.dataset.lastTo=pick.value;
  want.innerHTML=`<option value="">No property</option>`+p.properties.map(id=>`<option value="${id}">${esc(tile(id).name)}</option>`).join('');
}
function updateTimer(){const now=Date.now();document.querySelectorAll('[data-countdown]').forEach(e=>e.textContent=Math.max(0,Math.ceil((Number(e.dataset.countdown)-now)/1000))+'s');document.querySelectorAll('[data-countdown-bar]').forEach(e=>e.style.width=Math.max(0,Math.min(100,(Number(e.dataset.countdownBar)-now)/200))+'%');if(tab==='trade')updateTradeWant();}
function onRoom(s){if(session&&s.code!==session.code)return;const latest=s.log?.[0];const changed=latest&&latest.at!==firstLog;firstLog=latest?.at;
  room=s;if(changed&&audio&&role==='host'&&window.speechSynthesis&&latest){window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(latest.text);utterance.rate=1.06;utterance.pitch=.92;window.speechSynthesis.speak(utterance);}
  render();}
function connect(){
  if(typeof window.io!=='function'){setTimeout(connect,350);return;}
  gameSocket=io({transports:['websocket','polling'],reconnection:true,reconnectionAttempts:Infinity});
  gameSocket.on('connect',async()=>{connected=true;if(session){const event=session.role==='host'?'host:resume':'player:resume';const payload=session.role==='host'?{code:session.code,hostToken:session.token}:{code:session.code,token:session.token};const res=await emit(event,payload);if(res.ok){role=session.role;}else{session=null;role='home';storeSession(null);room=null;}}render();});
  gameSocket.on('disconnect',()=>{connected=false;render();});
  gameSocket.on('room:state',onRoom);
  gameSocket.on('player:state',p=>{mine=p;if(role==='player')render();});
  gameSocket.on('connect_error',()=>{connected=false;render();});
}
function goHome(){session=null;mine=null;room=null;role='home';tab='play';try{localStorage.removeItem('mogul:session');}catch{}history.replaceState({},'',location.pathname);render();}
async function onClick(e){
  const btn=e.target.closest('[data-action]');if(!btn)return;
  const act=btn.dataset.action;
  if(btn.tagName==='A')e.preventDefault();
  if(btn.disabled)return;
  if(act==='avatar'){avatar=btn.dataset.avatar;render();return;}
  if(act==='home'||act==='leave'){goHome();return;}
  if(act==='tab'){tab=btn.dataset.tab;render();return;}
  if(act==='audio'){audio=!audio;if(!audio&&window.speechSynthesis)window.speechSynthesis.cancel();render();notify(audio?'Mayor narration enabled':'Mayor narration muted');return;}
  if(act==='copy'){try{await navigator.clipboard.writeText(shareLink());notify('Invitation copied!');}catch{notify(shareLink());}return;}
  if(act==='create'){
    btn.disabled=true;const res=await emit('host:create',{maxRounds:12});if(res.ok){storeSession({role:'host',code:res.code,token:res.hostToken});role='host';history.replaceState({},'',location.pathname);render();}else btn.disabled=false;return;
  }
  if(act==='join'){
    const code=($('#join-code')?.value||urlCode||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);const name=($('#join-name')?.value||'').trim();
    if(code.length!==5){notify('Please enter the five-character room code.');return;}if(!name){notify('Enter your investor name.');return;}
    btn.disabled=true;const res=await emit('player:join',{code,name,avatar});if(res.ok){storeSession({role:'player',code:res.code,token:res.token,playerId:res.playerId});try{localStorage.setItem('mogul:lastName',name);}catch{}role='player';history.replaceState({},'',`/?room=${res.code}`);render();}else btn.disabled=false;return;
  }
  if(!room)return;
  const events={addbot:'host:bot',removebot:'host:removeBot',start:'host:start',restart:'host:restart',roll:'game:roll',buy:'game:buy',decline:'game:decline',end:'game:end',upgrade:'game:upgrade',accept:'trade:respond',reject:'trade:respond',bid:'auction:bid',trade:'trade:offer'};
  if(!events[act])return;
  let data={};
  if(act==='removebot'||act==='upgrade')data={id:btn.dataset.id};
  if(act==='accept'||act==='reject')data={offerId:btn.dataset.id,accept:act==='accept'};
  if(act==='bid')data={amount:Number($('#bid-input')?.value)};
  if(act==='trade'){
    data={to:$('#trade-to')?.value,give:$('#trade-give')?.value,want:$('#trade-want')?.value,pay:Number($('#trade-pay')?.value)||0,receive:Number($('#trade-receive')?.value)||0};
  }
  if(act==='restart'&&!window.confirm('Return everyone to the lobby for a new match?'))return;
  btn.disabled=true;const res=await emit(events[act],data);
  if(res.ok&&(act==='trade'||act==='bid'))notify(act==='trade'?'Your offer is on its way!':'Secret bid submitted!');
  if(!res.ok||act==='trade'||act==='bid')btn.disabled=false;
}
document.addEventListener('click',onClick);
document.addEventListener('change',e=>{if(e.target?.id==='round-count')emit('host:settings',{maxRounds:Number(e.target.value)});if(e.target?.id==='trade-to')updateTradeWant();});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target?.id==='join-code'||e.target?.id==='join-name')){$('[data-action="join"]')?.click();}});
setInterval(updateTimer,400);
render();connect();
})();