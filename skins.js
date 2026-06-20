/* ============ NEONDROP — skins repository ============ */
window.SKINS = (function () {
  const D = window.DATA;
  let ALL = [];                 // all skins with computed price + image
  const byRarity = {};          // rarity -> [skins]
  let ready = false;

  // ----- placeholder image (SVG data URI) when no real image available -----
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
          price: D.priceFor(rarity, s.name),
        });
      }
    } else {
      list = D.buildFallback().map((s) => ({ ...s, price: D.priceFor(s.rarity, s.name) }));
    }

    // ensure every skin has an image
    list.forEach((s) => { if (!s.image) s.image = placeholder(s); });
    index(list);
    ready = true;
    return list;
  }

  function isReady() { return ready; }
  function all() { return ALL; }

  // pool for a case = skins within its value band, grouped by rarity
  function poolForCase(caseDef) {
    const [lo, hi] = caseDef.band;
    const pool = {};
    D.TIER_ORDER.forEach((r) => (pool[r] = []));
    ALL.forEach((s) => { if (s.price >= lo && s.price <= hi) pool[s.rarity].push(s); });
    // guarantee non-empty rarities used by odds: borrow nearest if empty
    D.CASE_ODDS.forEach(({ rarity }) => {
      if (!pool[rarity].length) {
        const sorted = [...ALL].filter((s) => s.rarity === rarity).sort((a, b) => Math.abs(a.price - hi) - Math.abs(b.price - hi));
        pool[rarity] = sorted.slice(0, 12);
      }
    });
    return pool;
  }

  // top skins to showcase on a case card
  function featuredForCase(caseDef) {
    const pool = poolForCase(caseDef);
    const out = [];
    ['gold', 'covert', 'classified', 'restricted'].forEach((r) => {
      if (pool[r] && pool[r].length) out.push(pool[r][Math.floor(Math.random() * pool[r].length)]);
    });
    return out.slice(0, 3);
  }

  // representative contents list for display (a few per rarity)
  function contentsForCase(caseDef) {
    const pool = poolForCase(caseDef);
    const out = [];
    ['gold', 'covert', 'classified', 'restricted', 'milspec'].forEach((r) => {
      const arr = shuffle([...pool[r]]).slice(0, r === 'gold' ? 3 : r === 'covert' ? 4 : 6);
      arr.forEach((s) => out.push(s));
    });
    return out;
  }

  // weighted rarity roll, then random skin of that rarity
  function rollFromCase(caseDef) {
    const pool = poolForCase(caseDef);
    const r = pickRarity();
    let arr = pool[r];
    if (!arr || !arr.length) arr = pool.milspec.length ? pool.milspec : ALL;
    const base = arr[Math.floor(Math.random() * arr.length)];
    return decorate(base);
  }

  function pickRarity() {
    const x = Math.random();
    let acc = 0;
    for (const o of D.CASE_ODDS) { acc += o.p; if (x <= acc) return o.rarity; }
    return 'milspec';
  }

  // attach a random wear + final price (instance of a skin)
  function decorate(skin) {
    const wear = D.WEARS[Math.floor(Math.random() * D.WEARS.length)];
    const price = Math.max(1, Math.round(skin.price * wear.mult));
    return {
      id: skin.id, name: skin.name, weapon: skin.weapon, skin: skin.skin,
      rarity: skin.rarity, color: skin.color, image: skin.image,
      wear: wear.short, wearName: wear.name, price,
    };
  }

  // pick N random skins near a target price (for upgrade targets)
  function skinsNearPrice(price, count, tolerance) {
    const tol = tolerance || 0.6;
    const lo = price * (1 - tol), hi = price * (1 + tol * 2);
    let candidates = ALL.filter((s) => s.price >= lo && s.price <= hi);
    if (candidates.length < count) candidates = ALL;
    return shuffle(candidates).slice(0, count).map(decorate);
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
    decorate, skinsNearPrice, randomDrop, placeholder, shuffle,
    byRarity: () => byRarity,
  };
})();
