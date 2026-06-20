/* ============ NEONDROP — effects & shared helpers ============ */
window.FX = (function () {
  const CUR = ' ₽';

  // ----- number / text -----
  function fmt(n) {
    n = Math.round(n);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // ----- shared item card markup -----
  function itemCardHTML(item, opts) {
    opts = opts || {};
    const rcolor = item.color || '#8b95bf';
    const rname = (window.DATA.RARITIES[item.rarity] || {}).name || '';
    const wear = item.wear ? `<span class="item-wear">${esc(item.wear)}</span>` : '';
    const extra = opts.extra || '';
    return `
      <div class="item ${opts.selected ? 'selected' : ''}" style="--rc:${rcolor}" ${opts.attrs || ''}>
        <span class="item-rare-badge">${esc(rname)}</span>
        <div class="item-img"><img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy"
             onerror="this.src=SKINS.placeholder(${jsonAttr(item)})" /></div>
        <div class="item-info">
          <div class="item-weapon">${esc(item.weapon || '')}</div>
          <div class="item-name">${esc(item.skin || item.name)}</div>
          <div class="item-bottom">
            <span class="item-price">${fmt(item.price)}${CUR}</span>${wear}
          </div>
        </div>
        ${extra}
      </div>`;
  }
  function jsonAttr(item) {
    return "{color:'" + (item.color || '#6c5cff') + "',weapon:'" + escq(item.weapon) + "',skin:'" + escq(item.skin || item.name) + "'}";
  }
  function escq(s) { return String(s == null ? '' : s).replace(/['\\]/g, '\\$&'); }

  // ----- toasts -----
  const toastWrap = () => document.getElementById('toast-wrap');
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    toastWrap().appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
  }

  // ----- confetti -----
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let parts = [];
  let rafId = null;
  function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
  resize(); addEventListener('resize', resize);

  function confetti(intensity, colors) {
    intensity = intensity || 120;
    colors = colors || ['#6c5cff', '#00e0c6', '#ff3b8d', '#ffb649', '#ffffff'];
    const cx = innerWidth / 2;
    for (let i = 0; i < intensity; i++) {
      parts.push({
        x: cx + (Math.random() - 0.5) * 240,
        y: innerHeight * 0.35 + (Math.random() - 0.5) * 120,
        vx: (Math.random() - 0.5) * 13,
        vy: Math.random() * -13 - 4,
        g: 0.32 + Math.random() * 0.2,
        size: 5 + Math.random() * 7,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
      });
    }
    if (!rafId) loop();
  }
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.008;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    parts = parts.filter((p) => p.life > 0 && p.y < canvas.height + 40);
    if (parts.length) rafId = requestAnimationFrame(loop);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); rafId = null; }
  }

  // ----- sounds (WebAudio, no assets) -----
  let actx = null;
  let muted = false;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; }
  function beep(freq, dur, type, vol) {
    if (muted) return;
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(a.destination);
    const now = a.currentTime;
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (dur || 0.15));
    o.start(now); o.stop(now + (dur || 0.15));
  }
  const sound = {
    tick: () => beep(1200, 0.03, 'square', 0.025),
    open: () => beep(440, 0.12, 'sawtooth', 0.04),
    win: () => { beep(523, 0.12, 'triangle', 0.05); setTimeout(() => beep(659, 0.12, 'triangle', 0.05), 110); setTimeout(() => beep(784, 0.2, 'triangle', 0.05), 220); },
    jackpot: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.06), i * 120)); },
    lose: () => { beep(300, 0.2, 'sawtooth', 0.05); setTimeout(() => beep(200, 0.3, 'sawtooth', 0.05), 140); },
    coin: () => beep(900, 0.08, 'square', 0.03),
    setMuted: (m) => { muted = m; },
  };

  function flyi(item) { return (window.DATA.RARITIES[item.rarity] || {}).tier >= 5; }

  return { fmt, esc, itemCardHTML, toast, confetti, sound, isRare: flyi, CUR };
})();
