// Recipe Relay — turn-based co-op mode.
// The server secretly picks a target dish, derives clues that are all true for
// that dish, and splits them between the two players. Players take turns adding
// one ingredient or doing one action to a shared pot. At the end the pot is
// judged against every clue.

const INGREDIENTS = {
  carrot:   { emoji: '🥕', name: 'Carrot',   tags: ['veg', 'orange', 'sweet'] },
  garlic:   { emoji: '🧄', name: 'Garlic',   tags: ['veg', 'white', 'savory'] },
  onion:    { emoji: '🧅', name: 'Onion',    tags: ['veg', 'white', 'savory'] },
  chili:    { emoji: '🌶️', name: 'Chili',    tags: ['veg', 'red', 'spicy'] },
  tomato:   { emoji: '🍅', name: 'Tomato',   tags: ['veg', 'red', 'sour'] },
  mushroom: { emoji: '🍄', name: 'Mushroom', tags: ['veg', 'brown', 'savory'] },
  potato:   { emoji: '🥔', name: 'Potato',   tags: ['veg', 'brown', 'starchy'] },
  corn:     { emoji: '🌽', name: 'Corn',     tags: ['veg', 'yellow', 'sweet'] },
  lemon:    { emoji: '🍋', name: 'Lemon',    tags: ['fruit', 'yellow', 'sour'] },
  cheese:   { emoji: '🧀', name: 'Cheese',   tags: ['dairy', 'yellow', 'savory'] },
  milk:     { emoji: '🥛', name: 'Milk',     tags: ['dairy', 'white', 'sweet'] },
  egg:      { emoji: '🥚', name: 'Egg',      tags: ['protein', 'white', 'savory'] },
  chicken:  { emoji: '🍗', name: 'Chicken',  tags: ['protein', 'meat', 'brown', 'savory'] },
  shrimp:   { emoji: '🦐', name: 'Shrimp',   tags: ['protein', 'seafood', 'orange', 'savory'] },
  rice:     { emoji: '🍚', name: 'Rice',     tags: ['grain', 'white', 'starchy'] },
  noodles:  { emoji: '🍜', name: 'Noodles',  tags: ['grain', 'yellow', 'starchy'] },
  honey:    { emoji: '🍯', name: 'Honey',    tags: ['sweet', 'yellow'] },
  herbs:    { emoji: '🌿', name: 'Herbs',    tags: ['herb', 'green', 'fresh'] },
};

const ACTIONS = {
  stir:   { emoji: '🥄', name: 'Stir', past: 'stirred' },
  boil:   { emoji: '♨️', name: 'Boil', past: 'boiled' },
  salt:   { emoji: '🧂', name: 'Salt', past: 'salted' },
};

const TAG_LABELS = {
  veg: 'a veggie', fruit: 'a fruit', dairy: 'dairy', protein: 'protein', meat: 'meat',
  seafood: 'seafood', grain: 'a grain', herb: 'herbs',
  orange: 'something orange', white: 'something white', red: 'something red',
  brown: 'something brown', yellow: 'something yellow', green: 'something green',
  sweet: 'something sweet', savory: 'something savory', spicy: 'something SPICY',
  sour: 'something sour', starchy: 'something starchy', fresh: 'something fresh',
};

const DISH_TYPES = ['Soup', 'Stew', 'Stir-fry', 'Curry', 'Bowl', 'Hotpot', 'Risotto', 'Broth'];
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
  switch (clue.type) {
    case 'hasTag':     return (tags[clue.tag] || 0) >= 1;
    case 'noTag':      return !tags[clue.tag];
    case 'minTag':     return (tags[clue.tag] || 0) >= clue.n;
    case 'hasIng':     return ings.includes(clue.id);
    case 'noIng':      return !ings.includes(clue.id);
    case 'hasAction':  return acts.includes(clue.id);
    case 'noAction':   return !acts.includes(clue.id);
    case 'maxIngs':    return ings.length <= clue.n;
    case 'minIngs':    return ings.length >= clue.n;
    case 'lastIs':     return pot.length > 0 && pot[pot.length - 1].kind === 'action' && pot[pot.length - 1].id === clue.id;
    default:           return false;
  }
}

function clueText(clue) {
  switch (clue.type) {
    case 'hasTag':    return `has ${TAG_LABELS[clue.tag]}`;
    case 'noTag':     return `NO ${TAG_LABELS[clue.tag].replace(/^(a |something )/, '')}`;
    case 'minTag':    return `at least ${clue.n}× ${TAG_LABELS[clue.tag].replace(/^(a |something )/, '')}`;
    case 'hasIng':    return `must include ${INGREDIENTS[clue.id].emoji} ${INGREDIENTS[clue.id].name.toLowerCase()}`;
    case 'noIng':     return `absolutely no ${INGREDIENTS[clue.id].emoji} ${INGREDIENTS[clue.id].name.toLowerCase()}`;
    case 'hasAction': return `must be ${ACTIONS[clue.id].past} at some point`;
    case 'noAction':  return `never ${ACTIONS[clue.id].name.toLowerCase()} it`;
    case 'maxIngs':   return `no more than ${clue.n} ingredients`;
    case 'minIngs':   return `at least ${clue.n} ingredients`;
    case 'lastIs':    return `finish with a ${ACTIONS[clue.id].emoji} ${ACTIONS[clue.id].name.toLowerCase()}`;
    default:          return '???';
  }
}

// ---- Recipe generation ---------------------------------------------------

// Build every clue that is TRUE for the target dish, then pick a varied set.
function candidateClues(targetIngs, targetActs, lastAction) {
  const tags = tagsOf(targetIngs);
  const allIngIds = Object.keys(INGREDIENTS);
  const out = [];

  for (const [tag, n] of Object.entries(tags)) {
    out.push({ type: 'hasTag', tag, w: 3 });
    if (n >= 2) out.push({ type: 'minTag', tag, n: 2, w: 4 });
  }
  for (const tag of Object.keys(TAG_LABELS)) {
    if (!tags[tag] && ['dairy', 'meat', 'seafood', 'spicy', 'sweet', 'sour', 'grain', 'protein'].includes(tag)) {
      out.push({ type: 'noTag', tag, w: 3 });
    }
  }
  for (const id of targetIngs) out.push({ type: 'hasIng', id, w: 2 });
  for (const id of shuffle(allIngIds.filter(i => !targetIngs.includes(i))).slice(0, 3)) {
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

function generateRecipe(rand = Math.random) {
  const ingIds = Object.keys(INGREDIENTS);
  const nIngs = 4 + Math.floor(rand() * 2);          // 4–5 ingredients
  const targetIngs = shuffle(ingIds, rand).slice(0, nIngs);
  const nActs = TOTAL_TURNS - nIngs >= 3 ? 2 : 1;     // fits in 8 turns with room to spare
  const targetActs = shuffle(Object.keys(ACTIONS), rand).slice(0, nActs);
  const lastAction = targetActs[targetActs.length - 1];

  // Weighted shuffle: higher-weight clues tend to come first, with some randomness.
  const pool = candidateClues(targetIngs, targetActs, lastAction)
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
  const clues = shuffle(chosen, rand).map(({ w, ...c }) => ({ ...c, text: clueText(c) }));
  return {
    dishType: DISH_TYPES[Math.floor(rand() * DISH_TYPES.length)],
    target: { ingredients: targetIngs, actions: targetActs },
    cards: [clues.slice(0, CLUES_PER_PLAYER), clues.slice(CLUES_PER_PLAYER)],
  };
}

// ---- Game state ----------------------------------------------------------

function createRelayGame(round = 1, rand = Math.random) {
  const recipe = generateRecipe(rand);
  return {
    mode: 'relay',
    round,
    phase: 'playing',            // 'playing' | 'results'
    turn: 0,                     // 0..TOTAL_TURNS-1
    totalTurns: TOTAL_TURNS,
    starter: (round - 1) % 2,    // alternate who goes first each round
    pot: [],                     // [{kind, id, by}]
    recipe,
    result: null,
  };
}

function currentPlayer(game) {
  return (game.starter + game.turn) % 2;
}

// Returns an error string, or null on success.
function applyMove(game, seat, move) {
  if (game.phase !== 'playing') return 'The round is over.';
  if (currentPlayer(game) !== seat) return "It's not your turn.";
  if (!move || (move.kind !== 'ingredient' && move.kind !== 'action')) return 'Invalid move.';
  if (move.kind === 'ingredient') {
    if (!INGREDIENTS[move.id]) return 'Unknown ingredient.';
    if (game.pot.some(s => s.kind === 'ingredient' && s.id === move.id)) return "That's already in the pot.";
  } else if (!ACTIONS[move.id]) {
    return 'Unknown action.';
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

function dishName(game, names) {
  const ings = game.pot.filter(s => s.kind === 'ingredient').map(s => s.id);
  const tags = tagsOf(ings);
  const flavor = ['spicy', 'sweet', 'sour', 'savory'].sort((a, b) => (tags[b] || 0) - (tags[a] || 0))[0];
  const flavorWord = tags[flavor] ? flavor[0].toUpperCase() + flavor.slice(1) : 'Mystery';
  // Credit whoever added the most ingredients (ties → both).
  const by = [0, 0];
  game.pot.forEach(s => { if (s.kind === 'ingredient') by[s.by]++; });
  const chef = by[0] === by[1] ? `${names[0]} & ${names[1]}'s` : `${names[by[0] > by[1] ? 0 : 1]}'s`;
  const star = ings[0] ? INGREDIENTS[ings[0]].name : '';
  return `${chef} ${flavorWord} ${star} ${game.recipe.dishType}`.replace(/\s+/g, ' ').trim();
}

// What a given seat is allowed to see. The partner's card stays hidden until results.
function viewFor(game, seat, names) {
  const v = {
    mode: 'relay',
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
    v.dishName = dishName(game, names);
    v.target = game.recipe.target;
  }
  return v;
}

module.exports = {
  INGREDIENTS, ACTIONS, TOTAL_TURNS,
  createRelayGame, applyMove, viewFor, checkClue, generateRecipe, currentPlayer,
};
