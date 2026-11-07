/* Couple's Kitchen — client */
(() => {
  'use strict';

  // ───────── Utilities ─────────
  const $ = sel => document.querySelector(sel);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem('ck:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('ck:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem('ck:' + k); } catch { /* ignore */ } },
  };
  const SEAT_COLORS = [['#F5B83D', '#D99413'], ['#9B6BC4', '#774A9E']];
  const SEAT_FALLBACK = ['Honey', 'Plum'];

  let playerId = store.get('playerId');
  if (!playerId) {
    playerId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
    store.set('playerId', playerId);
  }

  // ───────── Sound & haptics (synthesised, no audio files) ─────────
  let muted = store.get('muted', false);
  let actx = null;
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch { /* audio unavailable */ }
  }
  const sfx = {
    tap: () => tone(520, 0.06, 'triangle', 0.08),
    plop: () => { tone(300, 0.1, 'sine', 0.2); tone(180, 0.15, 'sine', 0.15, 0.06); },
    yourTurn: () => { tone(660, 0.1, 'triangle', 0.12); tone(880, 0.16, 'triangle', 0.12, 0.1); },
    ding: () => { tone(1046, 0.4, 'sine', 0.15); tone(1318, 0.5, 'sine', 0.1, 0.12); },
    join: () => { tone(523, 0.1, 'triangle'); tone(659, 0.1, 'triangle', 0.15, 0.1); tone(784, 0.18, 'triangle', 0.15, 0.2); },
    heart: () => tone(880, 0.12, 'sine', 0.08),
    err: () => tone(160, 0.18, 'square', 0.06),
  };
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* ignore */ } };
  function syncMuteButtons() { document.querySelectorAll('#mute-btn, #relay-mute').forEach(b => (b.textContent = muted ? '🔇' : '🔊')); }
  document.querySelectorAll('#mute-btn, #relay-mute').forEach(b => b.addEventListener('click', () => {
    muted = !muted; store.set('muted', muted); syncMuteButtons(); sfx.tap();
  }));
  syncMuteButtons();

  // ───────── Chef blob SVG ─────────
  function chefSVG(seat, mood = 'happy') {
    const [c, d] = SEAT_COLORS[seat];
    const mouth = {
      happy: '<path d="M40 60 Q50 69 60 60" stroke="#4A3428" stroke-width="4" fill="none" stroke-linecap="round"/>',
      wow: '<ellipse cx="50" cy="62" rx="5" ry="6" fill="#4A3428"/>',
      sleepy: '<path d="M43 62 H57" stroke="#4A3428" stroke-width="4" stroke-linecap="round"/>',
    }[mood];
    const eyes = mood === 'sleepy'
      ? '<path d="M34 50 Q38 53 42 50 M58 50 Q62 53 66 50" stroke="#4A3428" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : '<circle cx="38" cy="50" r="4.5" fill="#4A3428"/><circle cx="62" cy="50" r="4.5" fill="#4A3428"/>';
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="94" rx="30" ry="5" fill="rgba(0,0,0,.15)"/>
      <path d="M30 22 Q30 6 50 8 Q70 6 70 22 Q82 18 80 30 Q78 38 70 36 H30 Q22 38 20 30 Q18 18 30 22Z" fill="#fff" stroke="#4A3428" stroke-width="3.5"/>
      <rect x="18" y="32" width="64" height="58" rx="30" fill="${c}" stroke="#4A3428" stroke-width="3.5"/>
      <path d="M32 70 H68 V86 Q50 94 32 86Z" fill="#fff" stroke="#4A3428" stroke-width="3" opacity=".95"/>
      <path d="M44 70 V64 H56 V70" fill="none" stroke="${d}" stroke-width="3"/>
      ${eyes}
      <circle cx="30" cy="58" r="5" fill="#E85D4A" opacity=".35"/><circle cx="70" cy="58" r="5" fill="#E85D4A" opacity=".35"/>
      ${mouth}
    </svg>`;
  }

  // ───────── Screens ─────────
  function show(screen, mode) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + screen));
    document.body.dataset.mode = mode || screen;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = document.body.dataset.mode === 'relay' ? '#3A2820' : '#FFF4E6';
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
  }
  function banner(msg) { const b = $('#conn-banner'); b.textContent = msg || ''; b.hidden = !msg; }

  function floatEmoji(emoji, count = 6) {
    const layer = $('#float-layer');
    for (let i = 0; i < count; i++) {
      const f = el('div', { class: 'floaty' }, emoji);
      f.style.left = (10 + Math.random() * 80) + '%';
      f.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
      f.style.animationDelay = (i * 0.12) + 's';
      layer.append(f);
      setTimeout(() => f.remove(), 3200 + i * 120);
    }
  }

  // ───────── Socket ─────────
  const socket = io({ transports: ['websocket', 'polling'] });
  let catalog = { ingredients: {}, actions: {} };
  fetch('/api/catalog').then(r => r.json()).then(c => { catalog = c; if (state) render(); }).catch(() => {});

  let state = null;          // last {room, game} from server
  let prev = null;           // previous state, for detecting changes
  let selection = null;      // {kind, id} picked in pantry but not yet added
  let cardHidden = true;

  socket.on('connect', () => {
    banner('');
    const code = store.get('room');
    if (code) {
      socket.emit('room:rejoin', { code, playerId }, res => {
        if (res && res.error) { store.del('room'); if (!state) show('home'); }
      });
    }
  });
  socket.on('disconnect', () => banner('🔌 Reconnecting…'));
  socket.on('kicked', msg => { store.del('room'); state = null; toast(msg); show('home'); });
  socket.on('state', s => { prev = state; state = s; store.set('room', s.room.code); render(); });
  socket.on('react', ({ emoji }) => { floatEmoji(emoji, emoji === '❤️' ? 9 : 4); sfx.heart(); buzz(20); });

  // ───────── Home ─────────
  const nameInput = $('#name-input');
  const codeInput = $('#code-input');
  nameInput.value = store.get('name', '');
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) codeInput.value = urlRoom.toUpperCase().slice(0, 4);
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });

  function myName() {
    const n = nameInput.value.trim();
    store.set('name', n);
    return n;
  }
  $('#create-btn').addEventListener('click', () => {
    sfx.tap();
    socket.emit('room:create', { name: myName(), playerId }, res => {
      if (res.error) return toast(res.error);
      history.replaceState(null, '', '?room=' + res.code);
    });
  });
  function join() {
    sfx.tap();
    const code = codeInput.value.trim();
    if (code.length !== 4) { sfx.err(); return toast('Kitchen codes have 4 letters.'); }
    socket.emit('room:join', { code, name: myName(), playerId }, res => {
      if (res.error) { sfx.err(); return toast(res.error); }
      history.replaceState(null, '', '?room=' + res.code);
    });
  }
  $('#join-btn').addEventListener('click', join);
  codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });

  // ───────── Lobby ─────────
  $('#leave-btn').addEventListener('click', () => {
    if (!confirm('Leave this kitchen? Your partner will need a new code.')) return;
    socket.emit('room:leave');
    store.del('room'); state = null;
    history.replaceState(null, '', location.pathname);
    show('home');
  });
  $('#share-btn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?room=${state.room.code}`;
    const text = `Come cook with me 🍳 Kitchen code: ${state.room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Couple's Kitchen", text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Invite link copied 📋'); }
    } catch { /* user cancelled */ }
  });
  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => {
    sfx.tap();
    socket.emit('mode:start', { mode: btn.dataset.mode }, res => { if (res && res.error) { sfx.err(); toast(res.error); } });
  }));

  function renderLobby() {
    const { room } = state;
    const code = $('#lobby-code');
    code.replaceChildren(...room.code.split('').map(ch => el('span', {}, ch)));

    const chefs = $('#lobby-chefs');
    chefs.replaceChildren(...room.players.map((p, seat) => {
      const box = el('div', { class: 'chef' + (p ? '' : ' waiting') });
      box.innerHTML = chefSVG(seat, p ? (p.connected ? 'happy' : 'sleepy') : 'sleepy');
      box.append(
        el('div', { class: 'chef-name' }, p ? p.name + (seat === room.seat ? ' (you)' : '') : 'Waiting…'),
        el('div', { class: 'chef-status' },
          el('span', { class: 'dot' + (p && p.connected ? '' : ' off') }),
          p ? (p.connected ? 'in the kitchen' : 'stepped out') : 'not here yet'),
      );
      return box;
    }));

    const partner = room.players[1 - room.seat];
    $('#lobby-hint').textContent = !partner
      ? 'Send your partner the code to start cooking 💌'
      : !partner.connected ? `${partner.name} stepped out. You can still start a dish.` : 'Both chefs ready! Pick a mode 👇';
    document.querySelectorAll('.mode-card[data-mode="relay"]').forEach(b => (b.disabled = !partner));

    const s = room.stats;
    const recap = $('#lobby-recap');
    if (s.rounds) {
      const best = s.dishes.slice().sort((a, b) => b.stars - a.stars)[0];
      recap.innerHTML = '';
      recap.append(
        'Tonight: ', el('b', {}, `${s.rounds} dish${s.rounds > 1 ? 'es' : ''}`), ' · ',
        el('b', {}, `${s.stars} ⭐`), el('br'),
        'Best: ', el('b', {}, `${best.name} ${'⭐'.repeat(best.stars) || '(0⭐)'}`),
      );
    } else recap.textContent = '';
  }

  // ───────── Recipe Relay ─────────
  $('#relay-back').addEventListener('click', () => {
    if (confirm('Leave this dish and go back to the kitchen? It ends the round for both of you.')) socket.emit('room:lobby');
  });

  const secretCard = $('#secret-card');
  secretCard.addEventListener('click', () => { cardHidden = !cardHidden; sfx.tap(); renderSecret(); });

  // Reactions bar
  $('#reactions').replaceChildren(...['❤️', '😏', '🤔', '👍', '👎', '😂'].map(e =>
    el('button', { 'aria-label': 'Send ' + e, onclick: () => { socket.emit('react', { emoji: e }); floatEmoji(e, 3); sfx.heart(); buzz(10); } }, e)));

  function playerName(seat) {
    const p = state.room.players[seat];
    return p ? p.name : SEAT_FALLBACK[seat];
  }
  function stepLabel(step) {
    if (step.kind === 'ingredient') { const i = catalog.ingredients[step.id]; return i ? `${i.emoji} ${i.name.toLowerCase()}` : step.id; }
    const a = catalog.actions[step.id];
    return a ? `${a.emoji} ${a.past}` : step.id;
  }

  function renderSecret() {
    const g = state.game;
    secretCard.classList.toggle('hidden', cardHidden);
    $('.secret-tip').textContent = cardHidden ? 'tap to peek 👀' : 'tap to hide';
    $('#secret-list').replaceChildren(...g.myCard.map(c => el('li', {}, c.text)));
  }

  function renderRelay() {
    const g = state.game, room = state.room;
    const mine = g.currentSeat === room.seat;
    const ingIds = Object.keys(catalog.ingredients);
    const inPot = new Set(g.pot.filter(s => s.kind === 'ingredient').map(s => s.id));
    if (selection && selection.kind === 'ingredient' && inPot.has(selection.id)) selection = null;
    if (!mine) selection = null;

    $('#relay-title').textContent = `Mystery ${g.dishType} #${g.round}`;
    const bannerEl = $('#turn-banner');
    bannerEl.classList.toggle('mine', mine);
    const left = g.totalTurns - g.turn;
    bannerEl.textContent = mine
      ? `Your turn ${room.seat === 0 ? '💛' : '💜'} · ${left} step${left > 1 ? 's' : ''} left`
      : `${playerName(g.currentSeat)} is thinking… 🤔`;

    // Turn dots, coloured by who will play / has played each step.
    $('#turn-dots').replaceChildren(...Array.from({ length: g.totalTurns }, (_, i) => {
      const step = g.pot[i];
      return el('i', { class: [step ? 'done p' + step.by : '', i === g.turn ? 'now' : ''].join(' ') });
    }));

    // Pot contents: ingredients float in a loose pile.
    const potBox = $('#pot-contents');
    const prevLen = prev && prev.game && prev.game.mode === 'relay' && prev.game.round === g.round ? prev.game.pot.length : 0;
    const ings = g.pot.filter(s => s.kind === 'ingredient');
    potBox.replaceChildren(...ings.map((s, i) => {
      const spot = [[50, 40], [24, 50], [76, 48], [38, 14], [64, 18], [12, 22], [88, 24], [50, 0]][i % 8];
      const n = el('span', { class: 'ing p' + s.by }, catalog.ingredients[s.id] ? catalog.ingredients[s.id].emoji : '?');
      n.style.left = `calc(${spot[0]}% - 15px)`; n.style.top = spot[1] + 'px';
      if (g.pot.indexOf(s) < prevLen) n.style.animation = 'simmer 3s ease-in-out infinite';
      n.style.animationDelay = (i * 0.3) + 's';
      return n;
    }));
    const last = g.pot[g.pot.length - 1];
    if (last && g.pot.length > prevLen && last.kind === 'action') {
      const pot = $('.pot'); pot.classList.remove('stir'); void pot.offsetWidth; pot.classList.add('stir');
    }
    $('#last-move').textContent = last
      ? `${last.by === room.seat ? 'You' : playerName(last.by)} ${last.kind === 'ingredient' ? 'added' : 'did'} ${stepLabel(last)}`
      : 'The pot is empty. Let’s cook!';

    renderSecret();

    // Pantry
    $('#pantry').replaceChildren(...ingIds.map(id => {
      const ing = catalog.ingredients[id];
      return el('button', {
        'aria-label': ing.name, title: ing.name,
        class: selection && selection.id === id ? 'selected' : '',
        disabled: !mine || inPot.has(id),
        onclick: () => { selection = { kind: 'ingredient', id }; sfx.tap(); buzz(8); renderRelay(); },
      }, ing.emoji);
    }));

    // Actions + confirm
    const actionBtns = Object.entries(catalog.actions).map(([id, a]) => el('button', {
      class: selection && selection.id === id ? 'selected' : '',
      disabled: !mine,
      onclick: () => { selection = { kind: 'action', id }; sfx.tap(); buzz(8); renderRelay(); },
    }, el('span', { class: 'e' }, a.emoji), a.name));
    const addLabel = !selection ? 'Pick one'
      : selection.kind === 'ingredient' ? `Add ${catalog.ingredients[selection.id].emoji}`
      : `${catalog.actions[selection.id].name} it`;
    const addBtn = el('button', { class: 'add-btn', disabled: !mine || !selection, onclick: commitMove }, mine ? addLabel : 'Wait…');
    $('#actions').replaceChildren(...actionBtns, addBtn);

    // Cues when the turn passes to me.
    const wasMine = prev && prev.game && prev.game.mode === 'relay' && prev.game.currentSeat === room.seat && prev.game.round === g.round;
    if (mine && !wasMine) { sfx.yourTurn(); buzz([30, 40, 30]); }
    else if (g.pot.length > prevLen) sfx.plop();
  }

  function commitMove() {
    if (!selection) return;
    const move = selection;
    socket.emit('relay:move', move, res => {
      if (res && res.error) { sfx.err(); toast(res.error); }
      else buzz(15);
    });
    selection = null;
  }

  // ───────── Results ─────────
  $('#next-btn').addEventListener('click', () => { sfx.tap(); cardHidden = true; socket.emit('relay:next'); });
  $('#results-lobby-btn').addEventListener('click', () => { sfx.tap(); socket.emit('room:lobby'); });

  function renderResults() {
    const g = state.game, room = state.room;
    $('#results-bowl').replaceChildren(...g.pot.filter(s => s.kind === 'ingredient').map(s => el('span', {}, catalog.ingredients[s.id] ? catalog.ingredients[s.id].emoji : '?')));
    $('#results-stars').replaceChildren(...[0, 1, 2].map(i => el('span', { class: i < g.result.stars ? '' : 'off' }, '⭐')));
    $('#results-name').textContent = g.dishName;
    const verdict = ['Hmm… the cat ate it 🐈', 'Edible! Kinda 😅', 'So tasty! 😋', 'Chef’s kiss! 👩‍🍳💋'][g.result.stars];
    $('#results-score').textContent = `${g.result.met}/${g.result.total} clues matched · ${verdict}`;

    $('#results-cards').replaceChildren(...[0, 1].map(seat => el('div', { class: 'result-card p' + seat },
      el('h3', {}, `${seat === room.seat ? 'Your' : playerName(seat) + '’s'} card`),
      el('ul', {}, ...g.cards[seat].map((c, i) => el('li', { class: g.result.checks[seat][i] ? 'ok' : 'no' }, c.text))),
    )));
    const t = g.target;
    $('#results-target').textContent = 'The secret recipe was: ' +
      [...t.ingredients.map(id => catalog.ingredients[id] ? catalog.ingredients[id].emoji : id),
       ...t.actions.map(id => catalog.actions[id] ? catalog.actions[id].emoji : id)].join(' ') +
      ' (any dish that matches every clue gets 3 stars)';

    const justFinished = !(prev && prev.game && prev.game.phase === 'results' && prev.game.round === g.round);
    if (justFinished) {
      sfx.ding(); buzz([40, 60, 40]);
      if (g.result.stars >= 2) setTimeout(() => floatEmoji(g.result.stars === 3 ? '💖' : '✨', 8), 600);
    }
  }

  // ───────── Main render ─────────
  function render() {
    if (!state) return show('home');
    const { room, game } = state;

    // Partner presence banner
    const partner = room.players[1 - room.seat];
    const prevPartner = prev && prev.room.players[1 - prev.room.seat];
    if (partner && !prevPartner && prev) { sfx.join(); buzz(30); toast(`${partner.name} joined the kitchen! 💕`); }
    banner(socket.connected ? (partner && !partner.connected && room.screen === 'game' ? `💤 ${partner.name} stepped out… they can come back anytime` : '') : '🔌 Reconnecting…');

    if (!game) { show('lobby'); renderLobby(); return; }
    if (game.mode === 'relay') {
      if (game.phase === 'results') { show('results', 'relay'); renderResults(); }
      else {
        if (!prev || !prev.game || prev.game.round !== game.round) cardHidden = true;
        if (!$('#screen-relay').classList.contains('active')) show('relay', 'relay');
        renderRelay();
      }
    }
  }

  show('home');
})();
