const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const relay = require('./relay');

const PORT = process.env.PORT || 3000;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;   // forget rooms idle for a day
const MODES = { relay };                    // 'rush' and 'sneak' arrive later

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/api/catalog', (_req, res) => res.json({ ingredients: relay.INGREDIENTS, actions: relay.ACTIONS }));

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
    stats: room.stats,
  };
}

function broadcast(room) {
  room.lastActive = Date.now();
  room.players.forEach((p, seat) => {
    if (!p || !p.socketId) return;
    const game = room.game ? MODES[room.game.mode].viewFor(room.game, seat, names(room)) : null;
    io.to(p.socketId).emit('state', { room: publicRoom(room, seat), game });
  });
}

function recordRound(room) {
  const g = room.game;
  if (!g || g.phase !== 'results' || g.recorded) return;
  g.recorded = true;
  const view = relay.viewFor(g, 0, names(room));
  room.stats.rounds++;
  room.stats.stars += g.result.stars;
  room.stats.dishes.push({ name: view.dishName, stars: g.result.stars });
  if (room.stats.dishes.length > 20) room.stats.dishes.shift();
}

function attach(socket, room, seat) {
  const p = room.players[seat];
  // If this player was connected on another tab, that tab loses its seat.
  if (p.socketId && p.socketId !== socket.id) io.to(p.socketId).emit('kicked', 'You opened the game somewhere else.');
  p.socketId = socket.id;
  p.connected = true;
  socket.data.code = room.code;
  socket.data.seat = seat;
  socket.join(room.code);
}

io.on('connection', socket => {
  socket.on('room:create', ({ name, playerId } = {}, ack = () => {}) => {
    if (!playerId) return ack({ error: 'Missing player id.' });
    const code = newCode();
    const room = {
      code,
      players: [{ id: playerId, name: cleanName(name, 'Honey'), socketId: null, connected: false }, null],
      game: null,
      stats: { rounds: 0, stars: 0, dishes: [] },
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
    if (!room) return ack({ error: `No kitchen found with code ${code || '—'}.` });
    let seat = seatOf(room, playerId);
    if (seat === -1) {
      seat = room.players.findIndex(p => p === null);
      if (seat === -1) return ack({ error: 'That kitchen already has two chefs.' });
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
    if (!room) return ack({ error: 'Not in a kitchen.' });
    if (!MODES[mode]) return ack({ error: 'That mode is still cooking. Coming soon!' });
    if (!room.players[0] || !room.players[1]) return ack({ error: 'Wait for your partner to join first.' });
    room.game = relay.createRelayGame(room.stats.rounds + 1);
    ack({ ok: true });
    broadcast(room);
  });

  socket.on('relay:move', (move, ack = () => {}) => {
    const room = rooms.get(socket.data.code);
    if (!room || !room.game || room.game.mode !== 'relay') return ack({ error: 'No game running.' });
    const err = relay.applyMove(room.game, socket.data.seat, move);
    if (err) return ack({ error: err });
    recordRound(room);
    ack({ ok: true });
    broadcast(room);
  });

  socket.on('relay:next', () => {
    const room = rooms.get(socket.data.code);
    if (!room || !room.game || room.game.phase !== 'results') return;
    room.game = relay.createRelayGame(room.stats.rounds + 1);
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

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.lastActive > ROOM_TTL_MS) rooms.delete(code);
}, 60 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`🍳 Couple's Kitchen running at http://localhost:${PORT}`));
}

module.exports = { server, rooms };
