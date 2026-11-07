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

  assert.ok((await emit(a, 'mode:start', { mode: 'rush' })).error);

  // Switch to the Vietnamese pantry; both players see it.
  const packed = nextState(b, s => s.room.pack === 'vietnam');
  a.emit('room:pack', { pack: 'vietnam' });
  await packed;
  const started = nextState(b, s => s.game);
  await emit(a, 'mode:start', { mode: 'relay' });
  const sb = await started;
  assert.strictEqual(sb.game.myCard.length, 3);
  assert.strictEqual(sb.game.cards, undefined);
  assert.strictEqual(sb.game.pack, 'vietnam');

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
  assert.strictEqual(last.game.dish.pack, 'vietnam');
  assert.strictEqual(last.room.stats.rounds, 1);

  // Refresh / reconnect: a fresh socket with the same playerId gets the seat back.
  b.close();
  const b2 = connect(url, { transports: ['websocket'] });
  t.after(() => b2.close());
  const re = await emit(b2, 'room:rejoin', { code: created.code, playerId: 'pb' });
  assert.strictEqual(re.seat, 1);
});
