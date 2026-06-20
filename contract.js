/* ============ NEONDROP — contract (trade-up) ============ */
window.CONTRACT = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE, E = window.ECONOMY;
  let selected = [];
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

  function selectedItems() {
    return selected.map((u) => St.findItem(u)).filter(Boolean);
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

    document.getElementById('contract-info').textContent = `Выбрано ${selected.length} / 3 · одна редкость`;
    const btn = document.getElementById('contract-btn');
    btn.disabled = selected.length !== 3 || busy;
    if (selected.length === 3) {
      const sum = selectedItems().reduce((a, b) => a + b.price, 0);
      const lo = Math.round(sum * E.CONTRACT_MIN);
      const hi = Math.round(sum * E.CONTRACT_MAX);
      btn.textContent = `Заключить контракт (${FX.fmt(lo)}–${FX.fmt(hi)}${FX.CUR})`;
    } else btn.textContent = 'Заключить контракт';
  }

  function renderInventory() {
    const grid = document.getElementById('contract-inventory');
    const inv = St.getInventory().filter((it) => (D.RARITIES[it.rarity] || {}).tier < 5);
    document.getElementById('contract-inv-count').textContent = inv.length + ' шт.';
    if (!inv.length) { grid.innerHTML = `<div class="slot-empty" style="grid-column:1/-1">Нет подходящих скинов (covert и ★ нельзя).</div>`; return; }
    grid.innerHTML = inv.map((it) => FX.itemCardHTML(it, { selected: selected.includes(it.uid), attrs: `data-uid="${it.uid}"` })).join('');
    grid.querySelectorAll('.item').forEach((el) => el.addEventListener('click', () => toggle(el.dataset.uid)));
  }

  function toggle(uid) {
    const it = St.findItem(uid);
    if (!it) return;
    if ((D.RARITIES[it.rarity] || {}).tier >= 5) { FX.toast('Covert и ★ нельзя закинуть в контракт', 'bad'); return; }
    const i = selected.indexOf(uid);
    if (i >= 0) selected.splice(i, 1);
    else {
      if (selected.length >= 3) { FX.toast('Уже выбрано 3 предмета', 'bad'); return; }
      if (selected.length) {
        const first = St.findItem(selected[0]);
        if (first && first.rarity !== it.rarity) { FX.toast('Все 3 скина должны быть одной редкости', 'bad'); return; }
      }
      selected.push(uid);
    }
    renderSlots(); renderInventory();
  }

  function pickContractOutput(items, targetSum, nextKey) {
    const pool = (S.byRarity()[nextKey] || []).slice();
    if (!pool.length) return S.randomDrop();

    let best = null;
    let bestDiff = Infinity;
    for (const s of pool) {
      for (const wear of D.WEARS) {
        const sell = E.sellPrice(Math.round(s.price * wear.mult));
        const diff = Math.abs(sell - targetSum);
        if (diff < bestDiff) { bestDiff = diff; best = { skin: s, wear, sell }; }
      }
    }
    if (!best) return S.decorate(pool[0]);
    const w = best.wear;
    return {
      id: best.skin.id, name: best.skin.name, weapon: best.skin.weapon, skin: best.skin.skin,
      rarity: best.skin.rarity, color: best.skin.color, image: best.skin.image,
      wear: w.short, wearName: w.name, price: best.sell, marketPrice: Math.round(best.skin.price * w.mult),
    };
  }

  function run() {
    if (busy || selected.length !== 3) return;
    const items = selectedItems();
    const rarities = new Set(items.map((i) => i.rarity));
    if (rarities.size !== 1) { FX.toast('Все 3 скина должны быть одной редкости', 'bad'); return; }

    busy = true;
    document.getElementById('contract-btn').disabled = true;
    FX.sound.open();

    const sum = items.reduce((a, b) => a + b.price, 0);
    const tier = (D.RARITIES[items[0].rarity] || {}).tier;
    const nextKey = D.TIER_ORDER[Math.min(tier + 1, D.TIER_ORDER.length - 1)];
    const targetSum = Math.round(E.contractTargetSum(sum));
    const chosen = pickContractOutput(items, targetSum, nextKey);

    setTimeout(() => {
      St.removeMany(selected);
      St.addItem(chosen);
      St.bumpStat('contracts', 1);
      const gained = chosen.price - sum;
      const rtier = (D.RARITIES[chosen.rarity] || {}).tier || 0;
      if (rtier >= 5) { FX.confetti(160, [chosen.color, '#fff']); FX.sound.jackpot(); }
      else if (gained > 0) { FX.confetti(60); FX.sound.win(); }
      else FX.sound.coin();
      FX.toast(`Контракт: ${chosen.skin} (${FX.fmt(chosen.price)}${FX.CUR}, ${gained >= 0 ? '+' : ''}${FX.fmt(gained)}${FX.CUR})`, gained >= 0 ? 'good' : 'gold');
      selected = [];
      busy = false;
      onShow();
    }, 700);
  }

  return { init, onShow };
})();
