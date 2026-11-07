// Midnight Snack — co-op stealth puzzle.
//
// Both partners see the same dark kitchen grid and each controls one chef.
// Every round each player plans up to 3 steps (move / use a station / wait) and
// locks in. When both are locked, the steps play out simultaneously.
//
// Everything makes noise. If the noise meter fills, the roommate wakes up and
// you lose. Get every part of the snack onto the table before that (or before
// sunrise) to win. Noise settles a little at the end of each round.

const it = (emoji, en, vi) => ({ emoji, name: { en, vi } });
const INGREDIENTS = {
  bread:    it('🍞', 'Bread', 'Bánh mì'),
  cheese:   it('🧀', 'Cheese', 'Phô mai'),
  noodles:  it('🍜', 'Instant noodles', 'Mì gói'),
  egg:      it('🥚', 'Egg', 'Trứng'),
  pork:     it('🥓', 'Pork', 'Thịt heo'),
  cucumber: it('🥒', 'Cucumber', 'Dưa leo'),
};

const STEPS_PER_ROUND = 3;
const NOISE = { walk: 1, creak: 3, nearDoor: 1, fridge: 3, fridgeHeld: 1, shelf: 1, stove: 2, board: 2, bonk: 5, meow: 5 };
const DECAY = 1;

// Map legend:
//   #  wall / counter      .  floor        ~  creaky floorboard
//   D  roommate's door     1 2  start positions (floor)
//   F  fridge   S  shelf   O  stove   B  chopping board   T  table
const LEVELS = [
  {
    snack: { emoji: '🥪', name: { en: 'Cheese Sandwich', vi: 'Bánh mì phô mai' } },
    map: [
      '##D####',
      '#....S#',
      '#.~~..#',
      '#..F..#',
      '#..T..#',
      '#.~...#',
      '#..~..#',
      '#.1.2.#',
      '#######',
    ],
    sources: { F: ['cheese'], S: ['bread'] },
    recipe: ['bread:raw', 'cheese:raw'],
    cat: [[5, 6]],                       // asleep — doesn't move
    maxNoise: 24, par: 5, maxRounds: 10,    // bot: 4 rounds, 17 noise
  },
  {
    snack: { emoji: '🍜', name: { en: 'Midnight Noodles', vi: 'Mì gói trứng' } },
    map: [
      '####D##',
      '#S....#',
      '#.~#~.#',
      '#..F..#',
      'O.....#',
      '#.~T..#',
      '#....~#',
      '#1...2#',
      '#######',
    ],
    sources: { F: ['egg'], S: ['noodles'] },
    recipe: ['noodles:cooked', 'egg:cooked'],
    cat: [[2, 6], [3, 6], [4, 6], [3, 6]],
    maxNoise: 36, par: 7, maxRounds: 12,    // bot: 6 rounds, 27 noise
  },
  {
    snack: { emoji: '🥖', name: { en: 'Late-night Bánh Mì', vi: 'Bánh mì đêm khuya' } },
    map: [
      '###D###',
      '#.....#',
      '#~.~.~O',
      'S..F..#',
      '#..T..B',
      '#.~#~.#',
      '#.....#',
      '#1...2#',
      '#######',
    ],
    sources: { F: ['cucumber', 'pork'], S: ['bread'] },
    recipe: ['bread:raw', 'cucumber:chopped', 'pork:cooked'],
    cat: [[2, 6], [3, 6], [4, 6], [3, 6]],
    maxNoise: 48, par: 8, maxRounds: 14,    // bot: 7 rounds, 37 noise
  },
];

const WALKABLE = new Set(['.', '~', '1', '2']);
const STATIONS = new Set(['F', 'S', 'O', 'B', 'T']);

function tileAt(level, x, y) {
  const row = level.map[y];
  return row && x >= 0 && x < row.length ? row[x] : '#';
}
const walkable = (level, x, y) => WALKABLE.has(tileAt(level, x, y));
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
function findChar(level, ch) {
  for (let y = 0; y < level.map.length; y++) {
    const x = level.map[y].indexOf(ch);
    if (x !== -1) return { x, y };
  }
  return null;
}

function itemKey(item) {
  const st = item.chopped && item.cooked ? 'chopped_cooked' : item.cooked ? 'cooked' : item.chopped ? 'chopped' : 'raw';
  return `${item.ing}:${st}`;
}

function stepNoiseForTile(level, x, y) {
  const door = findChar(level, 'D');
  let n = tileAt(level, x, y) === '~' ? NOISE.creak : NOISE.walk;
  if (door && Math.abs(door.x - x) + Math.abs(door.y - y) <= 2) n += NOISE.nearDoor;
  return n;
}

// ---- Game ----------------------------------------------------------------

function createSneakGame(levelNo = 1) {
  const n = Math.min(Math.max(1, levelNo | 0), LEVELS.length);
  const level = LEVELS[n - 1];
  const s1 = findChar(level, '1'), s2 = findChar(level, '2');
  return {
    mode: 'sneak',
    level: n,
    phase: 'planning',                 // planning → won | lost
    round: 1,
    players: [{ ...s1, hand: null }, { ...s2, hand: null }],
    catIndex: 0,
    noise: 0,
    table: [],                         // recipe keys placed so far
    plans: [[], []],
    locked: [false, false],
    lastRound: null,                   // replay of the last resolved round, for animation
    stats: { creaks: [0, 0], meows: [0, 0], bonks: 0, held: 0 },
    result: null,
  };
}

const lvl = game => LEVELS[game.level - 1];
const catPos = (game, i = game.catIndex) => { const c = lvl(game).cat; const [x, y] = c[i % c.length]; return { x, y }; };

// Validate a plan against the map only (partner and cat are ignored when planning).
function validatePlan(game, seat, steps) {
  if (!Array.isArray(steps) || steps.length > STEPS_PER_ROUND) return 'invalid_plan';
  const level = lvl(game);
  let pos = { x: game.players[seat].x, y: game.players[seat].y };
  const clean = [];
  for (const s of steps) {
    if (!s || typeof s !== 'object') return 'invalid_plan';
    if (s.t === 'wait') { clean.push({ t: 'wait' }); continue; }
    const target = { x: s.x | 0, y: s.y | 0 };
    if (!adjacent(pos, target)) return 'invalid_plan';
    if (s.t === 'move') {
      if (!walkable(level, target.x, target.y)) return 'invalid_plan';
      pos = target;
      clean.push({ t: 'move', ...target });
    } else if (s.t === 'use') {
      if (!STATIONS.has(tileAt(level, target.x, target.y))) return 'invalid_plan';
      clean.push({ t: 'use', ...target });
    } else return 'invalid_plan';
  }
  return clean;
}

function act(game, seat, action = {}) {
  if (game.phase !== 'planning') return 'not_planning';
  if (action.type === 'plan') {
    const plan = validatePlan(game, seat, action.steps);
    if (typeof plan === 'string') return plan;
    game.plans[seat] = plan;
    game.locked[seat] = false;          // changing your plan un-locks you
    return null;
  }
  if (action.type === 'lock') {
    if (!game.locked[seat] && game.plans[seat].length === 0) return 'empty_plan';
    game.locked[seat] = !game.locked[seat];
    if (game.locked[0] && game.locked[1]) resolveRound(game);
    return null;
  }
  return 'invalid_move';
}

function resolveRound(game) {
  const level = lvl(game);
  const plans = game.plans.map(p => { const q = p.slice(); while (q.length < STEPS_PER_ROUND) q.push({ t: 'wait' }); return q; });
  const steps = [];
  const P = game.players;

  for (let k = 0; k < STEPS_PER_ROUND && game.phase === 'planning'; k++) {
    const events = [];
    const acts = [plans[0][k], plans[1][k]];
    const cat = catPos(game);

    // 1) Movement, resolved simultaneously.
    const from = P.map(p => ({ x: p.x, y: p.y }));
    const to = acts.map((a, s) => (a.t === 'move' ? { x: a.x, y: a.y } : { ...from[s] }));
    const moving = acts.map(a => a.t === 'move');
    const same = (a, b) => a.x === b.x && a.y === b.y;
    const revert = [false, false];
    // walking into the cat
    for (const s of [0, 1]) if (moving[s] && same(to[s], cat)) { revert[s] = true; game.noise += NOISE.meow; game.stats.meows[s]++; events.push({ type: 'meow', who: s }); }
    // bumping into each other
    const bonk = () => { game.noise += NOISE.bonk; game.stats.bonks++; events.push({ type: 'bonk' }); };
    if (!revert[0] && !revert[1] && (moving[0] || moving[1])) {
      if (same(to[0], to[1]) || (same(to[0], from[1]) && same(to[1], from[0]))) { revert[0] = moving[0]; revert[1] = moving[1]; bonk(); }
    }
    for (const s of [0, 1]) {
      const o = 1 - s;
      const otherEnd = revert[o] || !moving[o] ? from[o] : to[o];
      if (moving[s] && !revert[s] && same(to[s], otherEnd)) { revert[s] = true; if (!events.some(e => e.type === 'bonk')) bonk(); }
    }
    for (const s of [0, 1]) {
      if (moving[s] && !revert[s]) {
        P[s].x = to[s].x; P[s].y = to[s].y;
        const n = stepNoiseForTile(level, P[s].x, P[s].y);
        game.noise += n;
        if (tileAt(level, P[s].x, P[s].y) === '~') { game.stats.creaks[s]++; events.push({ type: 'creak', who: s }); }
      }
    }

    // 2) Using stations.
    const uses = acts.map((a, s) => (a.t === 'use' && adjacent(P[s], a) ? a : null));
    const bothFridge = uses[0] && uses[1] && same(uses[0], uses[1]) && tileAt(level, uses[0].x, uses[0].y) === 'F';
    if (bothFridge) { game.noise += NOISE.fridgeHeld; game.stats.held++; events.push({ type: 'hold' }); }
    for (const s of [0, 1]) {
      const u = uses[s];
      if (!u) { if (acts[s].t === 'use') events.push({ type: 'miss', who: s }); continue; }
      const ch = tileAt(level, u.x, u.y);
      const hand = P[s].hand;
      if (ch === 'F' || ch === 'S') {
        if (!bothFridge) game.noise += ch === 'F' ? NOISE.fridge : NOISE.shelf;
        const items = level.sources[ch];
        if (hand && items.includes(hand.ing)) { P[s].hand = null; events.push({ type: 'putBack', who: s, ing: hand.ing }); continue; }
        if (hand) { events.push({ type: 'handsFull', who: s }); continue; }
        const held = P.map(p => p.hand && p.hand.ing);
        const want = level.recipe.find(c => { const ing = c.split(':')[0]; return items.includes(ing) && !game.table.includes(c) && !held.includes(ing); });
        if (!want) { events.push({ type: 'nothing', who: s }); continue; }
        P[s].hand = { ing: want.split(':')[0], chopped: false, cooked: false };
        events.push({ type: 'grab', who: s, ing: P[s].hand.ing });
      } else if (ch === 'O') {
        game.noise += NOISE.stove;
        if (!hand || hand.cooked) { events.push({ type: 'nothing', who: s }); continue; }
        hand.cooked = true; events.push({ type: 'cook', who: s, ing: hand.ing });
      } else if (ch === 'B') {
        game.noise += NOISE.board;
        if (!hand || hand.chopped || hand.cooked) { events.push({ type: 'nothing', who: s }); continue; }
        hand.chopped = true; events.push({ type: 'chop', who: s, ing: hand.ing });
      } else if (ch === 'T') {
        if (!hand) { events.push({ type: 'nothing', who: s }); continue; }
        const key = itemKey(hand);
        if (level.recipe.includes(key) && !game.table.includes(key)) {
          game.table.push(key); P[s].hand = null; events.push({ type: 'place', who: s, ing: hand.ing });
        } else events.push({ type: 'wrongPlace', who: s, ing: hand.ing });
      }
    }

    // 3) The cat wanders (unless a chef is standing in its way).
    if (level.cat.length > 1) {
      const next = catPos(game, game.catIndex + 1);
      if (!P.some(p => same(p, next))) game.catIndex = (game.catIndex + 1) % level.cat.length;
    }

    // 4) Win / lose checks.
    if (game.noise >= level.maxNoise) {
      game.noise = level.maxNoise;
      events.push({ type: 'woke' });
      finish(game, false, 'woke');
    } else if (level.recipe.every(c => game.table.includes(c))) {
      events.push({ type: 'won' });
      finish(game, true);
    }
    steps.push({ players: P.map(p => ({ x: p.x, y: p.y, hand: p.hand && { ...p.hand } })), cat: catPos(game), noise: game.noise, table: game.table.slice(), events });
  }

  const resolvedRound = game.round;
  if (game.phase === 'planning') {
    game.noise = Math.max(0, game.noise - DECAY);
    game.round++;
    if (game.round > level.maxRounds) finish(game, false, 'sunrise');
  }
  game.lastRound = { round: resolvedRound, plans, steps, noiseAfter: game.noise };
  game.plans = [[], []];
  game.locked = [false, false];
}

function finish(game, won, reason = null) {
  const level = lvl(game);
  game.phase = won ? 'won' : 'lost';
  const rounds = game.round;
  const stars = !won ? 0 : rounds <= level.par ? 3 : rounds <= level.par + 2 ? 2 : 1;
  game.result = { won, reason, stars, rounds, par: level.par, level: game.level, stats: game.stats, last: game.level >= LEVELS.length };
}

function viewFor(game, seat) {
  const level = lvl(game);
  return {
    mode: 'sneak',
    level: game.level,
    phase: game.phase,
    round: game.round,
    me: seat,
    map: level.map,
    sources: level.sources,
    recipe: level.recipe,
    snack: level.snack,
    catPath: level.cat,
    maxNoise: level.maxNoise,
    par: level.par,
    maxRounds: level.maxRounds,
    noiseRules: NOISE,
    decay: DECAY,
    stepsPerRound: STEPS_PER_ROUND,
    players: game.players,
    cat: catPos(game),
    catIndex: game.catIndex,
    noise: game.noise,
    table: game.table,
    plans: game.plans,                 // shared, so you can plan together
    locked: game.locked,
    lastRound: game.lastRound,
    result: game.result,
  };
}

module.exports = { INGREDIENTS, LEVELS, NOISE, STEPS_PER_ROUND, createSneakGame, act, viewFor, validatePlan, tileAt, walkable, findChar };
