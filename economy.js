/* ============ NEONDROP — economy & house edge ============ */
window.ECONOMY = (function () {
  // Средний возврат с кейса (RTP). 0.88 = казино забирает ~12% в долгую.
  const CASE_RTP = 0.88;

  // Апгрейд: шанс = (ставка / цель) × HOUSE, но не выше MAX_CHANCE.
  const UPGRADE_HOUSE = 0.78;
  const UPGRADE_MAX_CHANCE = 0.75;

  // Контракт: результат 62–88% от суммы вложенных скинов (среднее ~75%).
  const CONTRACT_MIN = 0.62;
  const CONTRACT_MAX = 0.88;

  // Продажа скина — 96% от номинала (комиссия площадки).
  const SELL_RATE = 0.96;

  // Демо-пополнение: не бесконечный кран.
  const TOPUP_AMOUNT = 2000;
  const TOPUP_COOLDOWN_MS = 60 * 60 * 1000; // 1 час
  const TOPUP_DAILY_MAX = 4;

  // Диапазоны цены дропа относительно цены кейса (FT, до износа).
  const TIER_BAND = {
    milspec:    [0.08, 0.88],
    restricted: [0.55, 1.35],
    classified: [1.15, 3.2],
    covert:     [3.0,  12],
    gold:       [10,   80],
  };

  // Какие редкости могут попасть в пул каждого тира (по цене).
  const TIER_FILL = {
    milspec:    ['consumer', 'industrial', 'milspec'],
    restricted: ['consumer', 'industrial', 'milspec', 'restricted'],
    classified: ['milspec', 'restricted', 'classified'],
    covert:     ['restricted', 'classified', 'covert'],
    gold:       ['covert', 'gold'],
  };

  const MIN_POOL_SIZE = 12;

  // Степень «тяги» к дешёвым скинам внутри редкости (выше = чаще дешёвое).
  const TIER_CHEAP_BIAS = {
    milspec: 2.8, restricted: 2.2, classified: 1.6, covert: 1.2, gold: 1.0,
  };

  function tierPriceRange(casePrice, rarity) {
    const b = TIER_BAND[rarity] || TIER_BAND.milspec;
    return [Math.round(casePrice * b[0]), Math.round(casePrice * b[1])];
  }

  /** Построить пул скинов для кейса — по ценовому коридору + несколько редкостей. */
  function buildCasePool(caseDef, allSkins) {
    const pool = {};
    const D = window.DATA;
    D.TIER_ORDER.forEach((r) => (pool[r] = []));
    D.CASE_ODDS.forEach(({ rarity }) => {
      const [lo0, hi0] = tierPriceRange(caseDef.price, rarity);
      const fill = TIER_FILL[rarity] || [rarity];
      let lo = lo0, hi = hi0;
      let arr = [];

      for (let pass = 0; pass < 4 && arr.length < MIN_POOL_SIZE; pass++) {
        const pad = Math.round(caseDef.price * (0.12 * pass));
        lo = Math.max(8, lo0 - pad);
        hi = hi0 + pad;
        arr = allSkins.filter((s) => fill.includes(s.rarity) && s.price >= lo && s.price <= hi);
      }

      // ещё расширяем: любой скин (кроме ★) по цене, если всё ещё мало
      if (arr.length < MIN_POOL_SIZE && rarity !== 'gold') {
        const pad = Math.round(caseDef.price * 0.35);
        arr = allSkins.filter((s) =>
          s.rarity !== 'gold' && s.price >= lo0 - pad && s.price <= hi0 + pad
        );
      }

      // ★ только ножи/перчатки
      if (arr.length < 4 && rarity === 'gold') {
        arr = allSkins.filter((s) => s.rarity === 'gold' && s.price >= lo && s.price <= hi * 1.25);
      }

      // дедуп по id, сортировка: дешёвые первыми (для разнообразия в UI)
      const seen = new Set();
      pool[rarity] = arr
        .filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
        .sort((a, b) => a.price - b.price);
    });
    return pool;
  }

  /** Взвешенный выбор — дешёвые скины внутри редкости выпадают чаще. */
  function pickSkin(poolArr, rarity) {
    if (!poolArr || !poolArr.length) return null;
    const pow = TIER_CHEAP_BIAS[rarity] || 1.5;
    const weights = poolArr.map((s) => Math.pow(1 / Math.max(s.price, 1), pow));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < poolArr.length; i++) {
      r -= weights[i];
      if (r <= 0) return poolArr[i];
    }
    return poolArr[poolArr.length - 1];
  }

  /** Износ: в мilspec/restricted чаще BS/WW — снижает реальный возврат. */
  function pickWear(rarity) {
    const D = window.DATA.WEARS;
    const cheap = D.filter((w) => w.short === 'BS' || w.short === 'WW' || w.short === 'FT');
    const nice = D.filter((w) => w.short === 'MW' || w.short === 'FN');
    const roll = Math.random();
    if (rarity === 'gold' || rarity === 'covert') {
      return roll < 0.38 ? nice[Math.floor(Math.random() * nice.length)] : cheap[Math.floor(Math.random() * cheap.length)];
    }
    if (rarity === 'classified') {
      return roll < 0.28 ? nice[Math.floor(Math.random() * nice.length)] : cheap[Math.floor(Math.random() * cheap.length)];
    }
    return roll < 0.18 ? nice[Math.floor(Math.random() * nice.length)] : cheap[Math.floor(Math.random() * cheap.length)];
  }

  function upgradeChance(sourceValue, targetValue) {
    if (!sourceValue || !targetValue) return 0;
    return Math.max(0.01, Math.min(UPGRADE_MAX_CHANCE, (sourceValue / targetValue) * UPGRADE_HOUSE));
  }

  /** Цена цели для желаемого шанса (обратная формула). */
  function upgradeTargetPrice(sourceValue, desiredChance) {
    if (!sourceValue || !desiredChance) return 0;
    const ch = Math.min(UPGRADE_MAX_CHANCE, Math.max(0.02, desiredChance));
    return (sourceValue * UPGRADE_HOUSE) / ch;
  }

  /** Ожидаемая стоимость апгрейда для игрока (EV). */
  function upgradeEV(sourceValue, targetValue) {
    const ch = upgradeChance(sourceValue, targetValue);
    return ch * targetValue; // проигрыш = 0
  }

  function contractTargetSum(inputSum) {
    return inputSum * (CONTRACT_MIN + Math.random() * (CONTRACT_MAX - CONTRACT_MIN));
  }

  function sellPrice(marketPrice) {
    return Math.max(1, Math.round(marketPrice * SELL_RATE));
  }

  /** Аналитический средний дроп кейса (для UI) — с учётом весов, износа и комиссии. */
  function caseExpectedDrop(caseDef, pools) {
    const D = window.DATA;
    let ev = 0;
    D.CASE_ODDS.forEach(({ rarity, p }) => {
      const arr = pools[rarity] || [];
      if (!arr.length) return;
      const pow = TIER_CHEAP_BIAS[rarity] || 1.5;
      const weights = arr.map((s) => Math.pow(1 / Math.max(s.price, 1), pow));
      const wSum = weights.reduce((a, b) => a + b, 0);
      let avgBase = 0;
      arr.forEach((s, i) => { avgBase += s.price * (weights[i] / wSum); });
      const wearMult = (rarity === 'gold' || rarity === 'covert') ? 0.88 : (rarity === 'classified' ? 0.82 : 0.74);
      ev += p * sellPrice(Math.round(avgBase * wearMult));
    });
    return Math.round(ev);
  }

  function canTopUp(state) {
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    if (state.topUpDay !== dayStart) return { ok: true };
    if ((state.topUpCount || 0) >= TOPUP_DAILY_MAX) {
      return { ok: false, reason: `Лимит пополнений на сегодня (${TOPUP_DAILY_MAX})` };
    }
    const left = TOPUP_COOLDOWN_MS - (now - (state.lastTopUp || 0));
    if (state.lastTopUp && left > 0) {
      const m = Math.ceil(left / 60000);
      return { ok: false, reason: `Подожди ${m} мин до следующего пополнения` };
    }
    return { ok: true };
  }

  function recordTopUp(state) {
    const dayStart = new Date().setHours(0, 0, 0, 0);
    if (state.topUpDay !== dayStart) { state.topUpDay = dayStart; state.topUpCount = 0; }
    state.topUpCount = (state.topUpCount || 0) + 1;
    state.lastTopUp = Date.now();
  }

  return {
    CASE_RTP, UPGRADE_HOUSE, UPGRADE_MAX_CHANCE, CONTRACT_MIN, CONTRACT_MAX, SELL_RATE,
    TOPUP_AMOUNT, TOPUP_COOLDOWN_MS, TOPUP_DAILY_MAX,
    tierPriceRange, buildCasePool, pickSkin, pickWear, TIER_FILL,
    upgradeChance, upgradeEV, upgradeTargetPrice, contractTargetSum, sellPrice,
    caseExpectedDrop, canTopUp, recordTopUp,
  };
})();
