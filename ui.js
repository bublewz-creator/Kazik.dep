/* ============ NEONDROP — UI shell (nav, header) ============ */
window.UI = (function () {
  const S = window.SKINS, St = window.STATE;
  const VIEWS = ['cases', 'open', 'upgrade', 'contract', 'inventory'];

  function showView(name) {
    VIEWS.forEach((v) => {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
    closeSidebar();
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
      [FX.fmt(st.bestDrop || 0) + FX.CUR, 'лучший дроп'],
      [S.all().length ? FX.fmt(S.all().length) : '—', 'скинов в базе'],
    ];
    document.getElementById('hero-stats').innerHTML = data
      .map(([b, s]) => `<div class="hero-stat"><b>${b}</b><span>${s}</span></div>`).join('');
  }

  // ----- live ticker removed -----

  // ----- sidebar (mobile) -----
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('scrim').classList.add('show');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('show');
  }

  // ----- bonus & funds -----
  function updateBonusBtn() {
    const can = St.canClaimBonus();
    document.getElementById('bonus-btn').classList.toggle('claimed', !can);
    const promo = document.getElementById('promo-bonus');
    if (promo) {
      promo.classList.toggle('claimed', !can);
      const sub = document.getElementById('promo-bonus-sub');
      if (sub) sub.textContent = can ? 'Забери +800 ₽' : 'Уже получен сегодня';
    }
  }
  function claimBonus() {
    if (!St.canClaimBonus()) {
      const ms = St.nextBonusIn();
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      FX.toast(`Бонус будет доступен через ${h}ч ${m}м`, 'bad');
      return;
    }
    const amount = 800;
    St.claimBonus(amount);
    FX.confetti(80, ['#ffb649', '#fff']);
    FX.sound.win();
    FX.toast(`Бонус получен: +${amount} ₽`, 'gold');
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
      const open = document.getElementById('sidebar').classList.contains('open');
      open ? closeSidebar() : openSidebar();
    });
    document.getElementById('scrim').addEventListener('click', closeSidebar);
    document.getElementById('bonus-btn').addEventListener('click', claimBonus);
    const promo = document.getElementById('promo-bonus');
    if (promo) promo.addEventListener('click', claimBonus);
    document.getElementById('add-funds').addEventListener('click', () => {
      const check = E.canTopUp(St.getTopUpState());
      if (!check.ok) { FX.toast(check.reason, 'bad'); return; }
      St.addBalance(E.TOPUP_AMOUNT);
      St.recordTopUp();
      FX.sound.coin();
      FX.toast(`+${FX.fmt(E.TOPUP_AMOUNT)}${FX.CUR} (осталось ${E.TOPUP_DAILY_MAX - (St.getTopUpState().topUpCount || 0)} сегодня)`, 'good');
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

  return { init, showView, renderHeroStats, updateBonusBtn };
})();
