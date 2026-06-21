/* ============ NEONDROP — upgrade ============ */
window.UPGRADE = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE, E = window.ECONOMY;
  const C = 603.2;
  const TARGET_COUNT = 16;

  let sources = [];
  let target = null;
  let balanceBet = 0;
  let mult = 2;
  let chancePreset = null; // null = режим множителя
  let targetList = [];
  let busy = false;

  function skinValue() {
    return sources.reduce((a, uid) => {
      const it = St.findItem(uid);
      return a + (it ? it.price : 0);
    }, 0);
  }

  function srcValue() { return skinValue() + balanceBet; }

  function idealTargetPrice() {
    const sv = srcValue();
    if (!sv) return 0;
    if (chancePreset) return E.upgradeTargetPrice(sv, chancePreset);
    return sv * mult;
  }

  function syncBalanceUI() {
    const max = Math.floor(St.getBalance());
    const range = document.getElementById('up-balance-range');
    range.max = max;
    if (balanceBet > max) balanceBet = max;
    range.value = balanceBet;
    range.disabled = busy;
    document.getElementById('up-bal-val').textContent = FX.fmt(balanceBet);
    document.getElementById('up-bal-max').textContent = FX.fmt(max);
  }

  function syncPresetUI() {
    document.querySelectorAll('#up-mult-switch button').forEach((b) => {
      const on = !chancePreset && +b.dataset.mult === mult;
      b.classList.toggle('active', on);
      b.disabled = busy || !srcValue();
    });
    document.querySelectorAll('#up-chance-presets button').forEach((b) => {
      const on = chancePreset === +b.dataset.chance;
      b.classList.toggle('active', on);
      b.disabled = busy || !srcValue();
    });
    document.getElementById('up-shuffle').disabled = busy || !srcValue();
  }

  function needStake() {
    if (srcValue()) return false;
    FX.toast('Сначала выбери скин или добавь баланс', 'bad');
    return true;
  }

  function applyMult(m) {
    if (needStake()) return;
    mult = m;
    chancePreset = null;
    syncPresetUI();
    refreshTargets(false, true);
  }

  function applyChance(ch) {
    if (needStake()) return;
    chancePreset = ch;
    syncPresetUI();
    refreshTargets(false, true);
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
      syncPresetUI();
      refreshTargets(false, true);
    });

    document.querySelectorAll('#up-mult-switch button').forEach((b) => {
      b.addEventListener('click', () => applyMult(+b.dataset.mult));
    });

    document.querySelectorAll('#up-chance-presets button').forEach((b) => {
      b.addEventListener('click', () => applyChance(+b.dataset.chance));
    });

    document.getElementById('up-shuffle').addEventListener('click', () => {
      if (needStake()) return;
      refreshTargets(true, false);
    });

    document.getElementById('upgrade-btn').addEventListener('click', run);
    St.on('balance', () => { syncBalanceUI(); syncPresetUI(); refreshTargets(false, true); });
  }

  function onShow() {
    sources = sources.filter((uid) => St.findItem(uid));
    syncBalanceUI();
    renderInventory();
    refreshTargets(false, sources.length > 0 || balanceBet > 0);
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

  function toggleSource(uid) {
    const i = sources.indexOf(uid);
    if (i >= 0) sources.splice(i, 1);
    else sources.push(uid);
    renderInventory();
    syncPresetUI();
    refreshTargets(false, true);
  }

  function pickAutoTarget(ideal) {
    const sv = srcValue();
    const best = S.findUpgradeTarget(sv, ideal);
    if (best) return best;
    return targetList[0] || null;
  }

  function ensureTargetInList(item) {
    if (!item) return;
    if (targetList.some((t) => t.id === item.id)) return;
    targetList.unshift(item);
    if (targetList.length > TARGET_COUNT) targetList.pop();
    targetList.sort((a, b) => a.price - b.price);
  }

  function refreshTargets(shuffle, autoSelect) {
    const grid = document.getElementById('up-targets');
    const sv = srcValue();
    syncPresetUI();

    if (!sv) {
      target = null;
      targetList = [];
      grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Выбери скин слева — затем x2 / x4 / x8 или шанс</div>`;
      document.getElementById('up-target-hint').textContent = '';
      renderSlots();
      recompute();
      return;
    }

    const ideal = idealTargetPrice();
    targetList = S.upgradeTargets(sv, ideal, TARGET_COUNT, shuffle);

    if (autoSelect) {
      target = pickAutoTarget(ideal);
      ensureTargetInList(target);
    } else if (target && !targetList.some((t) => t.id === target.id && t.price === target.price)) {
      ensureTargetInList(target);
    }

    renderTargetGrid();
    document.getElementById('up-target-hint').textContent =
      `≈ ${FX.fmt(Math.round(ideal))}${FX.CUR}` + (chancePreset ? ` · шанс ~${Math.round(chancePreset * 100)}%` : ` · x${mult}`);
    renderSlots();
    recompute();
  }

  function renderTargetGrid() {
    const grid = document.getElementById('up-targets');
    if (!targetList.length) {
      grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Нет подходящих целей — попробуй другой множитель</div>`;
      return;
    }
    grid.innerHTML = targetList.map((it, idx) => FX.itemCardHTML(it, {
      selected: target && target.id === it.id && target.price === it.price,
      attrs: `data-idx="${idx}"`,
    })).join('');
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => {
      target = targetList[+el.dataset.idx];
      chancePreset = null;
      syncPresetUI();
      grid.querySelectorAll('.item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      renderSlots();
      recompute();
    }));
  }

  function renderSlots() {
    const src = document.getElementById('up-source-slot');
    const tgt = document.getElementById('up-target-slot');
    const sv = srcValue();

    if (!sv) {
      src.innerHTML = `<div class="slot-empty">Выбери предмет из инвентаря</div>`;
    } else {
      const items = sources.map((uid) => St.findItem(uid)).filter(Boolean);
      let html = items.map((it) => FX.itemCardHTML(it)).join('');
      if (balanceBet > 0) {
        html += `<div class="up-bal-chip">+${FX.fmt(balanceBet)}${FX.CUR} баланс</div>`;
      }
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

  function recompute() {
    const ch = chance();
    const sv = srcValue();
    const pct = Math.round(ch * 100);
    const realMult = (sv && target) ? target.price / sv : 0;

    document.getElementById('up-chance').textContent = ch ? pct + '%' : '—';
    document.getElementById('up-mult').textContent = (sv && target)
      ? `x${realMult.toFixed(2)} · ставка ${FX.fmt(sv)}${FX.CUR}`
      : (sv ? `ставка ${FX.fmt(sv)}${FX.CUR}` : 'x0.00');

    document.getElementById('up-progress').style.strokeDashoffset = C * (1 - ch);

    const btn = document.getElementById('upgrade-btn');
    const minTarget = sv * 1.01;
    const targetOk = target && target.price >= minTarget;
    const ok = sv > 0 && targetOk && !busy;

    btn.disabled = !ok;
    if (ok) {
      btn.innerHTML = btnIcon() + ` Прокачать (${pct}%)`;
    } else if (sv > 0 && !target) {
      btn.innerHTML = btnIcon() + ' Выбери цель';
    } else if (target && !targetOk) {
      btn.innerHTML = btnIcon() + ' Цель слишком дешёвая';
    } else {
      btn.innerHTML = btnIcon() + ' Выбери предметы';
    }
  }

  function btnIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M7 14l5-5 5 5M7 10l5-5 5 5"/></svg>`;
  }

  function run() {
    if (busy) return;
    const sv = srcValue();
    const ch = chance();
    if (!ch || !target || target.price < sv * 1.01) return;

    busy = true;
    document.getElementById('upgrade-btn').disabled = true;
    syncPresetUI();
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
    mult = 2;
    chancePreset = null;
    busy = false;
    document.getElementById('up-needle').style.display = 'none';
    onShow();
  }

  return { init, onShow };
})();
