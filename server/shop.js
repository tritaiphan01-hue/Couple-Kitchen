// Shop & the couple's shared wallet. Everything lives on the room, so it lasts
// for one session (while the kitchen is open on the server).
//
// Both partners earn into ONE shared wallet 💰 and either of you can spend it:
// on kitchen upgrades and decor (for both of you) or on your own chef's look.

const n = (en, vi) => ({ en, vi });

const ITEMS = {
  // ---- Kitchen upgrades (shared wallet). They make a mode a little easier. ----
  burner3:    { kind: 'kitchen', mode: 'rush',  emoji: '🔥', price: 150, name: n('Third burner', 'Bếp thứ 3'),            desc: n('Cook 3 things at once', 'Nấu 3 món cùng lúc') },
  sharpKnife: { kind: 'kitchen', mode: 'rush',  emoji: '🔪', price: 100, name: n('Sharp knife', 'Dao bén'),                desc: n('Chop with fewer taps', 'Thái ít lần chạm hơn') },
  nonstick:   { kind: 'kitchen', mode: 'rush',  emoji: '🍳', price: 120, name: n('Non-stick pans', 'Chảo chống dính'),     desc: n('Food takes 50% longer to burn', 'Đồ ăn lâu cháy hơn 50%') },
  bell:       { kind: 'kitchen', mode: 'rush',  emoji: '🛎️', price: 150, name: n('Friendly bell', 'Chuông thân thiện'),   desc: n('Customers wait 20% longer', 'Khách chờ lâu hơn 20%') },
  notebook:   { kind: 'kitchen', mode: 'relay', emoji: '📖', price: 120, name: n('Recipe notebook', 'Sổ tay công thức'),   desc: n('+1 step in every Recipe Relay round', 'Thêm 1 bước nấu mỗi ván Tiếp Sức') },
  slippers:   { kind: 'kitchen', mode: 'sneak', emoji: '🩴', price: 120, name: n('Soft slippers', 'Dép êm'),               desc: n('Creaky boards are quieter (3 → 2)', 'Ván kẽo kẹt êm hơn (3 → 2)') },
  quietFridge:{ kind: 'kitchen', mode: 'sneak', emoji: '🧊', price: 100, name: n('Quiet fridge', 'Tủ lạnh êm'),            desc: n('Opening the fridge alone: 3 → 2', 'Mở tủ lạnh một mình: 3 → 2') },
  earplugs:   { kind: 'kitchen', mode: 'sneak', emoji: '🎧', price: 180, name: n('Roommate earplugs', 'Nút tai cho bạn cùng phòng'), desc: n('Noise meter holds 15% more', 'Thanh tiếng ồn chứa thêm 15%') },
  catTreat:   { kind: 'kitchen', mode: 'sneak', emoji: '🐟', price: 200, name: n('Cat treats', 'Bánh thưởng cho mèo'),     desc: n('The cat naps all night', 'Mèo ngủ suốt đêm') },

  // ---- Decor (shared wallet). Changes how the kitchen looks. ----
  decor_sakura: { kind: 'decor', emoji: '🌸', price: 80, name: n('Cherry blossom', 'Hoa anh đào'), desc: n('Pink kitchen', 'Căn bếp hồng') },
  decor_garden: { kind: 'decor', emoji: '🌿', price: 80, name: n('Garden', 'Vườn xanh'),          desc: n('Leafy green kitchen', 'Căn bếp xanh lá') },
  decor_ocean:  { kind: 'decor', emoji: '🌊', price: 80, name: n('Seaside', 'Biển xanh'),         desc: n('Breezy blue kitchen', 'Căn bếp xanh biển') },

  // ---- Chef looks (personal wallet). ----
  color_honey: { kind: 'look', slot: 'color', price: 0,   free: true, emoji: '💛', value: ['#F5B83D', '#D99413'], name: n('Honey', 'Mật ong'), desc: n('', '') },
  color_plum:  { kind: 'look', slot: 'color', price: 0,   free: true, emoji: '💜', value: ['#9B6BC4', '#774A9E'], name: n('Plum', 'Mận'), desc: n('', '') },
  color_mint:  { kind: 'look', slot: 'color', price: 60,  emoji: '💚', value: ['#7FCFA8', '#4FA27D'], name: n('Mint', 'Bạc hà'), desc: n('', '') },
  color_sky:   { kind: 'look', slot: 'color', price: 60,  emoji: '💙', value: ['#7DB7F0', '#4C86C2'], name: n('Sky', 'Bầu trời'), desc: n('', '') },
  color_peach: { kind: 'look', slot: 'color', price: 60,  emoji: '🧡', value: ['#FFAD84', '#E07E52'], name: n('Peach', 'Đào'), desc: n('', '') },
  color_rose:  { kind: 'look', slot: 'color', price: 60,  emoji: '🩷', value: ['#F29CB8', '#D06A8C'], name: n('Rose', 'Hồng'), desc: n('', '') },
  hat_chef:    { kind: 'look', slot: 'hat', price: 0, free: true, emoji: '👨‍🍳', name: n('Chef hat', 'Mũ đầu bếp'), desc: n('', '') },
  hat_bow:     { kind: 'look', slot: 'hat', price: 80,  emoji: '🎀', name: n('Bow', 'Nơ xinh'), desc: n('', '') },
  hat_cap:     { kind: 'look', slot: 'hat', price: 80,  emoji: '🧢', name: n('Cap', 'Mũ lưỡi trai'), desc: n('', '') },
  hat_flower:  { kind: 'look', slot: 'hat', price: 90,  emoji: '🌸', name: n('Flower', 'Hoa cài'), desc: n('', '') },
  hat_ears:    { kind: 'look', slot: 'hat', price: 120, emoji: '🐱', name: n('Cat ears', 'Tai mèo'), desc: n('', '') },
  hat_crown:   { kind: 'look', slot: 'hat', price: 150, emoji: '👑', name: n('Crown', 'Vương miện'), desc: n('', '') },
  glasses_none:{ kind: 'look', slot: 'glasses', price: 0, free: true, emoji: '🙂', name: n('No glasses', 'Không kính'), desc: n('', '') },
  glasses_cool:{ kind: 'look', slot: 'glasses', price: 70, emoji: '🕶️', name: n('Sunglasses', 'Kính râm'), desc: n('', '') },
  glasses_nerd:{ kind: 'look', slot: 'glasses', price: 70, emoji: '👓', name: n('Glasses', 'Kính cận'), desc: n('', '') },
};

const DEFAULT_LOOKS = [
  { color: 'color_honey', hat: 'hat_chef', glasses: 'glasses_none' },
  { color: 'color_plum', hat: 'hat_chef', glasses: 'glasses_none' },
];

// START_COINS (env) gives every new kitchen and chef some coins, for testing. Default 0.
const START_COINS = Math.max(0, parseInt(process.env.START_COINS || '0', 10) || 0);

function newPlayerShopState(seat) {
  return { owned: [], look: { ...DEFAULT_LOOKS[seat] } };
}

function newRoomShopState() {
  return { wallet: START_COINS, upgrades: [], decorOwned: [], decor: null };
}

// Every finished game pays into the shared wallet.
function grant(room, total) {
  total = Math.max(0, Math.round(total));
  room.shop.wallet += total;
  return { total };
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// Returns { error } or { ok, item }.
function buy(room, seat, id) {
  if (!has(ITEMS, id)) return { error: 'unknown_item' };
  const item = ITEMS[id];
  const p = room.players[seat];
  if (item.kind === 'kitchen') {
    if (room.shop.upgrades.includes(id)) return { error: 'already_owned' };
    if (room.shop.wallet < item.price) return { error: 'not_enough' };
    room.shop.wallet -= item.price;
    room.shop.upgrades.push(id);
  } else if (item.kind === 'decor') {
    if (room.shop.decorOwned.includes(id)) return { error: 'already_owned' };
    if (room.shop.wallet < item.price) return { error: 'not_enough' };
    room.shop.wallet -= item.price;
    room.shop.decorOwned.push(id);
    room.shop.decor = id;                          // put it up right away
  } else {
    if (item.free || p.shop.owned.includes(id)) return { error: 'already_owned' };
    if (room.shop.wallet < item.price) return { error: 'not_enough' };
    room.shop.wallet -= item.price;
    p.shop.owned.push(id);
    p.shop.look[item.slot] = id;                   // wear it right away
  }
  return { ok: true, item };
}

function equip(room, seat, id) {
  if (id === null || id === 'decor_none') { room.shop.decor = null; return { ok: true }; }
  if (!has(ITEMS, id)) return { error: 'unknown_item' };
  const item = ITEMS[id];
  if (item.kind === 'decor') {
    if (!room.shop.decorOwned.includes(id)) return { error: 'not_owned' };
    room.shop.decor = id;
    return { ok: true };
  }
  if (item.kind !== 'look') return { error: 'unknown_item' };
  const p = room.players[seat];
  if (!item.free && !p.shop.owned.includes(id)) return { error: 'not_owned' };
  p.shop.look[item.slot] = id;
  return { ok: true };
}

const hasUpgrade = (room, id) => room.shop.upgrades.includes(id);

module.exports = { ITEMS, DEFAULT_LOOKS, newPlayerShopState, newRoomShopState, grant, buy, equip, hasUpgrade };
