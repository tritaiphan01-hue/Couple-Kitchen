// A reasonable couple: they share both cards out loud, try the items that fit each
// riddle, scoop out anything Grandma hates, and do the actions the cards ask for.
const relay = require('../server/relay');

function play(round, upgrades = [], rand = Math.random) {
  const g = relay.createRelayGame(round, upgrades, rand);
  const clues = g.recipe.cards.flat().map(c => ({ ...c }));       // they read both cards to each other
  const riddles = clues.filter(c => c.type === 'riddle');
  const acts = clues.filter(c => c.type === 'hasAction').map(c => c.id);
  const banned = new Set();
  const fits = r => g.market.filter(id => r.tags.every(t => relay.INGREDIENTS[id].tags.includes(t)));
  let guard = 0;
  while (g.phase === 'playing' && guard++ < 40) {
    const seat = relay.currentPlayer(g);
    const last = g.reactions[g.reactions.length - 1];
    let move;
    if (last && last.mood === 'yuck' && last.kind === 'ingredient' && g.pot.some(s => s.kind === 'ingredient' && s.id === last.id)) {
      banned.add(last.id);
      move = { kind: 'remove' };
    } else {
      const inPot = new Set(g.pot.filter(s => s.kind === 'ingredient').map(s => s.id));
      // a riddle not yet satisfied by something Grandma liked
      const liked = new Set(g.reactions.filter(r => r.kind === 'ingredient' && r.mood === 'yum').map(r => r.id));
      const open = riddles.filter(r => !fits(r).some(id => liked.has(id) && inPot.has(id)));
      const r = open[0];
      const options = r ? fits(r).filter(id => !inPot.has(id) && !banned.has(id)) : [];
      const doneActs = new Set(g.pot.filter(s => s.kind === 'action').map(s => s.id));
      const act = acts.find(a => !doneActs.has(a));
      if (options.length) move = { kind: 'ingredient', id: options[Math.floor(rand() * options.length)] };
      else if (act) move = { kind: 'action', id: act };
      else move = { kind: 'action', id: acts[0] || 'stir' };
    }
    const err = relay.applyMove(g, seat, move);
    if (err) throw new Error(err + ' ' + JSON.stringify(move));
  }
  return g;
}

module.exports = { play };

if (require.main === module) {
  for (const round of [1, 4, 7]) {
    for (const up of [[], ['notebook']]) {
      const N = 3000, out = { perfect: 0, time: 0, kicked: 0 }; let stars = 0;
      for (let i = 0; i < N; i++) { const g = play(round, up); out[g.result.how]++; stars += g.result.stars; }
      console.log(`round ${round} ${up.join() || '-'}: perfect ${(100 * out.perfect / N).toFixed(0)}%  ran out ${(100 * out.time / N).toFixed(0)}%  kicked out ${(100 * out.kicked / N).toFixed(0)}%  avg stars ${(stars / N).toFixed(2)}`);
    }
  }
}
