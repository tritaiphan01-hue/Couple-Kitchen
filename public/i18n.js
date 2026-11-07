/* Couple's Kitchen — English & Vietnamese text.
   Strings use {name} placeholders. Functions are used where word order differs. */
(() => {
  'use strict';

  const STRINGS = {
    en: {
      'home.title': "Couple's<br>Kitchen",
      'home.tagline': 'Cook together, from anywhere 💕',
      'home.nameLabel': 'Your chef name',
      'home.namePh': 'e.g. Tri',
      'home.create': '🍳 Open a new kitchen',
      'home.or': 'or join your partner',
      'home.codePh': 'CODE',
      'home.join': 'Join',

      'lobby.title': 'The Kitchen',
      'lobby.codeLabel': 'Kitchen code',
      'lobby.share': '📤 Send to partner',
      'lobby.shareText': 'Come cook with me 🍳 Kitchen code: {code}',
      'lobby.copied': 'Invite link copied 📋',
      'lobby.you': '(you)',
      'lobby.waiting': 'Waiting…',
      'lobby.inKitchen': 'in the kitchen',
      'lobby.steppedOut': 'stepped out',
      'lobby.notHere': 'not here yet',
      'lobby.hintAlone': 'Send your partner the code to start cooking 💌',
      'lobby.hintAway': '{name} stepped out. You can still start a dish.',
      'lobby.hintReady': 'Both chefs ready! Pick a mode 👇',
      'lobby.packTitle': 'Pantry',
      'lobby.pack.western': '🍝 Western',
      'lobby.pack.vietnam': '🇻🇳 Vietnamese',
      'lobby.modeTitle': "Pick tonight's mode",
      'lobby.leaveConfirm': 'Leave this kitchen? Your partner will need a new code.',
      'lobby.recapTonight': 'Tonight:',
      'lobby.recapDishes': n => `${n} dish${n > 1 ? 'es' : ''}`,
      'lobby.recapBest': 'Best:',
      'soon': 'soon',

      'mode.relay.name': 'Recipe Relay',
      'mode.relay.desc': 'Chill · secret recipe cards, take turns adding to the pot',
      'mode.rush.name': 'Split Kitchen',
      'mode.rush.desc': 'Rush · real-time, each of you runs half the kitchen',
      'mode.sneak.name': 'Midnight Snack',
      'mode.sneak.desc': "Sneak · plan quiet moves, don't wake the roommate",

      'relay.title': 'Mystery {dish} #{round}',
      'relay.yourTurn': (heart, n) => `Your turn ${heart} · ${n} step${n > 1 ? 's' : ''} left`,
      'relay.theirTurn': '{name} is thinking… 🤔',
      'relay.empty': 'The pot is empty. Let’s cook!',
      'relay.youAdded': 'You added {thing}',
      'relay.theyAdded': '{name} added {thing}',
      'relay.youDid': 'You {action}',
      'relay.theyDid': '{name} {action}',
      'relay.secret': '🔒 Your secret card',
      'relay.peek': 'tap to peek 👀',
      'relay.hide': 'tap to hide',
      'relay.pick': 'Pick one',
      'relay.add': 'Add {emoji}',
      'relay.doIt': '{action} it',
      'relay.wait': 'Wait…',
      'relay.leaveConfirm': 'Leave this dish and go back to the kitchen? It ends the round for both of you.',

      'results.title': 'Taste test!',
      'results.score': '{met}/{total} clues matched · {verdict}',
      'results.verdicts': ['Hmm… the cat ate it 🐈', 'Edible! Kinda 😅', 'So tasty! 😋', 'Chef’s kiss! 👩‍🍳💋'],
      'results.yourCard': 'Your card',
      'results.theirCard': '{name}’s card',
      'results.secret': 'The secret recipe was: {items} (any dish that matches every clue gets 3 stars)',
      'results.again': '🍲 Cook another',
      'results.lobby': 'Back to kitchen',

      'joined': '{name} joined the kitchen! 💕',
      'reconnecting': '🔌 Reconnecting…',
      'partnerAway': '💤 {name} stepped out… they can come back anytime',
      'codeLength': 'Kitchen codes have 4 letters.',

      // Server error codes
      'err.no_room': 'No kitchen found with that code.',
      'err.room_full': 'That kitchen already has two chefs.',
      'err.mode_soon': 'That mode is still cooking. Coming soon!',
      'err.need_partner': 'Wait for your partner to join first.',
      'err.no_game': 'No dish is cooking right now.',
      'err.round_over': 'This round is over.',
      'err.not_your_turn': "It's not your turn.",
      'err.invalid_move': 'That move doesn’t work.',
      'err.unknown_ingredient': 'That ingredient isn’t in this pantry.',
      'err.already_in_pot': "That's already in the pot.",
      'err.unknown_action': 'Unknown action.',
      'err.opened_elsewhere': 'You opened the game somewhere else.',
      'err.missing_id': 'Something went wrong. Please refresh.',
    },

    vi: {
      'home.title': 'Bếp<br>Đôi Mình',
      'home.tagline': 'Cùng nấu ăn, dù ở đâu 💕',
      'home.nameLabel': 'Tên đầu bếp của bạn',
      'home.namePh': 'VD: Trí',
      'home.create': '🍳 Mở bếp mới',
      'home.or': 'hoặc vào bếp của người ấy',
      'home.codePh': 'MÃ',
      'home.join': 'Vào',

      'lobby.title': 'Căn Bếp',
      'lobby.codeLabel': 'Mã bếp',
      'lobby.share': '📤 Gửi cho người ấy',
      'lobby.shareText': 'Vào bếp nấu ăn với mình nha 🍳 Mã bếp: {code}',
      'lobby.copied': 'Đã sao chép link mời 📋',
      'lobby.you': '(bạn)',
      'lobby.waiting': 'Đang chờ…',
      'lobby.inKitchen': 'đang trong bếp',
      'lobby.steppedOut': 'vừa ra ngoài',
      'lobby.notHere': 'chưa vào',
      'lobby.hintAlone': 'Gửi mã cho người ấy để bắt đầu nấu nhé 💌',
      'lobby.hintAway': '{name} vừa ra ngoài. Bạn vẫn có thể bắt đầu món mới.',
      'lobby.hintReady': 'Hai đầu bếp đã sẵn sàng! Chọn chế độ nào 👇',
      'lobby.packTitle': 'Tủ bếp',
      'lobby.pack.western': '🍝 Món Tây',
      'lobby.pack.vietnam': '🇻🇳 Món Việt',
      'lobby.modeTitle': 'Tối nay chơi gì nè',
      'lobby.leaveConfirm': 'Rời bếp này? Người ấy sẽ cần mã mới đó.',
      'lobby.recapTonight': 'Tối nay:',
      'lobby.recapDishes': n => `${n} món`,
      'lobby.recapBest': 'Ngon nhất:',
      'soon': 'sắp có',

      'mode.relay.name': 'Tiếp Sức Công Thức',
      'mode.relay.desc': 'Thư giãn · thẻ công thức bí mật, thay phiên bỏ vào nồi',
      'mode.rush.name': 'Bếp Chia Đôi',
      'mode.rush.desc': 'Gấp rút · thời gian thực, mỗi người lo một nửa căn bếp',
      'mode.sneak.name': 'Ăn Vụng Nửa Đêm',
      'mode.sneak.desc': 'Rón rén · lên kế hoạch thật khẽ, đừng đánh thức bạn cùng phòng',

      'relay.title': '{dish} bí ẩn #{round}',
      'relay.yourTurn': (heart, n) => `Tới lượt bạn ${heart} · còn ${n} bước`,
      'relay.theirTurn': '{name} đang suy nghĩ… 🤔',
      'relay.empty': 'Nồi còn trống trơn. Nấu thôi!',
      'relay.youAdded': 'Bạn đã bỏ {thing}',
      'relay.theyAdded': '{name} đã bỏ {thing}',
      'relay.youDid': 'Bạn đã {action}',
      'relay.theyDid': '{name} đã {action}',
      'relay.secret': '🔒 Thẻ bí mật của bạn',
      'relay.peek': 'chạm để xem 👀',
      'relay.hide': 'chạm để che',
      'relay.pick': 'Chọn một món',
      'relay.add': 'Bỏ {emoji}',
      'relay.doIt': '{action}',
      'relay.wait': 'Chờ chút…',
      'relay.leaveConfirm': 'Bỏ món này và quay về bếp? Ván này sẽ kết thúc cho cả hai.',

      'results.title': 'Nếm thử nào!',
      'results.score': 'Đúng {met}/{total} gợi ý · {verdict}',
      'results.verdicts': ['Ơ… con mèo ăn mất rồi 🐈', 'Ăn được! Chắc vậy 😅', 'Ngon quá trời! 😋', 'Đỉnh của chóp! 👩‍🍳💋'],
      'results.yourCard': 'Thẻ của bạn',
      'results.theirCard': 'Thẻ của {name}',
      'results.secret': 'Công thức bí mật là: {items} (món nào khớp mọi gợi ý đều được 3 sao)',
      'results.again': '🍲 Nấu món nữa',
      'results.lobby': 'Về lại bếp',

      'joined': '{name} đã vào bếp! 💕',
      'reconnecting': '🔌 Đang kết nối lại…',
      'partnerAway': '💤 {name} vừa ra ngoài… quay lại lúc nào cũng được',
      'codeLength': 'Mã bếp gồm 4 chữ cái nha.',

      'err.no_room': 'Không tìm thấy bếp với mã này.',
      'err.room_full': 'Bếp này đã đủ hai đầu bếp rồi.',
      'err.mode_soon': 'Chế độ này đang được nấu. Sắp có nha!',
      'err.need_partner': 'Chờ người ấy vào bếp trước đã.',
      'err.no_game': 'Hiện chưa có món nào đang nấu.',
      'err.round_over': 'Ván này đã kết thúc.',
      'err.not_your_turn': 'Chưa tới lượt bạn.',
      'err.invalid_move': 'Bước này không hợp lệ.',
      'err.unknown_ingredient': 'Tủ bếp này không có nguyên liệu đó.',
      'err.already_in_pot': 'Món này có trong nồi rồi.',
      'err.unknown_action': 'Thao tác không hợp lệ.',
      'err.opened_elsewhere': 'Bạn đã mở trò chơi ở nơi khác.',
      'err.missing_id': 'Có lỗi xảy ra. Vui lòng tải lại trang.',
    },
  };

  // Tag words for clues. g = group: cat(egory), color, flavor.
  const TAGS = {
    veg:     { g: 'cat',    en: ['a veggie', 'veggies'],       vi: 'rau củ' },
    fruit:   { g: 'cat',    en: ['a fruit', 'fruit'],          vi: 'trái cây' },
    dairy:   { g: 'cat',    en: ['dairy', 'dairy'],            vi: 'đồ sữa' },
    protein: { g: 'cat',    en: ['protein', 'protein'],        vi: 'món đạm' },
    meat:    { g: 'cat',    en: ['meat', 'meat'],              vi: 'thịt' },
    seafood: { g: 'cat',    en: ['seafood', 'seafood'],        vi: 'hải sản' },
    grain:   { g: 'cat',    en: ['a grain', 'grains'],         vi: 'cơm, bún hoặc mì' },
    herb:    { g: 'cat',    en: ['herbs', 'herbs'],            vi: 'rau thơm' },
    orange:  { g: 'color',  en: 'orange', vi: 'cam' },
    white:   { g: 'color',  en: 'white',  vi: 'trắng' },
    red:     { g: 'color',  en: 'red',    vi: 'đỏ' },
    brown:   { g: 'color',  en: 'brown',  vi: 'nâu' },
    yellow:  { g: 'color',  en: 'yellow', vi: 'vàng' },
    green:   { g: 'color',  en: 'green',  vi: 'xanh lá' },
    sweet:   { g: 'flavor', en: 'sweet',  vi: 'ngọt' },
    savory:  { g: 'flavor', en: 'savory', vi: 'đậm đà' },
    spicy:   { g: 'flavor', en: 'SPICY 🌶️', vi: 'CAY 🌶️' },
    sour:    { g: 'flavor', en: 'sour',   vi: 'chua' },
    starchy: { g: 'cat',    en: ['something starchy', 'starchy things'], vi: 'tinh bột' },
    fresh:   { g: 'flavor', en: 'fresh',  vi: 'tươi mát' },
  };

  const FLAVOR_WORDS = {
    en: { spicy: 'Spicy', sweet: 'Sweet', sour: 'Sour', savory: 'Savory', none: 'Mystery' },
    vi: { spicy: 'cay', sweet: 'ngọt', sour: 'chua', savory: 'đậm đà', none: 'bí ẩn' },
  };

  let lang = 'en';
  let catalog = { packs: {}, actions: {} };
  const allIngredients = {};

  const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

  function t(key, ...args) {
    const v = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key];
    if (v == null) return key;
    if (typeof v === 'function') return v(...args);
    if (Array.isArray(v)) return v;
    return fill(v, args[0]);
  }

  function setCatalog(c) {
    catalog = c;
    for (const pack of Object.values(c.packs || {})) Object.assign(allIngredients, pack.ingredients);
  }

  const ingName = id => (allIngredients[id] ? allIngredients[id].name[lang] : id);
  const ingEmoji = id => (allIngredients[id] ? allIngredients[id].emoji : '❓');
  const actName = id => (catalog.actions[id] ? catalog.actions[id].name[lang] : id);
  const actEmoji = id => (catalog.actions[id] ? catalog.actions[id].emoji : '❓');
  const lower = s => (lang === 'en' ? s.toLowerCase() : s.charAt(0).toLowerCase() + s.slice(1));

  // Past tense for "Tri stirred" / "Trí đã khuấy".
  function actPast(id) {
    if (lang === 'vi') return `${actEmoji(id)} ${lower(actName(id))}`;
    return `${actEmoji(id)} ${{ stir: 'stirred', boil: 'boiled', salt: 'salted' }[id] || id}`;
  }

  function clueText(c) {
    const tag = TAGS[c.tag];
    if (lang === 'vi') {
      const word = tag && (tag.g === 'color' ? `món màu ${tag.vi}` : tag.g === 'flavor' ? `vị ${tag.vi}` : tag.vi);
      switch (c.type) {
        case 'hasTag':    return `có ${word}`;
        case 'noTag':     return `KHÔNG có ${word}`;
        case 'minTag':    return `ít nhất ${c.n} món ${tag.g === 'color' ? 'màu ' + tag.vi : tag.vi}`;
        case 'hasIng':    return `phải có ${ingEmoji(c.id)} ${lower(ingName(c.id))}`;
        case 'noIng':     return `tuyệt đối không có ${ingEmoji(c.id)} ${lower(ingName(c.id))}`;
        case 'hasAction': return `phải ${actEmoji(c.id)} ${lower(actName(c.id))} ít nhất một lần`;
        case 'noAction':  return `không bao giờ ${actEmoji(c.id)} ${lower(actName(c.id))}`;
        case 'maxIngs':   return `không quá ${c.n} nguyên liệu`;
        case 'minIngs':   return `ít nhất ${c.n} nguyên liệu`;
        case 'lastIs':    return `bước cuối phải là ${actEmoji(c.id)} ${lower(actName(c.id))}`;
      }
    } else {
      const one = tag && (tag.g === 'cat' ? tag.en[0] : `something ${tag.en}`);
      const many = tag && (tag.g === 'cat' ? tag.en[1] : `${tag.en} things`);
      const past = { stir: 'stirred', boil: 'boiled', salt: 'salted' };
      switch (c.type) {
        case 'hasTag':    return `has ${one}`;
        case 'noTag':     return `NO ${many}`;
        case 'minTag':    return `at least ${c.n}× ${many}`;
        case 'hasIng':    return `must include ${ingEmoji(c.id)} ${lower(ingName(c.id))}`;
        case 'noIng':     return `absolutely no ${ingEmoji(c.id)} ${lower(ingName(c.id))}`;
        case 'hasAction': return `must be ${actEmoji(c.id)} ${past[c.id]} at some point`;
        case 'noAction':  return `never ${actEmoji(c.id)} ${lower(actName(c.id))} it`;
        case 'maxIngs':   return `no more than ${c.n} ingredients`;
        case 'minIngs':   return `at least ${c.n} ingredients`;
        case 'lastIs':    return `finish with a ${actEmoji(c.id)} ${lower(actName(c.id))}`;
      }
    }
    return '???';
  }

  function dishTypeName(packId, key) {
    const pack = catalog.packs[packId];
    return pack && pack.dishTypes[key] ? pack.dishTypes[key][lang] : key;
  }

  // EN: "Tri & Mai's Spicy Shrimp Phở"   VI: "Phở tôm cay của Tri & Mai"
  function dishName(dish, names) {
    const chefs = dish.chefs.map(i => names[i]).join(' & ');
    const type = dishTypeName(dish.pack, dish.dishType);
    const flavor = FLAVOR_WORDS[lang][dish.flavor || 'none'];
    const star = dish.star ? ingName(dish.star) : '';
    if (lang === 'vi') return [type, star && lower(star), flavor, 'của', chefs].filter(Boolean).join(' ');
    return [`${chefs}'s`, flavor, star, type].filter(Boolean).join(' ');
  }

  function detectLang() {
    try {
      const saved = JSON.parse(localStorage.getItem('ck:lang'));
      if (saved === 'en' || saved === 'vi') return saved;
    } catch { /* ignore */ }
    return (navigator.languages || [navigator.language || 'en']).some(l => /^vi\b/i.test(l)) ? 'vi' : 'en';
  }

  function setLang(l) {
    lang = l === 'vi' ? 'vi' : 'en';
    try { localStorage.setItem('ck:lang', JSON.stringify(lang)); } catch { /* ignore */ }
    document.documentElement.lang = lang;
    document.title = lang === 'vi' ? 'Bếp Đôi Mình' : "Couple's Kitchen";
    document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(n => { n.innerHTML = t(n.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
    document.querySelectorAll('.lang-btn').forEach(b => { b.textContent = lang === 'vi' ? '🇻🇳' : '🇬🇧'; b.setAttribute('aria-label', lang === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'); });
  }

  window.I18N = {
    t, setLang, detectLang, setCatalog, clueText, dishName, dishTypeName,
    ingName, ingEmoji, actName, actEmoji, actPast, lower,
    get lang() { return lang; },
  };
})();
