// A simple strategy bot for Midnight Snack: each chef runs a fixed errand list,
// walking the cheapest (quietest) path and avoiding the cat's patrol.
const sneak = require('../server/sneak');

function quietPath(level, from, to, avoid) {
  const W = level.map[0].length, H = level.map.length, key = (x, y) => y * W + x;
  const dist = new Map([[key(from.x, from.y), 0]]), prev = new Map();
  const open = [{ x: from.x, y: from.y, d: 0 }];
  while (open.length) {
    open.sort((a, b) => a.d - b.d);
    const c = open.shift();
    if (c.x === to.x && c.y === to.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, y = c.y + dy;
      if (!sneak.walkable(level, x, y)) continue;
      let w = sneak.tileAt(level, x, y) === '~' ? 3 : 1;
      if (avoid.some(([ax, ay]) => ax === x && ay === y)) w += 50;
      const d = c.d + w, k = key(x, y);
      if (d < (dist.has(k) ? dist.get(k) : Infinity)) { dist.set(k, d); prev.set(k, c); open.push({ x, y, d }); }
    }
  }
  const path = [];
  let cur = to;
  while (!(cur.x === from.x && cur.y === from.y)) { path.unshift({ x: cur.x, y: cur.y }); cur = prev.get(key(cur.x, cur.y)); if (!cur) return null; }
  return path;
}

// errands: per seat, list of station chars ('F','S','O','B','T') to use in order.
function actionsFor(level, start, errands, avoidExtra = [], catPath = level.cat) {
  const out = [];
  let pos = start;
  for (const ch of errands) {
    const st = sneak.findChar(level, ch);
    let best = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = { x: st.x + dx, y: st.y + dy };
      if (!sneak.walkable(level, t.x, t.y)) continue;
      if (avoidExtra.some(([ax, ay]) => ax === t.x && ay === t.y)) continue;   // spot taken by partner
      const p = (t.x === pos.x && t.y === pos.y) ? [] : quietPath(level, pos, t, [...catPath, ...avoidExtra]);
      if (p && (!best || p.length < best.length)) best = p;
    }
    if (!best) { out.push({ t: 'wait' }); return out; }   // only spot is taken: wait your turn
    for (const s of best) out.push({ t: 'move', x: s.x, y: s.y });
    pos = best.length ? best[best.length - 1] : pos;
    out.push({ t: 'use', x: st.x, y: st.y });
  }
  return out;
}

// Play a level: each round, re-plan from where each chef actually is. Seat 1
// gives way (waits) when it would walk into seat 0, like a polite partner.
function play(levelNo, errands, delays = [0, 0], upgrades = []) {
  const g = sneak.createSneakGame(levelNo, upgrades);
  const level = sneak.LEVELS[levelNo - 1];
  const done = [0, 0];
  const waits = delays.slice();
  const SUCCESS = new Set(['grab', 'cook', 'chop', 'place']);
  let guard = 0;
  while (g.phase === 'planning' && guard++ < 30) {
    const plans = [0, 1].map(s => {
      const pre = Array(Math.min(waits[s], 3)).fill({ t: 'wait' });
      waits[s] -= pre.length;
      const other = g.players[1 - s];
      return [...pre, ...actionsFor(level, g.players[s], errands[s].slice(done[s]), [[other.x, other.y]], g.catPath)].slice(0, sneak.STEPS_PER_ROUND);
    });
    // Give way: step through both plans together; whoever would walk into the other waits.
    const pos = [{ ...g.players[0] }, { ...g.players[1] }];
    const same = (a, b) => a.x === b.x && a.y === b.y;
    for (let k = 0; k < sneak.STEPS_PER_ROUND; k++) {
      const a = [plans[0][k], plans[1][k]];
      const next = a.map((x, i) => (x && x.t === 'move' ? { x: x.x, y: x.y } : pos[i]));
      let yielder = -1;
      if (same(next[0], next[1]) || (same(next[0], pos[1]) && same(next[1], pos[0]))) yielder = 1;
      else if (a[1] && a[1].t === 'move' && same(next[1], pos[0]) && same(next[0], pos[0])) yielder = 1;
      else if (a[0] && a[0].t === 'move' && same(next[0], pos[1]) && same(next[1], pos[1])) yielder = 0;
      if (yielder >= 0) {
        plans[yielder].splice(k, 0, { t: 'wait' });
        plans[yielder].length = Math.min(plans[yielder].length, sneak.STEPS_PER_ROUND);
        next[yielder] = pos[yielder];
      }
      pos[0] = next[0]; pos[1] = next[1];
    }
    for (const s of [0, 1]) {
      const plan = plans[s].length ? plans[s] : [{ t: 'wait' }];
      const err = sneak.act(g, s, { type: 'plan', steps: plan });
      if (err) throw new Error(`plan rejected: ${err} ${JSON.stringify(plan)}`);
    }
    sneak.act(g, 0, { type: 'lock' }); sneak.act(g, 1, { type: 'lock' });
    for (const st of g.lastRound.steps) for (const e of st.events) if (SUCCESS.has(e.type)) done[e.who]++;
  }
  return g;
}

// Errands per map; night n uses map ((n - 1) % 3) + 1.
const MAP_SOLUTIONS = [
  { errands: [['F', 'T'], ['S', 'T']] },
  { errands: [['S', 'O', 'T'], ['F', 'O', 'T']] },
  { errands: [['S', 'T', 'F', 'O', 'T'], ['F', 'B', 'T']] },
  { errands: [['S', 'O', 'T'], ['F', 'O', 'T', 'F', 'T']] },
  { errands: [['S', 'B', 'T', 'S', 'B', 'T'], ['F', 'O', 'T']] },
];
const SOLUTIONS = {};
sneak.LEVELS.forEach((_, i) => { SOLUTIONS[i + 1] = MAP_SOLUTIONS[i % MAP_SOLUTIONS.length]; });

module.exports = { play, SOLUTIONS, actionsFor };

if (require.main === module) {
  for (const n of sneak.LEVELS.map((_, i) => i + 1)) {
    for (const delays of [[0, 0], [0, 1], [1, 0], [0, 2], [2, 0], [0, 3], [3, 0]]) {
      const g = play(n, SOLUTIONS[n].errands, delays);
      const evs = (g.lastRound ? [] : []);
      console.log(`level ${n} delays ${delays}: ${g.phase} ${g.result && g.result.reason || ''} rounds=${g.round} noise=${g.noise}/${sneak.LEVELS[n - 1].maxNoise} stars=${g.result && g.result.stars} bonks=${g.stats.bonks} meows=${g.stats.meows}`);
    }
  }
}
