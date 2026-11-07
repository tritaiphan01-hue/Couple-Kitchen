/* Couple's Kitchen — hand-made sticker icons (inline SVG), so the game looks the
   same on every phone instead of depending on each platform's emoji.
   Every icon is 64×64 with the same thick cocoa outline as the chefs.
   Icons size themselves to the surrounding font-size (1em), like emoji did. */
(() => {
  'use strict';
  const O = 'stroke="#4A3428" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  const L = 'stroke="#4A3428" stroke-width="2" stroke-linecap="round" fill="none"';
  const shine = (x, y, rx = 5, ry = 3, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45" transform="rotate(${rot} ${x} ${y})"/>`;

  const ICONS = {
    tomato: `<circle cx="32" cy="36" r="20" fill="#E8503A" ${O}/>${shine(23, 28)}<path d="M32 17 l-7 -4 l4 7 l-8 1 l9 3 l2 6 l2 -6 l9 -3 l-8 -1 l4 -7z" fill="#5BA35B" ${O} stroke-width="2"/>`,
    egg: `<ellipse cx="32" cy="34" rx="17" ry="22" fill="#FFF6E6" ${O}/>${shine(25, 24, 4, 6, 20)}`,
    beef: `<path d="M10 32 Q10 15 32 15 Q55 15 55 31 Q55 50 35 51 Q12 52 10 32Z" fill="#D9534F" ${O}/><path d="M20 26 Q30 22 38 30 Q44 36 50 33" ${L} stroke="#F7C6C0" stroke-width="3"/><path d="M18 38 Q26 34 32 40" stroke="#F7C6C0" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    pork: `<path d="M8 22 Q20 14 32 22 T56 22 L56 42 Q44 50 32 42 T8 42Z" fill="#E98A8A" ${O}/><path d="M8 32 Q20 24 32 32 T56 32" stroke="#FBE0D4" stroke-width="5" fill="none"/>`,
    shrimp: `<path d="M48 18 Q24 10 16 30 Q12 46 30 50 Q36 51 38 46 Q26 44 26 34 Q28 24 46 28Z" fill="#F4845F" ${O}/><path d="M24 26 l6 5 M20 34 l8 2 M22 42 l7 -2" ${L}/><path d="M46 28 l10 -6 l-2 10z" fill="#F4845F" ${O} stroke-width="2"/><circle cx="44" cy="21" r="2" fill="#4A3428"/>`,
    fish: `<path d="M8 32 Q24 14 44 26 L56 18 L54 32 L56 46 L44 38 Q24 50 8 32Z" fill="#7DB7F0" ${O}/><circle cx="18" cy="30" r="2.5" fill="#4A3428"/><path d="M28 26 Q32 32 28 38" ${L}/>${shine(22, 25)}`,
    lettuce: `<path d="M32 54 Q12 52 10 36 Q8 22 20 18 Q24 8 34 12 Q46 8 50 20 Q58 28 52 40 Q48 54 32 54Z" fill="#7CC06B" ${O}/><path d="M32 52 L32 22 M32 40 L22 30 M32 34 L42 26 M32 46 L42 40" ${L} stroke="#3F7A38"/>`,
    greens: `<path d="M32 58 L32 14" stroke="#3F7A38" stroke-width="4" stroke-linecap="round"/><path d="M32 22 Q16 10 14 24 Q22 30 32 26Z M32 34 Q48 22 50 36 Q42 42 32 38Z M32 46 Q16 36 14 50 Q22 54 32 50Z" fill="#7CC06B" ${O}/>`,
    cucumber: `<rect x="10" y="22" width="44" height="20" rx="10" fill="#5BA35B" ${O} transform="rotate(-25 32 32)"/><g fill="#A9D99A"><circle cx="22" cy="36" r="1.8"/><circle cx="30" cy="31" r="1.8"/><circle cx="38" cy="27" r="1.8"/><circle cx="34" cy="37" r="1.8"/><circle cx="44" cy="30" r="1.8"/></g>`,
    onion: `<path d="M32 10 Q36 18 46 26 Q56 36 50 48 Q44 56 32 56 Q20 56 14 48 Q8 36 18 26 Q28 18 32 10Z" fill="#C98BB9" ${O}/><path d="M32 56 Q24 40 30 20 M32 56 Q40 40 34 20" ${L} stroke="#8E5A84"/><path d="M28 58 l-2 3 M32 58 v3 M36 58 l2 3" ${L}/>${shine(22, 36)}`,
    potato: `<path d="M12 34 Q10 18 30 16 Q52 14 54 30 Q56 48 34 50 Q14 52 12 34Z" fill="#C9955C" ${O}/><g fill="#8B6239"><circle cx="24" cy="28" r="2"/><circle cx="38" cy="24" r="1.7"/><circle cx="44" cy="38" r="2"/><circle cx="28" cy="42" r="1.6"/></g>${shine(22, 22)}`,
    chili: `<path d="M44 16 Q50 30 40 44 Q30 56 12 54 Q30 46 34 30 Q36 20 44 16Z" fill="#E8503A" ${O}/><path d="M44 16 Q46 8 54 8" ${O} fill="none" stroke="#3F7A38" stroke-width="4"/>${shine(38, 28, 3, 6, 25)}`,
    pineapple: `<path d="M24 20 L20 6 L28 14 L32 4 L36 14 L44 6 L40 20Z" fill="#5BA35B" ${O}/><ellipse cx="32" cy="38" rx="16" ry="20" fill="#F5C542" ${O}/><path d="M20 28 L44 52 M18 40 L36 58 M26 20 L46 40 M44 28 L20 52 M46 40 L28 58 M38 20 L18 40" stroke="#C99A1E" stroke-width="2"/>`,
    herbs: `<path d="M30 58 Q30 36 34 14" stroke="#3F7A38" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M31 46 Q14 46 12 34 Q26 32 31 46Z M32 34 Q48 32 52 20 Q38 18 32 34Z M33 22 Q20 18 22 6 Q34 10 33 22Z" fill="#6FBF5E" ${O}/>`,
    lemongrass: `<path d="M24 58 Q26 30 18 8 M32 58 Q32 30 32 6 M40 58 Q38 30 46 8" stroke="#8CC152" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M24 58 Q26 30 18 8 M32 58 Q32 30 32 6 M40 58 Q38 30 46 8" ${L}/><path d="M22 58 h20" stroke="#E8DFC4" stroke-width="8" stroke-linecap="round"/>`,
    cheese: `<path d="M8 50 L56 50 L56 26 L16 12Z" fill="#FFD27A" ${O}/><path d="M8 50 L16 12" ${L}/><g fill="#E6B24A"><circle cx="26" cy="36" r="5"/><circle cx="45" cy="40" r="3.5"/><circle cx="40" cy="26" r="3"/><circle cx="18" cy="46" r="2"/></g>`,
    rice: `<path d="M10 32 Q32 12 54 32Z" fill="#FFFFFF" ${O}/><path d="M8 32 h48 Q54 54 32 54 Q10 54 8 32Z" fill="#7DB7F0" ${O}/><path d="M14 38 Q32 46 50 38" stroke="#fff" stroke-width="3" fill="none"/><g fill="#E8E0CF"><ellipse cx="24" cy="26" rx="2" ry="1.2"/><ellipse cx="32" cy="22" rx="2" ry="1.2"/><ellipse cx="40" cy="26" rx="2" ry="1.2"/></g>`,
    noodles: `<path d="M18 8 L28 34 M28 6 L34 32" stroke="#C9955C" stroke-width="3.5" stroke-linecap="round"/><path d="M8 32 h48 Q54 54 32 54 Q10 54 8 32Z" fill="#F3E2C7" ${O}/><path d="M12 32 Q18 26 24 32 T36 32 T48 32 T56 32" stroke="#F5C542" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M14 42 Q32 48 50 42" stroke="#E8503A" stroke-width="3" fill="none" opacity=".7"/>`,
    vermicelli: `<ellipse cx="32" cy="34" rx="22" ry="16" fill="#FFFDF6" ${O}/><path d="M14 30 Q20 24 26 30 T38 30 T50 30 M14 38 Q20 32 26 38 T38 38 T50 38" stroke="#E2D6BC" stroke-width="2.5" fill="none"/>`,
    pasta: `<ellipse cx="32" cy="40" rx="26" ry="12" fill="#fff" ${O}/><path d="M16 38 Q16 24 32 24 Q48 24 48 38 Q32 46 16 38Z" fill="#F5C542" ${O} stroke-width="2.5"/><path d="M22 32 Q32 26 42 32 M20 36 Q32 30 44 36" stroke="#C99A1E" stroke-width="2" fill="none"/><circle cx="32" cy="28" r="6" fill="#E8503A" ${O} stroke-width="2"/>`,
    baguette: `<rect x="6" y="24" width="52" height="16" rx="8" fill="#E2A65A" ${O} transform="rotate(-20 32 32)"/><path d="M18 38 l6 -8 M28 34 l6 -8 M38 30 l6 -8" stroke="#B07330" stroke-width="2.5" stroke-linecap="round"/>`,
    toast: `<path d="M12 28 Q10 12 32 12 Q54 12 52 28 L50 54 L14 54Z" fill="#E2A65A" ${O}/><path d="M18 30 Q17 18 32 18 Q47 18 46 30 L45 49 L19 49Z" fill="#FBE2B3"/>`,
    carrot: `<path d="M22 22 L42 26 L20 58Z" fill="#F4845F" ${O}/><path d="M28 34 h6 M24 44 h5" ${L}/><path d="M32 24 Q30 10 22 8 M34 24 Q38 10 46 10 M32 24 Q34 14 34 4" stroke="#5BA35B" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    garlic: `<path d="M32 10 Q36 18 44 22 Q56 30 50 46 Q44 56 32 56 Q20 56 14 46 Q8 30 20 22 Q28 18 32 10Z" fill="#FBF3E4" ${O}/><path d="M32 56 Q24 40 28 22 M32 56 Q40 40 36 22" ${L} stroke="#C8B89A"/>`,
    mushroom: `<path d="M8 32 Q8 10 32 10 Q56 10 56 32Z" fill="#E8503A" ${O}/><g fill="#fff"><circle cx="22" cy="22" r="4"/><circle cx="38" cy="18" r="3"/><circle cx="44" cy="27" r="3"/></g><path d="M24 32 L22 52 Q32 56 42 52 L40 32Z" fill="#FBF3E4" ${O}/>`,
    corn: `<ellipse cx="32" cy="30" rx="11" ry="20" fill="#F5C542" ${O}/><path d="M24 18 h16 M22 26 h20 M22 34 h20 M24 42 h16 M28 12 v36 M36 12 v36" stroke="#C99A1E" stroke-width="1.6"/><path d="M32 56 Q14 50 16 26 Q22 44 32 50 Q42 44 48 26 Q50 50 32 56Z" fill="#7CC06B" ${O}/>`,
    lime: `<circle cx="32" cy="32" r="20" fill="#9ACD4B" ${O}/><circle cx="32" cy="32" r="14" fill="#D8EC9C"/><path d="M32 18 v28 M18 32 h28 M22 22 l20 20 M42 22 l-20 20" stroke="#9ACD4B" stroke-width="2"/>`,
    milk: `<path d="M18 22 L26 10 H38 L46 22 V56 H18Z" fill="#fff" ${O}/><path d="M18 30 H46 V46 H18Z" fill="#7DB7F0"/><path d="M18 22 H46" ${L}/><path d="M26 38 q6 -6 12 0" stroke="#fff" stroke-width="3" fill="none"/>`,
    chicken: `<path d="M30 40 Q12 48 10 32 Q8 14 26 12 Q44 10 46 26 Q46 34 40 38Z" fill="#C9955C" ${O}/><path d="M40 38 L50 50" stroke="#FBF3E4" stroke-width="7" stroke-linecap="round"/><path d="M40 38 L50 50" ${L}/><circle cx="52" cy="52" r="4" fill="#FBF3E4" ${O} stroke-width="2"/>${shine(22, 22)}`,
    fishsauce: `<path d="M26 6 h12 v10 Q48 20 48 30 V56 H16 V30 Q16 20 26 16Z" fill="#C9772E" ${O}/><rect x="20" y="32" width="24" height="14" rx="3" fill="#FFF4E6" ${O} stroke-width="2"/><path d="M26 39 h12" stroke="#E8503A" stroke-width="3"/>`,
    honey: `<path d="M16 22 h32 v30 Q48 58 40 58 H24 Q16 58 16 52Z" fill="#F5B83D" ${O}/><rect x="14" y="14" width="36" height="9" rx="3" fill="#B07330" ${O}/><path d="M22 34 h20" stroke="#FFE08A" stroke-width="4" stroke-linecap="round"/>`,

    // ---- Midnight Snack stations & animals ----
    fridge: `<rect x="14" y="4" width="36" height="56" rx="6" fill="#DDEFFB" ${O}/><path d="M14 24 H50" ${L}/><path d="M20 12 v6 M20 30 v10" stroke="#4A3428" stroke-width="3" stroke-linecap="round"/>${shine(42, 12, 3, 5, 0)}`,
    shelf: `<path d="M8 50 H56 M8 28 H56" stroke="#8B6239" stroke-width="4" stroke-linecap="round"/><rect x="12" y="10" width="12" height="16" rx="3" fill="#E8503A" ${O} stroke-width="2.5"/><rect x="28" y="14" width="12" height="12" rx="3" fill="#F5C542" ${O} stroke-width="2.5"/><rect x="16" y="34" width="14" height="14" rx="3" fill="#7DB7F0" ${O} stroke-width="2.5"/><rect x="36" y="32" width="12" height="16" rx="3" fill="#8FB996" ${O} stroke-width="2.5"/>`,
    stove: `<circle cx="28" cy="34" r="18" fill="#3B3330" ${O}/><circle cx="28" cy="34" r="12" fill="#55504C"/><path d="M44 30 L60 22" stroke="#3B3330" stroke-width="7" stroke-linecap="round"/><path d="M44 30 L60 22" ${L}/><path d="M18 58 q2 -5 0 -8 M28 60 q2 -6 0 -9 M38 58 q2 -5 0 -8" stroke="#F4845F" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    board: `<rect x="6" y="20" width="44" height="32" rx="8" fill="#D9AE78" ${O}/><circle cx="44" cy="28" r="2.5" fill="#4A3428"/><path d="M14 14 L46 42" stroke="#C8D0D6" stroke-width="7" stroke-linecap="round"/><path d="M14 14 L46 42" ${L}/><path d="M46 42 L54 50" stroke="#4A3428" stroke-width="5" stroke-linecap="round"/>`,
    table: `<circle cx="32" cy="32" r="18" fill="#fff" ${O}/><circle cx="32" cy="32" r="11" fill="none" stroke="#E9D3B8" stroke-width="2"/><path d="M6 14 V50 M3 14 V24 Q6 28 9 24 V14" ${L} stroke-width="2.5"/><path d="M58 14 Q52 24 58 34 V50" ${L} stroke-width="2.5"/>`,
    door: `<rect x="14" y="4" width="36" height="58" rx="3" fill="#A0673F" ${O}/><rect x="20" y="10" width="24" height="18" rx="2" fill="#B97A4D" stroke="#4A3428" stroke-width="2"/><rect x="20" y="34" width="24" height="20" rx="2" fill="#B97A4D" stroke="#4A3428" stroke-width="2"/><circle cx="43" cy="32" r="3" fill="#F5C542" stroke="#4A3428" stroke-width="2"/>`,
    cat: `<path d="M16 58 Q12 38 22 30 L18 12 L28 22 Q32 20 36 22 L46 12 L42 30 Q52 38 48 58Z" fill="#F4A259" ${O}/><path d="M48 52 Q60 50 58 38" stroke="#F4A259" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M48 52 Q60 50 58 38" ${L}/><circle cx="27" cy="34" r="2.4" fill="#4A3428"/><circle cx="37" cy="34" r="2.4" fill="#4A3428"/><path d="M30 40 q2 2 4 0" ${L}/><path d="M24 46 h-8 M40 46 h8" ${L} stroke-width="1.5"/>`,
    dog: `<path d="M8 50 Q8 30 30 30 Q52 30 56 44 Q58 54 46 56 H16 Q8 56 8 50Z" fill="#C9955C" ${O}/><ellipse cx="20" cy="36" rx="7" ry="10" fill="#8B6239" ${O} stroke-width="2.5" transform="rotate(25 20 36)"/><path d="M30 44 q3 3 6 0 M40 44 q3 3 6 0" ${L}/><circle cx="52" cy="48" r="2.5" fill="#4A3428"/><text x="46" y="22" font-size="14" font-weight="800" fill="#9EA3D6">z</text><text x="54" y="12" font-size="10" font-weight="800" fill="#9EA3D6">z</text>`,
  };

  // Ingredient ids differ a little between modes; map them onto icons.
  const ALIAS = {
    relay: { rau_muong: 'greens', lemon: 'lime', thom: 'pineapple', thit_heo: 'pork', thit_bo: 'beef', ca: 'fish', nuoc_mam: 'fishsauce', noodles: 'pasta', bun: 'vermicelli', sa: 'lemongrass' },
    rush: { bread: 'baguette' },
    sneak: { bread: 'toast' },
    station: { F: 'fridge', S: 'shelf', O: 'stove', B: 'board', T: 'table', D: 'door', G: 'dog' },
  };

  function svg(key, cls = '') {
    const body = ICONS[key];
    return body ? `<svg class="ico ${cls}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>` : null;
  }
  // Icon for an ingredient/station, falling back to the emoji if there's no drawing.
  function icon(mode, id, fallbackEmoji = '❓') {
    const key = (ALIAS[mode] && ALIAS[mode][id]) || id;
    return svg(key) || `<span class="emo">${fallbackEmoji}</span>`;
  }

  window.Icons = { svg, icon, has: key => !!ICONS[key], keys: () => Object.keys(ICONS), ALIAS };
})();
