/* Couple's Kitchen — client */
(() => {
  'use strict';
  const { t } = I18N;

  // ───────── Utilities ─────────
  const $ = sel => document.querySelector(sel);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
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
  const errText = code => (t('err.' + code) === 'err.' + code ? code : t('err.' + code));

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
      const at = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      o.connect(g).connect(actx.destination); o.start(at); o.stop(at + dur);
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
  function syncMuteButtons() { document.querySelectorAll('.mute-btn').forEach(b => (b.textContent = muted ? '🔇' : '🔊')); }
  document.querySelectorAll('.mute-btn').forEach(b => b.addEventListener('click', () => {
    muted = !muted; store.set('muted', muted); syncMuteButtons(); sfx.tap();
  }));
  syncMuteButtons();

  // ───────── Language ─────────
  I18N.setLang(I18N.detectLang());
  document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => {
    I18N.setLang(I18N.lang === 'vi' ? 'en' : 'vi');
    sfx.tap();
    if (state) render(true);
  }));

  // ───────── Chef blob SVG ─────────
  function chefSVG(seat, mood = 'happy') {
    const [c, d] = SEAT_COLORS[seat];
    const mouth = {
      happy: '<path d="M40 60 Q50 69 60 60" stroke="#4A3428" stroke-width="4" fill="none" stroke-linecap="round"/>',
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
    const target = $('#screen-' + screen);
    if (!target.classList.contains('active')) {
      document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s === target));
      window.scrollTo(0, 0);
    }
    document.body.dataset.mode = mode || screen;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = document.body.dataset.mode === 'relay' ? '#3A2820' : '#FFF4E6';
  }

  let toastTimer;
  function toast(msg, ms = 2600) {
    const box = $('#toast');
    box.textContent = msg; box.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (box.hidden = true), ms);
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
  let catalog = null;
  fetch('/api/catalog').then(r => r.json()).then(c => { catalog = c; I18N.setCatalog(c); if (state) render(true); }).catch(() => {});

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
  socket.on('disconnect', () => banner(t('reconnecting')));
  socket.on('kicked', code => { store.del('room'); state = null; toast(errText(code)); show('home'); });
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
    // Vietnamese speakers start with the Vietnamese pantry; either player can switch in the lobby.
    const pack = I18N.lang === 'vi' ? 'vietnam' : 'western';
    socket.emit('room:create', { name: myName(), playerId, pack }, res => {
      if (res.error) return toast(errText(res.error));
      history.replaceState(null, '', '?room=' + res.code);
    });
  });
  function join() {
    sfx.tap();
    const code = codeInput.value.trim();
    if (code.length !== 4) { sfx.err(); return toast(t('codeLength')); }
    socket.emit('room:join', { code, name: myName(), playerId }, res => {
      if (res.error) { sfx.err(); return toast(errText(res.error)); }
      history.replaceState(null, '', '?room=' + res.code);
    });
  }
  $('#join-btn').addEventListener('click', join);
  codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });

  // ───────── Lobby ─────────
  $('#leave-btn').addEventListener('click', () => {
    if (!confirm(t('lobby.leaveConfirm'))) return;
    socket.emit('room:leave');
    store.del('room'); state = null;
    history.replaceState(null, '', location.pathname);
    show('home');
  });
  $('#share-btn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?room=${state.room.code}`;
    const text = t('lobby.shareText', { code: state.room.code });
    try {
      if (navigator.share) await navigator.share({ title: document.title, text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast(t('lobby.copied')); }
    } catch { /* user cancelled */ }
  });
  document.querySelectorAll('.pack-btn').forEach(btn => btn.addEventListener('click', () => {
    sfx.tap(); buzz(8);
    socket.emit('room:pack', { pack: btn.dataset.pack });
  }));
  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => {
    sfx.tap();
    socket.emit('mode:start', { mode: btn.dataset.mode }, res => { if (res && res.error) { sfx.err(); toast(errText(res.error)); } });
  }));

  function playerName(seat, room = state.room) {
    const p = room.players[seat];
    return p ? p.name : SEAT_FALLBACK[seat];
  }

  function renderLobby() {
    const { room } = state;
    $('#lobby-code').replaceChildren(...room.code.split('').map(ch => el('span', {}, ch)));

    $('#lobby-chefs').replaceChildren(...room.players.map((p, seat) => {
      const box = el('div', { class: 'chef' + (p ? '' : ' waiting') });
      box.innerHTML = chefSVG(seat, p && p.connected ? 'happy' : 'sleepy');
      box.append(
        el('div', { class: 'chef-name' }, p ? `${p.name}${seat === room.seat ? ' ' + t('lobby.you') : ''}` : t('lobby.waiting')),
        el('div', { class: 'chef-status' },
          el('span', { class: 'dot' + (p && p.connected ? '' : ' off') }),
          p ? (p.connected ? t('lobby.inKitchen') : t('lobby.steppedOut')) : t('lobby.notHere')),
      );
      return box;
    }));

    const partner = room.players[1 - room.seat];
    $('#lobby-hint').textContent = !partner ? t('lobby.hintAlone')
      : !partner.connected ? t('lobby.hintAway', { name: partner.name }) : t('lobby.hintReady');
    document.querySelectorAll('.mode-card[data-mode="relay"]').forEach(b => (b.disabled = !partner));
    document.querySelectorAll('.pack-btn').forEach(b => b.setAttribute('aria-checked', String(b.dataset.pack === room.pack)));

    const s = room.stats;
    const recap = $('#lobby-recap');
    recap.replaceChildren();
    if (s.rounds && catalog) {
      const best = s.dishes.slice().sort((a, b) => b.stars - a.stars)[0];
      recap.append(
        t('lobby.recapTonight') + ' ', el('b', {}, t('lobby.recapDishes', s.rounds)), ' · ', el('b', {}, `${s.stars} ⭐`), el('br'),
        t('lobby.recapBest') + ' ', el('b', {}, `${I18N.dishName(best.dish, best.names)} ${'⭐'.repeat(best.stars) || '(0⭐)'}`),
      );
    }
  }

  // ───────── Recipe Relay ─────────
  $('#relay-back').addEventListener('click', () => {
    if (confirm(t('relay.leaveConfirm'))) socket.emit('room:lobby');
  });

  const secretCard = $('#secret-card');
  secretCard.addEventListener('click', () => { cardHidden = !cardHidden; sfx.tap(); renderSecret(); });

  $('#reactions').replaceChildren(...['❤️', '😏', '🤔', '👍', '👎', '😂'].map(e =>
    el('button', { 'aria-label': e, onclick: () => { socket.emit('react', { emoji: e }); floatEmoji(e, 3); sfx.heart(); buzz(10); } }, e)));

  function stepLabel(step) {
    return step.kind === 'ingredient'
      ? `${I18N.ingEmoji(step.id)} ${I18N.lower(I18N.ingName(step.id))}`
      : I18N.actPast(step.id);
  }

  function renderSecret() {
    secretCard.classList.toggle('hidden', cardHidden);
    $('.secret-tip').textContent = cardHidden ? t('relay.peek') : t('relay.hide');
    $('#secret-list').replaceChildren(...state.game.myCard.map(c => el('li', {}, I18N.clueText(c))));
  }

  // `quiet` re-renders (language switch, catalog load) skip sounds and animations.
  function renderRelay(quiet = false) {
    const g = state.game, room = state.room;
    const mine = g.currentSeat === room.seat;
    const pack = catalog.packs[g.pack];
    const ingIds = Object.keys(pack.ingredients);
    const inPot = new Set(g.pot.filter(s => s.kind === 'ingredient').map(s => s.id));
    if (selection && selection.kind === 'ingredient' && inPot.has(selection.id)) selection = null;
    if (!mine) selection = null;

    $('#relay-title').textContent = t('relay.title', { dish: I18N.dishTypeName(g.pack, g.dishType), round: g.round });
    const bannerEl = $('#turn-banner');
    bannerEl.classList.toggle('mine', mine);
    bannerEl.textContent = mine
      ? t('relay.yourTurn', room.seat === 0 ? '💛' : '💜', g.totalTurns - g.turn)
      : t('relay.theirTurn', { name: playerName(g.currentSeat) });

    $('#turn-dots').replaceChildren(...Array.from({ length: g.totalTurns }, (_, i) => {
      const step = g.pot[i];
      return el('i', { class: [step ? 'done p' + step.by : '', i === g.turn ? 'now' : ''].join(' ') });
    }));

    // Pot contents: ingredients float in a loose pile; only new ones drop in.
    const sameRound = prev && prev.game && prev.game.mode === 'relay' && prev.game.round === g.round;
    const prevLen = quiet ? g.pot.length : sameRound ? prev.game.pot.length : 0;
    const ings = g.pot.filter(s => s.kind === 'ingredient');
    $('#pot-contents').replaceChildren(...ings.map((s, i) => {
      const spot = [[50, 40], [24, 50], [76, 48], [38, 14], [64, 18], [12, 22], [88, 24], [50, 0]][i % 8];
      const n = el('span', { class: 'ing p' + s.by }, I18N.ingEmoji(s.id));
      n.style.left = `calc(${spot[0]}% - 15px)`; n.style.top = spot[1] + 'px';
      if (g.pot.indexOf(s) < prevLen) n.style.animation = 'simmer 3s ease-in-out infinite';
      n.style.animationDelay = (i * 0.3) + 's';
      return n;
    }));
    const last = g.pot[g.pot.length - 1];
    if (last && g.pot.length > prevLen && last.kind === 'action') {
      const pot = $('.pot'); pot.classList.remove('stir'); void pot.offsetWidth; pot.classList.add('stir');
    }
    let lastText = t('relay.empty');
    if (last) {
      const me = last.by === room.seat, name = playerName(last.by);
      lastText = last.kind === 'ingredient'
        ? t(me ? 'relay.youAdded' : 'relay.theyAdded', { name, thing: stepLabel(last) })
        : t(me ? 'relay.youDid' : 'relay.theyDid', { name, action: stepLabel(last) });
    }
    // While choosing, show what the tapped emoji actually is (🌾 = Sả / Lemongrass).
    const lm = $('#last-move');
    lm.classList.toggle('picking', !!selection);
    lm.textContent = selection
      ? `👉 ${selection.kind === 'ingredient' ? I18N.ingEmoji(selection.id) + ' ' + I18N.ingName(selection.id) : I18N.actEmoji(selection.id) + ' ' + I18N.actName(selection.id)}`
      : lastText;

    renderSecret();

    $('#pantry').replaceChildren(...ingIds.map(id => el('button', {
      'aria-label': I18N.ingName(id), title: I18N.ingName(id),
      class: selection && selection.id === id ? 'selected' : '',
      disabled: !mine || inPot.has(id),
      onclick: () => { selection = { kind: 'ingredient', id }; sfx.tap(); buzz(8); renderRelay(true); },
    }, I18N.ingEmoji(id))));

    const actionBtns = Object.keys(catalog.actions).map(id => el('button', {
      class: selection && selection.id === id ? 'selected' : '',
      disabled: !mine,
      onclick: () => { selection = { kind: 'action', id }; sfx.tap(); buzz(8); renderRelay(true); },
    }, el('span', { class: 'e' }, I18N.actEmoji(id)), I18N.actName(id)));
    const addLabel = !mine ? t('relay.wait')
      : !selection ? t('relay.pick')
      : selection.kind === 'ingredient' ? t('relay.add', { emoji: I18N.ingEmoji(selection.id) })
      : t('relay.doIt', { action: I18N.actName(selection.id) });
    $('#actions').replaceChildren(...actionBtns, el('button', { class: 'add-btn', disabled: !mine || !selection, onclick: commitMove }, addLabel));

    if (quiet) return;
    const wasMine = sameRound && prev.game.currentSeat === room.seat;
    if (mine && !wasMine) { sfx.yourTurn(); buzz([30, 40, 30]); }
    else if (g.pot.length > prevLen) sfx.plop();
  }

  function commitMove() {
    if (!selection) return;
    socket.emit('relay:move', selection, res => {
      if (res && res.error) { sfx.err(); toast(errText(res.error)); } else buzz(15);
    });
    selection = null;
  }

  // ───────── Results ─────────
  $('#next-btn').addEventListener('click', () => { sfx.tap(); cardHidden = true; socket.emit('relay:next'); });
  $('#results-lobby-btn').addEventListener('click', () => { sfx.tap(); socket.emit('room:lobby'); });

  function renderResults(quiet = false) {
    const g = state.game, room = state.room;
    const names = [playerName(0), playerName(1)];
    $('#results-bowl').replaceChildren(...g.pot.filter(s => s.kind === 'ingredient').map(s => el('span', { title: I18N.ingName(s.id) }, I18N.ingEmoji(s.id))));
    $('#results-stars').replaceChildren(...[0, 1, 2].map(i => el('span', { class: i < g.result.stars ? '' : 'off' }, '⭐')));
    $('#results-name').textContent = I18N.dishName(g.dish, names);
    $('#results-score').textContent = t('results.score', { met: g.result.met, total: g.result.total, verdict: t('results.verdicts')[g.result.stars] });

    $('#results-cards').replaceChildren(...[0, 1].map(seat => el('div', { class: 'result-card p' + seat },
      el('h3', {}, seat === room.seat ? t('results.yourCard') : t('results.theirCard', { name: names[seat] })),
      el('ul', {}, ...g.cards[seat].map((c, i) => el('li', { class: g.result.checks[seat][i] ? 'ok' : 'no' }, I18N.clueText(c)))),
    )));
    const items = [...g.target.ingredients.map(I18N.ingEmoji), ...g.target.actions.map(I18N.actEmoji)].join(' ');
    $('#results-target').textContent = t('results.secret', { items });

    if (quiet) return;
    const justFinished = !(prev && prev.game && prev.game.phase === 'results' && prev.game.round === g.round);
    if (justFinished) {
      sfx.ding(); buzz([40, 60, 40]);
      if (g.result.stars >= 2) setTimeout(() => floatEmoji(g.result.stars === 3 ? '💖' : '✨', 8), 600);
    }
  }

  // ───────── Main render ─────────
  function render(quiet = false) {
    if (!state) return show('home');
    const { room, game } = state;

    const partner = room.players[1 - room.seat];
    const prevPartner = prev && prev.room.players[1 - prev.room.seat];
    if (!quiet && partner && !prevPartner && prev) { sfx.join(); buzz(30); toast(t('joined', { name: partner.name })); }
    banner(!socket.connected ? t('reconnecting')
      : partner && !partner.connected && room.screen === 'game' ? t('partnerAway', { name: partner.name }) : '');

    if (!game) { show('lobby'); renderLobby(); return; }
    if (!catalog) return;  // wait for ingredient data
    if (game.mode === 'relay') {
      if (game.phase === 'results') { show('results', 'relay'); renderResults(quiet); }
      else {
        if (!prev || !prev.game || prev.game.round !== game.round) cardHidden = true;
        show('relay', 'relay');
        renderRelay(quiet);
      }
    }
  }

  show('home');
})();
