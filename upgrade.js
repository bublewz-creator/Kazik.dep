/* ============ NEONDROP — upgrade ============ */
window.UPGRADE = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE, E = window.ECONOMY;
  const C = 603.2;
  const TARGET_COUNT = 24;

  let sources = [];
  let target = null;
  let mult = 2;
  let balanceBet = 0;
  let mode = 'mult';       // mult | chance | pick
  let chancePreset = 0.35;
  let busy = false;
  let targetList = [];

  function skinValue() {
    return sources.reduce((a, uid) => {
      const it = St.findItem(uid);
      return a + (it ? it.price : 0);
    }, 0);
  }

  function srcValue() { return skinValue() + balanceBet; }

  function hasStake() { return srcValue() > 0; }

  function idealTargetPrice() {
    const sv = srcValue();
    if (!sv) return 0;
    if (mode === 'chance') {
      const ch = Math.min(chancePreset, E.UPGRADE_MAX_CHANCE);
      return Math.round(sv * E.UPGRADE_HOUSE / ch);
    }
    return Math.round(sv * mult);
  }

  function sameTarget(a, b) {
    return a && b && a.id === b.id && a.price === b.price && a.wear === b.wear;
  }

  function pickClosest(list, price) {
    if (!list.length) return null;
    return list.reduce((best, it) => (
      Math.abs(it.price - price) < Math.abs(best.price - price) ? it : best
    ));
  }

  function syncPresetUI() {
    document.querySelectorAll('#up-mult-switch button').forEach((b) => {
      b.classList.toggle('active', mode === 'mult' && +b.dataset.mult === mult);
    });
    document.querySelectorAll('#up-chance-presets button').forEach((b) => {
      b.classList.toggle('active', mode === 'chance' && +b.dataset.chance === chancePreset);
    });
  }

  function syncBalanceUI() {
    const max = Math.floor(St.getBalance());
    const range = document.getElementById('up-balance-range');
    range.max = max;
    if (balanceBet > max) balanceBet = max;
    range.value = balanceBet;
    document.getElementById('up-bal-val').textContent = FX.fmt(balanceBet);
    document.getElementById('up-bal-max').textContent = FX.fmt(max);
  }

  function requireStake() {
    if (hasStake()) return true;
    FX.toast('Сначала выбери скин или добавь баланс', 'bad');
    return false;
  }

  function setMult(m) {
    if (!requireStake()) return;
    mode = 'mult';
    mult = m;
    target = null;
    syncPresetUI();
    refreshTargets();
    autoSelectTarget();
    recompute();
  }

  function setChancePreset(ch) {
    if (!requireStake()) return;
    mode = 'chance';
    chancePreset = ch;
    target = null;
    syncPresetUI();
    refreshTargets();
    autoSelectTarget();
    recompute();
  }

  function init() {
    const svg = document.getElementById('up-wheel');
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `<linearGradient id="upGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00e0c6"/><stop offset="1" stop-color="#6c5cff"/></linearGradient>`;
    svg.insertBefore(defs, svg.firstChild);

    document.getElementById('up-balance-range').addEventListener('input', (e) => {
      balanceBet = +e.target.value;
      document.getElementById('up-bal-val').textContent = FX.fmt(balanceBet);
      if (!hasStake()) { target = null; refreshTargets(); renderSlots(); recompute(); return; }
      onStakeChange();
    });

    document.querySelectorAll('#up-mult-switch button').forEach((b) => {
      b.addEventListener('click', () => setMult(+b.dataset.mult));
    });

    document.querySelectorAll('#up-chance-presets button').forEach((b) => {
      b.addEventListener('click', () => setChancePreset(+b.dataset.chance));
    });

    document.getElementById('up-shuffle').addEventListener('click', () => {
      if (!requireStake()) return;
      refreshTargets(true);
      autoSelectTarget(true);
      recompute();
    });

    document.getElementById('upgrade-btn').addEventListener('click', run);
    St.on('balance', () => { syncBalanceUI(); if (hasStake()) { refreshTargets(); if (mode !== 'pick') autoSelectTarget(); recompute(); } });
    syncPresetUI();
  }

  function onShow() {
    sources = sources.filter((uid) => St.findItem(uid));
    if (!hasStake()) target = null;
    syncBalanceUI();
    renderInventory();
    refreshTargets();
    if (hasStake() && mode !== 'pick') autoSelectTarget();
    renderSlots();
    recompute();
  }

  function renderInventory() {
    const grid = document.getElementById('up-inventory');
    const inv = St.getInventory();
    document.getElementById('up-inv-count').textContent = inv.length + ' шт.';
    if (!inv.length) {
      grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Инвентарь пуст — открой кейс.</div>`;
      return;
    }
    grid.innerHTML = inv.map((it) => FX.itemCardHTML(it, {
      selected: sources.includes(it.uid),
      attrs: `data-uid="${it.uid}"`,
    })).join('');
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => toggleSource(el.dataset.uid)));
  }

  function onStakeChange() {
    if (mode === 'pick') {
      mode = 'mult';
      target = null;
      syncPresetUI();
    } else {
      target = null;
    }
    refreshTargets();
    autoSelectTarget();
    recompute();
  }

  function toggleSource(uid) {
    const i = sources.indexOf(uid);
    if (i >= 0) sources.splice(i, 1);
    else sources.push(uid);

    if (!hasStake()) {
      target = null;
      renderInventory();
      refreshTargets();
      renderSlots();
      recompute();
      return;
    }

    renderInventory();
    onStakeChange();
  }

  function refreshTargets(shuffle) {
    const grid = document.getElementById('up-targets');
    const hint = document.getElementById('up-target-hint');
    const sv = srcValue();
    const ideal = idealTargetPrice();

    if (!sv || !ideal) {
      targetList = [];
      grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Выбери скин слева или добавь баланс — затем x2 / x4 / x8</div>`;
      hint.textContent = 'выбери ставку';
      return;
    }

    targetList = S.upgradePool(ideal, TARGET_COUNT, !!shuffle);
    if (!targetList.length) {
      grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Нет подходящих целей для этой ставки</div>`;
      hint.textContent = 'нет целей';
      return;
    }

    const lo = targetList[0].price;
    const hi = targetList[targetList.length - 1].price;
    const modeLabel = mode === 'chance'
      ? `шанс ${Math.round(chancePreset * 100)}%`
      : `x${mult}`;
    hint.textContent = `${modeLabel} · ~${FX.fmt(ideal)}${FX.CUR} · ${FX.fmt(lo)}–${FX.fmt(hi)}${FX.CUR}`;

    grid.innerHTML = targetList.map((it, idx) => FX.itemCardHTML(it, {
      selected: sameTarget(target, it),
      attrs: `data-idx="${idx}"`,
    })).join('');

    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => {
      target = targetList[+el.dataset.idx];
      mode = 'pick';
      syncPresetUI();
      renderSlots();
      recompute();
      grid.querySelectorAll('.item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
    }));
  }

  function autoSelectTarget(randomPick) {
    if (!targetList.length) { target = null; return; }
    const ideal = idealTargetPrice();
    if (randomPick) {
      target = targetList[Math.floor(Math.random() * targetList.length)];
    } else {
      target = pickClosest(targetList, ideal);
    }
    const grid = document.getElementById('up-targets');
    grid.querySelectorAll('.item').forEach((el) => {
      el.classList.toggle('selected', sameTarget(target, targetList[+el.dataset.idx]));
    });
    renderSlots();
  }

  function renderSlots() {
    const src = document.getElementById('up-source-slot');
    const tgt = document.getElementById('up-target-slot');
    const sv = srcValue();

    if (!sv) {
      src.innerHTML = `<div class="slot-empty">Выбери предмет из инвентаря или добавь баланс</div>`;
    } else {
      const items = sources.map((uid) => St.findItem(uid)).filter(Boolean);
      let html = items.map((it) => FX.itemCardHTML(it)).join('');
      if (balanceBet > 0) html += `<div class="up-bal-chip">+${FX.fmt(balanceBet)}${FX.CUR} баланс</div>`;
      if (!items.length && balanceBet > 0) {
        html = `<div class="up-bal-chip up-bal-only">${FX.fmt(balanceBet)}${FX.CUR} с баланса</div>`;
      }
      src.innerHTML = html;
    }

    tgt.innerHTML = target
      ? FX.itemCardHTML(target)
      : `<div class="slot-empty">Нажми x2 / x4 / x8 или выбери цель</div>`;
  }

  function chance() {
    const sv = srcValue();
    if (!sv || !target || !target.price) return 0;
    return E.upgradeChance(sv, target.price);
  }

  function btnLabel() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M7 14l5-5 5 5M7 10l5-5 5 5"/></svg> `;
  }

  function recompute() {
    const ch = chance();
    const sv = srcValue();
    const pct = Math.round(ch * 100);
    const realMult = (sv && target) ? target.price / sv : 0;

    document.getElementById('up-chance').textContent = ch ? pct + '%' : '—';
    document.getElementById('up-mult').textContent = (sv && target)
      ? 'x' + realMult.toFixed(2) + ` · ${FX.fmt(target.price)}${FX.CUR}`
      : (hasStake() ? `ставка ${FX.fmt(sv)}${FX.CUR}` : 'x0.00');

    document.getElementById('up-progress').style.strokeDashoffset = C * (1 - ch);

    const btn = document.getElementById('upgrade-btn');
    const minTarget = sv * 1.02;
    const targetOk = target && target.price >= minTarget;
    const ok = sv > 0 && targetOk && ch > 0 && !busy;

    btn.disabled = !ok;
    if (ok) btn.innerHTML = btnLabel() + `Прокачать (${pct}%)`;
    else if (!sv) btn.innerHTML = btnLabel() + 'Выбери ставку';
    else if (!target) btn.innerHTML = btnLabel() + 'Выбери цель';
    else if (!targetOk) btn.innerHTML = btnLabel() + 'Цель слишком дешёвая';
    else btn.innerHTML = btnLabel() + 'Прокачать';
  }

  function run() {
    if (busy) return;
    const sv = srcValue();
    const ch = chance();
    if (!ch || !target || target.price < sv * 1.02) return;

    busy = true;
    document.getElementById('upgrade-btn').disabled = true;
    FX.sound.open();

    const needle = document.getElementById('up-needle');
    needle.style.display = 'block';
    needle.style.transition = 'none';
    needle.style.transform = 'translate(-50%,-100%) rotate(0deg)';
    void needle.offsetWidth;

    const win = Math.random() < ch;
    const winDeg = ch * 360;
    const landing = win
      ? Math.random() * Math.max(2, winDeg - 4) + 2
      : winDeg + 2 + Math.random() * Math.max(2, 360 - winDeg - 4);
    const final = 360 * 6 + landing;

    let ticks = 26;
    const tick = () => { if (ticks-- > 0) { FX.sound.tick(); setTimeout(tick, 70 + (26 - ticks) * 6); } };
    tick();

    needle.style.transition = 'transform 3.6s cubic-bezier(0.1, 0.8, 0.15, 1)';
    requestAnimationFrame(() => { needle.style.transform = `translate(-50%,-100%) rotate(${final}deg)`; });

    setTimeout(() => settle(win), 3700);
  }

  function settle(win) {
    St.bumpStat('upgrades', 1);
    const removed = St.removeMany(sources);
    if (balanceBet > 0) St.spend(balanceBet);

    if (win) {
      const prize = {
        id: target.id, name: target.name, weapon: target.weapon, skin: target.skin,
        rarity: target.rarity, color: target.color, image: target.image,
        wear: target.wear, wearName: target.wearName, price: target.price,
      };
      St.addItem(prize);
      const tier = (D.RARITIES[prize.rarity] || {}).tier || 0;
      FX.confetti(tier >= 5 ? 180 : 110, [prize.color, '#fff', '#00e0c6']);
      FX.sound.jackpot();
      FX.toast(`Апгрейд удался! +${prize.skin} (${FX.fmt(prize.price)}${FX.CUR})`, 'good');
    } else {
      FX.sound.lose();
      FX.toast(`Апгрейд провалился. Ставка сгорела.`, 'bad');
    }

    sources = [];
    target = null;
    balanceBet = 0;
    mode = 'mult';
    mult = 2;
    busy = false;
    document.getElementById('up-needle').style.display = 'none';
    syncPresetUI();
    onShow();
  }

  return { init, onShow };
})();
