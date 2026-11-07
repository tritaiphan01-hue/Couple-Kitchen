// Recipe Relay — turn-based co-op mode.
// The server secretly picks a target dish, derives clues that are all true for
// that dish, and splits them between the two players. Players take turns adding
// one ingredient or doing one action to a shared pot. At the end the pot is
// judged against every clue.
//
// One combined Western + Vietnamese pantry; each round deals a random "market".
// Everything sent to clients is language-neutral data (ids, tags, numbers).
// Each phone turns it into English or Vietnamese text itself, so the two
// partners can even play in different languages.

const ing = (emoji, en, vi, tags) => ({ emoji, name: { en, vi }, tags });

// One combined pantry: Western and Vietnamese ingredients together.
const INGREDIENTS = {
  carrot:    ing('🥕', 'Carrot',        'Cà rốt',     ['veg', 'orange', 'sweet']),
  garlic:    ing('🧄', 'Garlic',        'Tỏi',        ['veg', 'white', 'savory']),
  onion:     ing('🧅', 'Onion',         'Hành',       ['veg', 'white', 'savory']),
  chili:     ing('🌶️', 'Chili',         'Ớt',         ['veg', 'red', 'spicy']),
  tomato:    ing('🍅', 'Tomato',        'Cà chua',    ['veg', 'red', 'sour']),
  mushroom:  ing('🍄', 'Mushroom',      'Nấm',        ['veg', 'brown', 'savory']),
  potato:    ing('🥔', 'Potato',        'Khoai tây',  ['veg', 'brown', 'starchy']),
  corn:      ing('🌽', 'Corn',          'Bắp',        ['veg', 'yellow', 'sweet']),
  rau_muong: ing('🥬', 'Water spinach', 'Rau muống',  ['veg', 'green', 'fresh']),
  lemon:     ing('🍋', 'Lime',          'Chanh',      ['fruit', 'yellow', 'sour']),
  thom:      ing('🍍', 'Pineapple',     'Thơm',       ['fruit', 'yellow', 'sweet', 'sour']),
  cheese:    ing('🧀', 'Cheese',        'Phô mai',    ['dairy', 'yellow', 'savory']),
  milk:      ing('🥛', 'Milk',          'Sữa',        ['dairy', 'white', 'sweet']),
  egg:       ing('🥚', 'Egg',           'Trứng',      ['protein', 'white', 'savory']),
  chicken:   ing('🍗', 'Chicken',       'Gà',         ['protein', 'meat', 'brown', 'savory']),
  thit_heo:  ing('🥓', 'Pork',          'Thịt heo',   ['protein', 'meat', 'red', 'savory']),
  thit_bo:   ing('🥩', 'Beef',          'Thịt bò',    ['protein', 'meat', 'red', 'savory']),
  shrimp:    ing('🦐', 'Shrimp',        'Tôm',        ['protein', 'seafood', 'orange', 'savory']),
  ca:        ing('🐟', 'Fish',          'Cá',         ['protein', 'seafood', 'white', 'savory']),
  nuoc_mam:  ing('🧴', 'Fish sauce',    'Nước mắm',   ['seafood', 'brown', 'savory']),
  rice:      ing('🍚', 'Rice',          'Cơm',        ['grain', 'white', 'starchy']),
  noodles:   ing('🍝', 'Pasta',         'Mì Ý',       ['grain', 'yellow', 'starchy']),
  bun:       ing('🍜', 'Vermicelli',    'Bún',        ['grain', 'white', 'starchy']),
  honey:     ing('🍯', 'Honey',         'Mật ong',    ['sweet', 'yellow']),
  herbs:     ing('🌿', 'Herbs',         'Rau thơm',   ['herb', 'green', 'fresh']),
  sa:        ing('🌾', 'Lemongrass',    'Sả',         ['herb', 'green', 'fresh']),
};

const DISH_TYPES = {
  soup:     { en: 'Soup',       vi: 'Súp' },
  stew:     { en: 'Stew',       vi: 'Món hầm' },
  stirfry:  { en: 'Stir-fry',   vi: 'Món xào' },
  curry:    { en: 'Curry',      vi: 'Cà ri' },
  risotto:  { en: 'Risotto',    vi: 'Cơm Ý' },
  pie:      { en: 'Pot Pie',    vi: 'Bánh nướng' },
  pho:      { en: 'Phở',        vi: 'Phở' },
  canhchua: { en: 'Canh Chua',  vi: 'Canh chua' },
  bun:      { en: 'Bún',        vi: 'Bún' },
  comchien: { en: 'Fried Rice', vi: 'Cơm chiên' },
  lau:      { en: 'Lẩu',        vi: 'Lẩu' },
  chao:     { en: 'Cháo',       vi: 'Cháo' },
  goi:      { en: 'Gỏi',        vi: 'Gỏi' },
  kho:      { en: 'Kho',        vi: 'Món kho' },
};

// Each round only some ingredients are "at the market", so the pantry fits on a phone
// and every round feels a little different.
const MARKET_SIZE = 18;

const ACTIONS = {
  stir: { emoji: '🥄', name: { en: 'Stir', vi: 'Khuấy' } },
  boil: { emoji: '♨️', name: { en: 'Boil', vi: 'Đun' } },
  salt: { emoji: '🧂', name: { en: 'Salt', vi: 'Nêm' } },
};

// Tags that make good "NO …" clues when the target dish lacks them.
const NEGATABLE_TAGS = ['dairy', 'meat', 'seafood', 'spicy', 'sweet', 'sour', 'grain', 'protein', 'fruit', 'herb'];
const TOTAL_TURNS = 8;
const CLUES_PER_PLAYER = 3;

function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tagsOf(ingredientIds) {
  const counts = {};
  for (const id of ingredientIds) for (const t of INGREDIENTS[id].tags) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

// ---- Clue checking -------------------------------------------------------

function checkClue(clue, pot) {
  const ings = pot.filter(s => s.kind === 'ingredient').map(s => s.id);
  const acts = pot.filter(s => s.kind === 'action').map(s => s.id);
  const tags = tagsOf(ings);
  const last = pot[pot.length - 1];
  switch (clue.type) {
    case 'hasTag':    return (tags[clue.tag] || 0) >= 1;
    case 'noTag':     return !tags[clue.tag];
    case 'minTag':    return (tags[clue.tag] || 0) >= clue.n;
    case 'hasIng':    return ings.includes(clue.id);
    case 'noIng':     return !ings.includes(clue.id);
    case 'hasAction': return acts.includes(clue.id);
    case 'noAction':  return !acts.includes(clue.id);
    case 'maxIngs':   return ings.length <= clue.n;
    case 'minIngs':   return ings.length >= clue.n;
    case 'lastIs':    return !!last && last.kind === 'action' && last.id === clue.id;
    default:          return false;
  }
}

// ---- Recipe generation ---------------------------------------------------

// Build every clue that is TRUE for the target dish, then pick a varied set.
function candidateClues(market, targetIngs, targetActs, lastAction, rand) {
  const tags = tagsOf(targetIngs);
  const marketTags = tagsOf(market);
  const out = [];

  for (const [tag, n] of Object.entries(tags)) {
    out.push({ type: 'hasTag', tag, w: 3 });
    if (n >= 2) out.push({ type: 'minTag', tag, n: 2, w: 4 });
  }
  // Only forbid things the pantry actually contains, otherwise the clue is free.
  for (const tag of NEGATABLE_TAGS) {
    if (!tags[tag] && marketTags[tag]) out.push({ type: 'noTag', tag, w: 3 });
  }
  for (const id of targetIngs) out.push({ type: 'hasIng', id, w: 2 });
  for (const id of shuffle(market.filter(i => !targetIngs.includes(i)), rand).slice(0, 3)) {
    out.push({ type: 'noIng', id, w: 1 });
  }
  for (const id of Object.keys(ACTIONS)) {
    out.push(targetActs.includes(id) ? { type: 'hasAction', id, w: 3 } : { type: 'noAction', id, w: 2 });
  }
  out.push({ type: 'maxIngs', n: targetIngs.length + 1, w: 2 });
  if (targetIngs.length >= 4) out.push({ type: 'minIngs', n: targetIngs.length - 1, w: 2 });
  if (lastAction) out.push({ type: 'lastIs', id: lastAction, w: 2 });
  return out;
}

// Two clues "collide" if they talk about the same thing — keeps the card varied.
function clueKey(c) {
  if (c.type === 'hasTag' || c.type === 'minTag' || c.type === 'noTag') return 'tag:' + c.tag;
  if (c.type === 'hasIng' || c.type === 'noIng') return 'ing:' + c.id;
  if (c.type === 'hasAction' || c.type === 'noAction' || c.type === 'lastIs') return 'act:' + c.id;
  if (c.type === 'maxIngs' || c.type === 'minIngs') return 'count';
  return c.type;
}

function generateRecipe(market = Object.keys(INGREDIENTS), rand = Math.random) {
  const ingIds = market;
  const nIngs = 4 + Math.floor(rand() * 2);          // 4–5 ingredients
  const targetIngs = shuffle(ingIds, rand).slice(0, nIngs);
  const nActs = TOTAL_TURNS - nIngs >= 3 ? 2 : 1;     // fits in 8 turns with room to spare
  const targetActs = shuffle(Object.keys(ACTIONS), rand).slice(0, nActs);
  const lastAction = targetActs[targetActs.length - 1];

  // Weighted shuffle: higher-weight clues tend to come first, with some randomness.
  const pool = candidateClues(market, targetIngs, targetActs, lastAction, rand)
    .map(c => ({ c, score: c.w + rand() * 3 }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.c);
  const chosen = [];
  const usedKeys = new Set();
  for (const c of pool) {
    if (chosen.length >= CLUES_PER_PLAYER * 2) break;
    const k = clueKey(c);
    if (usedKeys.has(k)) continue;
    usedKeys.add(k);
    chosen.push(c);
  }
  const clues = shuffle(chosen, rand).map(({ w, ...c }) => c);
  const dishKeys = Object.keys(DISH_TYPES);
  return {
    dishType: dishKeys[Math.floor(rand() * dishKeys.length)],
    target: { ingredients: targetIngs, actions: targetActs },
    cards: [clues.slice(0, CLUES_PER_PLAYER), clues.slice(CLUES_PER_PLAYER)],
  };
}

// ---- Game state ----------------------------------------------------------

function createRelayGame(round = 1, rand = Math.random) {
  // Today's market, in a stable order (by catalogue position) so the pantry grid stays tidy.
  const all = Object.keys(INGREDIENTS);
  const pick = new Set(shuffle(all, rand).slice(0, MARKET_SIZE));
  const market = all.filter(id => pick.has(id));
  return {
    mode: 'relay',
    market,
    round,
    phase: 'playing',            // 'playing' | 'results'
    turn: 0,                     // 0..TOTAL_TURNS-1
    totalTurns: TOTAL_TURNS,
    starter: (round - 1) % 2,    // alternate who goes first each round
    pot: [],                     // [{kind, id, by}]
    recipe: generateRecipe(market, rand),
    result: null,
  };
}

function currentPlayer(game) {
  return (game.starter + game.turn) % 2;
}

// Returns an error code (translated on the client), or null on success.
function applyMove(game, seat, move) {
  if (game.phase !== 'playing') return 'round_over';
  if (currentPlayer(game) !== seat) return 'not_your_turn';
  if (!move || (move.kind !== 'ingredient' && move.kind !== 'action')) return 'invalid_move';
  if (move.kind === 'ingredient') {
    if (!game.market.includes(move.id)) return 'unknown_ingredient';
    if (game.pot.some(s => s.kind === 'ingredient' && s.id === move.id)) return 'already_in_pot';
  } else if (!Object.prototype.hasOwnProperty.call(ACTIONS, move.id)) {
    return 'unknown_action';
  }
  game.pot.push({ kind: move.kind, id: move.id, by: seat });
  game.turn++;
  if (game.turn >= game.totalTurns) finishRound(game);
  return null;
}

function finishRound(game) {
  const checks = game.recipe.cards.map(card => card.map(c => checkClue(c, game.pot)));
  const met = checks.flat().filter(Boolean).length;
  const total = checks.flat().length;
  const stars = met === total ? 3 : met >= total - 1 ? 2 : met >= total - 3 ? 1 : 0;
  game.phase = 'results';
  game.result = { checks, met, total, stars };
}

// The pieces of the dish's name; each client words it in its own language.
function dishInfo(game) {
  const ings = game.pot.filter(s => s.kind === 'ingredient').map(s => s.id);
  const tags = tagsOf(ings);
  const flavor = ['spicy', 'sweet', 'sour', 'savory'].sort((a, b) => (tags[b] || 0) - (tags[a] || 0))[0];
  // Credit whoever added the most ingredients (ties → both).
  const by = [0, 0];
  game.pot.forEach(s => { if (s.kind === 'ingredient') by[s.by]++; });
  return {
    chefs: by[0] === by[1] ? [0, 1] : [by[0] > by[1] ? 0 : 1],
    flavor: tags[flavor] ? flavor : null,
    star: ings[0] || null,
    dishType: game.recipe.dishType,
  };
}

// What a given seat is allowed to see. The partner's card stays hidden until results.
function viewFor(game, seat) {
  const v = {
    mode: 'relay',
    market: game.market,
    round: game.round,
    phase: game.phase,
    turn: game.turn,
    totalTurns: game.totalTurns,
    currentSeat: game.phase === 'playing' ? currentPlayer(game) : null,
    pot: game.pot,
    dishType: game.recipe.dishType,
    myCard: game.recipe.cards[seat],
  };
  if (game.phase === 'results') {
    v.cards = game.recipe.cards;
    v.result = game.result;
    v.dish = dishInfo(game);
    v.target = game.recipe.target;
  }
  return v;
}

module.exports = {
  INGREDIENTS, DISH_TYPES, ACTIONS, TOTAL_TURNS, MARKET_SIZE,
  createRelayGame, applyMove, viewFor, checkClue, generateRecipe, currentPlayer, dishInfo,
};
