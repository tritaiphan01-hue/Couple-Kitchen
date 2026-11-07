// End-to-end: two socket clients create/join a room and play a full round.
const test = require('node:test');
const assert = require('node:assert');
const { io: connect } = require('socket.io-client');
const { server, rooms } = require('../server/index');

const emit = (s, ev, data) => new Promise(r => s.emit(ev, data, r));
const nextState = (s, pred = () => true) => new Promise(r => {
  const h = st => { if (pred(st)) { s.off('state', h); r(st); } };
  s.on('state', h);
});

test('two players can create, join, play and reconnect', async t => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const a = connect(url, { transports: ['websocket'] });
  const b = connect(url, { transports: ['websocket'] });
  t.after(() => { a.close(); b.close(); server.close(); });

  const created = await emit(a, 'room:create', { name: 'Tri', playerId: 'pa' });
  assert.match(created.code, /^[A-Z]{4}$/);

  assert.ok((await emit(b, 'room:join', { code: 'ZZZZ', name: 'X', playerId: 'pb' })).error);
  const joinedState = nextState(a, s => s.room.players[1]);
  const joined = await emit(b, 'room:join', { code: created.code.toLowerCase(), name: 'Mai', playerId: 'pb' });
  assert.strictEqual(joined.seat, 1);
  assert.strictEqual((await joinedState).room.players[1].name, 'Mai');

  // A third chef is turned away.
  const c = connect(url, { transports: ['websocket'] });
  assert.strictEqual((await emit(c, 'room:join', { code: created.code, playerId: 'pc' })).error, 'room_full');
  c.close();

  assert.strictEqual((await emit(a, 'mode:start', { mode: 'sneak' })).error, 'mode_soon');

  const started = nextState(b, s => s.game);
  await emit(a, 'mode:start', { mode: 'relay' });
  const sb = await started;
  assert.strictEqual(sb.game.myCard.length, 3);
  assert.strictEqual(sb.game.cards, undefined);
  assert.strictEqual(sb.game.market.length, 18);

  const players = [a, b];
  let last;
  for (let i = 0; i < 8; i++) {
    const room = rooms.get(created.code);
    const seat = (room.game.starter + room.game.turn) % 2;
    const wait = nextState(a, s => s.game.turn === i + 1);
    const res = await emit(players[seat], 'relay:move', { kind: 'action', id: 'stir' });
    assert.ok(res.ok, res.error);
    last = await wait;
  }
  assert.strictEqual(last.game.phase, 'results');
  assert.deepStrictEqual(last.game.dish.chefs, [0, 1]);   // nobody added ingredients → shared credit
  assert.strictEqual(last.room.stats.rounds, 1);

  // Refresh / reconnect: a fresh socket with the same playerId gets the seat back.
  b.close();
  const b2 = connect(url, { transports: ['websocket'] });
  t.after(() => b2.close());
  const re = await emit(b2, 'room:rejoin', { code: created.code, playerId: 'pb' });
  assert.strictEqual(re.seat, 1);
});

test('Split Kitchen runs in real time over sockets', async t => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const a = connect(url, { transports: ['websocket'] });
  const b = connect(url, { transports: ['websocket'] });
  t.after(() => { a.close(); b.close(); server.close(); });

  const { code } = await emit(a, 'room:create', { name: 'Tri', playerId: 'ra' });
  await emit(b, 'room:join', { code, name: 'Mai', playerId: 'rb' });
  const ready = nextState(b, s => s.game && s.game.mode === 'rush');
  assert.ok((await emit(a, 'mode:start', { mode: 'rush' })).ok);
  const s0 = await ready;
  assert.strictEqual(s0.game.phase, 'ready');
  assert.strictEqual(s0.game.myRole, 'prep');

  const playing = nextState(a, s => s.game.phase === 'playing' && s.game.orders.length === 1);
  await emit(a, 'rush:act', { type: 'ready' });
  await emit(b, 'rush:act', { type: 'ready' });
  const s1 = await playing;                         // after the 3-second countdown
  assert.ok(s1.game.running);

  // Cook grabs bread and passes it; Prep sees it on the counter.
  assert.ok((await emit(a, 'rush:act', { type: 'pantry', ing: 'bread' })).ok);
  const passed = nextState(b, s => s.game.counter[0]);
  assert.ok((await emit(a, 'rush:act', { type: 'counter', i: 0 })).ok);
  assert.strictEqual((await passed).game.counter[0].item.ing, 'bread');
  assert.strictEqual((await emit(b, 'rush:act', { type: 'pantry', ing: 'egg' })).error, 'wrong_role');

  // Clock keeps ticking on its own.
  const later = await nextState(a, s => s.game.clock > s1.game.clock + 400);
  assert.ok(later.game.clock > s1.game.clock);
});
