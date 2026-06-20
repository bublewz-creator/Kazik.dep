/* ============ NEONDROP — inventory ============ */
window.INVENTORY = (function () {
  const D = window.DATA, St = window.STATE;
  let sort = 'new';

  function init() {
    document.getElementById('inv-sort').addEventListener('change', (e) => { sort = e.target.value; render(); });
    document.getElementById('sell-all').addEventListener('click', sellAll);
    St.on('inventory', () => { if (!document.getElementById('view-inventory').classList.contains('hidden')) render(); });
  }

  function sorted() {
    const inv = [...St.getInventory()];
    switch (sort) {
      case 'price-desc': return inv.sort((a, b) => b.price - a.price);
      case 'price-asc': return inv.sort((a, b) => a.price - b.price);
      case 'rarity': return inv.sort((a, b) => (D.RARITIES[b.rarity].tier - D.RARITIES[a.rarity].tier) || b.price - a.price);
      default: return inv.sort((a, b) => b.ts - a.ts);
    }
  }

  function render() {
    const inv = sorted();
    const grid = document.getElementById('inventory-grid');
    const empty = document.getElementById('inv-empty');
    const total = inv.reduce((a, b) => a + b.price, 0);
    document.getElementById('inv-total').textContent = `${FX.fmt(total)}${FX.CUR} · ${inv.length} шт.`;

    if (!inv.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    grid.innerHTML = inv.map((it) => FX.itemCardHTML(it, {
      attrs: `data-uid="${it.uid}"`,
      extra: `<button class="sell-btn" data-sell="${it.uid}">Продать ${FX.fmt(it.price)}${FX.CUR}</button>`,
    })).join('');
    grid.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); sell(b.dataset.sell); }));
  }

  function sell(uid) {
    const it = St.findItem(uid);
    if (!it) return;
    St.removeItem(uid);
    St.addBalance(it.price);
    FX.sound.coin();
    FX.toast(`Продано: ${it.skin} за ${FX.fmt(it.price)}${FX.CUR}`, 'gold');
    render();
  }

  function sellAll() {
    const inv = St.getInventory();
    if (!inv.length) { FX.toast('Инвентарь пуст', 'bad'); return; }
    const total = inv.reduce((a, b) => a + b.price, 0);
    if (!confirm(`Продать все ${inv.length} предметов за ${FX.fmt(total)}${FX.CUR}?`)) return;
    St.clearInventory();
    St.addBalance(total);
    FX.sound.coin();
    FX.toast(`Продано всё за ${FX.fmt(total)}${FX.CUR}`, 'gold');
    render();
  }

  return { init, render };
})();
