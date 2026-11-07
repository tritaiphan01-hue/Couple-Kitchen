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
      'lobby.rushBest': 'Split Kitchen:',
      'rush.level': 'Level {n}',
      'rush.cook': '🔥 Cook',
      'rush.prep': '🔪 Prep',
      'rush.cookDesc': 'Pantry & stove',
      'rush.prepDesc': 'Chop, plate & serve',
      'rush.you': 'You',
      'rush.swap': '🔄 Swap roles',
      'rush.ready': "🙋 I'm ready!",
      'rush.unready': '✅ Ready! (tap to cancel)',
      'rush.waitingPartner': 'Waiting for {name}…',
      'rush.partnerReady': '{name} is ready ✅',
      'rush.tips': [
        'Cook grabs ingredients and cooks them. Prep chops, plates and serves. Pass things across the counter, and talk to each other!',
        'New dishes need things chopped AND cooked: Prep chops first, then passes it back to the stove.',
        'Faster orders and hotter stoves. Don’t let anything burn! 🔥',
      ],
      'rush.pantry': 'Pantry',
      'rush.stove': 'Stove',
      'rush.counterTo': 'Pass counter → {name}',
      'rush.counterFrom': 'Pass counter ← {name}',
      'rush.board': 'Chopping board',
      'rush.plate': 'Plate',
      'rush.serve': '🛎️ Serve',
      'rush.holding': 'Holding',
      'rush.handsEmpty': 'Hands empty ✋',
      'rush.tapChop': 'Tap to chop! {n}/{total}',
      'rush.chopDone': 'Chopped! Tap to pick up',
      'rush.boardEmpty': 'Put something raw here',
      'rush.plateEmpty': 'Empty plate',
      'rush.burnerEmpty': 'empty',
      'rush.paused': '⏸ Paused, waiting for {name}…',
      'rush.served': '+{coins} 💰 {dish}',
      'rush.missed': '😢 The {dish} customer left',
      'rush.burntEv': '🔥 The {ing} burnt!',
      'rush.st.raw': 'raw',
      'rush.st.chopped': 'chopped',
      'rush.st.cooked': 'cooked',
      'rush.st.chopped_cooked': 'chopped + cooked',
      'rush.st.burnt': 'burnt',
      'rush.resultsTitle': 'Kitchen closed!',
      'rush.coins': '{coins} coins',
      'rush.goal': 'Stars at {a} / {b} / {c} 💰',
      'rush.servedN': '🍽️ Dishes served: {n}',
      'rush.missedN': '😢 Customers missed: {n}',
      'rush.next': '➡️ Level {n}',
      'rush.retry': '🔁 Play again',
      'rush.funnyBurn': (name, n) => `🔥 ${name} burned ${n} thing${n > 1 ? 's' : ''}`,
      'rush.funnyPass': '🤝 {name} passed the most food',
      'rush.funnyPerfect': '🏆 Nothing burned. Kitchen heroes!',
      'rush.needStar': 'Get 1 ⭐ to unlock the next level',
      'rush.allDone': '🏆 You beat every level!',
      'err.wrong_role': "That's your partner's job!",
      'err.hands_full': 'Your hands are full',
      'err.burner_busy': 'That burner is busy',
      'err.slot_full': 'That spot is taken',
      'err.board_busy': 'The board is busy',
      'err.already_chopped': 'Already chopped',
      'err.cant_chop_cooked': "Can't chop cooked food",
      'err.plate_full': 'The plate is full',
      'err.empty_plate': 'The plate is empty',
      'err.no_matching_order': 'No order wants that plate 🤔',
      'err.burnt': 'Burnt! Throw it in the trash 🗑️',
      'err.paused': 'Paused',
      'err.not_started': 'Not started yet',
      'err.empty': '',
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
      'lobby.rushBest': 'Bếp Chia Đôi:',
      'rush.level': 'Màn {n}',
      'rush.cook': '🔥 Bếp chính',
      'rush.prep': '🔪 Phụ bếp',
      'rush.cookDesc': 'Tủ đồ & bếp lửa',
      'rush.prepDesc': 'Thái, bày món & ra món',
      'rush.you': 'Bạn',
      'rush.swap': '🔄 Đổi vai',
      'rush.ready': '🙋 Sẵn sàng!',
      'rush.unready': '✅ Đã sẵn sàng! (chạm để huỷ)',
      'rush.waitingPartner': 'Đang chờ {name}…',
      'rush.partnerReady': '{name} đã sẵn sàng ✅',
      'rush.tips': [
        'Bếp chính lấy nguyên liệu và nấu. Phụ bếp thái, bày món và ra món. Chuyền đồ qua quầy và nhớ nói chuyện với nhau nha!',
        'Món mới cần vừa thái vừa nấu: phụ bếp thái trước, rồi chuyền lại cho bếp chính.',
        'Khách tới nhanh hơn, bếp nóng hơn. Đừng để cháy nha! 🔥',
      ],
      'rush.pantry': 'Tủ đồ',
      'rush.stove': 'Bếp lửa',
      'rush.counterTo': 'Quầy chuyền → {name}',
      'rush.counterFrom': 'Quầy chuyền ← {name}',
      'rush.board': 'Thớt',
      'rush.plate': 'Đĩa',
      'rush.serve': '🛎️ Ra món',
      'rush.holding': 'Đang cầm',
      'rush.handsEmpty': 'Tay trống ✋',
      'rush.tapChop': 'Chạm để thái! {n}/{total}',
      'rush.chopDone': 'Thái xong! Chạm để lấy',
      'rush.boardEmpty': 'Đặt đồ sống lên đây',
      'rush.plateEmpty': 'Đĩa trống',
      'rush.burnerEmpty': 'trống',
      'rush.paused': '⏸ Tạm dừng, đang chờ {name}…',
      'rush.served': '+{coins} 💰 {dish}',
      'rush.missed': '😢 Khách gọi {dish} bỏ đi rồi',
      'rush.burntEv': '🔥 {ing} cháy rồi!',
      'rush.st.raw': 'sống',
      'rush.st.chopped': 'đã thái',
      'rush.st.cooked': 'đã nấu',
      'rush.st.chopped_cooked': 'thái + nấu',
      'rush.st.burnt': 'cháy',
      'rush.resultsTitle': 'Đóng cửa bếp!',
      'rush.coins': '{coins} xu',
      'rush.goal': 'Mốc sao: {a} / {b} / {c} 💰',
      'rush.servedN': '🍽️ Món đã ra: {n}',
      'rush.missedN': '😢 Khách bỏ về: {n}',
      'rush.next': '➡️ Màn {n}',
      'rush.retry': '🔁 Chơi lại',
      'rush.funnyBurn': (name, n) => `🔥 ${name} làm cháy ${n} món`,
      'rush.funnyPass': '🤝 {name} chuyền đồ nhiều nhất',
      'rush.funnyPerfect': '🏆 Không cháy món nào. Siêu đầu bếp!',
      'rush.needStar': 'Cần 1 ⭐ để mở màn tiếp theo',
      'rush.allDone': '🏆 Hai bạn đã phá đảo mọi màn!',
      'err.wrong_role': 'Việc này của người ấy mà!',
      'err.hands_full': 'Tay bạn đang cầm đồ rồi',
      'err.burner_busy': 'Bếp này đang bận',
      'err.slot_full': 'Chỗ này có đồ rồi',
      'err.board_busy': 'Thớt đang bận',
      'err.already_chopped': 'Thái rồi mà',
      'err.cant_chop_cooked': 'Không thái đồ đã nấu được',
      'err.plate_full': 'Đĩa đầy rồi',
      'err.empty_plate': 'Đĩa còn trống',
      'err.no_matching_order': 'Không có khách nào gọi đĩa này 🤔',
      'err.burnt': 'Cháy rồi! Bỏ vào thùng rác 🗑️',
      'err.paused': 'Đang tạm dừng',
      'err.not_started': 'Chưa bắt đầu',
      'err.empty': '',
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

  // Split Kitchen names (separate pantry from Recipe Relay).
  const rushIng = (pack, id) => { const p = catalog.rush && catalog.rush[pack]; return p && p.ingredients[id] ? p.ingredients[id] : { emoji: '❓', name: { en: id, vi: id } }; };
  const rushDish = (pack, id) => { const p = catalog.rush && catalog.rush[pack]; return p && p.dishes[id] ? p.dishes[id] : { emoji: '❓', name: { en: id, vi: id }, comps: [] }; };

  window.I18N = {
    t, setLang, detectLang, setCatalog, clueText, dishName, dishTypeName, rushIng, rushDish,
    ingName, ingEmoji, actName, actEmoji, actPast, lower,
    get lang() { return lang; },
  };
})();
