/* ============ NEONDROP — contract (trade-up) ============ */
window.CONTRACT = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE;
  let selected = []; // uids (max 3)
  let busy = false;

  function init() {
    renderSlots();
    document.getElementById('contract-btn').addEventListener('click', run);
  }

  function onShow() {
    selected = selected.filter((uid) => St.findItem(uid));
    renderSlots();
    renderInventory();
  }

  function renderSlots() {
    const wrap = document.getElementById('contract-slots');
    let html = '';
    for (let i = 0; i < 3; i++) {
      const uid = selected[i];
      const it = uid ? St.findItem(uid) : null;
      html += it
        ? `<div class="contract-slot" data-slot="${i}">${FX.itemCardHTML(it, { attrs: `data-uid="${it.uid}"` })}</div>`
        : `<div class="contract-slot" data-slot="${i}">＋</div>`;
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('.contract-slot .item').forEach((el) => el.addEventListener('click', () => toggle(el.dataset.uid)));

    document.getElementById('contract-info').textContent = `Выбрано ${selected.length} / 3`;
    const btn = document.getElementById('contract-btn');
    btn.disabled = selected.length !== 3 || busy;
    if (selected.length === 3) {
      const sum = selected.reduce((a, u) => a + (St.findItem(u)?.price || 0), 0);
      btn.textContent = `Заключить контракт (≈${FX.fmt(sum * 0.9)}${FX.CUR})`;
    } else btn.textContent = 'Заключить контракт';
  }

  function renderInventory() {
    const grid = document.getElementById('contract-inventory');
    const inv = St.getInventory();
    document.getElementById('contract-inv-count').textContent = inv.length + ' шт.';
    if (!inv.length) { grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Инвентарь пуст.</div>`; return; }
    grid.innerHTML = inv.map((it) => FX.itemCardHTML(it, { selected: selected.includes(it.uid), attrs: `data-uid="${it.uid}"` })).join('');
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => toggle(el.dataset.uid)));
  }

  function toggle(uid) {
    const i = selected.indexOf(uid);
    if (i >= 0) selected.splice(i, 1);
    else { if (selected.length >= 3) { FX.toast('Уже выбрано 3 предмета', 'bad'); return; } selected.push(uid); }
    renderSlots(); renderInventory();
  }

  function run() {
    if (busy || selected.length !== 3) return;
    busy = true;
    document.getElementById('contract-btn').disabled = true;
    FX.sound.open();

    const items = selected.map((u) => St.findItem(u)).filter(Boolean);
    const sum = items.reduce((a, b) => a + b.price, 0);
    const maxTier = Math.max(...items.map((i) => (D.RARITIES[i.rarity] || {}).tier || 0));
    const nextKey = D.TIER_ORDER[Math.min(maxTier + 1, D.TIER_ORDER.length - 1)];

    // output value: ~0.9x input (with luck variance)
    const luck = 0.7 + Math.random() * 0.7;
    const targetPrice = sum * 0.9 * luck;

    const pool = (S.byRarity()[nextKey] || []).slice();
    let chosen;
    if (pool.length) {
      pool.sort((a, b) => Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice));
      chosen = S.decorate(pool[Math.floor(Math.random() * Math.min(8, pool.length))]);
    } else {
      chosen = S.randomDrop();
    }

    setTimeout(() => {
      St.removeMany(selected);
      St.addItem(chosen);
      St.bumpStat('contracts', 1);
      const gained = chosen.price - sum;
      const tier = (D.RARITIES[chosen.rarity] || {}).tier || 0;
      if (tier >= 5) { FX.confetti(160, [chosen.color, '#fff']); FX.sound.jackpot(); }
      else { FX.confetti(80); FX.sound.win(); }
      FX.toast(`Контракт: получен ${chosen.skin} (${FX.fmt(chosen.price)}${FX.CUR}, ${gained >= 0 ? '+' : ''}${FX.fmt(gained)}${FX.CUR})`, gained >= 0 ? 'good' : 'gold');
      selected = [];
      busy = false;
      onShow();
    }, 700);
  }

  return { init, onShow };
})();
