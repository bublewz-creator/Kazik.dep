/* ============ NEONDROP — economy & house edge ============ */
window.ECONOMY = (function () {
  // Средний возврат с кейса (RTP). 0.88 = казино забирает ~12% в долгую.
  const CASE_RTP = 0.88;

  // Апгрейд: шанс = (ставка / цель) × HOUSE, но не выше MAX_CHANCE.
  const UPGRADE_HOUSE = 0.78;
  const UPGRADE_MAX_CHANCE = 0.62;

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
    milspec:    [0.32, 0.92],
    restricted: [0.68, 1.28],
    classified: [1.35, 2.85],
    covert:     [3.5,  11.5],
    gold:       [12,   72],
  };

  // Степень «тяги» к дешёвым скинам внутри редкости (выше = чаще дешёвое).
  const TIER_CHEAP_BIAS = {
    milspec: 2.8, restricted: 2.2, classified: 1.6, covert: 1.2, gold: 1.0,
  };

  function tierPriceRange(casePrice, rarity) {
    const b = TIER_BAND[rarity] || TIER_BAND.milspec;
    return [Math.round(casePrice * b[0]), Math.round(casePrice * b[1])];
  }

  /** Построить пул скинов для кейса — только в допустимых ценовых коридорах. */
  function buildCasePool(caseDef, allSkins) {
    const pool = {};
    const D = window.DATA;
    D.TIER_ORDER.forEach((r) => (pool[r] = []));
    D.CASE_ODDS.forEach(({ rarity }) => {
      const [lo, hi] = tierPriceRange(caseDef.price, rarity);
      pool[rarity] = allSkins.filter((s) => s.rarity === rarity && s.price >= lo && s.price <= hi);
      // если мало — расширяем на ±15%, но не берём «легендарки» в мilspec
      if (pool[rarity].length < 4) {
        const pad = Math.round(caseDef.price * 0.15);
        pool[rarity] = allSkins.filter((s) =>
          s.rarity === rarity && s.price >= lo - pad && s.price <= hi + pad
        );
      }
      // последний фолбэк: ближайшие к середине коридора, но строго в пределах ±10%
      if (!pool[rarity].length) {
        const mid = (lo + hi) / 2;
        const capLo = Math.round(lo * 0.9);
        const capHi = Math.round(hi * 1.1);
        pool[rarity] = allSkins
          .filter((s) => s.rarity === rarity && s.price >= capLo && s.price <= capHi)
          .sort((a, b) => Math.abs(a.price - mid) - Math.abs(b.price - mid))
          .slice(0, 16);
      }
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
    tierPriceRange, buildCasePool, pickSkin, pickWear,
    upgradeChance, upgradeEV, contractTargetSum, sellPrice,
    caseExpectedDrop, canTopUp, recordTopUp,
  };
})();
