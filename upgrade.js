/* ============ NEONDROP — upgrade ============ */
window.UPGRADE = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE;
  const HOUSE = 0.92;     // house edge factor
  const C = 603.2;        // circle circumference (r=96)
  let sources = [];       // uids
  let target = null;      // decorated skin instance
  let mult = 2.5;
  let busy = false;

  function init() {
    // inject gradient defs into wheel svg
    const svg = document.getElementById('up-wheel');
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `<linearGradient id="upGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00e0c6"/><stop offset="1" stop-color="#6c5cff"/></linearGradient>`;
    svg.insertBefore(defs, svg.firstChild);

    document.getElementById('up-target-range').addEventListener('input', (e) => {
      mult = 1.5 + (e.target.value / 100) * 13.5; // 1.5x .. 15x
      refreshTargets();
      recompute();
    });
    document.getElementById('upgrade-btn').addEventListener('click', run);
  }

  function onShow() {
    sources = sources.filter((uid) => St.findItem(uid));
    if (!St.findItem(target && target._sourceUid)) target = null;
    renderInventory();
    refreshTargets();
    renderSlots();
    recompute();
  }

  function srcValue() { return sources.reduce((a, uid) => { const it = St.findItem(uid); return a + (it ? it.price : 0); }, 0); }

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

  function refreshTargets() {
    const grid = document.getElementById('up-targets');
    const sv = srcValue();
    const base = sv > 0 ? sv * mult : 100 * mult;
    const list = S.skinsNearPrice(base, 12, 0.45);
    grid.innerHTML = list.map((it, idx) => FX.itemCardHTML(it, { selected: target && target.id === it.id && target.price === it.price, attrs: `data-idx="${idx}"` })).join('');
    grid._list = list;
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => {
      target = grid._list[+el.dataset.idx];
      target._sourceUid = sources[0];
      renderSlots(); recompute();
      grid.querySelectorAll('.item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
    }));
  }

  function renderSlots() {
    const src = document.getElementById('up-source-slot');
    const tgt = document.getElementById('up-target-slot');
    if (!sources.length) src.innerHTML = `<div class="slot-empty">Выбери предмет(ы) из инвентаря снизу</div>`;
    else {
      const items = sources.map((uid) => St.findItem(uid)).filter(Boolean);
      src.innerHTML = items.map((it) => FX.itemCardHTML(it)).join('');
    }
    tgt.innerHTML = target ? FX.itemCardHTML(target) : `<div class="slot-empty">Выбери цель справа</div>`;
  }

  function chance() {
    const sv = srcValue();
    if (!sv || !target || !target.price) return 0;
    return Math.max(0.02, Math.min(0.92, (sv / target.price) * HOUSE));
  }

  function recompute() {
    const ch = chance();
    const sv = srcValue();
    const pct = Math.round(ch * 100);
    document.getElementById('up-chance').textContent = ch ? pct + '%' : '—';
    document.getElementById('up-mult').textContent = (sv && target) ? 'x' + (target.price / sv).toFixed(2) : 'x0.00';
    document.getElementById('up-progress').style.strokeDashoffset = C * (1 - ch);
    const btn = document.getElementById('upgrade-btn');
    const ok = sv > 0 && target && !busy;
    btn.disabled = !ok;
    btn.textContent = ok ? `Апгрейд (${pct}%)` : (sources.length ? 'Выбери цель' : 'Выбери предметы');
  }

  function run() {
    if (busy) return;
    const ch = chance();
    if (!ch || !target) return;
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
    // land inside win arc (0..winDeg) if win, else in the rest
    let landing = win
      ? Math.random() * Math.max(2, winDeg - 4) + 2
      : winDeg + 2 + Math.random() * Math.max(2, 360 - winDeg - 4);
    const final = 360 * 6 + landing; // several spins

    // ticking
    let ticks = 26; const tick = () => { if (ticks-- > 0) { FX.sound.tick(); setTimeout(tick, 70 + (26 - ticks) * 6); } }; tick();

    needle.style.transition = 'transform 3.6s cubic-bezier(0.1, 0.8, 0.15, 1)';
    requestAnimationFrame(() => { needle.style.transform = `translate(-50%,-100%) rotate(${final}deg)`; });

    setTimeout(() => settle(win), 3700);
  }

  function settle(win) {
    St.bumpStat('upgrades', 1);
    const removed = St.removeMany(sources);
    if (win) {
      const prize = { id: target.id, name: target.name, weapon: target.weapon, skin: target.skin, rarity: target.rarity, color: target.color, image: target.image, wear: target.wear, wearName: target.wearName, price: target.price };
      St.addItem(prize);
      const tier = (D.RARITIES[prize.rarity] || {}).tier || 0;
      FX.confetti(tier >= 5 ? 180 : 110, [prize.color, '#fff', '#00e0c6']);
      FX.sound.jackpot();
      FX.toast(`Апгрейд удался! +${prize.skin} (${FX.fmt(prize.price)}${FX.CUR})`, 'good');
    } else {
      FX.sound.lose();
      FX.toast(`Апгрейд провалился. Потеряно ${removed.length} предмет(ов).`, 'bad');
    }
    sources = [];
    target = null;
    busy = false;
    document.getElementById('up-needle').style.display = 'none';
    onShow();
  }

  return { init, onShow };
})();
