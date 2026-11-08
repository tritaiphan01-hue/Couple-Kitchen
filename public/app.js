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
  const iconEl = (tag, props, html) => { const n = el(tag, props); n.innerHTML = html; return n; };
  const relayIcon = id => (window.Icons ? Icons.icon('relay', id, I18N.ingEmoji(id)) : I18N.ingEmoji(id));
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
  // iPhones only allow audio that was started by a tap, so create/resume the
  // audio context on the first touch, and again when the app comes back.
  function unlockAudio() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state !== 'running') actx.resume();
      if (window.Music) Music.attach(actx);
    } catch { /* audio unavailable */ }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && actx) actx.resume().catch(() => {}); });
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0) {
    if (muted) return;
    try {
      if (!actx || actx.state !== 'running') return;   // not unlocked by a tap yet
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
  // Android vibrates; iPhone Safari has no vibration API, so this quietly does nothing there.
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* ignore */ } };

  // Keep the screen awake during a game (supported on Android and iOS 16.4+).
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state && state.game) keepAwake(true); });
  function syncMuteButtons() { document.querySelectorAll('.mute-btn').forEach(b => (b.textContent = muted ? '🔇' : '🔊')); }
  document.querySelectorAll('.mute-btn').forEach(b => b.addEventListener('click', () => {
    muted = !muted; store.set('muted', muted); syncMuteButtons(); sfx.tap();
  }));
  syncMuteButtons();

  // Background music (separate from sound effects)
  if (window.Music) Music.setEnabled(store.get('music', true));
  function syncMusicButtons() { document.querySelectorAll('.music-btn').forEach(b => b.classList.toggle('off', !(window.Music && Music.enabled))); }
  document.querySelectorAll('.music-btn').forEach(b => b.addEventListener('click', () => {
    if (!window.Music) return;
    Music.setEnabled(!Music.enabled); store.set('music', Music.enabled); syncMusicButtons(); unlockAudio();
  }));
  syncMusicButtons();

  // ───────── Language ─────────
  I18N.setLang(I18N.detectLang());
  document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => {
    I18N.setLang(I18N.lang === 'vi' ? 'en' : 'vi');
    sfx.tap();
    if (state) render(true);
  }));

  // ───────── Chef blob SVG ─────────
  // A chef wears whatever its owner picked in the shop (colour, hat, glasses).
  function lookOf(seat) {
    const p = state && state.room && state.room.players[seat];
    return p && p.look ? p.look : { color: seat ? 'color_plum' : 'color_honey', hat: 'hat_chef', glasses: 'glasses_none' };
  }
  function chefSVG(seat, mood = 'happy', look = lookOf(seat)) {
    const items = (catalog && catalog.shop) || {};
    const [c, d] = (items[look.color] && items[look.color].value) || SEAT_COLORS[seat];
    const hat = look.hat && look.hat !== 'hat_chef' && items[look.hat]
      ? `<text x="50" y="${look.hat === 'hat_ears' ? 40 : 34}" font-size="${look.hat === 'hat_ears' ? 40 : 34}" text-anchor="middle">${items[look.hat].emoji}</text>`
      : '<path d="M30 22 Q30 6 50 8 Q70 6 70 22 Q82 18 80 30 Q78 38 70 36 H30 Q22 38 20 30 Q18 18 30 22Z" fill="#fff" stroke="#4A3428" stroke-width="3.5"/>';
    const glasses = look.glasses && look.glasses !== 'glasses_none' && items[look.glasses]
      ? `<text x="50" y="59" font-size="30" text-anchor="middle">${items[look.glasses].emoji}</text>` : '';
    const mouth = {
      happy: '<path d="M40 60 Q50 69 60 60" stroke="#4A3428" stroke-width="4" fill="none" stroke-linecap="round"/>',
      sleepy: '<path d="M43 62 H57" stroke="#4A3428" stroke-width="4" stroke-linecap="round"/>',
    }[mood];
    const eyes = mood === 'sleepy'
      ? '<path d="M34 50 Q38 53 42 50 M58 50 Q62 53 66 50" stroke="#4A3428" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      : '<circle cx="38" cy="50" r="4.5" fill="#4A3428"/><circle cx="62" cy="50" r="4.5" fill="#4A3428"/>';
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="94" rx="30" ry="5" fill="rgba(0,0,0,.15)"/>
      <rect x="18" y="32" width="64" height="58" rx="30" fill="${c}" stroke="#4A3428" stroke-width="3.5"/>
      <path d="M32 70 H68 V86 Q50 94 32 86Z" fill="#fff" stroke="#4A3428" stroke-width="3" opacity=".95"/>
      <path d="M44 70 V64 H56 V70" fill="none" stroke="${d}" stroke-width="3"/>
      ${eyes}
      <circle cx="30" cy="58" r="5" fill="#E85D4A" opacity=".35"/><circle cx="70" cy="58" r="5" fill="#E85D4A" opacity=".35"/>
      ${mouth}
      ${hat}
      ${glasses}
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
    if (window.Music) Music.setMood({ rush: 'rush', sneak: 'sneak' }[document.body.dataset.mode] || 'chill');
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
  let lastRoomCode = null;
  socket.on('state', s => {
    prev = state; state = s;
    if (s.game && s.game.mode === 'rush') { rushServerGame = s.game; rushReconcile(); }
    if (s.room.code !== lastRoomCode) { lastRoomCode = s.room.code; store.set('room', s.room.code); }
    saveProgress(s.room);
    render();
  });

  // Keep a copy of the couple's progress on this phone so it survives server restarts.
  let lastSaved = '';
  function saveProgress(room) {
    const me = room.players[room.seat];
    if (!room.shop || !me) return;
    const data = {
      v: 1,
      couple: { wallet: room.shop.wallet, upgrades: room.shop.upgrades, decorOwned: room.shop.decorOwned, decor: room.shop.decor, rushBest: room.rushBest, sneakBest: room.sneakBest },
      me: { owned: me.owned, look: me.look },
    };
    const json = JSON.stringify(data);
    if (json === lastSaved) return;      // was written 4×/s during Split Kitchen
    lastSaved = json;
    store.set('progress', { ...data, savedAt: Date.now() });
  }
  const savedProgress = () => store.get('progress', null);
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
    socket.emit('room:create', { name: myName(), playerId, progress: savedProgress() }, res => {
      if (res.error) return toast(errText(res.error));
      history.replaceState(null, '', '?room=' + res.code);
    });
  });
  function join() {
    sfx.tap();
    const code = codeInput.value.trim();
    if (code.length !== 4) { sfx.err(); return toast(t('codeLength')); }
    socket.emit('room:join', { code, name: myName(), playerId, progress: savedProgress() }, res => {
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
    document.querySelectorAll('.mode-card').forEach(b => (b.disabled = !partner));

    if (catalog) renderWallets($('#lobby-wallets'));
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
    // Progress per mode: highest level reached and total stars.
    for (const [bestKey, label, unit] of [['rushBest', 'lobby.rushBest', 'rush.level'], ['sneakBest', 'lobby.sneakBest', 'sneak.night']]) {
      const best = room[bestKey] || {};
      const levels = Object.keys(best).map(Number);
      if (!levels.length) continue;
      if (recap.childNodes.length) recap.append(el('br'));
      const stars = Object.values(best).reduce((a, b) => a + b, 0);
      recap.append(t(label) + ' ', el('b', {}, `${t(unit, { n: Math.max(...levels) })} · ${stars} ⭐`));
    }
  }

  // ───────── Recipe Relay ─────────
  $('#relay-back').addEventListener('click', () => {
    if (confirm(t('relay.leaveConfirm'))) socket.emit('room:lobby');
  });

  const secretCard = $('#secret-card');
  // 'hide': blurred until tapped (playing side by side). 'show': always visible (playing apart).
  let cardMode = store.get('cardMode', 'hide');
  secretCard.addEventListener('click', () => {
    sfx.tap();
    if (cardMode === 'show') { toast(t('relay.cardInfo'), 3200); return; }
    cardHidden = !cardHidden; renderSecret();
  });

  $('#reactions').replaceChildren(...['❤️', '😏', '🤔', '👍', '👎', '😂'].map(e =>
    el('button', { 'aria-label': e, onclick: () => { socket.emit('react', { emoji: e }); floatEmoji(e, 3); sfx.heart(); buzz(10); } }, e)));

  function stepLabel(step) {
    return step.kind === 'action'
      ? I18N.actPast(step.id)
      : `${I18N.ingEmoji(step.id)} ${I18N.lower(I18N.ingName(step.id))}`;
  }

  function renderSecret() {
    const hidden = cardMode === 'hide' && cardHidden;
    secretCard.classList.toggle('hidden', hidden);
    $('.secret-tip').textContent = cardMode === 'show' ? 'ⓘ' : hidden ? t('relay.peek') : t('relay.hide');
    $('#secret-list').replaceChildren(...state.game.myCard.map(c => el('li', {}, I18N.clueText(c))));
  }

  // Grandma's speech bubble: a fresh random line each time she reacts.
  const gmaUI = { seen: -1, line: '' };
  function gmaLine(r) {
    if (!r) return t('gma.watching');
    const key = r.mood === 'yum' ? 'gma.yum' : r.mood === 'yuck' ? 'gma.yuck' : r.mood === 'ok' ? 'gma.ok' : r.kind === 'remove' ? 'gma.oops' : 'gma.meh';
    return I18N.pickLine(key);
  }
  const heartsText = g => '❤️'.repeat(Math.max(0, g.hearts)) + '🤍'.repeat(Math.max(0, g.maxHearts - g.hearts));

  // `quiet` re-renders (language switch, catalog load) skip sounds and animations.
  function renderRelay(quiet = false) {
    const g = state.game, room = state.room;
    const playing = g.phase === 'playing';
    const mine = playing && g.currentSeat === room.seat;
    const ingIds = g.market;   // today's market: 18 of the combined pantry
    const inPot = new Set(g.pot.filter(s => s.kind === 'ingredient').map(s => s.id));
    if (selection && selection.kind === 'ingredient' && inPot.has(selection.id)) selection = null;
    if (selection && selection.kind === 'remove' && !inPot.size) selection = null;
    if (!mine) selection = null;

    $('#relay-title').textContent = `${t('relay.title', { round: g.round })} ${'🌶️'.repeat(g.tier + 1)}`;
    $('#screen-relay').classList.toggle('many-clues', g.myCard.length > 3);
    const bannerEl = $('#turn-banner');
    bannerEl.classList.toggle('mine', mine);
    bannerEl.textContent = !playing ? t('gma.watching')
      : mine ? t('relay.yourTurn', room.seat === 0 ? '💛' : '💜', g.totalTurns - g.turn)
      : t('relay.theirTurn', { name: playerName(g.currentSeat) });

    $('#relay-hearts').textContent = heartsText(g);
    $('#relay-count').textContent = t('relay.meta', { i: g.ingCount, a: g.actCount });
    $('#turn-dots').replaceChildren(...Array.from({ length: g.totalTurns }, (_, i) => {
      const r = g.reactions[i];
      return el('i', { class: [r ? 'done p' + r.by + ' ' + r.mood : '', i === g.turn && playing ? 'now' : ''].join(' ') });
    }));

    // Pot contents: ingredients float in a loose pile; only new ones drop in.
    const sameRound = prev && prev.game && prev.game.mode === 'relay' && prev.game.round === g.round;
    const prevSteps = quiet ? g.reactions.length : sameRound ? prev.game.reactions.length : 0;
    const prevIngs = sameRound ? new Set(prev.game.pot.filter(s => s.kind === 'ingredient').map(s => s.id)) : new Set();
    const ings = g.pot.filter(s => s.kind === 'ingredient');
    $('#pot-contents').replaceChildren(...ings.map((s, i) => {
      const spot = [[50, 40], [24, 50], [76, 48], [38, 14], [64, 18], [12, 22], [88, 24], [50, 0]][i % 8];
      const n = iconEl('span', { class: 'ing p' + s.by }, relayIcon(s.id));
      n.style.left = `calc(${spot[0]}% - 15px)`; n.style.top = spot[1] + 'px';
      if (quiet || prevIngs.has(s.id)) n.style.animation = 'simmer 3s ease-in-out infinite';
      n.style.animationDelay = (i * 0.3) + 's';
      return n;
    }));

    // What just happened + Grandma's reaction to it
    const last = g.reactions[g.reactions.length - 1];
    if (last && g.reactions.length > prevSteps && last.kind === 'action') {
      const pot = $('.pot'); pot.classList.remove('stir'); void pot.offsetWidth; pot.classList.add('stir');
    }
    let lastText = t('relay.empty');
    if (last) {
      const me = last.by === room.seat, name = playerName(last.by), thing = stepLabel(last);
      lastText = last.kind === 'ingredient' ? t(me ? 'relay.youAdded' : 'relay.theyAdded', { name, thing })
        : last.kind === 'remove' ? t(me ? 'relay.youScooped' : 'relay.theyScooped', { name, thing })
        : t(me ? 'relay.youDid' : 'relay.theyDid', { name, action: thing });
    }
    if (gmaUI.seen !== g.reactions.length || !gmaUI.line || quiet) {
      gmaUI.seen = g.reactions.length;
      gmaUI.line = g.hearts <= 0 ? t('gma.kicked') : gmaLine(last);
    }
    const gma = $('#grandma');
    gma.className = 'grandma ' + (last ? last.mood : '') + (g.hearts <= 0 ? ' angry' : '');
    $('#gma-bubble').textContent = gmaUI.line;

    renderSecret();

    $('#pantry').replaceChildren(...ingIds.map(id => el('button', {
      'aria-label': I18N.ingName(id), title: I18N.ingName(id),
      class: selection && selection.id === id ? 'selected' : '',
      disabled: !mine || inPot.has(id),
      'data-id': id,
      onclick: () => { if (!mine) return; selection = { kind: 'ingredient', id }; sfx.tap(); buzz(8); refreshRelaySelection(); },
    }, iconEl('span', { class: 'pi' }, relayIcon(id)))));

    const pick = sel => () => { if (!mine) return; selection = sel; sfx.tap(); buzz(8); refreshRelaySelection(); };
    const actionBtns = Object.keys(catalog.actions).map(id => el('button', {
      'data-kind': 'action', 'data-id': id, disabled: !mine, onclick: pick({ kind: 'action', id }),
    }, el('span', { class: 'e' }, I18N.actEmoji(id)), I18N.actName(id)));
    actionBtns.push(el('button', {
      class: 'scoop', 'data-kind': 'remove', disabled: !mine || !inPot.size, onclick: pick({ kind: 'remove' }),
    }, el('span', { class: 'e' }, '↩️'), t('relay.scoop')));
    $('#actions').replaceChildren(...actionBtns, el('button', { class: 'add-btn', onclick: commitMove }));
    relayCtx = { mine, lastText };
    refreshRelaySelection();

    if (quiet) return;
    // Sounds for Grandma's reaction, and for your turn.
    if (last && g.reactions.length > prevSteps) {
      if (last.mood === 'yuck') {
        sfx.err(); buzz([60, 40, 60]); floatEmoji('💔', 3);
        const h = $('#relay-hearts'); h.classList.remove('hurt'); void h.offsetWidth; h.classList.add('hurt');
        gma.classList.add('shake');
      } else if (last.mood === 'yum') { sfx.done(); floatEmoji('😋', 1); }
      else sfx.plop();
    }
    const wasMine = sameRound && prev.game.phase === 'playing' && prev.game.currentSeat === room.seat;
    if (mine && !wasMine) { sfx.yourTurn(); buzz([30, 40, 30]); }
  }

  // Highlight the current pick and update the "Add" button, without rebuilding anything.
  let relayCtx = { mine: false, lastText: '' };
  function refreshRelaySelection() {
    const { mine, lastText } = relayCtx;
    document.querySelectorAll('#pantry button').forEach(b => b.classList.toggle('selected', !!selection && selection.kind === 'ingredient' && b.dataset.id === selection.id));
    document.querySelectorAll('#actions button[data-kind]').forEach(b => b.classList.toggle('selected', !!selection && selection.kind === b.dataset.kind && (b.dataset.kind === 'remove' || b.dataset.id === selection.id)));
    const add = $('#actions .add-btn');
    if (add) {
      add.disabled = !mine || !selection;
      add.textContent = !mine ? t('relay.wait') : !selection ? t('relay.pick')
        : selection.kind === 'ingredient' ? t('relay.add', { emoji: I18N.ingEmoji(selection.id) })
        : selection.kind === 'remove' ? t('relay.scoopIt')
        : t('relay.doIt', { action: I18N.actName(selection.id) });
    }
    // While choosing, show what the tapped icon actually is (🌾 = Sả / Lemongrass).
    const lm = $('#last-move');
    lm.classList.toggle('picking', !!selection);
    lm.textContent = !selection ? lastText
      : selection.kind === 'ingredient' ? `👉 ${I18N.ingEmoji(selection.id)} ${I18N.ingName(selection.id)}`
      : selection.kind === 'remove' ? `👉 ${t('relay.scoopIt')}`
      : `👉 ${I18N.actEmoji(selection.id)} ${I18N.actName(selection.id)}`;
  }

  function commitMove() {
    if (!selection) return;
    socket.emit('relay:move', selection, res => {
      if (res && res.error) { sfx.err(); toast(errText(res.error)); } else buzz(15);
    });
    selection = null;
  }

  // ───────── Guess the dish ─────────
  function renderGuess(quiet) {
    const g = state.game, box = $('#guess');
    if (g.phase !== 'guessing') { box.hidden = true; return; }
    const verdict = g.how === 'kicked' ? t('gma.kicked') : g.how === 'perfect' ? t('results.perfect') : '👵 ' + t('gma.watching');
    const card = el('div', { class: 'intro-card guess-card' + (g.how === 'kicked' ? ' kicked' : '') },
      el('div', { class: 'guess-verdict' }, verdict),
      el('h2', {}, t('guess.title')),
      el('p', { class: 'guess-sub' }, t('guess.sub')),
      el('div', { class: 'guess-options' }, g.guessOptions.map(id => {
        const d = I18N.relayDish(id);
        return tapBtn('guess-opt' + (g.myGuess === id ? ' on' : '') + (g.myGuess && g.myGuess !== id ? ' dim' : ''),
          () => { if (g.myGuess) return; sfx.tap(); buzz(10); socket.emit('relay:guess', { dish: id }, res => { if (res && res.error) toast(errText(res.error)); }); },
          el('span', { class: 'go-e' }, d.emoji), el('span', { class: 'go-n' }, d.name[I18N.lang]));
      })),
      el('p', { class: 'guess-status' }, g.myGuess ? t('guess.waiting', { name: playerName(1 - state.room.seat) })
        : g.partnerGuessed ? t('guess.partnerDone', { name: playerName(1 - state.room.seat) }) : ''));
    box.replaceChildren(card);
    const wasHidden = box.hidden;
    box.hidden = false;
    if (wasHidden && !quiet) {
      if (g.how === 'kicked') { sfx.err(); buzz([100, 50, 200]); document.body.classList.add('lights-on'); setTimeout(() => document.body.classList.remove('lights-on'), 900); }
      else if (g.how === 'perfect') { sfx.ding(); floatEmoji('💖', 6); }
    }
  }

  // ───────── Results ─────────
  $('#next-btn').addEventListener('click', () => { sfx.tap(); cardHidden = true; socket.emit('relay:next'); });
  $('#results-lobby-btn').addEventListener('click', () => { sfx.tap(); socket.emit('room:lobby'); });

  function renderResults(quiet = false) {
    const g = state.game, room = state.room, r = g.result;
    const names = [playerName(0), playerName(1)];
    const dish = I18N.relayDish(g.dish);
    $('#results-bowl').replaceChildren(...g.pot.filter(s => s.kind === 'ingredient').map(s => iconEl('span', { title: I18N.ingName(s.id) }, relayIcon(s.id))));
    $('#results-stars').replaceChildren(...[0, 1, 2].map(i => el('span', { class: i < r.stars ? '' : 'off' }, '⭐')));
    const name = I18N.dishName(g.dishInfo, names);
    $('#results-name').textContent = `${dish.emoji} ${r.how === 'perfect' ? name : t('results.attempt', { dish: name })}`;
    $('#results-score').textContent = r.how === 'kicked' ? t('results.kicked') : r.how === 'perfect' ? t('results.perfect')
      : r.stars > 0 ? t('results.close', r.mistakes.total) : t('results.far', r.mistakes.total);

    $('#results-cards').replaceChildren(...[0, 1].map(seat => el('div', { class: 'result-card p' + seat },
      el('h3', {}, seat === room.seat ? t('results.yourCard') : t('results.theirCard', { name: names[seat] })),
      el('ul', {}, ...g.cards[seat].map((c, i) => {
        const li = el('li', { class: r.checks[seat][i] ? 'ok' : 'no' }, I18N.clueText(c));
        if (c.type === 'riddle') { li.append(' → '); li.append(iconEl('span', { class: 'answer' }, relayIcon(c.answer))); li.append(' ' + I18N.lower(I18N.ingName(c.answer))); }
        return li;
      })),
    )));
    const recipe = el('span', {});
    dish.ings.forEach(id => recipe.append(iconEl('span', { class: 'answer', title: I18N.ingName(id) }, relayIcon(id))));
    recipe.append(' ' + dish.acts.map(I18N.actEmoji).join(' '));
    const target = $('#results-target');
    target.replaceChildren(t('results.recipe', { items: '' }), recipe);
    $('#results-guesses').replaceChildren(...[0, 1].map(seat => el('div', {}, r.guessed && r.guessed[seat]
      ? t('results.guessRight', { name: names[seat] })
      : t('results.guessWrong', { name: names[seat], dish: I18N.relayDish(g.guesses[seat]).name[I18N.lang] }))));
    $('#results-reward').textContent = r.reward ? t('reward', r.reward) : '';

    if (quiet) return;
    const justFinished = !(prev && prev.game && prev.game.phase === 'results' && prev.game.round === g.round);
    if (justFinished) {
      sfx.ding(); buzz([40, 60, 40]);
      if (r.stars >= 2) setTimeout(() => floatEmoji(r.stars === 3 ? '💖' : '✨', 8), 600);
    }
  }

  // ───────── Split Kitchen ─────────
  const SILENT_ERRORS = new Set(['empty', 'not_started']);
  const rushUI = { key: null, lastEvent: 0, clockBase: 0, recvAt: 0, running: false, raf: 0, burnerState: [], orderIds: '' };

  sfx.chop = () => tone(900 + Math.random() * 200, 0.04, 'square', 0.04);
  sfx.whoosh = () => { tone(400, 0.08, 'sine', 0.1); tone(700, 0.1, 'sine', 0.08, 0.05); };
  sfx.done = () => tone(1200, 0.12, 'triangle', 0.1);
  sfx.warn = () => tone(260, 0.1, 'square', 0.05);

  const rushClock = () => (rushUI.running ? rushUI.clockBase + (performance.now() - rushUI.recvAt) : rushUI.clockBase);
  const fmtTime = ms => { const sec = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const BADGE = { raw: '', chopped: '🔪', cooked: '🔥', chopped_cooked: '🔪🔥', burnt: '💨' };

  function rushItemState(item, cfg, extra = 0) {
    if (item.burnt) return 'burnt';
    const cooked = item.cookedMs + extra >= cfg.cookMs;
    return item.chopped && cooked ? 'chopped_cooked' : cooked ? 'cooked' : item.chopped ? 'chopped' : 'raw';
  }
  function itemHTML(ing, st) {
    const info = I18N.rushIng(ing);
    const pic = window.Icons ? Icons.icon('rush', ing, info.emoji) : info.emoji;
    return `<span class="itm st-${st}"><span class="e">${pic}</span>${BADGE[st] ? `<span class="b">${BADGE[st]}</span>` : ''}</span>`;
  }
  const itemLabel = (ing, st) => `${I18N.rushIng(ing).name[I18N.lang]} (${t('rush.st.' + st)})`;

  function shake(node) { if (!node) return; node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }
  // Client-side prediction. Mirrors server/rush.js `act` for this player's own taps so the
  // kitchen reacts instantly. Pure: only mutates `g`, no DOM or sound.
  function applyRush(g, me, a) {
    const hand = g.hands[me], role = g.myRole, cfg = g.config;
    if (a.type === 'pantry' && role === 'cook' && !hand) g.hands[me] = { id: -1, ing: a.ing, chopped: false, cookedMs: 0, burnt: false };
    else if (a.type === 'trash' && hand) g.hands[me] = null;
    else if (a.type === 'counter') {
      const slot = g.counter[a.i];
      if (hand && !slot) { g.counter[a.i] = { item: hand, by: me }; g.hands[me] = null; }
      else if (!hand && slot) { g.hands[me] = slot.item; g.counter[a.i] = null; }
    } else if (a.type === 'burner' && role === 'cook') {
      const b = g.burners[a.i];
      if (!b) return;
      if (hand && !b.item && !hand.burnt) { b.item = hand; b.since = a.at; g.hands[me] = null; }
      else if (!hand && b.item) { g.hands[me] = { ...b.item, cookedMs: b.item.cookedMs + Math.max(0, a.at - b.since) }; b.item = null; }
    } else if (a.type === 'plate' && role === 'prep') {
      if (hand && !hand.burnt && g.plate.length < 4) { g.plate.push(hand); g.hands[me] = null; }
      else if (!hand && g.plate.length) g.hands[me] = g.plate.pop();
    } else if (a.type === 'board' && role === 'prep') {
      const bd = g.board;
      if (hand && !bd.item && !hand.chopped && hand.cookedMs < cfg.cookMs && !hand.burnt) { bd.item = hand; bd.taps = 0; g.hands[me] = null; }
      else if (!hand && bd.item && !bd.item.chopped) { bd.taps++; if (bd.taps >= cfg.chopTaps) bd.item = { ...bd.item, chopped: true }; }
      else if (!hand && bd.item) { g.hands[me] = bd.item; bd.item = null; bd.taps = 0; }
    } else if (a.type === 'clearPlate' && role === 'prep') g.plate = [];
  }

  // Taps the server hasn't answered yet. Every state update is the server's view *before*
  // these taps arrived, so we replay them on top — otherwise an in-flight tick overwrites the
  // prediction and the item flickers back for a moment (very visible on mobile data).
  const rushPending = [];
  let rushSeq = 0, rushServerGame = null;
  const rushLive = g => g && g.mode === 'rush' && g.phase === 'playing' && g.running;
  function rushReconcile() {
    const g = rushServerGame && structuredClone(rushServerGame);
    if (!g) return;
    if (!rushLive(g)) rushPending.length = 0;
    const me = state.room.seat;
    for (const a of rushPending) applyRush(g, me, a);
    state.game = g;
  }
  socket.on('disconnect', () => { rushPending.length = 0; });

  function rushSend(action, node) {
    const g = state && state.game;
    const live = rushLive(g);
    const a = { ...action, at: live ? rushClock() : 0 };
    if (live) {
      const seq = ++rushSeq;
      rushPending.push({ ...a, seq });
      applyRush(g, state.room.seat, a);
      updateRush(g);
      a.seq = seq;
    }
    socket.emit('rush:act', action, res => {
      // The server answers right before it broadcasts the resulting state, so from here on
      // its updates already include this tap.
      const idx = rushPending.findIndex(p => p.seq === a.seq);
      if (idx >= 0) rushPending.splice(idx, 1);
      if (res && res.error) {
        if (!SILENT_ERRORS.has(res.error)) { toast(errText(res.error), 1500); sfx.err(); }
        shake(node);
        // The tap was refused: undo its prediction now instead of waiting for the next tick.
        if (live && state && state.game && state.game.mode === 'rush') { rushReconcile(); updateRush(state.game); }
      }
    });
  }
  // Kitchen controls react on touch-down (no waiting for the finger to lift); other buttons on click.
  const FAST = /\b(slot|trash|clear-plate|serve)\b/;
  const tapBtn = (cls, onTap, ...kids) => {
    const b = el('button', { class: cls }, ...kids);
    if (FAST.test(cls)) b.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); onTap(b); });
    else b.addEventListener('click', () => onTap(b));
    return b;
  };
  // Only touch the DOM when the content really changed.
  const setHTML = (node, html) => { if (node && node.__html !== html) { node.innerHTML = html; node.__html = html; } };
  const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
  function maxUnlocked(room, total = 10, key = 'rushBest') {
    let n = 1;
    while (n < total && ((room[key] || {})[n] || 0) >= 1) n++;
    return n;
  }

  $('#rush-back').addEventListener('click', () => {
    if (confirm(t('relay.leaveConfirm'))) socket.emit('room:lobby');
  });

  // Build the DOM for the current phase & role once; later updates only touch contents.
  function buildRush(g) {
    const body = $('#rush-body');
    const room = state.room, me = room.seat, partnerName = playerName(1 - me);
    body.replaceChildren();
    rushUI.burnerState = [];
    rushUI.orderIds = '';

    if (g.phase === 'ready' || g.phase === 'countdown') {
      const unlocked = maxUnlocked(room);
      const panel = el('div', { class: 'rush-ready' },
        el('div', { class: 'level-chips' }, Array.from({ length: g.levelCount }, (_, i) => i + 1).map(n => tapBtn('level-chip' + (n === g.level ? ' on' : ''),
          () => { if (n <= unlocked) { sfx.tap(); socket.emit('rush:level', { level: n }); } },
          n <= unlocked ? (n === g.level ? t('rush.level', { n }) : String(n)) : `🔒${n}`))),
        el('p', { class: 'rush-tip' }, t('rush.tips')[g.level - 1]),
        el('div', { class: 'role-cards' }, [0, 1].map(seat => {
          const role = g.roles[seat];
          const card = el('div', { class: `role-card ${role} p${seat}` });
          card.innerHTML = chefSVG(seat, 'happy');
          card.append(
            el('div', { class: 'role-who' }, seat === me ? t('rush.you') : playerName(seat)),
            el('div', { class: 'role-name' }, t('rush.' + role)),
            el('div', { class: 'role-desc' }, t('rush.' + role + 'Desc')),
            el('div', { class: 'role-ready', id: 'role-ready-' + seat }),
          );
          return card;
        })),
        tapBtn('btn btn-ghost btn-swap', () => { sfx.tap(); rushSend({ type: 'swap' }); }, t('rush.swap')),
        tapBtn('btn btn-primary', () => { sfx.tap(); buzz(10); rushSend({ type: 'ready' }); }, ''),
        tapBtn('btn btn-ghost btn-help', () => { sfx.tap(); showHowto('rush', true); }, t('howto.button')),
        el('div', { class: 'countdown', id: 'rush-countdown' }),
      );
      panel.querySelector('.btn-primary').id = 'rush-ready-btn';
      body.append(panel);
      return;
    }

    if (g.phase !== 'playing') return;
    const pantryIds = Object.keys(catalog.rush.ingredients);
    const counter = el('div', { class: 'counter' }, g.counter.map((_, i) => tapBtn('slot counter-slot', b => { sfx.tap(); rushSend({ type: 'counter', i }, b); })));
    const handRow = el('div', { class: 'hand-row' },
      el('div', { class: 'hand', id: 'rush-hand' }),
      tapBtn('trash', b => { sfx.tap(); rushSend({ type: 'trash' }, b); }, '🗑️'));

    if (g.myRole === 'cook') {
      body.append(el('div', { class: 'kit cook' },
        el('div', { class: 'kit-label' }, t('rush.pantry')),
        el('div', { class: 'rush-pantry' }, pantryIds.map(id => tapBtn('slot pantry-item', b => { sfx.tap(); buzz(6); rushSend({ type: 'pantry', ing: id }, b); },
          iconEl('span', { class: 'e' }, window.Icons ? Icons.icon('rush', id, I18N.rushIng(id).emoji) : I18N.rushIng(id).emoji), el('span', { class: 'n' }, I18N.rushIng(id).name[I18N.lang])))),
        el('div', { class: 'kit-label' }, t('rush.stove')),
        el('div', { class: 'burners', style: `--b:${g.burners.length}` }, g.burners.map((_, i) => tapBtn('slot burner', b => { sfx.tap(); rushSend({ type: 'burner', i }, b); },
          el('span', { class: 'ring' }), el('span', { class: 'content' })))),
        el('div', { class: 'kit-label' }, t('rush.counterTo', { name: partnerName })),
        counter, handRow));
    } else {
      body.append(el('div', { class: 'kit prep' },
        el('div', { class: 'kit-label' }, t('rush.counterFrom', { name: partnerName })),
        counter,
        el('div', { class: 'kit-label' }, t('rush.board')),
        tapBtn('slot board', b => {
          const gg = state.game;
          if (!gg.hands[me] && gg.board.item && !gg.board.item.chopped) {
            sfx.chop(); buzz(5);
            // Web Animations restarts the wobble without forcing a layout inside the tap handler.
            const c = b.querySelector('.content');
            if (c.animate) c.animate([{ transform: 'none' }, { transform: 'scale(.85) rotate(-8deg)' }, { transform: 'none' }], { duration: 150, easing: 'ease' });
          }
          else sfx.tap();
          rushSend({ type: 'board' }, b);
        }, el('span', { class: 'content' }), el('span', { class: 'board-text' }), el('span', { class: 'chopbar' }, el('i'))),
        el('div', { class: 'kit-label' }, t('rush.plate')),
        el('div', { class: 'plate-row' },
          tapBtn('slot plate', b => { sfx.tap(); rushSend({ type: 'plate' }, b); }, el('span', { class: 'content' })),
          tapBtn('clear-plate', b => { sfx.tap(); rushSend({ type: 'clearPlate' }, b); }, '✖'),
          tapBtn('btn btn-primary serve', b => { rushSend({ type: 'serve' }, b); }, t('rush.serve'))),
        handRow));
    }
  }

  function updateRush(g) {
    const room = state.room, me = room.seat;
    const cfg = g.config;
    setText($('#rush-level'), t('rush.level', { n: g.level }));
    setText($('#rush-coins'), `💰 ${g.coins}`);
    const playing = g.phase === 'playing';
    if (!playing) $('#rush-clock').textContent = fmtTime(cfg.durationMs - g.clock);
    $('#rush-orders').hidden = !playing;
    $('.rush-timebar').hidden = !playing;

    const pause = $('#rush-pause');
    pause.hidden = !(playing && !g.running);
    if (!pause.hidden) pause.textContent = t('rush.paused', { name: playerName(1 - me) });

    if (g.phase === 'ready' || g.phase === 'countdown') {
      [0, 1].forEach(seat => { const n = $('#role-ready-' + seat); if (n) n.textContent = g.ready[seat] ? '✅' : '…'; });
      const btn = $('#rush-ready-btn');
      if (btn) { btn.textContent = g.ready[me] ? t('rush.unready') : t('rush.ready'); btn.classList.toggle('is-ready', g.ready[me]); }
      const cd = $('#rush-countdown');
      if (cd) {
        cd.textContent = g.phase === 'countdown' ? '' : g.ready[1 - me] ? t('rush.partnerReady', { name: playerName(1 - me) }) : g.ready[me] ? t('rush.waitingPartner', { name: playerName(1 - me) }) : '';
        cd.classList.toggle('big', g.phase === 'countdown');
      }
      return;
    }
    if (!playing) return;

    // Orders: rebuild when the set of orders changes; timers animate in the rAF loop.
    const ids = g.orders.map(o => o.id).join(',');
    if (ids !== rushUI.orderIds) {
      rushUI.orderIds = ids;
      $('#rush-orders').style.gridTemplateColumns = `repeat(${Math.max(3, cfg.maxOrders || 3)}, 1fr)`;
      $('#rush-orders').replaceChildren(...g.orders.map(o => {
        const d = I18N.rushDish(o.dish);
        const tk = el('div', { class: 'ticket', 'data-id': o.id });
        tk.innerHTML = `<div class="tk-head"><span class="tk-e">${d.emoji}</span><span class="tk-n">${d.name[I18N.lang]}</span></div>
          <div class="tk-comps">${d.comps.map(c => { const [ing, st] = c.split(':'); return itemHTML(ing, st); }).join('')}</div>
          <div class="tk-bar"><i></i></div>`;
        return tk;
      }));
    }

    // Counter
    document.querySelectorAll('.counter-slot').forEach((b, i) => {
      const slot = g.counter[i];
      setHTML(b, slot ? itemHTML(slot.item.ing, rushItemState(slot.item, cfg)) : '');
      b.classList.toggle('filled', !!slot);
      b.classList.toggle('from-partner', !!slot && slot.by !== me);
    });

    // Hand
    const hand = g.hands[me];
    const handEl = $('#rush-hand');
    if (handEl) {
      if (hand) {
        const st = rushItemState(hand, cfg);
        setHTML(handEl, `${itemHTML(hand.ing, st)}<span class="hand-text"><small>${t('rush.holding')}</small>${itemLabel(hand.ing, st)}</span>`);
      } else setHTML(handEl, `<span class="hand-text muted">${t('rush.handsEmpty')}</span>`);
      handEl.classList.toggle('full', !!hand);
    }

    if (g.myRole === 'prep') {
      const board = $('.board');
      const bi = g.board.item;
      setHTML(board.querySelector('.content'), bi ? itemHTML(bi.ing, rushItemState(bi, cfg)) : '');
      setText(board.querySelector('.board-text'), !bi ? t('rush.boardEmpty')
        : bi.chopped ? t('rush.chopDone') : t('rush.tapChop', { n: g.board.taps, total: cfg.chopTaps }));
      board.querySelector('.chopbar i').style.width = bi ? (bi.chopped ? 100 : (g.board.taps / cfg.chopTaps) * 100) + '%' : '0%';
      board.classList.toggle('ready-pick', !!(bi && bi.chopped));
      setHTML($('.plate .content'), g.plate.length
        ? g.plate.map(it => itemHTML(it.ing, rushItemState(it, cfg))).join('')
        : `<span class="muted">${t('rush.plateEmpty')}</span>`);
    }
    if (g.myRole === 'cook') document.querySelectorAll('.burner').forEach((b, i) => { if (!g.burners[i].item) { setHTML(b.querySelector('.content'), `<span class="muted">${t('rush.burnerEmpty')}</span>`); rushUI.burnerState[i] = null; } });
  }

  // Per-frame animation: clock, order patience, burner progress.
  function rushFrame() {
    rushUI.raf = 0;
    const g = state && state.game;
    if (!g || g.mode !== 'rush' || g.phase !== 'playing' || !$('#screen-rush').classList.contains('active')) return;
    const clock = rushClock(), cfg = g.config;
    const left = cfg.durationMs - clock;
    $('#rush-clock').textContent = fmtTime(left);
    $('#rush-clock').classList.toggle('hurry', left < 20000);
    $('#rush-timebar').style.width = Math.max(0, (left / cfg.durationMs) * 100) + '%';

    document.querySelectorAll('.ticket').forEach(tk => {
      const o = g.orders.find(x => String(x.id) === tk.dataset.id);
      if (!o) return;
      const p = Math.max(0, (o.expiresAt - clock) / cfg.patienceMs);
      tk.querySelector('.tk-bar i').style.width = p * 100 + '%';
      tk.classList.toggle('urgent', p < 0.3);
    });

    if (g.myRole === 'cook') {
      document.querySelectorAll('.burner').forEach((b, i) => {
        const bn = g.burners[i];
        if (!bn.item) { b.className = 'slot burner'; b.style.removeProperty('--p'); return; }
        const cooked = bn.item.cookedMs + (clock - bn.since);
        const st = rushItemState(bn.item, cfg, clock - bn.since);
        let cls, p;
        if (st === 'burnt' || cooked >= cfg.cookMs + cfg.burnMs) { cls = 'burnt'; p = 1; }
        else if (cooked < cfg.cookMs) { cls = 'cooking'; p = cooked / cfg.cookMs; }
        else { p = (cooked - cfg.cookMs) / cfg.burnMs; cls = p > 0.55 ? 'danger' : 'done'; }
        b.className = 'slot burner ' + cls;
        b.style.setProperty('--p', Math.min(1, p));
        const key = bn.item.id + ':' + (cls === 'burnt' ? 'burnt' : st);
        const prevKey = rushUI.burnerState[i];
        if (key !== prevKey) {
          b.querySelector('.content').innerHTML = itemHTML(bn.item.ing, cls === 'burnt' ? 'burnt' : st);
          if (prevKey && prevKey.split(':')[0] === String(bn.item.id)) {
            if (cls === 'done') { sfx.done(); buzz(20); }
          }
          rushUI.burnerState[i] = key;
        }
        if (cls === 'danger' && !b.dataset.warned) { b.dataset.warned = '1'; sfx.warn(); buzz([20, 30, 20]); }
        if (cls !== 'danger') delete b.dataset.warned;
      });
    }
    rushUI.raf = requestAnimationFrame(rushFrame);
  }

  // Play effects for events we haven't seen. A new game restarts event ids, so reset then.
  function rushEvents(g, quiet) {
    const me = state.room.seat;
    const maxId = g.events.length ? g.events[g.events.length - 1].id : 0;
    const newGame = !prev || !prev.game || prev.game.mode !== 'rush' || maxId < rushUI.lastEvent;
    const evs = newGame ? [] : g.events.filter(e => e.id > rushUI.lastEvent);
    rushUI.lastEvent = maxId;
    if (quiet) return;
    for (const e of evs) {
      if (e.type === 'served') {
        const d = I18N.rushDish(e.dish);
        sfx.ding(); buzz([30, 40, 30]); floatEmoji('💰', 4);
        toast(t('rush.served', { coins: e.coins, dish: d.emoji + ' ' + d.name[I18N.lang] }), 1500);
      } else if (e.type === 'missed') {
        const d = I18N.rushDish(e.dish);
        sfx.err(); buzz(80); toast(t('rush.missed', { dish: d.emoji + ' ' + d.name[I18N.lang] }), 1800);
      } else if (e.type === 'burnt') {
        floatEmoji('💨', 4); buzz(60);
        toast(t('rush.burntEv', { ing: I18N.rushIng(e.ing).emoji + ' ' + I18N.rushIng(e.ing).name[I18N.lang] }), 1500);
      } else if (e.type === 'passed' && e.by !== me) {
        sfx.whoosh(); buzz(25);
      }
    }
  }

  function renderRush(quiet) {
    const g = state.game, room = state.room;
    rushUI.clockBase = g.clock; rushUI.recvAt = performance.now(); rushUI.running = g.phase === 'playing' && g.running;
    const group = g.phase === 'countdown' ? 'ready' : g.phase;
    const key = [group, g.myRole, g.level, g.roles.join(), I18N.lang, maxUnlocked(room), playerName(0), playerName(1)].join('|');
    if (key !== rushUI.key) { rushUI.key = key; buildRush(g); }
    rushEvents(g, quiet);
    // Countdown beeps
    if (g.phase === 'countdown') {
      const n = Math.ceil(g.countdownLeft / 1000);
      const cd = $('#rush-countdown');
      if (cd && cd.dataset.n !== String(n)) { cd.dataset.n = n; cd.textContent = n > 0 ? n : ''; if (n > 0 && !quiet) { tone(660, 0.12, 'triangle', 0.12); buzz(15); } }
    }
    if (g.phase === 'playing' && prev && prev.game && prev.game.mode === 'rush' && prev.game.phase === 'countdown' && !quiet) { tone(990, 0.3, 'triangle', 0.15); buzz(60); }
    updateRush(g);
    if (!rushUI.raf) rushUI.raf = requestAnimationFrame(rushFrame);
  }

  // ───────── Split Kitchen results ─────────
  $('#rr-next').addEventListener('click', () => { sfx.tap(); socket.emit('rush:level', { level: state.game.level + 1 }); });
  $('#rr-retry').addEventListener('click', () => { sfx.tap(); socket.emit('rush:level', { level: state.game.level }); });
  $('#rr-lobby').addEventListener('click', () => { sfx.tap(); socket.emit('room:lobby'); });

  function renderRushResults(quiet) {
    const g = state.game, r = g.result, room = state.room;
    rushUI.key = null;
    $('#rr-level').textContent = `🔥 ${t('rush.level', { n: r.level })}`;
    $('#rr-stars').replaceChildren(...[0, 1, 2].map(i => el('span', { class: i < r.stars ? '' : 'off' }, '⭐')));
    $('#rr-coins').textContent = t('rush.coins', { coins: r.coins });
    $('#rr-goal').textContent = t('rush.goal', { a: r.thresholds[0], b: r.thresholds[1], c: r.thresholds[2] });
    const st = r.stats;
    const lines = [t('rush.servedN', { n: st.served }), t('rush.missedN', { n: st.missed })];
    const burnSeat = st.burnt[0] >= st.burnt[1] ? 0 : 1;
    if (st.burnt[burnSeat] > 0) lines.push(t('rush.funnyBurn', playerName(burnSeat), st.burnt[burnSeat]));
    else lines.push(t('rush.funnyPerfect'));
    if (st.passed[0] !== st.passed[1]) lines.push(t('rush.funnyPass', { name: playerName(st.passed[0] > st.passed[1] ? 0 : 1) }));
    const unlocked = r.unlocked || maxUnlocked(room);
    const levels = g.levelCount || 10;
    if (r.level >= levels && r.stars > 0) lines.push(t('rush.allDone'));
    else if (unlocked <= r.level && r.level < levels) lines.push(t('rush.needStar'));
    if (r.reward) lines.push(t('reward', r.reward));
    $('#rr-stats').replaceChildren(...lines.map(l => el('div', {}, l)));
    const next = $('#rr-next');
    next.hidden = !(r.level < levels && unlocked > r.level);
    next.textContent = t('rush.next', { n: r.level + 1 });

    const justFinished = !(prev && prev.game && prev.game.mode === 'rush' && prev.game.phase === 'results');
    if (justFinished && !quiet) {
      sfx.ding(); buzz([40, 60, 40]);
      if (r.stars >= 2) setTimeout(() => floatEmoji(r.stars === 3 ? '💖' : '✨', 8), 600);
    }
  }

  // ───────── Midnight Snack ─────────
  const STATION_EMOJI = { F: '🧊', S: '🥫', O: '🍳', B: '🔪', T: '🍽️', D: '🚪', G: '🐕' };
  const sneakUI = { key: null, animatedRound: null, animating: false, disp: null, introSeen: {}, timers: [] };
  sfx.creak = () => { tone(140, 0.18, 'sawtooth', 0.05); tone(110, 0.2, 'sawtooth', 0.04, 0.08); };
  sfx.meow = () => { tone(700, 0.12, 'triangle', 0.1); tone(950, 0.18, 'triangle', 0.08, 0.1); tone(600, 0.2, 'triangle', 0.06, 0.25); };
  sfx.bonk = () => tone(90, 0.2, 'square', 0.1);
  sfx.step = () => tone(220, 0.05, 'sine', 0.04);

  const sameXY = (a, b) => a.x === b.x && a.y === b.y;
  const isNext = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const sTile = (g, x, y) => (g.map[y] && x >= 0 && x < g.map[y].length ? g.map[y][x] : '#');
  const sWalk = (g, x, y) => '.~12'.includes(sTile(g, x, y));
  const sStation = ch => 'FSOBT'.includes(ch);
  function sDoor(g) { for (let y = 0; y < g.map.length; y++) { const x = g.map[y].indexOf('D'); if (x >= 0) return { x, y }; } return null; }
  const sItemState = it => (it.chopped && it.cooked ? 'chopped_cooked' : it.cooked ? 'cooked' : it.chopped ? 'chopped' : 'raw');
  function sItemHTML(ing, st) {
    const info = I18N.sneakIng(ing);
    const pic = window.Icons ? Icons.icon('sneak', ing, info.emoji) : info.emoji;
    return `<span class="itm st-${st}"><span class="e">${pic}</span>${BADGE[st] ? `<span class="b">${BADGE[st]}</span>` : ''}</span>`;
  }

  // Where my chef ends up after the planned moves, and the noise the plan will make.
  function planEnd(g, seat, steps) {
    let pos = { x: g.players[seat].x, y: g.players[seat].y };
    for (const st of steps) if (st.t === 'move') pos = { x: st.x, y: st.y };
    return pos;
  }
  function planNoise(g, steps, otherSteps = []) {
    const N = g.noiseRules, door = sDoor(g);
    let n = 0;
    steps.forEach((st, k) => {
      if (st.t === 'move') {
        n += sTile(g, st.x, st.y) === '~' ? N.creak : N.walk;
        if (door && Math.abs(door.x - st.x) + Math.abs(door.y - st.y) <= 2) n += N.nearDoor;
        if (N.dog && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sTile(g, st.x + dx, st.y + dy) === 'G')) n += N.dog;
      } else if (st.t === 'use') {
        const ch = sTile(g, st.x, st.y);
        const o = otherSteps[k];
        if (ch === 'F') n += o && o.t === 'use' && o.x === st.x && o.y === st.y ? N.fridgeHeld / 2 : N.fridge;
        else n += { S: N.shelf, O: N.stove, B: N.board, T: 0 }[ch] || 0;
      }
    });
    return Math.round(n);
  }

  $('#sneak-back').addEventListener('click', () => { if (confirm(t('relay.leaveConfirm'))) socket.emit('room:lobby'); });

  function sneakSend(action) {
    socket.emit('sneak:act', action, res => { if (res && res.error) { toast(errText(res.error), 1500); sfx.err(); } });
  }
  function setMyPlan(steps) {
    const g = state.game;
    g.plans[g.me] = steps; g.locked[g.me] = false;     // optimistic; the server confirms
    sneakSend({ type: 'plan', steps });
    renderSneakDynamic(g);
  }

  $('#sneak-undo').addEventListener('click', () => { const g = state.game; if (sneakUI.animating || !g.plans[g.me].length) return; sfx.tap(); setMyPlan(g.plans[g.me].slice(0, -1)); });
  $('#sneak-wait').addEventListener('click', () => {
    const g = state.game; if (sneakUI.animating) return;
    if (g.plans[g.me].length >= g.stepsPerRound) { toast(t('sneak.full'), 1400); return; }
    sfx.tap(); setMyPlan([...g.plans[g.me], { t: 'wait' }]);
  });
  $('#sneak-lock').addEventListener('click', () => { if (sneakUI.animating) return; sfx.tap(); buzz(15); sneakSend({ type: 'lock' }); });

  $('#sneak-board').addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const tile = e.target.closest('.tile');
    const g = state && state.game;
    if (!tile || !g || g.mode !== 'sneak' || g.phase !== 'planning' || sneakUI.animating) return;
    const x = +tile.dataset.x, y = +tile.dataset.y;
    const steps = g.plans[g.me];
    if (steps.length >= g.stepsPerRound) { toast(t('sneak.full'), 1400); shake(tile); return; }
    const end = planEnd(g, g.me, steps);
    if (sameXY(end, { x, y })) { sfx.tap(); setMyPlan([...steps, { t: 'wait' }]); return; }
    if (!isNext(end, { x, y })) { toast(t('sneak.notNext'), 1400); shake(tile); sfx.err(); return; }
    const ch = sTile(g, x, y);
    if (sWalk(g, x, y)) { sfx.step(); buzz(6); setMyPlan([...steps, { t: 'move', x, y }]); }
    else if (sStation(ch)) { sfx.tap(); buzz(6); setMyPlan([...steps, { t: 'use', x, y }]); }
    else { shake(tile); sfx.err(); }
  });

  function buildSneak(g) {
    const H = g.map.length, W = g.map[0].length;
    const board = $('#sneak-board');
    board.style.setProperty('--w', W); board.style.setProperty('--h', H);
    board.replaceChildren();
    g.map.forEach((row, y) => [...row].forEach((ch, x) => {
      const cls = ch === '#' ? 'wall' : ch === '~' ? 'floor creak' : '.12'.includes(ch) ? 'floor' : ch === 'G' ? 'dog' : 'station st-' + ch;
      const tile = el('div', { class: 'tile ' + cls, 'data-x': x, 'data-y': y });
      if (STATION_EMOJI[ch]) tile.append(iconEl('span', { class: 'st-e' }, window.Icons ? Icons.icon('station', ch, STATION_EMOJI[ch]) : STATION_EMOJI[ch]));
      if (ch === 'D') tile.append(el('span', { class: 'door-face', id: 'door-face' }, '😴'));
      tile.style.gridColumn = x + 1; tile.style.gridRow = y + 1;
      board.append(tile);
    }));
    const place = (node, x, y) => { node.style.left = (x / W * 100) + '%'; node.style.top = (y / H * 100) + '%'; };
    board.append(el('div', { class: 'markers', id: 'sneak-markers' }));
    const cat = iconEl('div', { class: 'sprite cat', id: 'sneak-cat' }, (window.Icons && Icons.svg('cat')) || '🐈');
    board.append(cat);
    [0, 1].forEach(seat => {
      const c = el('div', { class: `sprite chef p${seat}`, id: 'sneak-chef-' + seat });
      c.innerHTML = chefSVG(seat, 'happy') + '<span class="chef-hand"></span>';
      board.append(c);
    });
    sneakUI.place = place;
  }

  function renderSneakDynamic(g) {
    const disp = sneakUI.animating && sneakUI.disp ? sneakUI.disp : { players: g.players, cat: g.cat, noise: g.noise, table: g.table };
    const me = g.me, place = sneakUI.place;
    const planning = g.phase === 'planning' && !sneakUI.animating;

    $('#sneak-night').textContent = `${t('sneak.night', { n: g.level })} · ${'💤'.repeat(3 - g.tier)}`;
    $('#sneak-round').textContent = t('sneak.round', { r: Math.min(g.round, g.maxRounds), max: g.maxRounds });

    // Chefs, cat, light
    disp.players.forEach((p, seat) => {
      const c = $('#sneak-chef-' + seat);
      place(c, p.x, p.y);
      c.classList.toggle('me', seat === me);
      c.querySelector('.chef-hand').innerHTML = p.hand ? sItemHTML(p.hand.ing, sItemState(p.hand)) : '';
    });
    place($('#sneak-cat'), disp.cat.x, disp.cat.y);
    document.querySelectorAll('#sneak-board .tile').forEach(tile => {
      const x = +tile.dataset.x, y = +tile.dataset.y;
      const d = Math.min(...disp.players.map(p => Math.abs(p.x - x) + Math.abs(p.y - y)));
      tile.classList.toggle('lit', d <= 1);
      tile.classList.toggle('glow', d === 2);
    });

    // Plan markers (mine solid, partner's faded) and the cat's next paw prints
    const markers = $('#sneak-markers');
    markers.replaceChildren();
    if (planning) {
      [1 - me, me].forEach(seat => {
        g.plans[seat].forEach((st, k) => {
          if (st.t === 'wait') return;
          const m = el('div', { class: `marker p${seat} ${st.t}${seat === me ? ' mine' : ''}` }, st.t === 'use' ? '✋' : String(k + 1));
          place(m, st.x, st.y);
          markers.append(m);
        });
      });
      if (g.catPath.length > 1) {
        for (let k = 1; k <= g.stepsPerRound; k++) {
          const [x, y] = g.catPath[(g.catIndex + k) % g.catPath.length];
          if (x === g.cat.x && y === g.cat.y) continue;
          const paw = el('div', { class: 'marker paw' }, '🐾');
          place(paw, x, y);
          markers.append(paw);
        }
      }
    }

    // Noise meter
    const ratio = disp.noise / g.maxNoise;
    $('#noise-fill').style.width = Math.min(100, ratio * 100) + '%';
    $('#noise-fill').className = ratio >= 0.75 ? 'hot' : ratio >= 0.45 ? 'warm' : '';
    const preview = planning ? planNoise(g, g.plans[me], g.plans[1 - me]) : 0;
    const pv = $('#noise-preview');
    pv.style.left = Math.min(100, ratio * 100) + '%';
    pv.style.width = Math.min(100 - ratio * 100, (preview / g.maxNoise) * 100) + '%';
    $('#noise-num').textContent = preview ? `${disp.noise}/${g.maxNoise} · ${t('sneak.planPreview', { n: preview })}` : `${disp.noise}/${g.maxNoise}`;
    const face = g.phase === 'lost' && g.result && g.result.reason === 'woke' && !sneakUI.animating ? '😡' : ratio >= 0.75 ? '😳' : ratio >= 0.45 ? '😪' : '😴';
    $('#noise-face').textContent = face;
    const df = $('#door-face'); if (df) df.textContent = face;

    // Recipe + what each chef holds
    $('#sneak-recipe').innerHTML = `<span class="snack">${g.snack.emoji}</span>` +
      g.recipe.map(c => { const [ing, st] = c.split(':'); return `<span class="comp${disp.table.includes(c) ? ' done' : ''}">${sItemHTML(ing, st)}</span>`; }).join('');

    // Plan slots
    const mine = g.plans[me];
    const start = { x: g.players[me].x, y: g.players[me].y };
    let pos = start;
    $('#sneak-plan').replaceChildren(...Array.from({ length: g.stepsPerRound }, (_, k) => {
      const st = mine[k];
      let label = '';
      if (st && st.t === 'wait') label = '⏳';
      else if (st && st.t === 'use') label = STATION_EMOJI[sTile(g, st.x, st.y)] || '✋';
      else if (st && st.t === 'move') { label = st.x > pos.x ? '➡️' : st.x < pos.x ? '⬅️' : st.y > pos.y ? '⬇️' : '⬆️'; pos = st; }
      return el('div', { class: 'plan-slot' + (st ? ' filled' : '') }, label || String(k + 1));
    }));

    const partner = playerName(1 - me);
    $('#sneak-undo').textContent = t('sneak.undo');
    $('#sneak-wait').textContent = t('sneak.wait');
    const lockBtn = $('#sneak-lock');
    lockBtn.textContent = g.locked[me] ? t('sneak.unlock') : t('sneak.lock');
    lockBtn.classList.toggle('is-ready', g.locked[me]);
    ['#sneak-undo', '#sneak-wait', '#sneak-lock'].forEach(sel => ($(sel).disabled = !planning));
    $('#sneak-undo').disabled = !planning || !mine.length || g.locked[me];
    $('#sneak-status').textContent = sneakUI.animating ? t('sneak.watching')
      : !planning ? ''
      : g.locked[1 - me] ? t('sneak.partnerLocked', { name: partner })
      : mine.length === 0 ? t('sneak.tapHint')
      : t('sneak.partnerPlanning', { name: partner, n: g.plans[1 - me].length });
  }

  function sneakPop(g, x, y, text, cls = '') {
    const pop = el('div', { class: 'sneak-pop ' + cls }, text);
    sneakUI.place(pop, x, y);
    $('#sneak-board').append(pop);
    setTimeout(() => pop.remove(), 1300);
  }

  function animateRound(g) {
    const lr = g.lastRound;
    sneakUI.animating = true;
    sneakUI.timers.forEach(clearTimeout); sneakUI.timers = [];
    lr.steps.forEach((st, i) => {
      sneakUI.timers.push(setTimeout(() => {
        sneakUI.disp = st;
        renderSneakDynamic(g);
        let quietStep = true;
        for (const e of st.events) {
          const who = e.who != null ? st.players[e.who] : null;
          const at = who || st.players[0];
          const item = e.ing ? I18N.sneakIng(e.ing).emoji : '';
          const txt = { creak: t('sneak.ev.creak'), meow: t('sneak.ev.meow'), bonk: t('sneak.ev.bonk'), hold: t('sneak.ev.hold'), growl: t('sneak.ev.growl'),
            grab: '+' + item, cook: '🔥 ' + item, chop: '🔪 ' + item, place: '✅ ' + item, putBack: '↩ ' + item,
            wrongPlace: t('sneak.ev.wrongPlace'), handsFull: t('sneak.ev.handsFull'), miss: t('sneak.ev.miss'), nothing: t('sneak.ev.nothing') }[e.type];
          if (txt) sneakPop(g, at.x, at.y, txt, e.type);
          if (e.type === 'creak') { sfx.creak(); buzz(40); quietStep = false; }
          else if (e.type === 'growl') { tone(85, 0.35, 'sawtooth', 0.06); buzz(60); quietStep = false; }
          else if (e.type === 'meow') { sfx.meow(); buzz([40, 40, 40]); quietStep = false; }
          else if (e.type === 'bonk') { sfx.bonk(); buzz(80); quietStep = false; }
          else if (e.type === 'place') { sfx.done(); buzz(20); }
          else if (e.type === 'grab' || e.type === 'cook' || e.type === 'chop') sfx.tap();
          else if (e.type === 'woke') { sfx.err(); buzz([100, 50, 200]); document.body.classList.add('lights-on'); setTimeout(() => document.body.classList.remove('lights-on'), 1800); }
          else if (e.type === 'won') { sfx.ding(); floatEmoji('🌙', 6); }
        }
        if (quietStep) sfx.step();
      }, i * 750));
    });
    sneakUI.timers.push(setTimeout(() => {
      sneakUI.animating = false; sneakUI.disp = null;
      render(true);
      const g2 = state.game;
      if (g2 && g2.mode === 'sneak' && g2.phase === 'planning') { sfx.yourTurn(); buzz(20); }
    }, lr.steps.length * 750 + (g.phase === 'planning' ? 250 : 1400)));
  }

  function showSneakIntro(g) {
    const box = $('#sneak-intro');
    if (sneakUI.introSeen[g.level] || g.round > 1 || g.phase !== 'planning') { box.hidden = true; return; }
    box.hidden = false;
    box.replaceChildren(el('div', { class: 'intro-card' },
      el('div', { class: 'intro-snack' }, g.snack.emoji),
      el('h2', {}, t('sneak.introTitle', { n: g.level, snack: g.snack.name[I18N.lang] })),
      el('p', { class: 'intro-tier' }, `${'💤'.repeat(3 - g.tier)} ${t('sneak.tiers')[g.tier]}`),
      el('div', { class: 'intro-recipe' }),
      el('ul', {}, t('sneak.rules').map(r => el('li', {}, r))),
      el('p', { class: 'intro-legend' }, t('sneak.legend')),
      tapBtn('btn btn-primary', () => { sneakUI.introSeen[g.level] = true; box.hidden = true; sfx.tap(); }, t('sneak.start'))));
    box.querySelector('.intro-recipe').innerHTML = g.recipe.map(c => { const [ing, st] = c.split(':'); return `<span class="comp">${sItemHTML(ing, st)}</span>`; }).join(' + ');
  }

  function renderSneak(quiet) {
    const g = state.game;
    const key = ['sneak', g.level, I18N.lang, g.map.join('')].join('|');
    const newGame = !prev || !prev.game || prev.game.mode !== 'sneak' || prev.game.level !== g.level || (prev.game.round > g.round) || (!g.lastRound && prev.game.lastRound);
    if (key !== sneakUI.key || newGame) {
      if (key !== sneakUI.key) { sneakUI.key = key; buildSneak(g); }
      if (newGame) { sneakUI.animatedRound = g.lastRound ? g.lastRound.round : null; sneakUI.timers.forEach(clearTimeout); sneakUI.animating = false; }
    }
    if (g.lastRound && g.lastRound.round !== sneakUI.animatedRound) {
      sneakUI.animatedRound = g.lastRound.round;
      if (!quiet) { animateRound(g); return; }
    }
    if (g.phase !== 'planning' && !sneakUI.animating) { show('sneak-results', 'sneak'); renderSneakResults(); return; }
    renderSneakDynamic(g);
    showSneakIntro(g);
  }

  // ───────── Midnight Snack results ─────────
  $('#sr-next').addEventListener('click', () => { sfx.tap(); socket.emit('sneak:level', { level: state.game.level + 1 }); });
  $('#sr-retry').addEventListener('click', () => { sfx.tap(); socket.emit('sneak:level', { level: state.game.level }); });
  $('#sr-lobby').addEventListener('click', () => { sfx.tap(); socket.emit('room:lobby'); });

  function renderSneakResults() {
    const g = state.game, r = g.result, room = state.room;
    $('#sr-title').textContent = r.won ? t('sneak.resultTitleWon') : t('sneak.resultTitleLost');
    $('#sr-snack').textContent = r.won ? g.snack.emoji : r.reason === 'woke' ? '💡' : '☀️';
    $('#sr-stars').replaceChildren(...[0, 1, 2].map(i => el('span', { class: i < r.stars ? '' : 'off' }, '⭐')));
    $('#sr-headline').textContent = r.won ? t('sneak.won') : r.reason === 'woke' ? t('sneak.woke') : t('sneak.sunrise');
    $('#sr-rounds').textContent = t('sneak.roundsUsed', { r: r.rounds, par: r.par });
    const st = r.stats, lines = [];
    [0, 1].forEach(s => { if (st.creaks[s]) lines.push(t('sneak.statCreaks', playerName(s), st.creaks[s])); });
    [0, 1].forEach(s => { if (st.meows[s]) lines.push(t('sneak.statMeows', playerName(s), st.meows[s])); });
    if (st.bonks) lines.push(t('sneak.statBonks', st.bonks));
    if (st.growls) lines.push(t('sneak.statGrowls', st.growls));
    if (st.held) lines.push(t('sneak.statHeld', st.held));
    if (!lines.length) lines.push(t('sneak.statQuiet'));
    const unlocked = r.unlocked || 1;
    if (r.won && r.last) lines.push(t('sneak.allDone'));
    else if (!r.won && unlocked <= r.level && r.level < g.levelCount) lines.push(t('sneak.needStar'));
    if (r.reward) lines.push(t('reward', r.reward));
    $('#sr-stats').replaceChildren(...lines.map(l => el('div', {}, l)));
    const next = $('#sr-next');
    next.hidden = !(r.level < g.levelCount && unlocked > r.level);
    next.textContent = t('sneak.next', { n: r.level + 1 });
  }

  // ───────── Shop & wallets ─────────
  let shopOpen = false;
  let shopTab = 'kitchen';
  const itemName = (id) => { const it = catalog && catalog.shop[id]; return it ? `${it.emoji} ${it.name[I18N.lang]}` : id; };

  function renderWallets(box, big = false) {
    box.replaceChildren(el('span', { class: 'wallet shared' }, t('wallet.shared', { n: state.room.shop.wallet })));
    box.classList.toggle('big', big);
  }

  $('#shop-btn').addEventListener('click', () => { sfx.tap(); shopOpen = true; render(true); });
  $('#shop-back').addEventListener('click', () => { sfx.tap(); shopOpen = false; render(true); });
  document.querySelectorAll('.shop-tab').forEach(b => b.addEventListener('click', () => { sfx.tap(); shopTab = b.dataset.tab; renderShop(); }));

  function shopAction(type, id) {
    socket.emit(type, { id }, res => {
      if (res && res.error) { sfx.err(); toast(errText(res.error), 1600); return; }
      if (type === 'shop:buy') { sfx.ding(); buzz([20, 30, 20]); floatEmoji(catalog.shop[id].emoji, 5); toast(t('shop.boughtMe', { item: itemName(id) }), 1600); }
      else sfx.tap();
    });
  }
  socket.on('shop:bought', ({ seat, id }) => { sfx.ding(); toast(t('shop.bought', { name: playerName(seat), item: itemName(id) }), 2200); });

  function shopCard(id, it, { state: st, onTap }) {
    const card = el('div', { class: 'shop-item' + (st === 'using' ? ' using' : '') },
      el('div', { class: 'si-e' }, it.emoji),
      el('div', { class: 'si-text' }, el('div', { class: 'si-name' }, it.name[I18N.lang]), it.desc[I18N.lang] ? el('div', { class: 'si-desc' }, it.desc[I18N.lang]) : null));
    const label = st === 'buy' ? `💰 ${it.price}`
      : st === 'owned' ? t('shop.owned') : st === 'use' ? t('shop.use') : t('shop.using');
    const btn = el('button', { class: 'btn btn-small si-btn ' + st, disabled: st === 'owned' || st === 'using' }, label);
    btn.addEventListener('click', onTap);
    card.append(btn);
    return card;
  }

  function renderShop() {
    if (!catalog || !state) return;
    const room = state.room, me = room.players[room.seat];
    renderWallets($('#shop-wallets'), true);
    document.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === shopTab));
    const body = $('#shop-body');
    body.replaceChildren();
    const items = Object.entries(catalog.shop);
    const section = (title, list) => { if (list.length) body.append(el('h3', { class: 'shop-sec' }, title), ...list); };

    if (shopTab === 'kitchen') {
      body.append(el('p', { class: 'shop-note' }, t('shop.sharedNote')));
      for (const mode of ['rush', 'sneak', 'relay']) {
        section(t('shop.sec.' + mode), items.filter(([, it]) => it.kind === 'kitchen' && it.mode === mode).map(([id, it]) =>
          shopCard(id, it, { state: room.shop.upgrades.includes(id) ? 'owned' : 'buy', onTap: () => shopAction('shop:buy', id) })));
      }
      const decor = items.filter(([, it]) => it.kind === 'decor').map(([id, it]) => {
        const owned = room.shop.decorOwned.includes(id);
        return shopCard(id, it, { state: room.shop.decor === id ? 'using' : owned ? 'use' : 'buy', onTap: () => shopAction(owned ? 'shop:equip' : 'shop:buy', id) });
      });
      decor.unshift(shopCard('decor_none', { emoji: '🏠', name: { en: t('shop.noDecor'), vi: t('shop.noDecor') }, desc: { en: '', vi: '' } },
        { state: room.shop.decor ? 'use' : 'using', onTap: () => shopAction('shop:equip', 'decor_none') }));
      section(t('shop.sec.decor'), decor);
    } else {
      body.append(el('p', { class: 'shop-note' }, t('shop.mineNote')));
      const preview = el('div', { class: 'shop-preview' });
      preview.innerHTML = chefSVG(room.seat, 'happy');
      body.append(preview);
      for (const slot of ['color', 'hat', 'glasses']) {
        section(t('shop.sec.' + slot), items.filter(([, it]) => it.kind === 'look' && it.slot === slot).map(([id, it]) => {
          const owned = it.free || (me && me.owned.includes(id));
          const using = me && me.look[slot] === id;
          return shopCard(id, it, { state: using ? 'using' : owned ? 'use' : 'buy', onTap: () => shopAction(owned ? 'shop:equip' : 'shop:buy', id) });
        }));
      }
    }
  }

  // ───────── How to play (first time per mode, on this phone) ─────────
  function showHowto(mode, force = false) {
    const key = 'seen:' + mode;
    if (!force && store.get(key, false)) return;
    const box = $('#howto');
    const steps = t(`howto.${mode}.steps`);
    const card = el('div', { class: 'intro-card howto-card' },
      el('h2', {}, t(`howto.${mode}.title`)),
      el('ol', {}, steps.map(st => el('li', {}, st))));
    if (mode === 'relay') {
      card.append(el('p', { class: 'howto-q' }, t('howto.relay.where')));
      const choice = el('div', { class: 'howto-choice' }, ['hide', 'show'].map(m => {
        const b = tapBtn('choice' + (cardMode === m ? ' on' : ''), () => {
          cardMode = m; store.set('cardMode', m); sfx.tap();
          choice.querySelectorAll('.choice').forEach(c => c.classList.toggle('on', c === b));
          if (state && state.game && state.game.mode === 'relay') renderSecret();
        },
          el('b', {}, t(m === 'hide' ? 'howto.relay.together' : 'howto.relay.apart')),
          el('small', {}, t(m === 'hide' ? 'howto.relay.togetherDesc' : 'howto.relay.apartDesc')));
        return b;
      }));
      card.append(choice);
    }
    card.append(tapBtn('btn btn-primary', () => { store.set(key, true); box.hidden = true; sfx.tap(); }, t('howto.gotIt')));
    box.replaceChildren(card);
    box.hidden = false;
  }
  document.querySelectorAll('.help-btn').forEach(b => b.addEventListener('click', () => { sfx.tap(); showHowto(b.dataset.mode, true); }));

  // ───────── Main render ─────────
  function render(quiet = false) {
    if (!state) return show('home');
    const { room, game } = state;

    const partner = room.players[1 - room.seat];
    const prevPartner = prev && prev.room.players[1 - prev.room.seat];
    if (!quiet && partner && !prevPartner && prev) { sfx.join(); buzz(30); toast(t('joined', { name: partner.name })); }
    banner(!socket.connected ? t('reconnecting')
      : partner && !partner.connected && room.screen === 'game' ? t('partnerAway', { name: partner.name }) : '');

    document.body.dataset.decor = (room.shop && room.shop.decor) || '';
    keepAwake(!!game);
    if (!game && shopOpen) { show('shop'); renderShop(); return; }
    if (!game) { show('lobby'); renderLobby(); return; }
    shopOpen = false;
    if (!catalog) return;  // wait for ingredient data
    if (game.mode === 'sneak') {
      // Let the last round finish playing out before showing the results.
      if (game.phase !== 'planning' && !sneakUI.animating && !(game.lastRound && game.lastRound.round !== sneakUI.animatedRound && !quiet)) {
        show('sneak-results', 'sneak'); renderSneakResults(); return;
      }
      show('sneak', 'sneak'); renderSneak(quiet);
      return;
    }
    if (game.mode === 'rush') {
      if (game.phase === 'results') { show('rush-results', 'rush'); renderRushResults(quiet); }
      else { show('rush', 'rush'); renderRush(quiet); if (game.phase === 'ready') showHowto('rush'); }
      return;
    }
    if (game.mode === 'relay') {
      if (game.phase === 'results') { show('results', 'relay'); renderResults(quiet); }
      else {
        if (!prev || !prev.game || prev.game.round !== game.round) cardHidden = true;
        show('relay', 'relay');
        renderRelay(quiet);
        renderGuess(quiet);
        if (game.phase === 'playing') showHowto('relay');
      }
    }
  }

  show('home');
})();
