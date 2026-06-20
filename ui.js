/* ============ NEONDROP — UI shell (nav, header, ticker) ============ */
window.UI = (function () {
  const S = window.SKINS, St = window.STATE;
  const VIEWS = ['cases', 'open', 'upgrade', 'contract', 'inventory'];

  function showView(name) {
    VIEWS.forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
    document.getElementById('main-nav').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (name === 'inventory') window.INVENTORY.render();
    if (name === 'upgrade') window.UPGRADE.onShow();
    if (name === 'contract') window.CONTRACT.onShow();
    location.hash = name;
  }

  // ----- balance display -----
  function syncBalance(val) {
    const el = document.getElementById('balance-value');
    el.textContent = FX.fmt(val);
  }
  function flashBalance(up) {
    const el = document.getElementById('balance-value');
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(up ? 'flash-up' : 'flash-down');
    setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 600);
  }

  // ----- hero stats -----
  function renderHeroStats() {
    const st = St.getStats();
    const data = [
      [FX.fmt(St.getInventory().length), 'предметов'],
      [FX.fmt(st.opened || 0), 'кейсов открыто'],
      [FX.fmt(st.bestDrop || 0) + '◎', 'лучший дроп'],
      [S.all().length ? FX.fmt(S.all().length) : '—', 'скинов в базе'],
    ];
    document.getElementById('hero-stats').innerHTML = data
      .map(([b, s]) => `<div class="hero-stat"><b>${b}</b><span>${s}</span></div>`).join('');
  }

  // ----- live ticker -----
  function startTicker() {
    const track = document.getElementById('ticker-track');
    const names = ['Crypt0', 'NEK0', 'sw1ft', 'b1t', 'Mango', 'GLHF', 'volna', 'kazik_god', 'shadow', 'pixel', 'Nova', 'frost'];
    function makeItem() {
      const drop = S.randomDrop();
      const u = names[(Math.random() * names.length) | 0];
      const d = document.createElement('div');
      d.className = 'tick-item';
      d.style.borderLeftColor = drop.color;
      d.innerHTML = `<img src="${FX.esc(drop.image)}" onerror="this.style.display='none'"/>
        <span class="tick-name">${FX.esc(u)} · ${FX.esc(drop.skin)}</span>
        <span class="tick-price">${FX.fmt(drop.price)}◎</span>`;
      return d;
    }
    function fill() {
      track.innerHTML = '';
      const items = [];
      for (let i = 0; i < 16; i++) items.push(makeItem());
      // duplicate for seamless loop
      items.concat(items.map((n) => n.cloneNode(true))).forEach((n) => track.appendChild(n));
    }
    fill();
    // occasionally prepend a fresh hot drop
    setInterval(() => {
      const fresh = makeItem();
      track.insertBefore(fresh, track.firstChild);
      if (track.children.length > 40) track.removeChild(track.lastChild);
    }, 5200);
  }

  // ----- bonus & funds -----
  function updateBonusBtn() {
    const btn = document.getElementById('bonus-btn');
    btn.classList.toggle('claimed', !St.canClaimBonus());
  }
  function claimBonus() {
    if (!St.canClaimBonus()) {
      const ms = St.nextBonusIn();
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      FX.toast(`Бонус будет доступен через ${h}ч ${m}м`, 'bad');
      return;
    }
    const amount = 500;
    St.claimBonus(amount);
    FX.confetti(80, ['#ffb649', '#fff']);
    FX.sound.win();
    FX.toast(`Бонус получен: +${amount}◎`, 'gold');
    updateBonusBtn();
  }

  function init() {
    // nav clicks
    document.body.addEventListener('click', (e) => {
      const navEl = e.target.closest('[data-nav]');
      if (navEl) { e.preventDefault(); showView(navEl.dataset.nav); return; }
      const scrollEl = e.target.closest('[data-scroll]');
      if (scrollEl) { document.getElementById(scrollEl.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }); }
    });

    document.getElementById('burger').addEventListener('click', () => {
      document.getElementById('main-nav').classList.toggle('open');
    });
    document.getElementById('bonus-btn').addEventListener('click', claimBonus);
    document.getElementById('add-funds').addEventListener('click', () => {
      St.addBalance(1000); FX.sound.coin(); FX.toast('+1000◎ демо-баланса', 'good');
    });

    // balance reactive
    St.on('balance', (v) => { const prev = +document.getElementById('balance-value').textContent.replace(/\s/g, '') || 0; syncBalance(v); flashBalance(v >= prev); });
    St.on('inventory', renderHeroStats);
    syncBalance(St.getBalance());
    updateBonusBtn();

    // hash routing
    const initial = (location.hash || '').replace('#', '');
    if (VIEWS.includes(initial) && initial !== 'open') showView(initial);
    else showView('cases');
  }

  return { init, showView, renderHeroStats, startTicker, updateBonusBtn };
})();
