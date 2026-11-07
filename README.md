# 🍳 Couple's Kitchen · Bếp Đôi Mình

A cozy co-op cooking game for two, played online from your phones.

## Modes
| Mode | Status | Vibe |
|---|---|---|
| 🍷 **Recipe Relay** | ✅ playable | Turn-based. Each of you holds half of a secret recipe card. Take turns adding one ingredient or action to a shared pot; after 8 steps the dish is judged against both cards (0–3 ⭐). |
| 🔥 **Split Kitchen** | ✅ playable | Real-time. 🔥 Cook has the pantry + 2 burners, 🔪 Prep has the chopping board, plate and serve bell. Pass food across a shared counter to fill orders before customers leave. 3 levels (earn ⭐ to unlock the next); food burns if you forget it; the clock pauses if a phone disconnects. |
| 🌙 **Midnight Snack** | ✅ playable | Co-op stealth puzzle. Both see a dark kitchen grid; each round you each plan up to 3 steps (walk / use the fridge, shelf, stove, board or table / wait), lock in, and move at the same time. Creaky boards, the cat and bumping into each other make noise; open the fridge together to keep it quiet. Get the snack on the table before the roommate wakes up. 3 nights. |

## Coins, shop & upgrades
- Every finished game pays coins into **one shared 💰 wallet** that both partners earn into and either can spend.
  - Recipe Relay: 10 + 10 per ⭐ · Split Kitchen: half the coins earned + 15 per ⭐ · Midnight Snack: 30 + 15 per ⭐ + 5 × night (5 for trying)
- **🛒 Shop** (from the lobby):
  - Kitchen: upgrades that make modes easier (third burner, sharp knife, non-stick pans, friendly bell, recipe notebook, soft slippers, quiet fridge, earplugs, cat treats) and decor (cherry blossom, garden, seaside).
  - My chef: your own chef's colour, hat and glasses. Your partner sees your look everywhere.
- Difficulty keeps climbing so upgrades stay useful: Split Kitchen has **10 levels**, Midnight Snack **9 nights** (each map with a lighter and lighter sleeper), and Recipe Relay gets more clues and fewer steps as the evening goes on.
- **Progress is saved on each phone** (localStorage): coins, upgrades, decor, unlocked levels and your chef's look. When you open a kitchen or join your partner's, the saved copies are merged (bigger wallet wins, owned items and stars combine), so a server restart or redeploy doesn't lose anything. Reconnecting to the same kitchen never merges again, so spent coins can't come back. Clearing the browser's site data on *both* phones resets progress.
- `START_COINS=500 npm start` gives new kitchens 500 coins for testing.

## Languages & pantries
- **English / Tiếng Việt** — tap the flag on the home screen or in the lobby. It defaults to Vietnamese when the phone's language is Vietnamese. Each partner can play in their own language in the same game.
- **One combined kitchen**: Vietnamese and Western ingredients and dishes live together. Recipe Relay deals a random "today's market" of 18 ingredients each round (from 26), so every round is different; Split Kitchen has an 18-item pantry and every level mixes dishes like bánh mì, phở bò and cơm tấm with burgers, fries and pasta.
- All text lives in `public/i18n.js`; the server only sends ids/tags, so adding another language means adding one more block there.

## Run it locally
```bash
npm install
npm start          # http://localhost:3000
```
Open it on two devices (or two browser windows). One taps **Open a new kitchen** and shares the 4‑letter code or the invite link; the other joins.
To play from a phone on the same Wi‑Fi, open `http://<your-computer's-LAN-IP>:3000`.

```bash
npm test           # game-logic + two-player socket tests
npm run dev        # auto-restart on server changes
```

## Deploy (free tiers work fine)
It's a single Node process with WebSockets, so any host that supports long-lived connections works:
- **Render**: New → Web Service → connect repo → Build `npm install`, Start `npm start`.
- **Fly.io**: `fly launch` then `fly deploy`.
- **Railway**: New project from repo; it detects `npm start`.

The server listens on `$PORT`. Rooms live in memory, so a restart/redeploy clears open kitchens. Rooms idle for 24h are cleaned up automatically.

## How it works
- `server/index.js` — Express static server + Socket.IO rooms (create/join/rejoin, reactions, presence).
- `server/rush.js` — Split Kitchen rules: roles, items (raw/chopped/cooked/burnt), orders, coins, levels. The server runs one 250 ms game clock for all kitchens.
- `server/sneak.js` — Midnight Snack rules: maps, simultaneous moves, noise, cat patrols. `test/sneak-solver.js` is a small bot that proves every night can be won within par.
- `server/shop.js` — wallets, payouts, shop items and buying/equipping.
- `server/relay.js` — Recipe Relay rules. The server picks a hidden target dish, derives clues that are all true for it, and splits them 3/3. Each player only ever receives their own card until the round ends.
- `public/` — vanilla HTML/CSS/JS, mobile-first, no build step. `i18n.js` holds all English/Vietnamese text. Sounds are synthesized with Web Audio.
- Reconnects: each browser keeps a player id in `localStorage`, so refreshing or a dropped phone connection puts you back in your seat.
