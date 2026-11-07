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

test('every generated recipe is solvable for 3 stars, in both pantries', () => {
  for (let i = 0; i < 1000; i++) {
    const pack = i % 2 ? 'vietnam' : 'western';
    const g = relay.createRelayGame(1 + (i % 2), pack);
    assert.strictEqual(g.pack, pack);
    for (const id of g.recipe.target.ingredients) assert.ok(relay.PACKS[pack].ingredients[id], id);
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
  assert.strictEqual(relay.applyMove(g, 0, { kind: 'ingredient', id: 'carrot' }), null);
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: 'carrot' }), 'already_in_pot');
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: 'pizza' }), 'unknown_ingredient');
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: 'toString' }), 'unknown_ingredient');
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'dance' }), 'invalid_move');
  // Ingredients from the other pantry are rejected.
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'ingredient', id: 'nuoc_mam' }), 'unknown_ingredient');
  const vn = relay.createRelayGame(1, 'vietnam');
  assert.strictEqual(relay.applyMove(vn, 0, { kind: 'ingredient', id: 'nuoc_mam' }), null);
});

test("a player's view never leaks the partner's card before results", () => {
  const g = relay.createRelayGame(1);
  const v = relay.viewFor(g, 0);
  assert.deepStrictEqual(v.myCard, g.recipe.cards[0]);
  assert.strictEqual(v.cards, undefined);
  assert.strictEqual(v.target, undefined);
  assert.ok(!JSON.stringify(v).includes(JSON.stringify(g.recipe.cards[1])));
});
