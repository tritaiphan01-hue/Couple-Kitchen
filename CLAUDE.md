# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Couple's Kitchen / Bếp Đôi Mình: a mobile-first co-op cooking game for exactly two players on two phones. It has a Node (Express + Socket.IO) server and a vanilla HTML/CSS/JS client with no build step. Three modes: Recipe Relay (`relay`), Split Kitchen (`rush`) and Midnight Snack (`sneak`). There's also a shared coin wallet, a shop, and English/Vietnamese UI. The user communicates in Vietnamese.

## Commands

```bash
npm install
npm start                      # http://localhost:3000 (PORT env overrides)
npm run dev                    # node --watch
npm test                       # node --test test/*.test.js
node --test test/rush.test.js  # one file
node --test --test-name-pattern="Grandma" test/relay.test.js   # one test
START_COINS=500 npm start      # new kitchens start with coins (shop testing)
node tools/render-music.js     # re-render public/music/*.mp3 (needs Playwright Chromium + ffmpeg)
node test/sneak-solver.js      # print bot results for every Midnight Snack night
node test/relay-bot.js         # print Recipe Relay win/loss rates per difficulty tier
```

There is no linter or bundler. To check client syntax quickly, run `node -e "new Function(require('fs').readFileSync('public/app.js','utf8'))"`.

## Architecture

**The server is authoritative.** The client only sends intents and draws state.
- `server/index.js` holds rooms in memory (a `Map` keyed by a 4-letter code). It handles socket events (`room:*`, `relay:*`, `rush:*`, `sneak:*`, `shop:*`), payouts, level unlocking, and one global 250 ms tick that advances every Split Kitchen game.
- After any change it calls `broadcast(room)`, which sends each seat `{ room: publicRoom(room, seat), game: MODES[mode].viewFor(game, seat) }`.
- Errors are returned as **codes** (e.g. `not_your_turn`) and translated on the client via `err.<code>` keys.

**Each mode is a pure rules module** with no socket code, so it can be unit-tested directly:

| File | Main exports |
|---|---|
| `server/relay.js` | `createRelayGame`, `applyMove`, `applyGuess`, `viewFor` |
| `server/rush.js` | `createRushGame`, `act`, `tick`, `viewFor` |
| `server/sneak.js` | `createSneakGame`, `act`, `viewFor` |
| `server/shop.js` | `ITEMS`, `grant`, `buy`, `equip`, `importProgress` |

`viewFor(game, seat)` is the privacy boundary. In Recipe Relay, `publicClue` strips the riddle answer `id`, and the dish id and the partner's card are only sent once `phase === 'results'`. There are tests asserting nothing leaks, so keep them passing when you add fields.

**How each mode works:**
- **Relay:** the secret dish is a real recipe from `DISHES`. Clues are per-ingredient tag "riddles" plus `hasAction` clues, dealt across both cards. Grandma's reaction to each step (`yum`/`yuck`/`meh`/`ok`) is stored in `game.reactions`; `yuck` costs a heart and 0 hearts ends the round (`how: 'kicked'`). Phases are `playing → guessing → results`. Difficulty `TIERS` depend on the room's round count and were tuned with `test/relay-bot.js`. If you change the rules, re-run the bot and keep the rate test in `relay.test.js` passing.
- **Rush:** real-time on a game clock (`game.clock`) that only advances while both players are connected, so a disconnect pauses the game. Upgrades are baked into `game.config` at creation (`applyUpgrades`). Client effects come from `game.events` (incrementing ids, reset per game).
- **Sneak:** a grid map (legend in the file header). `LEVELS` is generated as `MAPS × TIERS`, and each map's `bot: {rounds, noise}` sets its noise limit and par. Both plans resolve simultaneously in `resolveRound` and are recorded in `lastRound.steps` for client replay. If you change maps or noise rules, re-run `test/sneak-solver.js`; the test requires every night to be won within par.

**Economy and persistence:**
- There is one shared wallet (`room.shop.wallet`). Chef looks are per player (`player.shop.owned/look`).
- Rooms live only in memory. Each phone saves progress to `localStorage` (`ck:progress`) and sends it on `room:create`/`room:join`.
- `shop.importProgress` merges it: the larger wallet wins, items are unioned, and the best stars per level are kept. It only merges for a new seat, **never on rejoin**, so spent coins can't come back.

**Client (`public/`)**, loaded in this order: `i18n.js` → `music.js` → `icons.js` → `app.js` (one IIFE):
- **Screens:** `show(screen, mode)` switches `.screen` sections and sets `body[data-mode]`, which drives the CSS theme and the music mood.
- **Prediction:** `renderRush` predicts taps locally (`predictRush`) before the server confirms.
- **Fast DOM updates:** `setHTML`/`setText` only touch the DOM when the content changed, and kitchen buttons use `pointerdown` (via the `FAST` regex in `tapBtn`).
- **Performance:** avoid CSS `filter`/`drop-shadow` on many elements; it was a measured cause of jank on phones.
- **Text:** all user-facing text goes in `public/i18n.js` with both `en` and `vi` blocks. Values can be functions (plurals, word order). `test/i18n.test.js` fails if the two blocks have different keys, and it renders every clue and dish name in both languages.
- **Ingredient ids** differ per mode (e.g. relay `thit_bo` vs rush `beef`). `public/icons.js` maps them to SVG stickers through `ALIAS`, and a test requires every ingredient and station to have an icon.
- **Catalog:** the client gets ingredient, dish, shop and action data from `GET /api/catalog`, so names and emoji live on the server.

**Audio:**
- Sound effects are synthesized in `app.js`.
- The soundtrack is pre-rendered loops in `public/music/{chill,rush,sneak}.mp3`, played and crossfaded by `public/music.js`. Users can replace these files.
- Audio only unlocks on the first tap, which iPhones require.

## Testing approach

- Tests use `node:test`.
- `test/server.test.js` starts the real server on a random port and drives it with two `socket.io-client` sockets. It can peek at `rooms` to learn hidden state (e.g. the relay dish).
- For UI checks, Playwright with Chromium is preinstalled in this environment. Earlier sessions used it with two `devices['iPhone 13']` contexts to play full games and check that screens fit without scrolling (`scrollHeight - innerHeight`).
