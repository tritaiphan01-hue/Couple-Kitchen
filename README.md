# 🍳 Couple's Kitchen · Bếp Đôi Mình

A cozy co-op cooking game for two, played online from your phones.

## Modes
| Mode | Status | Vibe |
|---|---|---|
| 🍷 **Recipe Relay** | ✅ playable | Turn-based. Each of you holds half of a secret recipe card. Take turns adding one ingredient or action to a shared pot; after 8 steps the dish is judged against both cards (0–3 ⭐). |
| 🔥 **Split Kitchen** | 🚧 next | Real-time. Each of you sees only half the kitchen and passes ingredients across. |
| 🌙 **Midnight Snack** | 🚧 later | Plan quiet moves together on a grid without waking the roommate. |

## Languages & pantries
- **English / Tiếng Việt** — tap the flag on the home screen or in the lobby. It defaults to Vietnamese when the phone's language is Vietnamese. Each partner can play in their own language in the same game.
- **🇻🇳 Món Việt / 🍝 Western pantry** — pick in the lobby (either partner can switch; applies to the next dish). The Vietnamese pantry has nước mắm, rau thơm, sả, ớt, rau muống, bún, cơm, tôm, cá, thịt heo, thịt bò… and dishes like Phở, Canh chua, Lẩu, Cháo, Gỏi, Món kho.
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
- `server/relay.js` — Recipe Relay rules. The server picks a hidden target dish, derives clues that are all true for it, and splits them 3/3. Each player only ever receives their own card until the round ends.
- `public/` — vanilla HTML/CSS/JS, mobile-first, no build step. `i18n.js` holds all English/Vietnamese text. Sounds are synthesized with Web Audio.
- Reconnects: each browser keeps a player id in `localStorage`, so refreshing or a dropped phone connection puts you back in your seat.
