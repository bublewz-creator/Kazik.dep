/* ============ NEONDROP — upgrade ============ */
window.UPGRADE = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE, E = window.ECONOMY;
  const C = 603.2;        // circle circumference (r=96)
  let sources = [];       // uids
  let target = null;      // decorated skin instance
  let mult = 2;
  let balanceBet = 0;
  let chancePreset = null;
  let busy = false;

  function skinValue() {
    return sources.reduce((a, uid) => { const it = St.findItem(uid); return a + (it ? it.price : 0); }, 0);
  }

  function srcValue() { return skinValue() + balanceBet; }

  function targetBasePrice() {
    const sv = srcValue();
    if (chancePreset && sv > 0) return (sv * E.UPGRADE_HOUSE) / chancePreset;
    return sv > 0 ? sv * mult : 100 * mult;
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

  function setMult(m) {
    mult = m;
    chancePreset = null;
    document.querySelectorAll('#up-mult-switch button').forEach((b) => b.classList.toggle('active', +b.dataset.mult === m));
    document.querySelectorAll('#up-chance-presets button').forEach((b) => b.classList.remove('active'));
    refreshTargets();
    recompute();
  }

  function setChancePreset(ch) {
    chancePreset = ch;
    document.querySelectorAll('#up-chance-presets button').forEach((b) => b.classList.toggle('active', +b.dataset.chance === ch));
    document.querySelectorAll('#up-mult-switch button').forEach((b) => b.classList.remove('active'));
    refreshTargets();
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
      refreshTargets();
      recompute();
    });

    document.querySelectorAll('#up-mult-switch button').forEach((b) => {
      b.addEventListener('click', () => setMult(+b.dataset.mult));
    });

    document.querySelectorAll('#up-chance-presets button').forEach((b) => {
      b.addEventListener('click', () => setChancePreset(+b.dataset.chance));
    });

    document.getElementById('up-shuffle').addEventListener('click', () => refreshTargets(true));
    document.getElementById('upgrade-btn').addEventListener('click', run);
    St.on('balance', () => { syncBalanceUI(); refreshTargets(); recompute(); });
  }

  function onShow() {
    sources = sources.filter((uid) => St.findItem(uid));
    if (!St.findItem(target && target._sourceUid)) target = null;
    syncBalanceUI();
    renderInventory();
    refreshTargets();
    renderSlots();
    recompute();
  }

  function renderInventory() {
    const grid = document.getElementById('up-inventory');
    const inv = St.getInventory();
    document.getElementById('up-inv-count').textContent = inv.length + ' шт.';
    if (!inv.length) { grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Инвентарь пуст — открой кейс.</div>`; return; }
    grid.innerHTML = inv.map((it) => FX.itemCardHTML(it, { selected: sources.includes(it.uid), attrs: `data-uid="${it.uid}"` })).join('');
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => toggleSource(el.dataset.uid)));
  }

  function toggleSource(uid) {
    const i = sources.indexOf(uid);
    if (i >= 0) sources.splice(i, 1); else sources.push(uid);
    renderInventory(); renderSlots(); refreshTargets(); recompute();
  }

  function refreshTargets(shuffle) {
    const grid = document.getElementById('up-targets');
    const base = targetBasePrice();
    let list = S.skinsNearPrice(base, 12, 0.45, shuffle);
    list.sort((a, b) => a.price - b.price);
    grid.innerHTML = list.map((it, idx) => FX.itemCardHTML(it, { selected: target && target.id === it.id && target.price === it.price, attrs: `data-idx="${idx}"` })).join('');
    grid._list = list;
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => {
      target = grid._list[+el.dataset.idx];
      target._sourceUid = sources[0];
      chancePreset = null;
      document.querySelectorAll('#up-chance-presets button').forEach((b) => b.classList.remove('active'));
      renderSlots(); recompute();
      grid.querySelectorAll('.item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
    }));
  }

  function renderSlots() {
    const src = document.getElementById('up-source-slot');
    const tgt = document.getElementById('up-target-slot');
    if (!sources.length && !balanceBet) src.innerHTML = `<div class="slot-empty">Выбери предмет(ы) из инвентаря или добавь баланс</div>`;
    else {
      const items = sources.map((uid) => St.findItem(uid)).filter(Boolean);
      let html = items.map((it) => FX.itemCardHTML(it)).join('');
      if (balanceBet > 0) {
        html += `<div class="up-bal-chip">+${FX.fmt(balanceBet)}${FX.CUR} баланс</div>`;
      }
      src.innerHTML = html;
    }
    tgt.innerHTML = target ? FX.itemCardHTML(target) : `<div class="slot-empty">Выбери цель справа</div>`;
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
    const ev = Math.round(E.upgradeEV(sv, target ? target.price : 0));
    document.getElementById('up-chance').textContent = ch ? pct + '%' : '—';
    document.getElementById('up-mult').textContent = (sv && target) ? 'x' + (target.price / sv).toFixed(2) + (ev ? ` · EV≈${FX.fmt(ev)}${FX.CUR}` : '') : 'x0.00';
    document.getElementById('up-progress').style.strokeDashoffset = C * (1 - ch);
    const btn = document.getElementById('upgrade-btn');
    const minTarget = sv * 1.05;
    const targetOk = target && target.price >= minTarget;
    const ok = sv > 0 && targetOk && !busy;
    btn.disabled = !ok;
    if (ok) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M7 14l5-5 5 5M7 10l5-5 5 5"/></svg> Прокачать (${pct}%)`;
    else if (target && !targetOk) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M7 14l5-5 5 5M7 10l5-5 5 5"/></svg> Цель должна быть дороже`;
    else if (sv > 0) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M7 14l5-5 5 5M7 10l5-5 5 5"/></svg> Выбери цель`;
    else btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M7 14l5-5 5 5M7 10l5-5 5 5"/></svg> Выбери предметы`;
    renderSlots();
  }

  function run() {
    if (busy) return;
    const sv = srcValue();
    const ch = chance();
    if (!ch || !target || target.price < sv * 1.05) return;
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
    let landing = win
      ? Math.random() * Math.max(2, winDeg - 4) + 2
      : winDeg + 2 + Math.random() * Math.max(2, 360 - winDeg - 4);
    const final = 360 * 6 + landing;

    let ticks = 26; const tick = () => { if (ticks-- > 0) { FX.sound.tick(); setTimeout(tick, 70 + (26 - ticks) * 6); } }; tick();

    needle.style.transition = 'transform 3.6s cubic-bezier(0.1, 0.8, 0.15, 1)';
    requestAnimationFrame(() => { needle.style.transform = `translate(-50%,-100%) rotate(${final}deg)`; });

    setTimeout(() => settle(win), 3700);
  }

  function settle(win) {
    St.bumpStat('upgrades', 1);
    const removed = St.removeMany(sources);
    if (balanceBet > 0) St.spend(balanceBet);
    if (win) {
      const prize = { id: target.id, name: target.name, weapon: target.weapon, skin: target.skin, rarity: target.rarity, color: target.color, image: target.image, wear: target.wear, wearName: target.wearName, price: target.price };
      St.addItem(prize);
      const tier = (D.RARITIES[prize.rarity] || {}).tier || 0;
      FX.confetti(tier >= 5 ? 180 : 110, [prize.color, '#fff', '#00e0c6']);
      FX.sound.jackpot();
      FX.toast(`Апгрейд удался! +${prize.skin} (${FX.fmt(prize.price)}${FX.CUR})`, 'good');
    } else {
      FX.sound.lose();
      const lost = removed.length + (balanceBet > 0 ? 1 : 0);
      FX.toast(`Апгрейд провалился. Потеряно ${lost > 1 ? lost + ' ставок' : 'ставка'}.`, 'bad');
    }
    sources = [];
    target = null;
    balanceBet = 0;
    chancePreset = null;
    busy = false;
    document.getElementById('up-needle').style.display = 'none';
    document.querySelectorAll('#up-chance-presets button').forEach((b) => b.classList.remove('active'));
    onShow();
  }

  return { init, onShow };
})();
