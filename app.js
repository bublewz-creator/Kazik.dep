/* ============ NEONDROP — bootstrap ============ */
(async function () {
  const loader = document.getElementById('loader-overlay');

  // listeners only — views open after skins are loaded
  window.CASES.init();
  window.UPGRADE.init();
  window.CONTRACT.init();
  window.INVENTORY.init();
  window.UI.init();

  try {
    await window.SKINS.load();
  } catch (e) {
    console.warn('skins load failed, using fallback', e);
  }

  window.CASES.renderGrid('all');
  window.UI.renderHeroStats();
  window.UI.bootView();

  loader.classList.add('hidden');

  const resume = () => {
    try { (new (window.AudioContext || window.webkitAudioContext)()).resume(); } catch (e) {}
    document.removeEventListener('click', resume);
  };
  document.addEventListener('click', resume, { once: true });
})();
