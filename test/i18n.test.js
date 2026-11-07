// Runs the browser i18n module in a sandbox and renders every clue the server
// can generate, in both languages, checking nothing is missing or untranslated.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const relay = require('../server/relay');

function loadI18n() {
  const ctx = {
    window: {}, localStorage: { getItem: () => null, setItem() {} },
    navigator: { languages: ['vi-VN'] },
    document: { documentElement: {}, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/i18n.js'), 'utf8'), ctx);
  const I = ctx.window.I18N;
  I.setCatalog(JSON.parse(JSON.stringify({ packs: relay.PACKS, actions: relay.ACTIONS })));
  return I;
}

test('every clue and dish name renders in English and Vietnamese', () => {
  const I = loadI18n();
  assert.strictEqual(I.detectLang(), 'vi');
  const bad = /\?\?\?|undefined|null|NaN|\{\w+\}/;
  for (const lang of ['en', 'vi']) {
    I.setLang(lang);
    for (let i = 0; i < 400; i++) {
      const pack = i % 2 ? 'vietnam' : 'western';
      const g = relay.createRelayGame(1, pack);
      for (const clue of g.recipe.cards.flat()) {
        const text = I.clueText(clue);
        assert.doesNotMatch(text, bad, `${lang}: ${JSON.stringify(clue)} → ${text}`);
      }
      // Fill the pot with the target and name the dish.
      g.recipe.target.ingredients.forEach((id, k) => g.pot.push({ kind: 'ingredient', id, by: k % 2 }));
      const name = I.dishName(relay.dishInfo(g), ['Tri', 'Mai']);
      assert.doesNotMatch(name, bad, name);
      assert.match(name, /Tri|Mai/);
    }
  }
  I.setLang('vi');
  assert.match(I.dishName({ chefs: [0], flavor: 'spicy', star: 'tom', dishType: 'pho', pack: 'vietnam' }, ['Trí', 'Mai']), /^Phở tôm cay của Trí$/);
  I.setLang('en');
  assert.strictEqual(I.dishName({ chefs: [0, 1], flavor: 'spicy', star: 'tom', dishType: 'pho', pack: 'vietnam' }, ['Tri', 'Mai']), "Tri & Mai's Spicy Shrimp Phở");
});

test('Vietnamese has every key English has', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/i18n.js'), 'utf8');
  const block = name => src.split(`    ${name}: {`)[1].split('\n    },')[0];
  const keys = b => [...b.matchAll(/^\s+'([\w.]+)':/gm)].map(m => m[1]).sort();
  assert.deepStrictEqual(keys(block('vi')), keys(block('en')));
});
