/* ============ NEONDROP — skins repository ============ */
window.SKINS = (function () {
  const D = window.DATA;
  const E = () => window.ECONOMY;
  let ALL = [];
  const byRarity = {};
  const casePools = {}; // caseId -> pools cache
  const caseScale = {}; // caseId -> RTP calibration multiplier
  let ready = false;

  function placeholder(skin) {
    const c = skin.color || '#6c5cff';
    const label = (skin.skin || skin.name || '').slice(0, 16);
    const wep = (skin.weapon || '').slice(0, 14);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${c}' stop-opacity='0.9'/>
        <stop offset='1' stop-color='#0a0c1c' stop-opacity='0.95'/></linearGradient></defs>
      <rect width='200' height='150' rx='12' fill='url(#g)'/>
      <text x='100' y='66' font-family='Arial' font-size='15' font-weight='bold' fill='white' text-anchor='middle'>${esc(wep)}</text>
      <text x='100' y='90' font-family='Arial' font-size='12' fill='rgba(255,255,255,0.85)' text-anchor='middle'>${esc(label)}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function esc(s) { return String(s).replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m])); }

  function index(list) {
    ALL = list;
    D.TIER_ORDER.forEach((r) => (byRarity[r] = []));
    list.forEach((s) => { (byRarity[s.rarity] = byRarity[s.rarity] || []).push(s); });
    Object.keys(casePools).forEach((k) => delete casePools[k]);
    Object.keys(caseScale).forEach((k) => delete caseScale[k]);
  }

  async function fetchJSON(url, timeout) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout || 9000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'force-cache' });
      clearTimeout(t);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { clearTimeout(t); return null; }
  }

  async function load() {
    let raw = null;
    const sources = (D.API_MIRRORS && D.API_MIRRORS.length) ? D.API_MIRRORS : [D.API_URL];
    for (const url of sources) {
      raw = await fetchJSON(url, 9000);
      if (Array.isArray(raw) && raw.length) break;
      raw = null;
    }

    let list;
    if (Array.isArray(raw) && raw.length) {
      const seen = new Set();
      list = [];
      for (const s of raw) {
        if (!s || !s.name || seen.has(s.name)) continue;
        seen.add(s.name);
        const rarity = D.normalizeRarity(s.rarity && s.rarity.name, s.category && s.category.name);
        const weapon = (s.weapon && s.weapon.name) || s.name.split('|')[0].trim();
        const skin = s.pattern && s.pattern.name ? s.pattern.name : (s.name.split('|')[1] || '').trim();
        list.push({
          id: s.id || s.name,
          name: s.name,
          weapon,
          skin: skin || s.name,
          rarity,
          color: D.RARITIES[rarity].color,
          image: s.image || null,
          price: D.priceFor(rarity, s.name, weapon, skin),
        });
      }
      D.mergeBudgetSkins(list);
    } else {
      list = D.buildFallback().map((s) => ({ ...s, price: D.priceFor(s.rarity, s.name, s.weapon, s.skin) }));
    }

    list.forEach((s) => { if (!s.image) s.image = placeholder(s); });
    index(list);
    ready = true;
    return list;
  }

  function isReady() { return ready; }
  function all() { return ALL; }

  function poolForCase(caseDef) {
    if (casePools[caseDef.id]) return casePools[caseDef.id];
    const pool = E().buildCasePool(caseDef, ALL);
    casePools[caseDef.id] = pool;
    const ev = E().caseExpectedDrop(caseDef, pool);
    const target = caseDef.price * E().CASE_RTP;
    caseScale[caseDef.id] = ev > caseDef.price * 0.05 ? target / ev : E().CASE_RTP;
    return pool;
  }

  function scaleForCase(caseDef) {
    poolForCase(caseDef);
    return caseScale[caseDef.id] || 1;
  }

  function featuredForCase(caseDef) {
    const pool = poolForCase(caseDef);
    const out = [];
    ['gold', 'covert', 'classified', 'restricted'].forEach((r) => {
      if (pool[r] && pool[r].length) out.push(pool[r][Math.floor(Math.random() * pool[r].length)]);
    });
    return out.slice(0, 3);
  }

  function contentsForCase(caseDef) {
    const pool = poolForCase(caseDef);
    const scale = scaleForCase(caseDef);
    const out = [];
    const limits = { gold: 5, covert: 7, classified: 8, restricted: 10, milspec: 12 };

    ['gold', 'covert', 'classified', 'restricted', 'milspec'].forEach((tier) => {
      const arr = pool[tier] || [];
      if (!arr.length) return;
      const skins = arr.slice(0, limits[tier] || 8);
      skins.forEach((s) => {
        D.WEARS.forEach((wear) => {
          let market = Math.max(1, Math.round(s.price * wear.mult));
          let price = E().sellPrice(market);
          if (scale !== 1) {
            market = Math.max(1, Math.round(market * scale));
            price = Math.max(1, Math.round(price * scale));
          }
          out.push({
            id: s.id + '-' + wear.short, name: s.name, weapon: s.weapon, skin: s.skin,
            rarity: s.rarity, color: s.color, image: s.image,
            wear: wear.short, wearName: wear.name, wearNameRu: wear.nameRu,
            price, marketPrice: market, dropTier: tier,
          });
        });
      });
    });
    return out.sort((a, b) => a.price - b.price);
  }

  function expectedDrop(caseDef) {
    return Math.round(E().caseExpectedDrop(caseDef, poolForCase(caseDef)) * scaleForCase(caseDef));
  }

  function rollFromCase(caseDef) {
    const pool = poolForCase(caseDef);
    const r = pickRarity();
    let arr = pool[r];
    if (!arr || !arr.length) {
      const [lo, hi] = E().tierPriceRange(caseDef.price, r);
      const fill = E().TIER_FILL[r] || [r];
      arr = ALL.filter((s) => fill.includes(s.rarity) && s.price >= lo && s.price <= hi);
      if (!arr.length) arr = ALL.filter((s) => s.rarity !== 'gold' && s.price >= lo && s.price <= hi);
      if (!arr.length && pool.milspec && pool.milspec.length) arr = pool.milspec;
    }
    const base = E().pickSkin(arr, r) || arr[0];
    const item = decorate(base, r);
    const scale = scaleForCase(caseDef);
    if (scale !== 1) {
      item.price = Math.max(1, Math.round(item.price * scale));
      item.marketPrice = Math.max(1, Math.round(item.marketPrice * scale));
    }
    return item;
  }

  function pickRarity() {
    const x = Math.random();
    let acc = 0;
    for (const o of D.CASE_ODDS) { acc += o.p; if (x <= acc) return o.rarity; }
    return 'milspec';
  }

  function decorateForCase(skin, rarityHint, caseDef) {
    const item = decorate(skin, rarityHint);
    const scale = scaleForCase(caseDef);
    if (scale !== 1) {
      item.price = Math.max(1, Math.round(item.price * scale));
      item.marketPrice = Math.max(1, Math.round(item.marketPrice * scale));
    }
    return item;
  }

  function decorate(skin, rarityHint) {
    const r = rarityHint || skin.rarity;
    const wear = E().pickWear(r);
    const market = Math.max(1, Math.round(skin.price * wear.mult));
    const price = E().sellPrice(market); // цена в инвентаре = после комиссии при продаже
    return {
      id: skin.id, name: skin.name, weapon: skin.weapon, skin: skin.skin,
      rarity: skin.rarity, color: skin.color, image: skin.image,
      wear: wear.short, wearName: wear.name, wearNameRu: wear.nameRu,
      price, marketPrice: market,
    };
  }

  function skinsNearPrice(price, count, tolerance) {
    const tol = tolerance || 0.45;
    const lo = price * (1 - tol), hi = price * (1 + tol);
    let candidates = ALL.filter((s) => s.price >= lo && s.price <= hi);
    if (candidates.length < count) candidates = ALL.slice().sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
    return shuffle(candidates).slice(0, count).map((s) => decorate(s));
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomDrop() {
    const s = ALL[Math.floor(Math.random() * ALL.length)];
    return decorate(s);
  }

  return {
    load, isReady, all, poolForCase, contentsForCase, featuredForCase, rollFromCase,
    decorate, skinsNearPrice, randomDrop, placeholder, shuffle, expectedDrop,
    byRarity: () => byRarity,
  };
})();
