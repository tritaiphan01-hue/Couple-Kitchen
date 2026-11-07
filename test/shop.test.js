const test = require('node:test');
const assert = require('node:assert');
const shop = require('../server/shop');
const rush = require('../server/rush');
const sneak = require('../server/sneak');
const relay = require('../server/relay');
const { play, SOLUTIONS } = require('./sneak-solver');

function room() {
  return {
    shop: shop.newRoomShopState(),
    players: [{ shop: shop.newPlayerShopState(0) }, { shop: shop.newPlayerShopState(1) }],
  };
}

test('payouts all go into the one shared wallet', () => {
  const r = room();
  assert.deepStrictEqual(shop.grant(r, 41), { total: 41 });
  shop.grant(r, 9);
  assert.strictEqual(r.shop.wallet, 50);
});

test('both partners spend the same wallet, on the kitchen or their own chef', () => {
  const r = room();
  assert.strictEqual(shop.buy(r, 0, 'burner3').error, 'not_enough');
  r.shop.wallet = 200;
  assert.ok(shop.buy(r, 1, 'burner3').ok);                    // either partner can buy for the kitchen
  assert.strictEqual(r.shop.wallet, 50);
  assert.strictEqual(shop.buy(r, 0, 'burner3').error, 'already_owned');
  assert.strictEqual(shop.buy(r, 0, 'pizza_oven').error, 'unknown_item');

  r.shop.wallet = 100;
  assert.ok(shop.buy(r, 0, 'hat_crown').error === 'not_enough');
  assert.ok(shop.buy(r, 0, 'hat_bow').ok);
  assert.strictEqual(r.shop.wallet, 20);                       // came out of the shared wallet
  assert.strictEqual(r.players[0].shop.look.hat, 'hat_bow');  // worn right away
  assert.strictEqual(r.players[1].shop.look.hat, 'hat_chef');
  assert.strictEqual(shop.equip(r, 1, 'hat_bow').error, 'not_owned');
  assert.ok(shop.equip(r, 0, 'hat_chef').ok);
  assert.ok(shop.equip(r, 1, 'color_honey').ok);              // free colours for everyone
  assert.strictEqual(shop.buy(r, 0, 'color_plum').error, 'already_owned');
});

test('decor is bought once and can be switched', () => {
  const r = room();
  r.shop.wallet = 200;
  assert.ok(shop.buy(r, 0, 'decor_sakura').ok);
  assert.ok(shop.buy(r, 1, 'decor_ocean').ok);
  assert.strictEqual(r.shop.decor, 'decor_ocean');
  assert.ok(shop.equip(r, 0, 'decor_sakura').ok);
  assert.strictEqual(r.shop.decor, 'decor_sakura');
  assert.ok(shop.equip(r, 0, 'decor_none').ok);
  assert.strictEqual(r.shop.decor, null);
  assert.strictEqual(shop.equip(r, 0, 'decor_garden').error, 'not_owned');
});

test('Split Kitchen upgrades change the kitchen', () => {
  const base = rush.createRushGame(3);
  const up = rush.createRushGame(3, undefined, ['burner3', 'sharpKnife', 'nonstick', 'bell']);
  assert.strictEqual(base.burners.length, 2);
  assert.strictEqual(up.burners.length, 3);
  assert.strictEqual(up.config.chopTaps, base.config.chopTaps - 2);
  assert.strictEqual(up.config.burnMs, Math.round(base.config.burnMs * 1.5));
  assert.strictEqual(up.config.patienceMs, Math.round(base.config.patienceMs * 1.2));
  assert.strictEqual(rush.LEVELS.length, 10);
  // later levels are harder
  for (let i = 3; i < 10; i++) assert.ok(rush.LEVELS[i].spawnMs <= rush.LEVELS[i - 1].spawnMs && rush.LEVELS[i].patienceMs <= rush.LEVELS[i - 1].patienceMs);
});

test('Midnight Snack upgrades make nights quieter', () => {
  const g = sneak.createSneakGame(7, ['slippers', 'quietFridge', 'earplugs', 'catTreat']);
  assert.strictEqual(g.rules.creak, 2);
  assert.strictEqual(g.rules.fridge, 2);
  assert.strictEqual(g.maxNoise, Math.round(sneak.LEVELS[6].maxNoise * 1.15));
  assert.strictEqual(g.catPath.length, 1);
  // the hardest night becomes comfortable with upgrades
  const hard = play(9, SOLUTIONS[9].errands, [0, 0], ['slippers', 'earplugs']);
  const plain = play(9, SOLUTIONS[9].errands, [0, 0]);
  assert.strictEqual(hard.phase, 'won');
  assert.ok(hard.maxNoise - hard.noise > plain.maxNoise - plain.noise);
});

test('Recipe Relay gets harder through the evening, notebook gives a step', () => {
  assert.deepStrictEqual([1, 3, 4, 6, 7, 12].map(relay.tierFor), [0, 0, 1, 1, 2, 2]);
  const late = relay.createRelayGame(7);
  assert.strictEqual(late.totalTurns, 7);
  assert.strictEqual(late.recipe.cards.flat().length, 8);
  assert.strictEqual(relay.createRelayGame(7, ['notebook']).totalTurns, 8);
  // every tier stays solvable: play the hidden target, padded with actions
  for (const round of [1, 4, 7]) {
    for (let i = 0; i < 300; i++) {
      const g = relay.createRelayGame(round);
      const { ingredients, actions } = g.recipe.target;
      const steps = [...ingredients.map(id => ({ kind: 'ingredient', id })), ...actions.map(id => ({ kind: 'action', id }))];
      while (steps.length < g.totalTurns) steps.splice(steps.length - 1, 0, { kind: 'action', id: actions[0] });
      for (const st of steps) assert.strictEqual(relay.applyMove(g, relay.currentPlayer(g), st), null);
      assert.strictEqual(g.result.stars, 3, `round ${round}: ${JSON.stringify(g.recipe.cards)}`);
    }
  }
});
