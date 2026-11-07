// Runs the browser i18n module in a sandbox and renders every clue the server
// can generate, in both languages, checking nothing is missing or untranslated.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const relay = require('../server/relay');
const rush = require('../server/rush');

function loadI18n() {
  const ctx = {
    window: {}, localStorage: { getItem: () => null, setItem() {} },
    navigator: { languages: ['vi-VN'] },
    document: { documentElement: {}, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/i18n.js'), 'utf8'), ctx);
  const I = ctx.window.I18N;
  I.setCatalog(JSON.parse(JSON.stringify({ ingredients: relay.INGREDIENTS, dishes: relay.DISHES, actions: relay.ACTIONS, rush: { ingredients: rush.INGREDIENTS, dishes: rush.DISHES } })));
  return I;
}

test('every clue and dish name renders in English and Vietnamese', () => {
  const I = loadI18n();
  assert.strictEqual(I.detectLang(), 'vi');
  const bad = /\?\?\?|undefined|null|NaN|\{\w+\}/;
  for (const lang of ['en', 'vi']) {
    I.setLang(lang);
    for (let i = 0; i < 400; i++) {
      const g = relay.createRelayGame(1 + (i % 9));
      // what the phone actually receives (riddles without answers)
      for (const clue of relay.viewFor(g, i % 2).myCard) {
        const text = I.clueText(clue);
        assert.doesNotMatch(text, bad, `${lang}: ${JSON.stringify(clue)} → ${text}`);
      }
      const name = I.dishName(relay.dishInfo(g), ['Tri', 'Mai']);
      assert.doesNotMatch(name, bad, name);
      assert.match(name, /Tri|Mai/);
    }
    for (const key of ['gma.yum', 'gma.yuck', 'gma.meh', 'gma.oops', 'gma.ok']) assert.ok(I.pickLine(key).length > 3, key);
  }
  I.setLang('vi');
  assert.strictEqual(I.dishName({ dish: 'phobo', chefs: [0] }, ['Trí', 'Mai']), 'Phở bò của Trí');
  assert.strictEqual(I.clueText({ type: 'riddle', tags: ['veg', 'red', 'sour'] }), 'một loại rau củ màu đỏ, vị chua');
  assert.strictEqual(I.clueText({ type: 'riddle', tags: ['white', 'sweet'] }), 'thứ gì đó màu trắng, vị ngọt');
  assert.strictEqual(I.clueText({ type: 'hasAction', id: 'boil' }), 'cần ♨️ đun');
  I.setLang('en');
  assert.strictEqual(I.dishName({ dish: 'phobo', chefs: [0, 1] }, ['Tri', 'Mai']), "Tri & Mai's Beef Phở");
  assert.strictEqual(I.clueText({ type: 'riddle', tags: ['veg', 'red', 'sour'] }), 'a red, sour veggie');
  assert.strictEqual(I.clueText({ type: 'riddle', tags: ['herb'] }), 'a herb');
  assert.strictEqual(I.clueText({ type: 'riddle', tags: ['white', 'sweet'] }), 'something white & sweet');
  assert.strictEqual(I.clueText({ type: 'riddle', tags: ['seafood', 'orange'] }), 'an orange seafood');
});

test('every Split Kitchen ingredient and dish has both names', () => {
  for (const x of [...Object.values(rush.INGREDIENTS), ...Object.values(rush.DISHES)]) {
    assert.ok(x.emoji && x.name.en && x.name.vi, JSON.stringify(x));
  }
});

test('Vietnamese has every key English has', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/i18n.js'), 'utf8');
  const block = name => src.split(`    ${name}: {`)[1].split('\n    },')[0];
  const keys = b => [...b.matchAll(/^\s+'([\w.]+)':/gm)].map(m => m[1]).sort();
  assert.deepStrictEqual(keys(block('vi')), keys(block('en')));
});

test('every ingredient and Midnight Snack station has a drawn icon', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/icons.js'), 'utf8'), ctx);
  const I = ctx.window.Icons;
  const sneak = require('../server/sneak');
  const missing = [];
  const check = (mode, ids) => ids.forEach(id => { if (I.icon(mode, id).includes('class="emo"')) missing.push(`${mode}:${id}`); });
  check('relay', Object.keys(relay.INGREDIENTS));
  check('rush', Object.keys(rush.INGREDIENTS));
  check('sneak', Object.keys(sneak.INGREDIENTS));
  check('station', ['F', 'S', 'O', 'B', 'T', 'D', 'G']);
  assert.deepStrictEqual(missing, []);
  assert.ok(I.svg('cat'));
});

test('soundtrack loops are present and phone-friendly in size', () => {
  for (const mood of ['chill', 'rush', 'sneak']) {
    const file = path.join(__dirname, '../public/music', mood + '.mp3');
    assert.ok(fs.existsSync(file), mood);
    const kb = fs.statSync(file).size / 1024;
    assert.ok(kb > 100 && kb < 1500, `${mood}: ${kb.toFixed(0)} KB`);
    assert.strictEqual(fs.readFileSync(file).subarray(0, 3).toString('latin1') === 'ID3' || fs.readFileSync(file)[0] === 0xff, true);
  }
});
