# Mogul City ♛

**A phone-controlled property game for TV game nights.** An original, independent Monopoly-inspired game (not affiliated with Hasbro or Jackbox Games).

## How to play

1. Open the hosted website on a TV or laptop, select **Create a game room**.
2. Each player scans the QR code, or opens the same website on their phone and enters the five-character code.
3. Enter a name, select an avatar. Optionally add AI investors on the host screen.
4. The host selects 8, 12 or 16 rounds, then starts the match (2–6 investors).
5. Roll, buy, auction, upgrade, trade and collect rent through the phone. The TV shows the shared board and event stream.
6. Highest net worth at the end—or last solvent investor—wins.

## Features

- Server-authoritative Socket.IO multiplayer with per-player opaque session tokens and host token
- Responsive 24-space original city board, distinct development districts, auctions with **private sealed bids**, portfolio trading
- City news events and economic progression; bots with conservative/balanced/aggressive heuristics
- Phone-private trades, advisor, reconnect after page refresh
- QR room invites, full-screen TV view, optional browser text-to-speech host narration
- Automatic file-backed game snapshots, optional Redis persistence with `REDIS_URL`
- Original visuals and mechanics; no copyrighted Monopoly/Jackbox assets

## Run

Node 20+:

```sh
npm install
npm test
npm start
```

Then open `http://localhost:3000`. To run on Render: root `mogul-city`, Node runtime, build command `npm install`, start command `npm start`, PORT auto-provided. The client and game server are served at the **same origin**.

### Environment

`PORT` (optional, defaults 3000)
`REDIS_URL` (optional): Redis-compatible URL. Recommended for recovery after redeployment; rooms persist as JSON. Without it, state is saved to a local `.sessions.json` file, but Render's ephemeral disk is not reliable across deployments.

## Fairness & security

- Server rolls cryptographically secure dice; clients cannot propose dice values.
- All property and money operations are validated by server game logic.
- Player and host tokens never appear in the public room state.
- Private bid values and trade offers are never sent in the public room state.
- No account or tracking needed. Room names and user content should be kept non-sensitive.

## Current limitations / next work

- A room uses one server instance; scale-out requires Redis-backed locks/pubsub and atomic transactions.
- No generative AI or voice model is called; the strategy bots and analyst are explainable, offline rule-based algorithms. Add an opt-in LLM integration later.
- Human players who leave mid-game can cause turns to stall until rejoining; future versions should offer a host-authorized skip or bot takeover.
- Free Render instances may sleep when idle and reconnect after a delay.
- The game presently supports **two to six investors**, rather than a large party.

## License

Source authored for this project. Do not copy original Monopoly art, trademarks, board titles, or audio.