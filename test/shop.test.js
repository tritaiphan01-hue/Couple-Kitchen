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

test('Recipe Relay tiers and the recipe notebook', () => {
  assert.deepStrictEqual([1, 3, 4, 6, 7, 12].map(relay.tierFor), [0, 0, 1, 1, 2, 2]);
  const base = relay.createRelayGame(7);
  assert.strictEqual(relay.createRelayGame(7, ['notebook']).totalTurns, base.totalTurns + 1);
});

test('saved progress is restored, merged between phones, and validated', () => {
  const levels = { rush: 10, sneak: 9 };
  const r = room();
  r.rushBest = {}; r.sneakBest = {};
  // Phone A opens the kitchen
  shop.importProgress(r, 0, {
    couple: { wallet: 300, upgrades: ['burner3', 'hat_bow', 'nope'], decorOwned: ['decor_sakura'], decor: 'decor_sakura', rushBest: { 1: 3, 2: 1, 99: 3, x: 2 }, sneakBest: { 1: 2 } },
    me: { owned: ['hat_crown', 'burner3'], look: { color: 'color_rose', hat: 'hat_crown', glasses: 'glasses_cool' } },
  }, levels, { merge: false });
  assert.strictEqual(r.shop.wallet, 300);
  assert.deepStrictEqual(r.shop.upgrades, ['burner3']);                 // look items / unknown ids dropped
  assert.strictEqual(r.shop.decor, 'decor_sakura');
  assert.deepStrictEqual(r.rushBest, { 1: 3, 2: 1 });                   // out-of-range levels dropped
  assert.deepStrictEqual(r.players[0].shop.owned, ['hat_crown']);
  assert.strictEqual(r.players[0].shop.look.hat, 'hat_crown');
  assert.strictEqual(r.players[0].shop.look.color, 'color_honey');      // rose wasn't owned
  assert.strictEqual(r.players[0].shop.look.glasses, 'glasses_none');

  // Phone B joins with its own (slightly different) copy
  shop.importProgress(r, 1, {
    couple: { wallet: 250, upgrades: ['slippers'], rushBest: { 2: 3, 3: 1 }, sneakBest: { 4: 1 } },
    me: { owned: ['hat_ears'], look: { hat: 'hat_ears' } },
  }, levels, { merge: true });
  assert.strictEqual(r.shop.wallet, 300);                               // larger wallet wins
  assert.deepStrictEqual(r.shop.upgrades.sort(), ['burner3', 'slippers']);
  assert.deepStrictEqual(r.rushBest, { 1: 3, 2: 3, 3: 1 });
  assert.deepStrictEqual(r.sneakBest, { 1: 2, 4: 1 });
  assert.strictEqual(r.players[1].shop.look.hat, 'hat_ears');
  assert.strictEqual(r.players[0].shop.look.hat, 'hat_crown');          // A's look untouched

  // Garbage is ignored safely
  shop.importProgress(r, 1, 'lol', levels, { merge: true });
  shop.importProgress(r, 1, { couple: { wallet: -5, upgrades: 'x' }, me: null }, levels, { merge: true });
  assert.strictEqual(r.shop.wallet, 300);
});
