/* ============ NEONDROP — data layer ============ */
window.DATA = (function () {
  // Rarity tiers — colors match CS2 grades.
  const RARITIES = {
    consumer:   { key: 'consumer',   name: 'Consumer',   color: '#b0c3d9', tier: 0, base: [25, 150] },
    industrial: { key: 'industrial', name: 'Industrial', color: '#5e98d9', tier: 1, base: [80, 400] },
    milspec:    { key: 'milspec',    name: 'Mil-Spec',   color: '#4b69ff', tier: 2, base: [150, 1200] },
    restricted: { key: 'restricted', name: 'Restricted', color: '#8847ff', tier: 3, base: [500, 4500] },
    classified: { key: 'classified', name: 'Classified', color: '#d32ce6', tier: 4, base: [1500, 18000] },
    covert:     { key: 'covert',     name: 'Covert',     color: '#eb4b4b', tier: 5, base: [4000, 75000] },
    gold:       { key: 'gold',       name: '★ Exceedingly Rare', color: '#ffae39', tier: 6, base: [18000, 450000] },
  };
  const TIER_ORDER = ['consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'gold'];

  // Standard CS2 case odds (probability of pulling each rarity tier).
  const CASE_ODDS = [
    { rarity: 'milspec',    p: 0.7992 },
    { rarity: 'restricted', p: 0.1598 },
    { rarity: 'classified', p: 0.032 },
    { rarity: 'covert',     p: 0.0064 },
    { rarity: 'gold',       p: 0.0026 },
  ];

  // Wear tiers — множители относительно цены FT (как на Steam Market).
  const WEARS = [
    { name: 'Factory New',     nameRu: 'Прямо с завода',   short: 'FN', mult: 1.55 },
    { name: 'Minimal Wear',    nameRu: 'Немного поношенное', short: 'MW', mult: 1.18 },
    { name: 'Field-Tested',    nameRu: 'После полевых',    short: 'FT', mult: 1.0 },
    { name: 'Well-Worn',       nameRu: 'Поношенное',       short: 'WW', mult: 0.78 },
    { name: 'Battle-Scarred',  nameRu: 'Закалённое',       short: 'BS', mult: 0.62 },
  ];

  const CASES = [
    { id: 'starter',  name: 'Стартовый кейс',  glow: '#4b69ff', tag: 'NEW',   price: 99,   band: [80, 8000],    desc: 'Идеален для первого открытия. Базовый набор скинов и шанс на нож.' },
    { id: 'neon',     name: 'Neon Riot',       glow: '#00e0c6', tag: 'HOT',   price: 199,  band: [150, 18000],  desc: 'Яркие граффити-скины и кислотные раскраски.' },
    { id: 'crimson',  name: 'Crimson Web',     glow: '#eb4b4b', tag: '',      price: 399,  band: [400, 45000],  desc: 'Красные covert-скины и редкие ножи с паутиной.' },
    { id: 'gold',     name: 'Golden Vault',    glow: '#ffb649', tag: 'GOLD',  price: 799,  band: [1200, 120000],desc: 'Премиальный кейс с повышенным шансом на золото.' },
    { id: 'knife',    name: 'Knife & Gloves',  glow: '#8847ff', tag: '★',     price: 1499, band: [8000, 450000],desc: 'Только дорогой лут: ножи, перчатки и топовые covert.' },
    { id: 'budget',   name: 'Бюджетный кейс',  glow: '#5e98d9', tag: '',      price: 49,   band: [30, 3500],    desc: 'Дёшево и сердито — раскачай инвентарь с нуля.' },
  ];

  // ---- deterministic pseudo-random from string (stable prices per skin) ----
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  // Ориентиры Steam Market (~₽, Field-Tested). Обновляются по имени «Оружие | Скин».
  const MARKET_HINTS = {
    'AWP | Asiimov': 5200, 'M4A4 | Asiimov': 6800, 'AK-47 | Redline': 3400,
    'AK-47 | Vulcan': 22000, 'AK-47 | Fire Serpent': 98000, 'AK-47 | Bloodsport': 8500,
    'AWP | Dragon Lore': 920000, 'AWP | Lightning Strike': 9200, 'AWP | Hyper Beast': 4800,
    'AWP | Neo-Noir': 6200, 'AWP | Wildfire': 7500, 'M4A4 | Howl': 1200000,
    'M4A1-S | Printstream': 13500, 'M4A1-S | Hyper Beast': 5200, 'M4A1-S | Player Two': 4800,
    'Desert Eagle | Blaze': 48000, 'Desert Eagle | Printstream': 11000, 'Desert Eagle | Code Red': 3800,
    'USP-S | Kill Confirmed': 8200, 'USP-S | Printstream': 9500, 'Glock-18 | Fade': 32000,
    'MAC-10 | Neon Rider': 4200, 'P250 | Asiimov': 520, 'P90 | Asiimov': 480,
    'Karambit | Doppler': 95000, 'Karambit | Fade': 145000, 'Butterfly Knife | Fade': 195000,
    'M9 Bayonet | Doppler': 88000, 'Bayonet | Doppler': 62000, 'Sport Gloves | Vice': 185000,
    'Sport Gloves | Pandora\'s Box': 420000, 'Specialist Gloves | Crimson Kimono': 165000,
  };

  const WEAPON_MULT = {
    'AWP': 1.35, 'AK-47': 1.22, 'M4A4': 1.2, 'M4A1-S': 1.18, 'Desert Eagle': 1.15,
    'USP-S': 1.08, 'Glock-18': 1.05, 'SSG 08': 1.1,
  };

  function weaponMult(weapon) {
    if (!weapon) return 1;
    for (const [k, v] of Object.entries(WEAPON_MULT)) if (weapon.includes(k)) return v;
    if (/knife|bayonet|karambit|dagger|gloves/i.test(weapon)) return 2.8;
    return 1;
  }

  // Compute stable price in rubles (FT baseline before wear).
  function priceFor(rarityKey, name, weapon, skin) {
    const full = name || (weapon && skin ? weapon + ' | ' + skin : '');
    if (MARKET_HINTS[full]) return MARKET_HINTS[full];

    const skinName = (skin || (full.split('|')[1] || '')).trim().toLowerCase();
    if (skinName.includes('asiimov')) {
      const w = (weapon || full.split('|')[0] || '').toLowerCase();
      if (w.includes('awp')) return 5200;
      if (w.includes('m4a4')) return 6800;
      if (w.includes('p250') || w.includes('p90')) return 500;
    }
    if (skinName.includes('printstream')) return (weapon || '').includes('M4A1') ? 13500 : 9500;
    if (skinName.includes('doppler')) return 85000;
    if (skinName.includes('fade')) return /glove/i.test(weapon || '') ? 95000 : 120000;

    const r = RARITIES[rarityKey] || RARITIES.milspec;
    const [lo, hi] = r.base;
    const t = hashStr(full + rarityKey);
    let v = lo + (hi - lo) * Math.pow(t, 1.55);
    v *= weaponMult(weapon || full.split('|')[0].trim());
    return Math.max(25, Math.round(v));
  }

  // Map API rarity names -> our tier keys.
  function normalizeRarity(apiRarityName, categoryName) {
    const c = (categoryName || '').toLowerCase();
    if (c.includes('knife') || c.includes('knive') || c.includes('glove')) return 'gold';
    const n = (apiRarityName || '').toLowerCase();
    if (n.includes('contraband') || n.includes('extraordinary') || n.includes('exceed')) return 'gold';
    if (n.includes('covert')) return 'covert';
    if (n.includes('classified')) return 'classified';
    if (n.includes('restricted')) return 'restricted';
    if (n.includes('mil-spec') || n.includes('milspec')) return 'milspec';
    if (n.includes('industrial')) return 'industrial';
    if (n.includes('consumer')) return 'consumer';
    return 'milspec';
  }

  // Fallback dataset (used if API is unreachable). Real CS2 skin names.
  const FALLBACK = [
    ['AK-47', 'Redline', 'classified'], ['AK-47', 'Asiimov', 'covert'], ['AK-47', 'Fire Serpent', 'covert'],
    ['AK-47', 'Vulcan', 'covert'], ['AK-47', 'Neon Rider', 'covert'], ['AK-47', 'Bloodsport', 'covert'],
    ['AWP', 'Asiimov', 'covert'], ['AWP', 'Dragon Lore', 'gold'], ['AWP', 'Neo-Noir', 'covert'],
    ['AWP', 'Hyper Beast', 'covert'], ['AWP', 'Wildfire', 'covert'], ['AWP', 'Lightning Strike', 'classified'],
    ['M4A4', 'Howl', 'gold'], ['M4A4', 'Asiimov', 'covert'], ['M4A4', 'Neo-Noir', 'covert'],
    ['M4A1-S', 'Hyper Beast', 'covert'], ['M4A1-S', 'Printstream', 'covert'], ['M4A1-S', 'Player Two', 'covert'],
    ['Desert Eagle', 'Blaze', 'restricted'], ['Desert Eagle', 'Code Red', 'covert'], ['Desert Eagle', 'Printstream', 'covert'],
    ['Glock-18', 'Fade', 'restricted'], ['Glock-18', 'Water Elemental', 'restricted'], ['Glock-18', 'Neo-Noir', 'classified'],
    ['USP-S', 'Kill Confirmed', 'covert'], ['USP-S', 'Neo-Noir', 'classified'], ['USP-S', 'Cortex', 'classified'],
    ['P250', 'Asiimov', 'restricted'], ['P90', 'Asiimov', 'restricted'], ['MP9', 'Hot Rod', 'classified'],
    ['SSG 08', 'Blood in the Water', 'classified'], ['Five-SeveN', 'Hyper Beast', 'classified'],
    ['Galil AR', 'Chatterbox', 'covert'], ['FAMAS', 'Roll Cage', 'milspec'], ['Tec-9', 'Decimator', 'milspec'],
    ['UMP-45', 'Primal Saber', 'restricted'], ['Nova', 'Hyper Beast', 'milspec'], ['MAC-10', 'Neon Rider', 'restricted'],
    ['★ Karambit', 'Doppler', 'gold'], ['★ Karambit', 'Fade', 'gold'], ['★ Butterfly Knife', 'Fade', 'gold'],
    ['★ M9 Bayonet', 'Marble Fade', 'gold'], ['★ Bayonet', 'Tiger Tooth', 'gold'], ['★ Flip Knife', 'Doppler', 'gold'],
    ['★ Sport Gloves', 'Pandora\'s Box', 'gold'], ['★ Specialist Gloves', 'Crimson Kimono', 'gold'],
    ['MP7', 'Nemesis', 'milspec'], ['CZ75-Auto', 'Victoria', 'restricted'], ['SG 553', 'Cyrex', 'classified'],
    ['AUG', 'Chameleon', 'classified'], ['Dual Berettas', 'Cobra Strike', 'milspec'], ['XM1014', 'Tranquility', 'milspec'],
    ['P2000', 'Ocean Foam', 'milspec'], ['Sawed-Off', 'The Kraken', 'classified'], ['Negev', 'Power Loader', 'milspec'],
  ];

  // Дешёвые скины для наполнения бюджетных кейсов (если в API мало consumer/industrial).
  const BUDGET_SKINS = [
    ['P250', 'Sand Dune', 'consumer'], ['P250', 'Boreal Forest', 'consumer'], ['P250', 'Facility Draft', 'consumer'],
    ['Nova', 'Walnut', 'consumer'], ['Nova', 'Polar Mesh', 'consumer'], ['Nova', 'Sand Dune', 'consumer'],
    ['MP9', 'Slide', 'consumer'], ['MP9', 'Storm', 'consumer'], ['MP9', 'Sand Dashed', 'consumer'],
    ['G3SG1', 'Orange Crash', 'consumer'], ['G3SG1', 'Desert Storm', 'consumer'],
    ['SCAR-20', 'Sand Mesh', 'consumer'], ['SCAR-20', 'Contractor', 'consumer'],
    ['SG 553', 'Army Sheen', 'consumer'], ['SG 553', 'Waves Perforated', 'consumer'],
    ['MAC-10', 'Silver', 'industrial'], ['MAC-10', 'Indigo', 'industrial'], ['MAC-10', 'Candy Apple', 'industrial'],
    ['UMP-45', 'Gunsmoke', 'industrial'], ['UMP-45', 'Corporal', 'industrial'],
    ['PP-Bizon', 'Sand Dashed', 'consumer'], ['PP-Bizon', 'Facility Sketch', 'consumer'],
    ['Five-SeveN', 'Coolant', 'consumer'], ['Five-SeveN', 'Orange Peel', 'consumer'],
    ['Dual Berettas', 'Contractor', 'consumer'], ['Dual Berettas', 'Colony', 'consumer'],
    ['R8 Revolver', 'Bone Mask', 'consumer'], ['R8 Revolver', 'Desert Brush', 'consumer'],
    ['Negev', 'Army Sheen', 'consumer'], ['Negev', 'Bulkhead', 'consumer'],
    ['Sawed-Off', 'Forest DDPAT', 'consumer'], ['Sawed-Off', 'Snake Camo', 'consumer'],
    ['XM1014', 'Blue Spruce', 'consumer'], ['XM1014', 'Blue Steel', 'industrial'],
    ['Galil AR', 'Sage Spray', 'consumer'], ['FAMAS', 'Colony', 'consumer'],
    ['Tec-9', 'Groundwater', 'consumer'], ['Tec-9', 'Army Mesh', 'consumer'],
    ['P90', 'Sand Spray', 'consumer'], ['P90', 'Scorched', 'consumer'],
    ['MP7', 'Prey', 'consumer'], ['MP7', 'Motherboard', 'industrial'],
    ['P2000', 'Granite Marbleized', 'industrial'], ['P2000', 'Pathfinder', 'industrial'],
    ['CZ75-Auto', 'Tuxedo', 'milspec'], ['CZ75-Auto', 'Polymer', 'milspec'],
    ['Desert Eagle', 'Bronze Deco', 'milspec'], ['Desert Eagle', 'Corinthian', 'milspec'],
    ['Glock-18', 'Sacrifice', 'milspec'], ['Glock-18', 'Off World', 'milspec'],
    ['USP-S', 'Ticket to Hell', 'restricted'], ['AWP', 'Worm God', 'restricted'],
    ['AK-47', 'Safety Net', 'restricted'], ['M4A4', 'Sheet Lightning', 'restricted'],
  ];

  function budgetEntries() {
    return BUDGET_SKINS.map(([weapon, skin, rarity]) => ({
      id: (weapon + '-' + skin).replace(/\s+/g, '-').toLowerCase(),
      weapon, skin, name: weapon + ' | ' + skin,
      rarity, color: RARITIES[rarity].color, image: null,
    }));
  }

  function buildFallback() {
    // Prefer the embedded real-skin dataset (with real images) loaded from skins-data.js
    const real = (typeof window !== 'undefined' && Array.isArray(window.FALLBACK_SKINS)) ? window.FALLBACK_SKINS : null;
    if (real && real.length) {
      const seen = new Set(real.map((o) => (o.w + '|' + o.s).toLowerCase()));
      const merged = real.map((o) => {
        const rarity = o.r || 'milspec';
        return {
          id: (o.w + '-' + o.s).replace(/\s+/g, '-').toLowerCase(),
          weapon: o.w, skin: o.s, name: o.w + ' | ' + o.s,
          rarity, color: (RARITIES[rarity] || RARITIES.milspec).color, image: o.i || null,
        };
      });
      budgetEntries().forEach((b) => {
        const key = (b.weapon + '|' + b.skin).toLowerCase();
        if (!seen.has(key)) { seen.add(key); merged.push(b); }
      });
      return merged;
    }
    // last-resort text-only fallback
    const base = FALLBACK.map(([weapon, name, rarity]) => ({
      id: (weapon + '-' + name).replace(/\s+/g, '-').toLowerCase(),
      weapon, skin: name, name: weapon + ' | ' + name,
      rarity, color: RARITIES[rarity].color, image: null,
    }));
    const seen = new Set(base.map((s) => s.id));
    budgetEntries().forEach((b) => { if (!seen.has(b.id)) base.push(b); });
    return base;
  }

  function mergeBudgetSkins(list) {
    const seen = new Set(list.map((s) => s.id));
    budgetEntries().forEach((b) => {
      if (seen.has(b.id)) return;
      seen.add(b.id);
      list.push(Object.assign({}, b, { price: priceFor(b.rarity, b.name, b.weapon, b.skin) }));
    });
    return list;
  }

  return {
    RARITIES, TIER_ORDER, CASE_ODDS, WEARS, CASES,
    priceFor, normalizeRarity, buildFallback, mergeBudgetSkins, hashStr,
    // Reliable source: jsDelivr CDN mirror of ByMykel/CSGO-API (HTTPS + CORS).
    API_URL: 'https://cdn.jsdelivr.net/gh/ByMykel/CSGO-API@main/public/api/en/skins.json',
    API_MIRRORS: [
      'https://cdn.jsdelivr.net/gh/ByMykel/CSGO-API@main/public/api/en/skins.json',
      'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json',
      'https://bymykel.github.io/CSGO-API/api/en/skins.json',
    ],
  };
})();
