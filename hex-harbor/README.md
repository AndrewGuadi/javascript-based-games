# HEX HARBOR ⬡

**An original island-building strategy party game, playable on your TV and controlled with phones.**

A Catan-style economic board game with original artwork and naming. **Not affiliated with CATAN GmbH or Jackbox Games.**

## Game night

1. On a TV or laptop, open the publicly hosted URL and choose **Host on TV**.
2. Every player scans the QR code displayed on the TV, or opens the same website and enters the 5-character room code.
3. Players select a name and animal avatar. The host optionally adds rule-based AI explorers to make a 2–4 player game.
4. Press **Start expedition**. Players choose two starting villages and connecting roads, in snake order.
5. Players roll dice, gather private resource cards, trade with people and harbors, build roads / villages / cities, use discovery cards, and deploy the Corsair robber.
6. The first explorer to reach 10 victory stars wins.

## Included mechanics

- 19 randomized hexes, 54 shared intersections, 72 edges, 9 ports, and six-/eight-number distribution balancing
- Production and finite bank, settlements, roads, cities, 2–4 explorer support and snake draft starting placement
- Robber: seven-card limit / discard excess half, move to new hex, steal one random card from an adjacent rival
- Private resource hands, hidden discovery cards and secret victory stars
- 2:1 / 3:1 port trading and 4:1 bank exchange, private person-to-person trade proposals
- Discovery deck (patrol, roadbuilding, harvest, trade charter, secret victory star)
- Longest road (5+) and largest army (3+) worth 2 stars
- Rule-based AI opponents, local rule-based turn advisor and optional browser voice narration
- Server-authoritative actions, token-based reconnect, rate-limit checks, and no account required
- Automatic session snapshots to local file and optional Redis-backed cross-restart persistence

## Technical stack

Node.js 20+, Express, Socket.IO, HTML/CSS, SVG; no SPA framework or native phone installation required.

```bash
cd hex-harbor
npm install
npm test
npm run check
npm start
```

Open http://localhost:3000 on the TV and access the same address on mobile on the same network.

### Hosting on Render

New **Node.js** Web Service connected to `AndrewGuadi/javascript-based-games`, deploy branch `feature/hex-harbor-party-v1`, repository root:

- Build command: `cd hex-harbor && npm install && npm test && npm run check`
- Start command: `cd hex-harbor && npm start`
- Region: Virginia
- Plan: Free
- Render supplies PORT automatically
- Optional `REDIS_URL`: attach persistent Redis-compatible KV if you want matches to survive free-service restarts / redeploys.

One Render origin serves both the big-screen site, all phone controllers, QR codes and WebSocket game engine.

## Security and known limitations

- Anyone with the 5-letter room code can request a seat **until a match starts**. A player's private hand requires a cryptographically generated seat token. The host has a different secret host token.
- This first version uses rule-based strategy bot decisions and advisor insights; **it does not call a generative AI service**.
- The game supports one app server instance; multi-instance horizontal scaling would require a distributed Socket.IO adapter and atomic state transitions.
- Room state is saved to local disk on each change, which is **ephemeral on Render**; persistent `REDIS_URL` recommended for important game nights.
- Physical multi-device gameplay and accessibility remain next priorities for field testing; server-rule tests are included.
- Free Render may sleep while idle and take time to wake.

## Original identity

Hex Harbor is an independent game: its visuals, narrative, island title, pieces, and text are original and do not copy official CATAN/Jackbox trademarks, art, or product branding. Inspiration: island economy games and tabletop trading mechanics.
