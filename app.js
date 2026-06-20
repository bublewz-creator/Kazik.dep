/* ============ NEONDROP — bootstrap ============ */
(async function () {
  const loader = document.getElementById('loader-overlay');

  // init modules that don't need skin data
  window.CASES.init();
  window.UPGRADE.init();
  window.CONTRACT.init();
  window.INVENTORY.init();
  window.UI.init();

  // load skins (API + fallback)
  try {
    await window.SKINS.load();
  } catch (e) {
    console.warn('skins load failed, using fallback', e);
  }

  // now render data-dependent UI
  window.CASES.renderGrid('all');
  window.UI.renderHeroStats();
  window.UI.startTicker();

  loader.classList.add('hidden');

  // resume AudioContext on first interaction (browser autoplay policy)
  const resume = () => { try { (new (window.AudioContext || window.webkitAudioContext)()).resume(); } catch (e) {} document.removeEventListener('click', resume); };
  document.addEventListener('click', resume, { once: true });
})();
