// The seasonal footer: a strip at the foot of the home page that comes alive
// when it scrolls into view, with a few quiet details for the current theme.
// Spring drifts petals, summer breathes soft light rays down from above,
// autumn lets a handful of leaves tumble, winter a light fall of snow. Kept
// sparse and faint, masked to fade into the page, paused when off screen,
// and left out entirely for reduced motion.
(function () {
  const wrap = document.querySelector('.season-footer');
  const canvas = wrap && wrap.querySelector('.season-footer-canvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');

  const root = document.documentElement;
  const seasonOf = () => ({ spring: 'spring', autumn: 'autumn', dark: 'winter' })[root.getAttribute('data-theme')] || 'summer';

  // Colours per season: a few tones each, drawn at low opacity.
  const PALETTE = {
    spring: ['#e9a0b6', '#f0b6c7', '#e7c46e', '#d993aa'],
    autumn: ['#cf8a55', '#b8693a', '#e2b25c', '#9a5a33'],
    winter: ['#ffffff', '#dfe8f2'],
  };
  // Scaled by width below, so a wide screen gets a full spread.
  const COUNT = { spring: 30, autumn: 22, winter: 80 };

  let W = 0;
  let H = 0;
  let dpr = 1;
  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function spawn(kind, anywhere) {
    const p = { x: rand(0, W), y: anywhere ? rand(-H * 0.2, H) : rand(-30, -8), phase: rand(0, Math.PI * 2), rot: rand(0, 6.28) };
    if (kind === 'winter') return { ...p, r: rand(1, 2.4), vy: rand(10, 20), sway: rand(4, 10), vr: 0, color: pick(PALETTE.winter), a: rand(0.55, 0.9) };
    if (kind === 'autumn') return { ...p, r: rand(4, 7), vy: rand(12, 22), sway: rand(12, 26), vr: rand(-1.4, 1.4), color: pick(PALETTE.autumn), a: rand(0.6, 0.85) };
    return { ...p, r: rand(3.4, 5.4), vy: rand(7, 13), sway: rand(10, 22), vr: rand(-0.9, 0.9), color: pick(PALETTE.spring), a: rand(0.65, 0.9) };
  }

  let kind = seasonOf();
  let items = [];
  function reset() {
    size();
    items = [];
    const n = Math.round((COUNT[kind] || 0) * Math.max(0.5, Math.min(1.6, W / 1300)));
    for (let i = 0; i < n; i += 1) items.push(spawn(kind, true));
  }

  function drawRays(t) {
    // Soft warm beams falling across the whole width from above, each slowly
    // breathing and swaying; blurred so they read as light.
    ctx.filter = 'blur(14px)';
    const beams = Math.max(4, Math.round(W / 260));
    for (let i = 0; i < beams; i += 1) {
      const ox = W * ((i + 0.5) / beams) + Math.sin(t * 0.12 + i * 2.1) * 30;
      const oy = -H * 0.6;
      const ang = Math.PI / 2 + 0.28 + Math.sin(t * 0.15 + i * 1.3) * 0.05;
      const spread = 0.07 + Math.sin(t * 0.3 + i) * 0.02;
      const len = H * 2.2;
      const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      const a = 0.34 + Math.sin(t * 0.4 + i * 2.3) * 0.1;
      g.addColorStop(0.25, `rgba(250, 210, 110, ${a})`);
      g.addColorStop(1, 'rgba(250, 210, 110, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(ang - spread) * len, oy + Math.sin(ang - spread) * len);
      ctx.lineTo(ox + Math.cos(ang + spread) * len, oy + Math.sin(ang + spread) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.filter = 'none';
  }

  function drawItem(p, x) {
    ctx.globalAlpha = p.a * fade;
    ctx.fillStyle = p.color;
    if (kind === 'winter') {
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(x, p.y);
    ctx.rotate(p.rot);
    ctx.beginPath();
    if (kind === 'autumn') {
      // A leaf: pointed oval with a faint midrib.
      ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = p.a * fade * 0.5;
      ctx.strokeStyle = 'rgba(80, 40, 20, 0.6)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-p.r, 0);
      ctx.lineTo(p.r, 0);
      ctx.stroke();
    } else {
      // A petal: a soft teardrop.
      ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r * 0.9, 0, 0, p.r);
      ctx.quadraticCurveTo(-p.r * 0.9, 0, 0, -p.r);
      ctx.fill();
    }
    ctx.restore();
  }

  let fade = 0;
  let fadeTarget = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const t = now / 1000;
    fade += (fadeTarget - fade) * Math.min(1, dt * 1.6);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (kind === 'summer') {
      ctx.globalAlpha = fade;
      drawRays(t);
    } else {
      items.forEach((p, i) => {
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const x = p.x + Math.sin(t * 0.7 + p.phase) * p.sway;
        if (p.y > H + 12) items[i] = spawn(kind, false);
        drawItem(p, x);
      });
    }
    ctx.globalAlpha = 1;
    if (fadeTarget === 0 && fade < 0.01) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  reset();
  window.addEventListener('resize', () => { size(); });

  // Comes in once the strip is properly on screen, and eases out as it
  // leaves; doesn't run at all while it's away.
  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    fadeTarget = visible && !document.hidden ? 1 : 0;
    if (fadeTarget) start();
  }, { threshold: 0.35 }).observe(wrap);
  document.addEventListener('visibilitychange', () => {
    fadeTarget = visible && !document.hidden ? 1 : 0;
    if (fadeTarget) start();
  });

  // Follow the theme: a new season starts its own set of details.
  new MutationObserver(() => {
    const next = seasonOf();
    if (next === kind) return;
    kind = next;
    reset();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
