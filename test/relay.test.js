const test = require('node:test');
const assert = require('node:assert');
const relay = require('../server/relay');
const { play } = require('./relay-bot');

// Cook the real recipe, in order, alternating seats.
function cookPerfectly(g) {
  const d = relay.DISHES[g.dish];
  const steps = [...d.ings.map(id => ({ kind: 'ingredient', id })), ...d.acts.map(id => ({ kind: 'action', id }))];
  for (const st of steps) assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), st), null, JSON.stringify(st));
}
const wrongIngredient = g => g.market.find(id => !relay.DISHES[g.dish].ings.includes(id));
const wrongAction = g => Object.keys(relay.ACTIONS).find(a => !relay.DISHES[g.dish].acts.includes(a));

test('every dish fits the turns, and its ingredients are always at the market', () => {
  for (const [id, d] of Object.entries(relay.DISHES)) {
    assert.ok(d.ings.length >= 3 && d.ings.length <= 5, id);
    assert.ok(d.ings.length + d.acts.length <= 7, id);
    for (const i of d.ings) assert.ok(relay.INGREDIENTS[i], `${id}: ${i}`);
    for (const a of d.acts) assert.ok(relay.ACTIONS[a], `${id}: ${a}`);
  }
  for (let i = 0; i < 1000; i++) {
    const g = relay.createRelayGame(1 + (i % 9));
    assert.strictEqual(g.market.length, relay.MARKET_SIZE);
    for (const id of relay.DISHES[g.dish].ings) assert.ok(g.market.includes(id));
    assert.ok(g.guessOptions.includes(g.dish) && g.guessOptions.length === 4);
  }
});

test('clues are riddles for each ingredient plus each action, all true for the recipe', () => {
  for (let i = 0; i < 1000; i++) {
    const g = relay.createRelayGame(1 + (i % 9));
    const d = relay.DISHES[g.dish];
    const all = g.recipe.cards.flat();
    assert.deepStrictEqual(all.filter(c => c.type === 'riddle').map(c => c.id).sort(), d.ings.slice().sort());
    assert.deepStrictEqual(all.filter(c => c.type === 'hasAction').map(c => c.id).sort(), d.acts.slice().sort());
    for (const c of all.filter(c => c.type === 'riddle')) {
      assert.ok(c.tags.length >= 1 && c.tags.every(t => relay.INGREDIENTS[c.id].tags.includes(t)));
    }
    assert.ok(Math.abs(g.recipe.cards[0].length - g.recipe.cards[1].length) <= 1);
  }
});

test('later rounds have vaguer riddles and a grumpier grandma', () => {
  const avg = round => {
    let n = 0, sum = 0;
    for (let i = 0; i < 400; i++) for (const c of relay.createRelayGame(round).recipe.cards.flat()) if (c.type === 'riddle') { n++; sum += c.matches; }
    return sum / n;
  };
  assert.ok(avg(1) < avg(4));
  assert.strictEqual(relay.createRelayGame(1).hearts, 3);
  assert.strictEqual(relay.createRelayGame(7).hearts, 2);
  assert.strictEqual(relay.createRelayGame(7, ['notebook']).totalTurns, relay.createRelayGame(7).totalTurns + 1);
});

test('cooking the exact recipe wins right away with 3 stars', () => {
  for (const id of Object.keys(relay.DISHES)) {
    const g = relay.createRelayGame(1, [], Math.random, id);
    cookPerfectly(g);
    assert.strictEqual(g.phase, 'guessing');
    assert.strictEqual(g.result.how, 'perfect');
    assert.strictEqual(g.result.stars, 3);
    assert.ok(g.reactions.every(r => r.mood === 'yum'));
    assert.ok(g.result.checks.flat().every(Boolean));
  }
});

test('Grandma loses a heart for each wrong step and kicks you out at zero', () => {
  const g = relay.createRelayGame(7, [], Math.random, 'phobo');   // 2 hearts
  assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), { kind: 'ingredient', id: wrongIngredient(g) }), null);
  assert.strictEqual(g.reactions[0].mood, 'yuck');
  assert.strictEqual(g.hearts, 1);
  assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), { kind: 'action', id: wrongAction(g) }), null);
  assert.strictEqual(g.hearts, 0);
  assert.strictEqual(g.phase, 'guessing');
  assert.strictEqual(g.result.how, 'kicked');
  assert.strictEqual(g.result.stars, 0);
  assert.strictEqual(g.result.won, false);
  assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), { kind: 'action', id: 'boil' }), 'round_over');
});

test('scooping out fixes the pot but never gives a heart back; repeats are harmless', () => {
  const g = relay.createRelayGame(1, [], Math.random, 'canhchua');   // boil only
  relay.applyMove(g, relay.currentPlayer(g), { kind: 'ingredient', id: wrongIngredient(g) });
  assert.strictEqual(g.hearts, 2);
  assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), { kind: 'remove' }), null);
  assert.strictEqual(g.reactions[1].mood, 'ok');
  assert.strictEqual(g.hearts, 2);
  assert.strictEqual(g.pot.length, 0);
  assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), { kind: 'remove' }), 'nothing_to_remove');
  relay.applyMove(g, relay.currentPlayer(g), { kind: 'action', id: 'boil' });
  relay.applyMove(g, relay.currentPlayer(g), { kind: 'action', id: 'boil' });
  assert.strictEqual(g.reactions[3].mood, 'meh');
  assert.strictEqual(g.hearts, 2);
});

test('running out of steps scores by how close you got', () => {
  const g = relay.createRelayGame(1, [], Math.random, 'canhchua');   // 4 ings + boil
  const d = relay.DISHES[g.dish];
  // 3 of 4 ingredients + boil, then burn the remaining steps on repeat boils
  for (const id of d.ings.slice(0, 3)) relay.applyMove(g, relay.currentPlayer(g), { kind: 'ingredient', id });
  while (g.phase === 'playing') relay.applyMove(g, relay.currentPlayer(g), { kind: 'action', id: 'boil' });
  assert.strictEqual(g.result.how, 'time');
  assert.strictEqual(g.result.mistakes.total, 1);
  assert.strictEqual(g.result.stars, 2);
});

test('both players guess the dish, then results', () => {
  const g = relay.createRelayGame(1);
  cookPerfectly(g);
  const wrong = g.guessOptions.find(d => d !== g.dish);
  assert.strictEqual(relay.applyGuess(g, 0, 'not_a_dish'), 'invalid_move');
  assert.strictEqual(relay.applyGuess(g, 0, g.dish), null);
  assert.strictEqual(g.phase, 'guessing');
  const v = relay.viewFor(g, 1);
  assert.strictEqual(v.partnerGuessed, true);
  assert.strictEqual(v.dish, undefined);                 // still secret
  assert.strictEqual(relay.applyGuess(g, 1, wrong), null);
  assert.strictEqual(g.phase, 'results');
  assert.deepStrictEqual(g.result.guessed, [true, false]);
});

test('turn order is enforced and alternates between rounds', () => {
  const g = relay.createRelayGame(1);
  assert.strictEqual(relay.currentPlayer(g), 0);
  assert.strictEqual(relay.applyMove(g, 1, { kind: 'action', id: 'stir' }), 'not_your_turn');
  assert.strictEqual(relay.applyMove(g, 0, { kind: 'ingredient', id: 'pizza' }), 'unknown_ingredient');
  assert.strictEqual(relay.applyMove(g, 0, { kind: 'dance' }), 'invalid_move');
  assert.strictEqual(relay.currentPlayer(relay.createRelayGame(2)), 1);
});

test("the answer never reaches a player's phone before the results", () => {
  for (let i = 0; i < 200; i++) {
    const g = relay.createRelayGame(1 + (i % 9));
    const v = relay.viewFor(g, i % 2);
    const json = JSON.stringify(v);
    for (const c of v.myCard) if (c.type === 'riddle') assert.strictEqual(c.id, undefined);
    assert.strictEqual(v.dish, undefined);
    assert.strictEqual(v.cards, undefined);
    assert.ok(!json.includes(`"${g.dish}"`), 'dish id leaked');
  }
});

test('a guessing couple wins most early rounds and is at real risk later', () => {
  const rate = (round, how) => { let n = 0; for (let i = 0; i < 600; i++) if (play(round).result.how === how) n++; return n / 600; };
  assert.ok(rate(1, 'perfect') > 0.7);
  assert.ok(rate(1, 'kicked') < 0.08);
  assert.ok(rate(7, 'kicked') > 0.15);
});
