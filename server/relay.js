// Recipe Relay — turn-based co-op cooking with Grandma watching.
//
// The server secretly picks a REAL dish (phở bò, canh chua, mì Ý sốt cà…),
// derives clues from its recipe and splits them between the two players.
// Players take turns adding one ingredient, doing one action, or scooping the
// last ingredient back out. Grandma 👵 reacts to every step: a wrong ingredient
// or action costs one of her hearts, and when they run out she kicks you out of
// the kitchen — the round is lost on the spot. Cook the exact recipe to win.
// Afterwards both players guess which dish it was.
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

// Real dishes. Each uses 3–5 ingredients from the pantry and 1–2 actions.
const DISHES = {
  phobo:      { emoji: '🍜', name: { en: 'Beef Phở', vi: 'Phở bò' },                  ings: ['thit_bo', 'bun', 'onion', 'herbs'],        acts: ['boil', 'salt'] },
  canhchua:   { emoji: '🍲', name: { en: 'Sour Fish Soup', vi: 'Canh chua cá' },     ings: ['ca', 'thom', 'tomato', 'herbs'],           acts: ['boil'] },
  bunbohue:   { emoji: '🌶️', name: { en: 'Spicy Beef Noodles', vi: 'Bún bò Huế' },   ings: ['thit_bo', 'bun', 'sa', 'chili'],           acts: ['boil'] },
  comchien:   { emoji: '🍳', name: { en: 'Egg Fried Rice', vi: 'Cơm chiên trứng' },  ings: ['rice', 'egg', 'onion', 'garlic'],          acts: ['stir', 'salt'] },
  gaxaosa:    { emoji: '🍗', name: { en: 'Lemongrass Chili Chicken', vi: 'Gà xào sả ớt' }, ings: ['chicken', 'sa', 'chili', 'garlic'], acts: ['stir'] },
  raumuong:   { emoji: '🥬', name: { en: 'Garlic Water Spinach', vi: 'Rau muống xào tỏi' }, ings: ['rau_muong', 'garlic', 'nuoc_mam'],  acts: ['stir'] },
  miysotca:   { emoji: '🍝', name: { en: 'Tomato Pasta', vi: 'Mì Ý sốt cà' },        ings: ['noodles', 'tomato', 'garlic', 'cheese'],   acts: ['boil', 'stir'] },
  supnam:     { emoji: '🍄', name: { en: 'Creamy Mushroom Soup', vi: 'Súp kem nấm' }, ings: ['mushroom', 'milk', 'onion', 'potato'],     acts: ['boil', 'stir'] },
  supgabap:   { emoji: '🌽', name: { en: 'Chicken Corn Soup', vi: 'Súp gà bắp' },    ings: ['chicken', 'corn', 'egg', 'carrot'],        acts: ['boil'] },
  tomrim:     { emoji: '🦐', name: { en: 'Honey Garlic Shrimp', vi: 'Tôm rim mật ong' }, ings: ['shrimp', 'honey', 'garlic', 'nuoc_mam'], acts: ['stir'] },
  thitkho:    { emoji: '🥚', name: { en: 'Braised Pork & Eggs', vi: 'Thịt kho trứng' }, ings: ['thit_heo', 'egg', 'nuoc_mam', 'honey'],  acts: ['boil'] },
  khoaitay:   { emoji: '🥔', name: { en: 'Cheesy Mashed Potato', vi: 'Khoai tây nghiền phô mai' }, ings: ['potato', 'milk', 'cheese'], acts: ['boil', 'stir'] },
  cariga:     { emoji: '🍛', name: { en: 'Chicken Curry', vi: 'Cà ri gà' },          ings: ['chicken', 'potato', 'carrot', 'sa', 'milk'], acts: ['boil'] },
  goicuon:    { emoji: '🌯', name: { en: 'Fresh Spring Rolls', vi: 'Gỏi cuốn tôm thịt' }, ings: ['shrimp', 'thit_heo', 'bun', 'herbs'], acts: ['boil'] },
  chaoga:     { emoji: '🥣', name: { en: 'Chicken Rice Porridge', vi: 'Cháo gà' },    ings: ['rice', 'chicken', 'onion', 'herbs'],       acts: ['boil', 'salt'] },
};

// Each round only some ingredients are "at the market", so the pantry fits on a phone
// and every round feels a little different. The secret dish's ingredients are always there.
const MARKET_SIZE = 18;

const ACTIONS = {
  stir: { emoji: '🥄', name: { en: 'Stir', vi: 'Khuấy' } },
  boil: { emoji: '♨️', name: { en: 'Boil', vi: 'Đun' } },
  salt: { emoji: '🧂', name: { en: 'Salt', vi: 'Nêm' } },
};

// Difficulty climbs through the evening: vaguer riddles (decoys in the market),
// then a grumpier grandma. Tuned with test/relay-bot.js (a naive guessing couple):
// perfect ≈ 82% / 48% / 45%, kicked out ≈ 2% / 10% / 34%.
const TIERS = [
  { fromRound: 1, turns: 8, maxTags: 3, target: [1, 1], hearts: 3 },   // exact riddles, patient grandma
  { fromRound: 4, turns: 8, maxTags: 2, target: [1, 2], hearts: 3 },   // some riddles fit a decoy too
  { fromRound: 7, turns: 8, maxTags: 2, target: [1, 2], hearts: 2 },   // same riddles, but Grandma only has 2 hearts
];
const tierFor = round => TIERS.reduce((t, x, i) => (round >= x.fromRound ? i : t), 0);
const TOTAL_TURNS = TIERS[0].turns;
const GUESS_OPTIONS = 4;

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

const potIngs = pot => pot.filter(s => s.kind === 'ingredient').map(s => s.id);
const potActs = pot => pot.filter(s => s.kind === 'action').map(s => s.id);

// ---- Clues ---------------------------------------------------------------
//
// Each ingredient of the secret recipe becomes a little riddle made of its tags
// ("a red, sour veggie"), picked so as few market items as possible match it.
// Each needed action is a clue too ("needs boiling"). The riddles and actions
// are dealt alternately onto the two cards. The answer (`id`) never leaves the
// server: viewFor strips it.

// Which tag reads as the noun of a riddle, most specific first.
const NOUN_TAGS = ['meat', 'seafood', 'dairy', 'herb', 'grain', 'fruit', 'veg', 'protein'];

function matching(market, tags) {
  return market.filter(id => tags.every(t => INGREDIENTS[id].tags.includes(t)));
}

function subsets(list, maxSize) {
  const out = [];
  const rec = (i, cur) => {
    if (cur.length) out.push(cur.slice());
    if (cur.length === maxSize) return;
    for (let j = i; j < list.length; j++) { cur.push(list[j]); rec(j + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

// `target` = how many market items the riddle should fit (1 = exact, 2+ = decoys).
function riddleFor(id, market, maxTags, target, rand) {
  const tags = INGREDIENTS[id].tags;
  const options = subsets(tags, maxTags).map(sub => ({ sub, n: matching(market, sub).length }));
  const dist = o => Math.abs(o.n - target) + (o.n < target ? 0.5 : 0);   // prefer slightly too vague over too exact
  const bestDist = Math.min(...options.map(dist));
  const pool = options.filter(o => dist(o) === bestDist);
  const best = pool[0].n;
  const smallest = Math.min(...pool.map(o => o.sub.length));
  const pick = pool.filter(o => o.sub.length === smallest);
  const chosen = pick[Math.floor(rand() * pick.length)].sub;
  // put the noun tag (if any) first, so clients can phrase it naturally
  chosen.sort((a, b) => (NOUN_TAGS.includes(b) ? 1 : 0) - (NOUN_TAGS.includes(a) ? 1 : 0));
  return { type: 'riddle', id, tags: chosen, matches: matching(market, chosen).length };
}

function makeClues(dish, market, maxTags = 3, rand = Math.random, target = [1, 1]) {
  const riddles = shuffle(dish.ings, rand).map(id => riddleFor(id, market, maxTags, target[0] + Math.floor(rand() * (target[1] - target[0] + 1)), rand));
  const acts = shuffle(dish.acts, rand).map(id => ({ type: 'hasAction', id }));
  const cards = [[], []];
  riddles.forEach((c, i) => cards[i % 2].push(c));
  // each action clue goes to whichever card is shorter, so both cards stay even
  acts.forEach((c, i) => cards[cards[0].length === cards[1].length ? i % 2 : cards[0].length < cards[1].length ? 0 : 1].push(c));
  return cards;
}

function checkClue(clue, pot) {
  const ings = potIngs(pot), acts = potActs(pot);
  switch (clue.type) {
    case 'riddle':    return ings.includes(clue.id);
    case 'hasAction': return acts.includes(clue.id);
    default:          return false;
  }
}

// Send clues without the answer.
const publicClue = ({ id, matches, ...c }) => (c.type === 'riddle' ? c : { ...c, id });

// ---- Game ----------------------------------------------------------------

function createRelayGame(round = 1, upgrades = [], rand = Math.random, dishId = null) {
  const tier = tierFor(round);
  const T = TIERS[tier];
  const turns = T.turns + (upgrades.includes('notebook') ? 1 : 0);
  const ids = Object.keys(DISHES);
  const dishKey = dishId && DISHES[dishId] ? dishId : ids[Math.floor(rand() * ids.length)];
  const dish = DISHES[dishKey];
  // Market: the dish's ingredients plus random others, in catalogue order.
  const all = Object.keys(INGREDIENTS);
  const extra = shuffle(all.filter(id => !dish.ings.includes(id)), rand).slice(0, MARKET_SIZE - dish.ings.length);
  const pick = new Set([...dish.ings, ...extra]);
  const market = all.filter(id => pick.has(id));
  const guessOptions = shuffle([dishKey, ...shuffle(ids.filter(d => d !== dishKey), rand).slice(0, GUESS_OPTIONS - 1)], rand);
  return {
    mode: 'relay',
    market,
    tier,
    round,
    phase: 'playing',            // playing → guessing → results
    turn: 0,
    totalTurns: turns,
    starter: (round - 1) % 2,    // alternate who goes first each round
    pot: [],                     // [{kind, id, by}]
    hearts: T.hearts,
    maxHearts: T.hearts,
    reactions: [],               // grandma's reaction to each step, for the client
    dish: dishKey,
    recipe: { cards: makeClues(dish, market, T.maxTags, rand, T.target) },
    guessOptions,
    guesses: [null, null],
    result: null,
  };
}

function currentPlayer(game) {
  return (game.starter + game.turn) % 2;
}

// Mistakes still in the pot right now (missing / wrong ingredients, missing actions).
function mistakes(game) {
  const dish = DISHES[game.dish];
  const ings = potIngs(game.pot), acts = potActs(game.pot);
  const missing = dish.ings.filter(id => !ings.includes(id)).length;
  const wrong = ings.filter(id => !dish.ings.includes(id)).length;
  const missingActs = dish.acts.filter(id => !acts.includes(id)).length;
  return { missing, wrong, missingActs, total: missing + wrong + missingActs };
}

// Returns an error code (translated on the client), or null on success.
function applyMove(game, seat, move) {
  if (game.phase !== 'playing') return 'round_over';
  if (currentPlayer(game) !== seat) return 'not_your_turn';
  if (!move || !['ingredient', 'action', 'remove'].includes(move.kind)) return 'invalid_move';
  const dish = DISHES[game.dish];
  let mood;   // grandma: 'yum' | 'ok' | 'meh' | 'yuck'

  if (move.kind === 'ingredient') {
    if (!game.market.includes(move.id)) return 'unknown_ingredient';
    if (game.pot.some(s => s.kind === 'ingredient' && s.id === move.id)) return 'already_in_pot';
    game.pot.push({ kind: 'ingredient', id: move.id, by: seat });
    mood = dish.ings.includes(move.id) ? 'yum' : 'yuck';
  } else if (move.kind === 'action') {
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, move.id)) return 'unknown_action';
    const done = potActs(game.pot).includes(move.id);
    game.pot.push({ kind: 'action', id: move.id, by: seat });
    mood = !dish.acts.includes(move.id) ? 'yuck' : done ? 'meh' : 'yum';
  } else {
    // Scoop out the most recently added ingredient.
    const idx = game.pot.map(s => s.kind).lastIndexOf('ingredient');
    if (idx === -1) return 'nothing_to_remove';
    const [removed] = game.pot.splice(idx, 1);
    move = { kind: 'remove', id: removed.id };
    mood = dish.ings.includes(removed.id) ? 'meh' : 'ok';
  }

  if (mood === 'yuck') game.hearts--;
  game.reactions.push({ step: game.turn, by: seat, kind: move.kind, id: move.id, mood, hearts: game.hearts });
  game.turn++;

  if (game.hearts <= 0) return finishRound(game, 'kicked'), null;
  if (mistakes(game).total === 0) return finishRound(game, 'perfect'), null;
  if (game.turn >= game.totalTurns) finishRound(game, 'time');
  return null;
}

function finishRound(game, how) {
  const m = mistakes(game);
  const checks = game.recipe.cards.map(card => card.map(c => checkClue(c, game.pot)));
  let stars, won;
  if (how === 'kicked') { stars = 0; won = false; }
  else if (how === 'perfect') { stars = 3; won = true; }
  else { stars = m.total === 1 ? 2 : m.total === 2 ? 1 : 0; won = stars > 0; }
  game.result = { how, won, stars, mistakes: m, checks, turnsLeft: game.totalTurns - game.turn, hearts: game.hearts };
  // Everyone gets to guess the dish (even after a loss — it's half the fun).
  game.phase = 'guessing';
}

function applyGuess(game, seat, dishId) {
  if (game.phase !== 'guessing') return 'not_guessing';
  if (!game.guessOptions.includes(dishId)) return 'invalid_move';
  if (game.guesses[seat]) return null;
  game.guesses[seat] = dishId;
  if (game.guesses[0] && game.guesses[1]) {
    game.result.guessed = game.guesses.map(g => g === game.dish);
    game.phase = 'results';
  }
  return null;
}

// Pieces of the dish's name for the recap; clients word it in their language.
function dishInfo(game) {
  const by = [0, 0];
  game.pot.forEach(s => { if (s.kind === 'ingredient') by[s.by]++; });
  return { dish: game.dish, chefs: by[0] === by[1] ? [0, 1] : [by[0] > by[1] ? 0 : 1] };
}

// What a given seat is allowed to see. The dish and the partner's card stay hidden until results.
function viewFor(game, seat) {
  const v = {
    mode: 'relay',
    market: game.market,
    tier: game.tier,
    round: game.round,
    phase: game.phase,
    turn: game.turn,
    totalTurns: game.totalTurns,
    currentSeat: game.phase === 'playing' ? currentPlayer(game) : null,
    pot: game.pot,
    hearts: game.hearts,
    maxHearts: game.maxHearts,
    reactions: game.reactions,
    myCard: game.recipe.cards[seat].map(publicClue),
    ingCount: DISHES[game.dish].ings.length,
    actCount: DISHES[game.dish].acts.length,
  };
  if (game.phase === 'guessing') {
    v.guessOptions = game.guessOptions;
    v.myGuess = game.guesses[seat];
    v.partnerGuessed = !!game.guesses[1 - seat];
    v.how = game.result.how;
  }
  if (game.phase === 'results') {
    v.cards = game.recipe.cards.map(card => card.map(c => ({ ...publicClue(c), answer: c.id })));
    v.result = game.result;
    v.dish = game.dish;
    v.dishInfo = dishInfo(game);
    v.guesses = game.guesses;
  }
  return v;
}

module.exports = {
  INGREDIENTS, DISHES, ACTIONS, TOTAL_TURNS, MARKET_SIZE, TIERS, tierFor,
  createRelayGame, applyMove, applyGuess, viewFor, checkClue, makeClues, currentPlayer, dishInfo, mistakes,
};
