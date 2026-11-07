const test = require('node:test');
const assert = require('node:assert');
const rush = require('../server/rush');

const COOK = 0, PREP = 1;

// Start a game and fast-forward through the countdown.
function started(level = 1, pack = 'western') {
  const g = rush.createRushGame(level, pack);
  assert.strictEqual(rush.act(g, 0, { type: 'ready' }), null);
  assert.strictEqual(rush.act(g, 1, { type: 'ready' }), null);
  assert.strictEqual(g.phase, 'countdown');
  const t0 = g.countdownEnd;
  rush.tick(g, t0);
  assert.strictEqual(g.phase, 'playing');
  g._now = t0;
  return g;
}
// Advance game time in realistic 250ms ticks.
function advance(g, ms, connected = [true, true]) {
  for (let t = 0; t < ms; t += 250) { g._now += 250; rush.tick(g, g._now, connected); }
}
const ok = (g, seat, a) => assert.strictEqual(rush.act(g, seat, a), null, JSON.stringify(a));

// Make one item in the requested state and pass it to Prep's hand.
function make(g, ing, state) {
  const c = rush.LEVELS[g.level - 1];
  ok(g, COOK, { type: 'pantry', ing });
  if (state.startsWith('chopped')) {
    ok(g, COOK, { type: 'counter', i: 0 });
    ok(g, PREP, { type: 'counter', i: 0 });
    ok(g, PREP, { type: 'board' });
    for (let k = 0; k < c.chopTaps; k++) ok(g, PREP, { type: 'board' });
    ok(g, PREP, { type: 'board' });                   // pick up chopped item
    if (state === 'chopped') return;
    ok(g, PREP, { type: 'counter', i: 1 });           // send it back to cook
    ok(g, COOK, { type: 'counter', i: 1 });
  }
  if (state.endsWith('cooked')) {
    ok(g, COOK, { type: 'burner', i: 0 });
    advance(g, c.cookMs + 250);
    ok(g, COOK, { type: 'burner', i: 0 });
  }
  ok(g, COOK, { type: 'counter', i: 2 });
  ok(g, PREP, { type: 'counter', i: 2 });
}

test('every dish in every level can be cooked and served', () => {
  for (const pack of Object.keys(rush.PACKS)) {
    const P = rush.PACKS[pack];
    for (let level = 1; level <= 3; level++) {
      for (const dish of P.levels[level - 1]) {
        const g = started(level, pack);
        g.orders = [{ id: 999, dish, createdAt: g.clock, expiresAt: g.clock + 999999 }];
        for (const comp of P.dishes[dish].comps) {
          const [ing, state] = comp.split(':');
          assert.ok(P.ingredients[ing], `${pack}/${dish}: unknown ${ing}`);
          make(g, ing, state);
          ok(g, PREP, { type: 'plate' });
        }
        const before = g.coins;
        ok(g, PREP, { type: 'serve' });
        assert.ok(g.coins > before, `${pack}/${dish} earned nothing`);
        assert.strictEqual(g.stats.served, 1);
        assert.deepStrictEqual(g.plate, []);
      }
    }
  }
});

test('roles are enforced', () => {
  const g = started();
  assert.strictEqual(rush.act(g, PREP, { type: 'pantry', ing: 'bread' }), 'wrong_role');
  assert.strictEqual(rush.act(g, COOK, { type: 'board' }), 'wrong_role');
  assert.strictEqual(rush.act(g, COOK, { type: 'serve' }), 'wrong_role');
  assert.strictEqual(rush.act(g, PREP, { type: 'burner', i: 0 }), 'wrong_role');
  assert.strictEqual(rush.act(g, COOK, { type: 'pantry', ing: 'nuoc_mam' }), 'unknown_ingredient');
  ok(g, COOK, { type: 'pantry', ing: 'bread' });
  assert.strictEqual(rush.act(g, COOK, { type: 'pantry', ing: 'egg' }), 'hands_full');
});

test('swapping roles on the ready screen', () => {
  const g = rush.createRushGame(1);
  ok(g, 0, { type: 'ready' });
  ok(g, 1, { type: 'swap' });
  assert.deepStrictEqual(g.roles, ['prep', 'cook']);
  assert.deepStrictEqual(g.ready, [false, false]);
});

test('food burns if left on the stove, and burnt food cannot be plated', () => {
  const g = started(1);
  const c = rush.LEVELS[0];
  ok(g, COOK, { type: 'pantry', ing: 'patty' });
  ok(g, COOK, { type: 'burner', i: 1 });
  advance(g, c.cookMs + c.burnMs + 500);
  assert.strictEqual(g.burners[1].item.burnt, true);
  assert.strictEqual(g.stats.burnt[COOK], 1);
  ok(g, COOK, { type: 'burner', i: 1 });
  assert.strictEqual(rush.act(g, COOK, { type: 'burner', i: 0 }), 'burnt');
  ok(g, COOK, { type: 'trash' });
  assert.strictEqual(g.hands[COOK], null);
});

test('cooked food cannot be chopped; wrong plates are rejected', () => {
  const g = started(1);
  g.orders = [{ id: 1, dish: 'salad', createdAt: 0, expiresAt: 1e9 }];
  make(g, 'egg', 'cooked');
  assert.strictEqual(rush.act(g, PREP, { type: 'board' }), 'cant_chop_cooked');
  ok(g, PREP, { type: 'plate' });
  assert.strictEqual(rush.act(g, PREP, { type: 'serve' }), 'no_matching_order');
  assert.strictEqual(g.stats.wrong, 1);
});

test('the clock pauses while a partner is disconnected', () => {
  const g = started(1);
  const clock = g.clock;
  advance(g, 5000, [true, false]);
  assert.strictEqual(g.clock, clock);
  assert.strictEqual(g.running, false);
  assert.strictEqual(rush.act(g, COOK, { type: 'pantry', ing: 'egg' }), 'paused');
  advance(g, 1000);
  assert.ok(g.clock > clock);
});

test('orders expire, new ones arrive, and the level ends with stars', () => {
  const g = started(1);
  assert.strictEqual(g.orders.length, 1);
  advance(g, 20000);
  assert.strictEqual(g.orders.length, 2);         // level 1 caps at 2
  advance(g, 70000);
  assert.ok(g.stats.missed >= 1);
  advance(g, 60000);
  assert.strictEqual(g.phase, 'results');
  assert.strictEqual(g.result.stars, 0);
  assert.strictEqual(g.coins, 0);                 // penalties never go below zero
});

test('view includes everything needed to draw both halves', () => {
  const g = started(2, 'vietnam');
  const v = rush.viewFor(g, PREP);
  assert.strictEqual(v.myRole, 'prep');
  assert.strictEqual(v.pack, 'vietnam');
  assert.strictEqual(v.burners.length, 2);
  assert.strictEqual(v.counter.length, 4);
  assert.ok(v.config.cookMs > 0);
});
