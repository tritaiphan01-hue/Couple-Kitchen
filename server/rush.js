// Split Kitchen — real-time co-op mode.
//
// Each partner runs half the kitchen and only sees their half:
//   🔥 Cook: pantry + 2 burners          🔪 Prep: chopping board + plate + serve window
// A shared pass counter sits between them. Each player holds one item at a time.
//
// Orders need ingredients in a specific state: raw, chopped, cooked, or
// chopped-then-cooked. Only Prep can chop and serve, only Cook can grab from the
// pantry and cook, so every dish needs both of you.
//
// Time runs on a game clock (ms) that only advances while both players are
// connected, so a dropped phone pauses the round instead of ruining it.

const it = (emoji, en, vi) => ({ emoji, name: { en, vi } });

// One combined pantry (18 items = 3 neat rows on a phone) and a menu that mixes
// Western and Vietnamese dishes in every level.
const INGREDIENTS = {
  bread:     it('🥖', 'Bread', 'Bánh mì'),
  beef:      it('🥩', 'Beef', 'Thịt bò'),
  pork:      it('🥓', 'Pork', 'Thịt heo'),
  egg:       it('🥚', 'Egg', 'Trứng'),
  shrimp:    it('🦐', 'Shrimp', 'Tôm'),
  fish:      it('🐟', 'Fish', 'Cá'),
  tomato:    it('🍅', 'Tomato', 'Cà chua'),
  lettuce:   it('🥬', 'Lettuce', 'Xà lách'),
  cucumber:  it('🥒', 'Cucumber', 'Dưa leo'),
  onion:     it('🧅', 'Onion', 'Hành'),
  potato:    it('🥔', 'Potato', 'Khoai tây'),
  chili:     it('🌶️', 'Chili', 'Ớt'),
  pineapple: it('🍍', 'Pineapple', 'Thơm'),
  herbs:     it('🌿', 'Herbs', 'Rau thơm'),
  cheese:    it('🧀', 'Cheese', 'Phô mai'),
  rice:      it('🍚', 'Rice', 'Gạo'),
  noodles:   it('🍜', 'Rice noodles', 'Bánh phở'),
  pasta:     it('🍝', 'Pasta', 'Mì Ý'),
};

const DISHES = {
  salad:        { emoji: '🥗', name: { en: 'Salad', vi: 'Salad rau' }, comps: ['lettuce:chopped', 'tomato:chopped'] },
  eggtoast:     { emoji: '🍳', name: { en: 'Egg Toast', vi: 'Bánh mì trứng' }, comps: ['bread:raw', 'egg:cooked'] },
  burger:       { emoji: '🍔', name: { en: 'Burger', vi: 'Hamburger' }, comps: ['bread:raw', 'beef:cooked', 'lettuce:chopped'] },
  banhmi:       { emoji: '🥖', name: { en: 'Bánh Mì', vi: 'Bánh mì thịt' }, comps: ['bread:raw', 'pork:cooked', 'cucumber:chopped'] },
  comtrung:     { emoji: '🍱', name: { en: 'Egg & Rice', vi: 'Cơm trứng' }, comps: ['rice:cooked', 'egg:cooked'] },
  phobo:        { emoji: '🍜', name: { en: 'Phở Bò', vi: 'Phở bò' }, comps: ['noodles:cooked', 'beef:chopped', 'herbs:raw'] },
  fries:        { emoji: '🍟', name: { en: 'Fries', vi: 'Khoai tây chiên' }, comps: ['potato:chopped_cooked'] },
  pasta:        { emoji: '🍝', name: { en: 'Tomato Pasta', vi: 'Mì Ý sốt cà' }, comps: ['pasta:cooked', 'tomato:chopped_cooked'] },
  goicuon:      { emoji: '🌯', name: { en: 'Spring Rolls', vi: 'Gỏi cuốn' }, comps: ['shrimp:cooked', 'noodles:cooked', 'herbs:raw'] },
  comtam:       { emoji: '🍛', name: { en: 'Cơm Tấm', vi: 'Cơm tấm' }, comps: ['rice:cooked', 'pork:cooked', 'cucumber:chopped'] },
  soup:         { emoji: '🥣', name: { en: 'Onion Soup', vi: 'Súp hành' }, comps: ['onion:chopped_cooked', 'cheese:raw'] },
  cheeseburger: { emoji: '🧀', name: { en: 'Cheeseburger', vi: 'Burger phô mai' }, comps: ['bread:raw', 'beef:cooked', 'cheese:raw', 'tomato:chopped'] },
  canhchua:     { emoji: '🍲', name: { en: 'Sour Soup', vi: 'Canh chua' }, comps: ['fish:chopped_cooked', 'pineapple:chopped', 'chili:chopped'] },
  boluclac:     { emoji: '🥘', name: { en: 'Shaking Beef', vi: 'Bò lúc lắc' }, comps: ['beef:chopped_cooked', 'cucumber:chopped'] },
};

const LEVEL_DISHES = [
  ['salad', 'eggtoast', 'burger', 'banhmi', 'comtrung', 'phobo'],
  ['burger', 'banhmi', 'comtrung', 'phobo', 'fries', 'pasta', 'goicuon', 'comtam'],
  ['fries', 'pasta', 'goicuon', 'comtam', 'soup', 'cheeseburger', 'canhchua', 'boluclac'],
];

const LEVELS = [
  { durationMs: 120000, maxOrders: 2, spawnMs: 15000, patienceMs: 65000, cookMs: 5000, burnMs: 12000, chopTaps: 4, stars: [40, 90, 140] },
  { durationMs: 150000, maxOrders: 3, spawnMs: 12000, patienceMs: 60000, cookMs: 5000, burnMs: 9000,  chopTaps: 5, stars: [70, 150, 230] },
  { durationMs: 180000, maxOrders: 3, spawnMs: 9000,  patienceMs: 55000, cookMs: 6000, burnMs: 7000,  chopTaps: 5, stars: [100, 220, 340] },
];
// Levels 4–10 keep the level-3 menu but get steadily faster and less forgiving.
for (let n = 4; n <= 10; n++) {
  const k = n - 3;
  LEVELS.push({
    durationMs: 180000,
    maxOrders: n >= 6 ? 4 : 3,
    spawnMs: Math.max(5500, 9000 - k * 500),
    patienceMs: Math.max(38000, 55000 - k * 2500),
    cookMs: 6000,
    burnMs: Math.max(4500, 7000 - k * 350),
    chopTaps: n >= 8 ? 6 : 5,
    stars: [100 + k * 20, 220 + k * 35, 340 + k * 50],
  });
  LEVEL_DISHES.push(LEVEL_DISHES[2]);
}

// Kitchen upgrades bought in the shop tweak a level's numbers.
function applyUpgrades(base, upgrades = []) {
  const c = { ...base, burners: 2 };
  if (upgrades.includes('burner3')) c.burners = 3;
  if (upgrades.includes('sharpKnife')) c.chopTaps = Math.max(2, c.chopTaps - 2);
  if (upgrades.includes('nonstick')) c.burnMs = Math.round(c.burnMs * 1.5);
  if (upgrades.includes('bell')) c.patienceMs = Math.round(c.patienceMs * 1.2);
  return c;
}

const COUNTER_SLOTS = 4;
const PLATE_MAX = 4;
const COUNTDOWN_MS = 3000;
const MISS_PENALTY = 5;

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// ---- Items ---------------------------------------------------------------

let nextId = 1;
const newItem = ing => ({ id: nextId++, ing, chopped: false, cookedMs: 0, burnt: false });

function itemState(item, level) {
  if (item.burnt) return 'burnt';
  const cooked = item.cookedMs >= level.cookMs;
  if (item.chopped && cooked) return 'chopped_cooked';
  if (cooked) return 'cooked';
  if (item.chopped) return 'chopped';
  return 'raw';
}
const itemKey = (item, level) => `${item.ing}:${itemState(item, level)}`;

// ---- Game ----------------------------------------------------------------

function createRushGame(levelNo = 1, roles = ['cook', 'prep'], upgrades = []) {
  const level = Math.min(Math.max(1, levelNo | 0), LEVELS.length);
  const config = applyUpgrades(LEVELS[level - 1], upgrades);
  return {
    mode: 'rush',
    level,
    phase: 'ready',            // ready → countdown → playing → results
    ready: [false, false],
    roles: roles.slice(),      // roles[seat] = 'cook' | 'prep'
    countdownEnd: 0,           // wall-clock ms
    clock: 0,                  // game ms, advances only while playing & both connected
    lastTick: 0,
    running: false,
    hands: [null, null],
    config,
    upgrades: upgrades.slice(),
    burners: Array.from({ length: config.burners }, () => ({ item: null, since: 0 })),
    counter: Array.from({ length: COUNTER_SLOTS }, () => null),   // {item, by}
    board: { item: null, taps: 0 },
    plate: [],
    orders: [],
    nextSpawnAt: 0,
    lastDish: null,
    coins: 0,
    stats: { served: 0, missed: 0, burnt: [0, 0], wrong: 0, passed: [0, 0], bestTip: 0 },
    events: [],
    eventSeq: 0,
    result: null,
  };
}

const cfg = game => game.config;

function pushEvent(game, ev) {
  game.events.push({ id: ++game.eventSeq, ...ev });
  if (game.events.length > 20) game.events.shift();
}

function spawnOrder(game, rand = Math.random) {
  const pool = LEVEL_DISHES[game.level - 1];
  const choices = pool.length > 1 ? pool.filter(d => d !== game.lastDish) : pool;
  const dish = choices[Math.floor(rand() * choices.length)];
  game.lastDish = dish;
  const c = cfg(game);
  game.orders.push({ id: ++game.eventSeq, dish, createdAt: game.clock, expiresAt: game.clock + c.patienceMs });
}

// Freeze cooking progress into the item when it leaves a burner.
function liftFromBurner(game, burner) {
  const item = burner.item;
  item.cookedMs += game.clock - burner.since;
  burner.item = null;
  return item;
}

// seat → role helpers
const roleOf = (game, seat) => game.roles[seat];

// Returns an error code, or null. Errors are mostly "nothing happens" taps.
function act(game, seat, action = {}) {
  if (game.phase === 'ready') {
    if (action.type === 'ready') {
      game.ready[seat] = !game.ready[seat];
      if (game.ready[0] && game.ready[1]) { game.phase = 'countdown'; game.countdownEnd = Date.now() + COUNTDOWN_MS; }
      return null;
    }
    if (action.type === 'swap') {
      game.roles.reverse();
      game.ready = [false, false];
      return null;
    }
    return 'not_started';
  }
  if (game.phase !== 'playing') return 'not_started';
  if (!game.running) return 'paused';

  const role = roleOf(game, seat);
  const c = cfg(game);
  const hand = game.hands[seat];
  const i = action.i | 0;

  switch (action.type) {
    case 'pantry': {
      if (role !== 'cook') return 'wrong_role';
      if (!has(INGREDIENTS, action.ing)) return 'unknown_ingredient';
      if (hand) return 'hands_full';
      game.hands[seat] = newItem(action.ing);
      return null;
    }
    case 'burner': {
      if (role !== 'cook') return 'wrong_role';
      const b = game.burners[i];
      if (!b) return 'invalid_move';
      if (hand && !b.item) {
        if (hand.burnt) return 'burnt';
        b.item = hand; b.since = game.clock; game.hands[seat] = null;
        return null;
      }
      if (!hand && b.item) { game.hands[seat] = liftFromBurner(game, b); return null; }
      return hand ? 'burner_busy' : 'empty';
    }
    case 'counter': {
      const slot = game.counter[i];
      if (slot === undefined) return 'invalid_move';
      if (hand && !slot) {
        game.counter[i] = { item: hand, by: seat }; game.hands[seat] = null;
        game.stats.passed[seat]++;
        pushEvent(game, { type: 'passed', by: seat, ing: hand.ing });
        return null;
      }
      if (!hand && slot) { game.hands[seat] = slot.item; game.counter[i] = null; return null; }
      return hand ? 'slot_full' : 'empty';
    }
    case 'board': {
      if (role !== 'prep') return 'wrong_role';
      const board = game.board;
      if (hand && !board.item) {
        if (hand.chopped) return 'already_chopped';
        if (hand.burnt || hand.cookedMs >= c.cookMs) return 'cant_chop_cooked';
        board.item = hand; board.taps = 0; game.hands[seat] = null;
        return null;
      }
      if (!hand && board.item) {
        if (!board.item.chopped) {
          board.taps++;
          if (board.taps >= c.chopTaps) board.item.chopped = true;
          return null;
        }
        game.hands[seat] = board.item; board.item = null; board.taps = 0;
        return null;
      }
      return hand ? 'board_busy' : 'empty';
    }
    case 'plate': {
      if (role !== 'prep') return 'wrong_role';
      if (hand) {
        if (hand.burnt) return 'burnt';
        if (game.plate.length >= PLATE_MAX) return 'plate_full';
        game.plate.push(hand); game.hands[seat] = null;
        return null;
      }
      if (game.plate.length) { game.hands[seat] = game.plate.pop(); return null; }
      return 'empty';
    }
    case 'serve': {
      if (role !== 'prep') return 'wrong_role';
      if (!game.plate.length) return 'empty_plate';
      const plateKey = game.plate.map(it => itemKey(it, c)).sort().join('|');
      // Serve the most urgent matching order.
      const match = game.orders
        .filter(o => DISHES[o.dish].comps.slice().sort().join('|') === plateKey)
        .sort((a, b) => a.expiresAt - b.expiresAt)[0];
      if (!match) {
        game.stats.wrong++;
        pushEvent(game, { type: 'wrong' });
        return 'no_matching_order';
      }
      const left = Math.max(0, match.expiresAt - game.clock) / c.patienceMs;
      const base = 10 + 5 * DISHES[match.dish].comps.length;
      const tip = Math.round(left * 10);
      game.coins += base + tip;
      game.stats.served++;
      game.stats.bestTip = Math.max(game.stats.bestTip, tip);
      game.orders = game.orders.filter(o => o !== match);
      game.plate = [];
      pushEvent(game, { type: 'served', dish: match.dish, coins: base + tip, tip });
      return null;
    }
    case 'trash': {
      if (!hand) return 'empty';
      game.hands[seat] = null;
      pushEvent(game, { type: 'trashed', by: seat });
      return null;
    }
    case 'clearPlate': {
      if (role !== 'prep') return 'wrong_role';
      game.plate = [];
      return null;
    }
    default:
      return 'invalid_move';
  }
}

// Advance the game. `connected` = [bool, bool]. `now` = wall-clock ms.
function tick(game, now = Date.now(), connected = [true, true], rand = Math.random) {
  if (game.phase === 'ready') {
    // Someone left the ready screen? Un-ready them.
    connected.forEach((ok, s) => { if (!ok) game.ready[s] = false; });
    return;
  }
  if (game.phase === 'countdown') {
    if (!connected[0] || !connected[1]) { game.phase = 'ready'; game.ready = [false, false]; return; }
    if (now >= game.countdownEnd) {
      game.phase = 'playing'; game.lastTick = now; game.running = true;
      spawnOrder(game, rand);
      game.nextSpawnAt = game.clock + cfg(game).spawnMs;
    }
    return;
  }
  if (game.phase !== 'playing') return;

  const dt = Math.min(1000, Math.max(0, now - game.lastTick));   // clamp: no big jumps after a stall
  game.lastTick = now;
  game.running = connected[0] && connected[1];
  if (!game.running) return;
  game.clock += dt;
  const c = cfg(game);

  // Burning
  for (const b of game.burners) {
    if (!b.item || b.item.burnt) continue;
    if (b.item.cookedMs + (game.clock - b.since) >= c.cookMs + c.burnMs) {
      b.item.cookedMs += game.clock - b.since; b.since = game.clock;
      b.item.burnt = true;
      const cookSeat = game.roles.indexOf('cook');
      game.stats.burnt[cookSeat]++;
      pushEvent(game, { type: 'burnt', ing: b.item.ing });
    }
  }

  // Expired orders
  for (const o of game.orders.filter(o => o.expiresAt <= game.clock)) {
    game.orders = game.orders.filter(x => x !== o);
    game.stats.missed++;
    game.coins = Math.max(0, game.coins - MISS_PENALTY);
    pushEvent(game, { type: 'missed', dish: o.dish });
  }

  // New orders (none in the last 15 seconds — nobody likes an impossible ticket)
  const remaining = c.durationMs - game.clock;
  if (remaining > 15000 && game.orders.length < c.maxOrders && (game.clock >= game.nextSpawnAt || game.orders.length === 0)) {
    spawnOrder(game, rand);
    game.nextSpawnAt = game.clock + c.spawnMs;
  }

  if (game.clock >= c.durationMs) finish(game);
}

function finish(game) {
  const c = cfg(game);
  game.phase = 'results';
  game.running = false;
  const stars = c.stars.filter(s => game.coins >= s).length;
  game.result = { coins: game.coins, stars, level: game.level, stats: game.stats, thresholds: c.stars, last: game.level >= LEVELS.length };
}

// Both players see the same kitchen state (each client only draws its own half).
function viewFor(game, seat) {
  const c = cfg(game);
  return {
    mode: 'rush',
    level: game.level,
    phase: game.phase,
    ready: game.ready,
    roles: game.roles,
    myRole: game.roles[seat],
    countdownLeft: game.phase === 'countdown' ? Math.max(0, game.countdownEnd - Date.now()) : 0,
    clock: game.clock,
    running: game.running,
    config: { durationMs: c.durationMs, cookMs: c.cookMs, burnMs: c.burnMs, chopTaps: c.chopTaps, patienceMs: c.patienceMs, stars: c.stars, maxOrders: c.maxOrders },
    levelCount: LEVELS.length,
    upgrades: game.upgrades,
    hands: game.hands,
    burners: game.burners,
    counter: game.counter,
    board: game.board,
    plate: game.plate,
    orders: game.orders,
    coins: game.coins,
    events: game.events,
    result: game.result,
  };
}

module.exports = { INGREDIENTS, DISHES, LEVEL_DISHES, LEVELS, applyUpgrades, createRushGame, act, tick, viewFor, itemState, COUNTDOWN_MS };
