const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const relay = require('./relay');
const rush = require('./rush');

const PORT = process.env.PORT || 3000;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;   // forget rooms idle for a day
const MODES = { relay, rush };              // 'sneak' arrives later
const TICK_MS = 250;
const PACKS_OK = new Set(Object.keys(relay.PACKS));

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/api/catalog', (_req, res) => res.json({ packs: relay.PACKS, actions: relay.ACTIONS, rush: rush.PACKS }));

const server = http.createServer(app);
const io = new Server(server);

/** @type {Map<string, any>} */
const rooms = new Map();

// No easily-confused letters (O/0, I/1) so codes are easy to read aloud.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(name, fallback) {
  const n = String(name || '').replace(/[<>]/g, '').trim().slice(0, 16);
  return n || fallback;
}

function names(room) {
  return room.players.map((p, i) => (p ? p.name : ['Honey', 'Plum'][i]));
}

function seatOf(room, playerId) {
  return room.players.findIndex(p => p && p.id === playerId);
}

function publicRoom(room, seat) {
  return {
    code: room.code,
    seat,
    screen: room.game ? 'game' : 'lobby',
    players: room.players.map(p => (p ? { name: p.name, connected: p.connected } : null)),
    pack: room.pack,
    stats: room.stats,
    rushBest: room.rushBest,
  };
}

function broadcast(room) {
  room.lastActive = Date.now();
  room.players.forEach((p, seat) => {
    if (!p || !p.socketId) return;
    const game = room.game ? MODES[room.game.mode].viewFor(room.game, seat) : null;
    io.to(p.socketId).emit('state', { room: publicRoom(room, seat), game });
  });
}

function recordRound(room) {
  const g = room.game;
  if (!g || g.phase !== 'results' || g.recorded) return;
  g.recorded = true;
  room.stats.rounds++;
  room.stats.stars += g.result.stars;
  // Store chef *names* with the dish so the recap still reads right if someone leaves.
  room.stats.dishes.push({ dish: relay.dishInfo(g), names: names(room), stars: g.result.stars });
  if (room.stats.dishes.length > 20) room.stats.dishes.shift();
}

function attach(socket, room, seat) {
  const p = room.players[seat];
  // If this player was connected on another tab, that tab loses its seat.
  if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('kicked', 'opened_elsewhere');
  p.socketId = socket.id;
  p.connected = true;
  socket.data.code = room.code;
  socket.data.seat = seat;
  socket.join(room.code);
}

io.on('connection', socket => {
  socket.on('room:create', ({ name, playerId, pack } = {}, ack = () => {}) => {
    if (!playerId) return ack({ error: 'missing_id' });
    const code = newCode();
    const room = {
      code,
      players: [{ id: playerId, name: cleanName(name, 'Honey'), socketId: null, connected: false }, null],
      game: null,
      pack: PACKS_OK.has(pack) ? pack : relay.DEFAULT_PACK,
      stats: { rounds: 0, stars: 0, dishes: [] },
      rushBest: {},              // level → best stars in Split Kitchen
      lastActive: Date.now(),
    };
    rooms.set(code, room);
    attach(socket, room, 0);
    ack({ code, seat: 0 });
    broadcast(room);
  });

  socket.on('room:join', ({ code, name, playerId } = {}, ack = () => {}) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack({ error: 'no_room' });
    let seat = seatOf(room, playerId);
    if (seat === -1) {
      seat = room.players.findIndex(p => p === null);
      if (seat === -1) return ack({ error: 'room_full' });
      room.players[seat] = { id: playerId, name: cleanName(name, 'Plum'), socketId: null, connected: false };
    } else if (name) {
      room.players[seat].name = cleanName(name, room.players[seat].name);
    }
    attach(socket, room, seat);
    ack({ code, seat });
    broadcast(room);
  });

  // Silent reconnect after a refresh or a dropped phone connection.
  socket.on('room:rejoin', ({ code, playerId } = {}, ack = () => {}) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const seat = room ? seatOf(room, playerId) : -1;
    if (seat === -1) return ack({ error: 'gone' });
    attach(socket, room, seat);
    ack({ code: room.code, seat });
    broadcast(room);
  });

  socket.on('room:leave', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    room.players[socket.data.seat] = null;
    socket.leave(room.code);
    socket.data.code = null;
    room.game = null;
    if (room.players.every(p => !p)) rooms.delete(room.code);
    else broadcast(room);
  });

  socket.on('mode:start', ({ mode } = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.code);
    if (!room) return ack({ error: 'no_room' });
    if (!MODES[mode]) return ack({ error: 'mode_soon' });
    if (!room.players[0] || !room.players[1]) return ack({ error: 'need_partner' });
    room.game = mode === 'rush'
      ? rush.createRushGame(rushStartLevel(room), room.pack)
      : relay.createRelayGame(room.stats.rounds + 1, room.pack);
    ack({ ok: true });
    broadcast(room);
  });

  // ---- Split Kitchen ----
  socket.on('rush:act', (action, ack = () => {}) => {
    const room = rooms.get(socket.data.code);
    if (!room || !room.game || room.game.mode !== 'rush') return ack({ error: 'no_game' });
    const err = rush.act(room.game, socket.data.seat, action || {});
    ack(err ? { error: err } : { ok: true });
    if (!err) broadcast(room);
  });

  // Pick a level (ready screen) or play the next/same level again (results screen).
  socket.on('rush:level', ({ level } = {}) => {
    const room = rooms.get(socket.data.code);
    const g = room && room.game;
    if (!g || g.mode !== 'rush' || (g.phase !== 'ready' && g.phase !== 'results')) return;
    level = level | 0;
    if (level < 1 || level > maxUnlocked(room)) return;
    room.game = rush.createRushGame(level, room.pack, g.roles);
    broadcast(room);
  });

  socket.on('relay:move', (move, ack = () => {}) => {
    const room = rooms.get(socket.data.code);
    if (!room || !room.game || room.game.mode !== 'relay') return ack({ error: 'no_game' });
    const err = relay.applyMove(room.game, socket.data.seat, move);
    if (err) return ack({ error: err });
    recordRound(room);
    ack({ ok: true });
    broadcast(room);
  });

  socket.on('relay:next', () => {
    const room = rooms.get(socket.data.code);
    if (!room || !room.game || room.game.phase !== 'results') return;
    room.game = relay.createRelayGame(room.stats.rounds + 1, room.pack);
    broadcast(room);
  });

  // Choose the pantry: Western kitchen or Vietnamese kitchen. Applies to the next dish.
  socket.on('room:pack', ({ pack } = {}) => {
    const room = rooms.get(socket.data.code);
    if (!room || !PACKS_OK.has(pack) || room.pack === pack) return;
    room.pack = pack;
    broadcast(room);
  });

  socket.on('room:lobby', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    room.game = null;
    broadcast(room);
  });

  // Floating hearts / emoji reactions to your partner.
  socket.on('react', ({ emoji } = {}) => {
    const room = rooms.get(socket.data.code);
    if (!room || !['❤️', '😏', '🤔', '👍', '👎', '😂'].includes(emoji)) return;
    socket.to(room.code).emit('react', { emoji, from: socket.data.seat });
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const p = room.players[socket.data.seat];
    if (p && p.socketId === socket.id) {
      p.connected = false;
      p.socketId = null;
      broadcast(room);
    }
  });
});

// Levels unlock by earning at least one star on the previous one.
function maxUnlocked(room) {
  let n = 1;
  while (n < rush.LEVELS.length && (room.rushBest[n] || 0) >= 1) n++;
  return n;
}
function rushStartLevel(room) { return maxUnlocked(room); }

// One shared clock for every Split Kitchen in progress.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const g = room.game;
    if (!g || g.mode !== 'rush' || g.phase === 'results') continue;
    const before = g.phase;
    rush.tick(g, now, room.players.map(p => !!(p && p.connected)));
    if (g.phase === 'results') {
      room.rushBest[g.level] = Math.max(room.rushBest[g.level] || 0, g.result.stars);
      g.result.unlocked = maxUnlocked(room);
    }
    if (g.phase !== 'ready' || before !== g.phase) broadcast(room);
  }
}, TICK_MS).unref();

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.lastActive > ROOM_TTL_MS) rooms.delete(code);
}, 60 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`🍳 Couple's Kitchen running at http://localhost:${PORT}`));
}

module.exports = { server, rooms };
