/* ============ NEONDROP — data layer ============ */
window.DATA = (function () {
  // Rarity tiers — colors match CS2 grades.
  const RARITIES = {
    consumer:   { key: 'consumer',   name: 'Consumer',   color: '#b0c3d9', tier: 0, base: [2, 12] },
    industrial: { key: 'industrial', name: 'Industrial', color: '#5e98d9', tier: 1, base: [6, 28] },
    milspec:    { key: 'milspec',    name: 'Mil-Spec',   color: '#4b69ff', tier: 2, base: [12, 90] },
    restricted: { key: 'restricted', name: 'Restricted', color: '#8847ff', tier: 3, base: [45, 320] },
    classified: { key: 'classified', name: 'Classified', color: '#d32ce6', tier: 4, base: [180, 1100] },
    covert:     { key: 'covert',     name: 'Covert',     color: '#eb4b4b', tier: 5, base: [600, 4200] },
    gold:       { key: 'gold',       name: '★ Exceedingly Rare', color: '#ffae39', tier: 6, base: [2200, 26000] },
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

  // Wear tiers add price variance & flavor.
  const WEARS = [
    { name: 'Factory New',     short: 'FN', mult: 1.0 },
    { name: 'Minimal Wear',    short: 'MW', mult: 0.82 },
    { name: 'Field-Tested',    short: 'FT', mult: 0.62 },
    { name: 'Well-Worn',       short: 'WW', mult: 0.48 },
    { name: 'Battle-Scarred',  short: 'BS', mult: 0.38 },
  ];

  // Case definitions. priceBand filters which skins (by computed value) can appear.
  // odds-driven rarity, value band keeps each case thematically priced.
  const CASES = [
    { id: 'starter',  name: 'Стартовый кейс',  glow: '#4b69ff', tag: 'NEW',   price: 45,   band: [5, 1500],   desc: 'Идеален для первого открытия. Базовый набор скинов и шанс на нож.' },
    { id: 'neon',     name: 'Neon Riot',       glow: '#00e0c6', tag: 'HOT',   price: 120,  band: [12, 3500],  desc: 'Яркие граффити-скины и кислотные раскраски.' },
    { id: 'crimson',  name: 'Crimson Web',     glow: '#eb4b4b', tag: '',      price: 260,  band: [30, 8000],  desc: 'Красные covert-скины и редкие ножи с паутиной.' },
    { id: 'gold',     name: 'Golden Vault',    glow: '#ffb649', tag: 'GOLD',  price: 650,  band: [120, 20000],desc: 'Премиальный кейс с повышенным шансом на золото.' },
    { id: 'knife',    name: 'Knife & Gloves',  glow: '#8847ff', tag: '★',     price: 1400, band: [300, 26000],desc: 'Только дорогой лут: ножи, перчатки и топовые covert.' },
    { id: 'budget',   name: 'Бюджетный кейс',  glow: '#5e98d9', tag: '',      price: 25,   band: [2, 600],    desc: 'Дёшево и сердито — раскачай инвентарь с нуля.' },
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

  // Compute a stable price for a skin from its rarity + name.
  function priceFor(rarityKey, name) {
    const r = RARITIES[rarityKey] || RARITIES.milspec;
    const [lo, hi] = r.base;
    const t = hashStr(name + rarityKey);
    // skew toward lower end (more cheap skins) using power curve
    const v = lo + (hi - lo) * Math.pow(t, 1.7);
    return Math.max(1, Math.round(v));
  }

  // Map API rarity names -> our tier keys.
  function normalizeRarity(apiRarityName, categoryName) {
    const c = (categoryName || '').toLowerCase();
    if (c.includes('knife') || c.includes('glove')) return 'gold';
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

  function buildFallback() {
    return FALLBACK.map(([weapon, name, rarity]) => ({
      id: (weapon + '-' + name).replace(/\s+/g, '-').toLowerCase(),
      weapon,
      skin: name,
      name: weapon + ' | ' + name,
      rarity,
      color: RARITIES[rarity].color,
      image: null, // placeholder generated in skins.js
    }));
  }

  return {
    RARITIES, TIER_ORDER, CASE_ODDS, WEARS, CASES,
    priceFor, normalizeRarity, buildFallback, hashStr,
    API_URL: 'https://bymykel.github.io/CSGO-API/api/en/skins.json',
  };
})();
