const test = require('node:test');
const assert = require('node:assert');
const sneak = require('../server/sneak');
const { play, SOLUTIONS } = require('./sneak-solver');

const plan = (g, seat, steps) => assert.strictEqual(sneak.act(g, seat, { type: 'plan', steps }), null, JSON.stringify(steps));
const lockBoth = g => { sneak.act(g, 0, { type: 'lock' }); sneak.act(g, 1, { type: 'lock' }); };
const W = { t: 'wait' };

test('all 9 nights can be won within par by a simple strategy', () => {
  for (const n of sneak.LEVELS.map((_, i) => i + 1)) {
    for (const delays of [[0, 0], [0, 1], [1, 0]]) {
      const g = play(n, SOLUTIONS[n].errands, delays);
      assert.strictEqual(g.phase, 'won', `night ${n} ${delays}: ${g.result && g.result.reason}`);
      assert.ok(g.result.stars >= 2, `night ${n}: ${g.result.stars} stars`);
    }
  }
});

test('maps are well-formed', () => {
  for (const L of sneak.LEVELS) {
    assert.ok(L.map.every(r => r.length === L.map[0].length));
    for (const ch of ['1', '2', 'D', 'T']) assert.ok(sneak.findChar(L, ch), ch);
    for (const [x, y] of L.cat) assert.ok(sneak.walkable(L, x, y), `cat at ${x},${y}`);
    for (const comp of L.recipe) {
      const ing = comp.split(':')[0];
      assert.ok(Object.values(L.sources).some(list => list.includes(ing)), ing);
      assert.ok(sneak.INGREDIENTS[ing]);
    }
  }
});

test('plans are validated against the map', () => {
  const g = sneak.createSneakGame(1);   // P0 starts at (2,7)
  assert.strictEqual(sneak.act(g, 0, { type: 'plan', steps: [{ t: 'move', x: 2, y: 8 }] }), 'invalid_plan'); // wall
  assert.strictEqual(sneak.act(g, 0, { type: 'plan', steps: [{ t: 'move', x: 4, y: 7 }] }), 'invalid_plan'); // not adjacent
  assert.strictEqual(sneak.act(g, 0, { type: 'plan', steps: [W, W, W, W] }), 'invalid_plan');            // too long
  assert.strictEqual(sneak.act(g, 0, { type: 'plan', steps: [{ t: 'use', x: 2, y: 6 }] }), 'invalid_plan'); // floor isn't a station
  assert.strictEqual(sneak.act(g, 0, { type: 'lock' }), 'empty_plan');
  plan(g, 0, [{ t: 'move', x: 2, y: 6 }, { t: 'move', x: 2, y: 5 }]);
  assert.strictEqual(sneak.act(g, 0, { type: 'lock' }), null);
  assert.deepStrictEqual(g.locked, [true, false]);
  plan(g, 0, [W]);                                       // editing un-locks
  assert.deepStrictEqual(g.locked, [false, false]);
});

test('walking, creaking and the noise meter', () => {
  const g = sneak.createSneakGame(1);
  plan(g, 0, [{ t: 'move', x: 2, y: 6 }, { t: 'move', x: 2, y: 5 }]);   // (2,5) is creaky
  plan(g, 1, [W]);
  lockBoth(g);
  assert.strictEqual(g.lastRound.steps[1].noise, 1 + 3);
  assert.strictEqual(g.noise, 4 - 1);                                   // settles by 1 after the round
  assert.strictEqual(g.round, 2);
  assert.deepStrictEqual(g.plans, [[], []]);
});

test('bumping into each other or the cat makes noise and blocks the move', () => {
  const g = sneak.createSneakGame(1);   // P0 (2,7), P1 (4,7)
  plan(g, 0, [{ t: 'move', x: 3, y: 7 }]);
  plan(g, 1, [{ t: 'move', x: 3, y: 7 }]);
  lockBoth(g);
  assert.deepStrictEqual([g.players[0].x, g.players[1].x], [2, 4]);
  assert.ok(g.lastRound.steps[0].events.some(e => e.type === 'bonk'));

  const c = sneak.createSneakGame(1);   // sleeping cat at (5,6)
  plan(c, 1, [{ t: 'move', x: 5, y: 7 }, { t: 'move', x: 5, y: 6 }]);
  plan(c, 0, [W]);
  lockBoth(c);
  assert.deepStrictEqual([c.players[1].x, c.players[1].y], [5, 7]);
  assert.ok(c.lastRound.steps[1].events.some(e => e.type === 'meow'));
});

test('holding the fridge door together is quieter', () => {
  // Night 1: fridge on the inner counter at (3,3), with free sides at (2,3) and (4,3).
  const alone = sneak.createSneakGame(1);
  alone.players[0] = { x: 2, y: 3, hand: null };
  plan(alone, 0, [{ t: 'use', x: 3, y: 3 }]); plan(alone, 1, [W]); lockBoth(alone);
  assert.strictEqual(alone.lastRound.steps[0].noise, sneak.NOISE.fridge);

  const real = sneak.createSneakGame(1);
  real.players[0] = { x: 2, y: 3, hand: null }; real.players[1] = { x: 4, y: 3, hand: null };
  plan(real, 0, [{ t: 'use', x: 3, y: 3 }]); plan(real, 1, [{ t: 'use', x: 3, y: 3 }]); lockBoth(real);
  assert.strictEqual(real.lastRound.steps[0].noise, sneak.NOISE.fridgeHeld);

  // And a full two-item fridge on a tiny custom kitchen.
  const L = JSON.parse(JSON.stringify(sneak.LEVELS[0]));
  L.map = ['#####', '#.F.#', '#.T.#', '#1.2#', '#####'];
  L.sources = { F: ['cheese', 'bread'] }; L.recipe = ['cheese:raw', 'bread:raw']; L.cat = [[2, 3]];
  sneak.LEVELS.push(L);
  try {
    const h = sneak.createSneakGame(sneak.LEVELS.length);
    h.players[0] = { x: 1, y: 1, hand: null }; h.players[1] = { x: 3, y: 1, hand: null };
    plan(h, 0, [{ t: 'use', x: 2, y: 1 }]); plan(h, 1, [{ t: 'use', x: 2, y: 1 }]); lockBoth(h);
    const st = h.lastRound.steps[0];
    assert.strictEqual(st.noise, sneak.NOISE.fridgeHeld);
    assert.ok(st.events.some(e => e.type === 'hold'));
    assert.deepStrictEqual(st.players.map(p => p.hand && p.hand.ing).sort(), ['bread', 'cheese']);
    // both place on the table → snack done
    plan(h, 0, [{ t: 'move', x: 1, y: 2 }, { t: 'use', x: 2, y: 2 }]);
    plan(h, 1, [{ t: 'move', x: 3, y: 2 }, { t: 'use', x: 2, y: 2 }]);
    lockBoth(h);
    assert.strictEqual(h.phase, 'won');
    assert.strictEqual(h.result.stars, 3);
  } finally { sneak.LEVELS.pop(); }
});

test('the roommate wakes up when the meter fills, and sunrise ends the night', () => {
  const g = sneak.createSneakGame(1);
  g.noise = sneak.LEVELS[0].maxNoise - 1;
  plan(g, 0, [{ t: 'move', x: 2, y: 6 }]); plan(g, 1, [W]); lockBoth(g);
  assert.strictEqual(g.phase, 'lost');
  assert.strictEqual(g.result.reason, 'woke');

  const s = sneak.createSneakGame(1);
  for (let r = 0; r < 10; r++) { plan(s, 0, [W]); plan(s, 1, [W]); lockBoth(s); }
  assert.strictEqual(s.phase, 'lost');
  assert.strictEqual(s.result.reason, 'sunrise');
});

test('cooking and chopping change what you carry', () => {
  const g = sneak.createSneakGame(3);
  g.players[1] = { x: 5, y: 4, hand: { ing: 'cucumber', chopped: false, cooked: false } };   // next to the board (6,4)
  plan(g, 1, [{ t: 'use', x: 6, y: 4 }]); plan(g, 0, [W]); lockBoth(g);
  assert.strictEqual(g.players[1].hand.chopped, true);
  // wrong item on the table is refused
  g.players[1] = { x: 4, y: 4, hand: { ing: 'pork', chopped: false, cooked: false } };      // raw pork, recipe wants cooked
  plan(g, 1, [{ t: 'use', x: 3, y: 4 }]); plan(g, 0, [W]); lockBoth(g);
  assert.ok(g.lastRound.steps[0].events.some(e => e.type === 'wrongPlace'));
  assert.deepStrictEqual(g.table, []);
});
