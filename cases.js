/* ============ NEONDROP — cases & roulette ============ */
window.CASES = (function () {
  const D = window.DATA, S = window.SKINS, St = window.STATE, E = window.ECONOMY;
  const ITEM_W = 160; // 150 width + 10 gap
  let currentCase = null;
  let qty = 1;
  let spinning = false;

  // ---------- render cases grid ----------
  function renderGrid(filter) {
    const grid = document.getElementById('cases-grid');
    const list = D.CASES.filter((c) => {
      if (!filter || filter === 'all') return true;
      const tag = (c.tag || '').toLowerCase();
      if (filter === 'hot') return tag === 'hot';
      if (filter === 'gold') return tag === 'gold' || tag === '★' || c.price >= 600;
      if (filter === 'cheap') return c.price <= 99;
      return tag === filter;
    });
    grid.innerHTML = (list.length ? list : D.CASES).map(cardHTML).join('');
    grid.querySelectorAll('.case-card').forEach((el) => {
      el.addEventListener('click', () => openCaseView(el.dataset.id));
    });
  }
  function cardHTML(c) {
    const feat = (S.featuredForCase ? S.featuredForCase(c) : []);
    const imgs = feat.map((s, i) => FX.imgHTML(s).replace('<img ', `<img class="cf cf-${i}" `)).join('');
    return `
      <div class="case-card" data-id="${c.id}" style="--glow:${c.glow}">
        ${c.tag ? `<span class="case-tag">${FX.esc(c.tag)}</span>` : ''}
        <div class="case-visual">
          <div class="case-pedestal" style="--glow:${c.glow}"></div>
          <div class="case-feats">${imgs}</div>
        </div>
        <h3>${FX.esc(c.name)}</h3>
        <div class="case-meta">${FX.esc(c.desc).slice(0, 60)}…</div>
        <div class="case-open-row">
          <span class="case-price"><span class="coin">₽</span>${FX.fmt(c.price)}</span>
          <button class="btn btn-primary case-open-btn">Открыть</button>
        </div>
      </div>`;
  }

  // ---------- open view ----------
  function openCaseView(id) {
    currentCase = D.CASES.find((c) => c.id === id);
    if (!currentCase) return;
    document.getElementById('open-case-name').textContent = currentCase.name;
    document.getElementById('open-case-desc').textContent = currentCase.desc;
    qty = 1;
    syncQtyUI();
    buildIdleRoulette();
    renderContents();
    window.UI.showView('open');
  }

  function renderContents() {
    renderOdds();
    const list = S.contentsForCase(currentCase);
    document.getElementById('contents-count').textContent = `(${list.length} вариантов · все степени износа)`;
    document.getElementById('contents-grid').innerHTML = list.map((s) => FX.itemCardHTML(s)).join('');
  }

  function renderOdds() {
    const box = document.getElementById('case-odds');
    if (!box || !currentCase) return;
    const ev = S.expectedDrop(currentCase);
    const rtp = Math.round((ev / currentCase.price) * 100);
    const oddsHtml = D.CASE_ODDS.slice().reverse().map((o) => {
      const r = D.RARITIES[o.rarity];
      const pct = (o.p * 100);
      const label = pct.toFixed(2);
      return `<div class="odd" title="${r.name}: ${label}%">
        <div class="odd-bar"><span style="width:${Math.max(2, Math.sqrt(o.p) * 100)}%;background:${r.color}"></span></div>
        <div class="odd-meta"><span class="odd-dot" style="background:${r.color}"></span>${r.name}<b>${label}%</b></div>
      </div>`;
    }).join('');
    box.innerHTML = `
      <div class="ev-banner">
        <span>Средний дроп ≈ <b>${FX.fmt(ev)}${FX.CUR}</b></span>
        <span class="ev-rtp">RTP ~${rtp}% · казино забирает ${100 - rtp}% в долгую</span>
      </div>${oddsHtml}`;
  }

  function syncQtyUI() {
    document.querySelectorAll('#qty-switch button').forEach((b) => b.classList.toggle('active', +b.dataset.qty === qty));
    const total = currentCase.price * qty;
    document.getElementById('open-price').innerHTML = `Открыть ${qty > 1 ? 'x' + qty : ''} — ${FX.fmt(total)}${FX.CUR}`;
  }

  // idle decorative strip
  function buildIdleRoulette() {
    const wrap = document.getElementById('roulette-wrap');
    wrap.classList.remove('win', 'multi');
    wrap.querySelectorAll('.roulette').forEach((r, i) => { if (i > 0) r.remove(); });
    let row = wrap.querySelector('.roulette');
    const items = [];
    for (let i = 0; i < 16; i++) items.push(S.rollFromCase(currentCase));
    row.style.transition = 'none';
    row.style.height = '100%';
    row.style.transform = 'translateX(0)';
    row.innerHTML = items.map(roulItemHTML).join('');
  }

  function roulItemHTML(it) {
    const wear = it.wearNameRu || it.wearName || it.wear || '';
    return `<div class="roul-item" style="--rc:${it.color}">
      ${FX.imgHTML(it)}
      <div class="ri-name">${FX.esc(it.skin || it.name)}</div>
      <div class="ri-wear">${FX.esc(wear)}</div>
      <div class="ri-price">${FX.fmt(it.price)}${FX.CUR}</div>
    </div>`;
  }

  // ---------- open action ----------
  function open() {
    if (spinning) return;
    const total = currentCase.price * qty;
    if (!St.canAfford(total)) { FX.toast('Недостаточно средств. Пополни баланс или открой бонус.', 'bad'); FX.sound.lose(); return; }
    St.spend(total);
    FX.sound.open();
    spinning = true;
    document.getElementById('open-btn').disabled = true;

    const winners = [];
    for (let i = 0; i < qty; i++) winners.push(S.rollFromCase(currentCase));

    const fast = document.getElementById('fast-toggle').checked;
    buildSpinRows(winners, fast, () => {
      spinning = false;
      document.getElementById('open-btn').disabled = false;
      St.bumpStat('opened', qty);
      finishOpen(winners);
    });
  }

  function buildSpinRows(winners, fast, done) {
    const wrap = document.getElementById('roulette-wrap');
    wrap.classList.remove('win');
    // remove extra rows
    wrap.querySelectorAll('.roulette').forEach((r, i) => { if (i > 0) r.remove(); });
    const baseRow = wrap.querySelector('.roulette');
    const rows = [baseRow];
    for (let i = 1; i < winners.length; i++) {
      const r = baseRow.cloneNode(false);
      wrap.insertBefore(r, document.querySelector('.roulette-glow'));
      rows.push(r);
    }
    // stack rows vertically when multiple
    const multi = winners.length > 1;
    wrap.classList.toggle('multi', multi);
    rows.forEach((r) => { r.style.height = multi ? '88px' : '100%'; });

    const WIN_INDEX = 48;
    const STRIP_LEN = 60;
    let finished = 0;

    rows.forEach((row, ri) => {
      const strip = [];
      for (let i = 0; i < STRIP_LEN; i++) {
        strip.push(i === WIN_INDEX ? winners[ri] : S.rollFromCase(currentCase));
      }
      row.style.transition = 'none';
      row.style.transform = 'translateX(0)';
      row.innerHTML = strip.map(roulItemHTML).join('');
      row.dataset.win = WIN_INDEX;

      // force reflow then animate
      void row.offsetWidth;
      const wrapW = wrap.clientWidth;
      const jitter = (Math.random() - 0.5) * (ITEM_W * 0.6);
      const target = WIN_INDEX * ITEM_W + ITEM_W / 2 - wrapW / 2 + jitter;
      const dur = fast ? 1.6 : (3.4 + Math.random() * 0.7 + ri * 0.25);
      requestAnimationFrame(() => {
        row.style.transition = `transform ${dur}s cubic-bezier(0.12, 0.78, 0.18, 1)`;
        row.style.transform = `translateX(${-target}px)`;
      });

      const onEnd = () => {
        row.removeEventListener('transitionend', onEnd);
        // snap-correct & highlight
        const items = row.children;
        if (items[WIN_INDEX]) items[WIN_INDEX].style.boxShadow = `0 0 22px ${winners[ri].color}`;
        finished++;
        if (finished === rows.length) {
          wrap.classList.add('win');
          done();
        }
      };
      row.addEventListener('transitionend', onEnd);
    });

    // ticking sound during spin
    let ticks = fast ? 14 : 34;
    const tick = () => { if (ticks-- > 0) { FX.sound.tick(); setTimeout(tick, 60 + (34 - ticks) * 4); } };
    tick();
  }

  // ---------- finish / reward ----------
  function finishOpen(winners) {
    const best = winners.reduce((a, b) => (a.price > b.price ? a : b));
    const bestTier = (D.RARITIES[best.rarity] || {}).tier || 0;
    wrapWinColor(best.color);

    if (bestTier >= 6) { FX.confetti(220, ['#ffae39', '#fff', '#ffd479']); FX.sound.jackpot(); }
    else if (bestTier >= 5) { FX.confetti(160); FX.sound.win(); }
    else if (bestTier >= 4) { FX.confetti(90); FX.sound.win(); }
    else FX.sound.coin();

    showRewardModal(winners);
  }
  function wrapWinColor(c) {
    document.querySelector('.roulette-glow').style.setProperty('--win-color', c);
  }

  function showRewardModal(winners) {
    const modal = document.getElementById('reward-modal');
    const sum = winners.reduce((a, b) => a + b.price, 0);
    const best = winners.reduce((a, b) => (a.price > b.price ? a : b));
    document.getElementById('reward-glow').style.setProperty('--win-color', best.color);
    document.getElementById('reward-items').innerHTML = winners
      .map((w, i) => FX.itemCardHTML(w, { attrs: `data-delay="${i}"` }))
      .join('');
    document.querySelectorAll('#reward-items .item').forEach((el, i) => { el.style.animationDelay = (i * 0.08) + 's'; });
    document.getElementById('reward-sell-sum').textContent = FX.fmt(sum);
    modal.classList.remove('hidden');

    const keepBtn = document.getElementById('reward-keep');
    const sellBtn = document.getElementById('reward-sell');
    const close = () => modal.classList.add('hidden');

    keepBtn.onclick = () => {
      winners.forEach((w) => St.addItem(w));
      FX.toast(`Добавлено в инвентарь: ${winners.length} предмет(ов)`, 'good');
      close();
    };
    sellBtn.onclick = () => {
      St.addBalance(sum);
      FX.sound.coin();
      FX.toast(`Продано за ${FX.fmt(sum)}${FX.CUR}`, 'gold');
      close();
    };
  }

  // ---------- wiring ----------
  function init() {
    document.getElementById('open-btn').addEventListener('click', open);
    document.querySelectorAll('#qty-switch button').forEach((b) => {
      b.addEventListener('click', () => { if (spinning) return; qty = +b.dataset.qty; syncQtyUI(); });
    });
    document.getElementById('reward-modal').addEventListener('click', (e) => {
      if (e.target.id === 'reward-modal') e.currentTarget.classList.add('hidden');
    });
    // filters
    const filters = document.getElementById('case-filters');
    const opts = [['all', 'Все'], ['hot', 'Горячие'], ['gold', 'Премиум'], ['cheap', 'Дешёвые']];
    filters.innerHTML = opts.map(([v, l], i) => `<button class="filter-chip ${i === 0 ? 'active' : ''}" data-f="${v}">${l}</button>`).join('');
    filters.querySelectorAll('.filter-chip').forEach((c) => c.addEventListener('click', () => {
      filters.querySelectorAll('.filter-chip').forEach((x) => x.classList.remove('active'));
      c.classList.add('active');
      renderGrid(c.dataset.f);
    }));
  }

  return { renderGrid, init, openCaseView };
})();
