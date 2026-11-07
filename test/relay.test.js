const test = require('node:test');
const assert = require('node:assert');
const relay = require('../server/relay');

// Play the secret target dish exactly, in a fixed order.
function playTarget(game) {
  const { ingredients, actions } = game.recipe.target;
  const steps = [
    ...ingredients.map(id => ({ kind: 'ingredient', id })),
    ...actions.map(id => ({ kind: 'action', id })),          // last action stays last
  ];
  // Pad with stirs *before* the final action so "finish with X" still holds,
  // unless stirring is forbidden — then pad with an allowed action.
  const forbidden = new Set(game.recipe.cards.flat().filter(c => c.type === 'noAction').map(c => c.id));
  const pad = ['stir', 'boil', 'salt'].find(a => !forbidden.has(a) && actions.includes(a)) || actions[0];
  while (steps.length < relay.TOTAL_TURNS) steps.splice(steps.length - 1, 0, { kind: 'action', id: pad });
  for (const s of steps) {
    const err = relay.applyMove(game, relay.currentPlayer(game), s);
    assert.strictEqual(err, null, `move ${JSON.stringify(s)} failed: ${err}`);
  }
}

test('every generated recipe is solvable for 3 stars from that round\'s market', () => {
  for (let i = 0; i < 1000; i++) {
    const g = relay.createRelayGame(1 + (i % 2));
    assert.strictEqual(g.market.length, relay.MARKET_SIZE);
    assert.strictEqual(new Set(g.market).size, relay.MARKET_SIZE);
    for (const id of g.recipe.target.ingredients) assert.ok(g.market.includes(id), id);
    // "no X" clues must only name things that are actually at the market
    for (const c of g.recipe.cards.flat()) if (c.type === 'noIng') assert.ok(g.market.includes(c.id), c.id);
    assert.strictEqual(g.recipe.cards[0].length, 3);
    assert.strictEqual(g.recipe.cards[1].length, 3);
    playTarget(g);
    assert.strictEqual(g.phase, 'results');
    assert.strictEqual(g.result.stars, 3, JSON.stringify({ target: g.recipe.target, cards: g.recipe.cards, pot: g.pot, checks: g.result.checks }));
  }
});

test('turn order is enforced and alternates', () => {
  const g = relay.createRelayGame(1);
  assert.strictEqual(relay.currentPlayer(g), 0);
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'action', id: 'stir' }), 'not_your_turn');
  assert.strictEqual(relay.applyMove(g, 0, { kind: 'action', id: 'stir' }), null);
  assert.strictEqual(relay.currentPlayer(g), 1);
  // Round 2: the other player starts.
  assert.strictEqual(relay.currentPlayer(relay.createRelayGame(2)), 1);
});

test('rejects duplicate and unknown ingredients', () => {
  const g = relay.createRelayGame(1);
  const [first] = g.market;
  assert.strictEqual(relay.applyMove(g, 0, { kind: 'ingredient', id: first }), null);
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: first }), 'already_in_pot');
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: 'pizza' }), 'unknown_ingredient');
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: 'toString' }), 'unknown_ingredient');
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'dance' }), 'invalid_move');
  // Ingredients that aren't at today's market are rejected.
  const missing = Object.keys(relay.INGREDIENTS).find(id => !g.market.includes(id));
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: missing }), 'unknown_ingredient');
});

test("a player's view never leaks the partner's card before results", () => {
  const g = relay.createRelayGame(1);
  const v = relay.viewFor(g, 0);
  assert.deepStrictEqual(v.myCard, g.recipe.cards[0]);
  assert.strictEqual(v.cards, undefined);
  assert.strictEqual(v.target, undefined);
  assert.ok(!JSON.stringify(v).includes(JSON.stringify(g.recipe.cards[1])));
});
