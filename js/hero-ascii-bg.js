(function () {
  const CHARSET = ['·', '.', ':', '-', '+', '*', '=', '#', '@'];
  const CELL = 26;
  const FONT_SIZE = 15;
  const HOVER_RADIUS = 160;
  const BASE_OPACITY = 0.13;
  const PEAK_OPACITY = 0.75;
  const PASTEL_COLORS = [
    [96, 165, 250],
    [236, 112, 186],
    [250, 204, 21],
    [52, 211, 153],
    [167, 139, 250],
    [251, 146, 60],
  ];
  const GRAY_PALETTE = [
    [110, 110, 110],
    [80, 80, 80],
    [55, 55, 55],
    [30, 30, 30],
    [10, 10, 10],
    [60, 60, 60],
  ];
  const THEME_PALETTES = {
    'pastel-blue': [
      [147, 197, 253],
      [96, 165, 250],
      [59, 130, 246],
      [37, 99, 235],
      [29, 78, 216],
      [30, 64, 175],
    ],
    'pastel-pink': [
      [249, 168, 212],
      [244, 114, 182],
      [236, 72, 153],
      [219, 39, 119],
      [190, 24, 93],
      [157, 23, 77],
    ],
    'pastel-yellow': [
      [253, 224, 71],
      [250, 204, 21],
      [245, 158, 11],
      [217, 119, 6],
      [180, 83, 9],
      [146, 64, 14],
    ],
    'pastel-green': [
      [134, 239, 172],
      [74, 222, 128],
      [34, 197, 94],
      [22, 163, 74],
      [21, 128, 61],
      [22, 101, 52],
    ],
  };
  const PASTEL_CYCLE_MS = 380;

  function paletteForTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (!theme || theme === 'normal') return GRAY_PALETTE;
    return THEME_PALETTES[theme] || PASTEL_COLORS;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function canHoverInteract() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function initAsciiSection(section) {
    const canvas = section.querySelector('.ascii-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const flipY = section.classList.contains('ascii-bg-section--flip-y');
    const isHomeHero = section.classList.contains('home-hero');
    const titleSelector = section.dataset.asciiTitle || '.hero-title';
    const titleMaskMin = isHomeHero ? 0.04 : 0.1;
    const titleMaskRxPad = isHomeHero ? 96 : 64;
    const titleMaskRyPad = isHomeHero ? 48 : 36;
    const titleMaskInnerDist = isHomeHero ? 0.62 : 0.5;
    const titleMaskOuterDist = isHomeHero ? 1.55 : 1.4;
    let cells = [];
    let pointer = { x: -9999, y: -9999, active: false };
    let hoverAnimId = null;
    let textColor = '#3b3b3b';
    let activePalette = paletteForTheme();
    let burst = { active: false, start: 0 };
    let burstAnimId = null;
    const BURST_MS = 1600;
    let ripples = [];
    let rippleAnimId = null;
    let rippleMaxRadius = 900;
    const RIPPLE_MS = 1400;
    const RIPPLE_BAND = 120;

    function burstFactor(now) {
      if (!burst.active) return 0;
      const p = (now - burst.start) / BURST_MS;
      if (p <= 0) return 0;
      if (p >= 1) return 0;
      if (p < 0.28) return p / 0.28;
      if (p < 0.5) return 1;
      return Math.max(0, 1 - (p - 0.5) / 0.5);
    }

    function rippleFactor(x, y, now) {
      if (!ripples.length) return 0;
      let best = 0;
      for (let i = 0; i < ripples.length; i += 1) {
        const r = ripples[i];
        const p = (now - r.start) / RIPPLE_MS;
        if (p < 0 || p > 1) continue;
        const radius = p * rippleMaxRadius;
        const diff = Math.abs(Math.hypot(x - r.x, y - r.y) - radius);
        if (diff < RIPPLE_BAND) {
          const ring = 1 - diff / RIPPLE_BAND;
          const intensity = ring * ring * (1 - p);
          if (intensity > best) best = intensity;
        }
      }
      return best;
    }

    function pickChar() {
      return CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }

    function readTextColor() {
      textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#3b3b3b';
    }

    function buildGrid() {
      const width = section.clientWidth;
      const height = section.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rippleMaxRadius = Math.hypot(width, height);

      const cols = Math.ceil(width / CELL);
      const rows = Math.ceil(height / CELL);
      cells = [];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          cells.push({
            x: col * CELL + CELL / 2,
            y: row * CELL + CELL / 2,
            char: pickChar(),
            baseChar: pickChar(),
          });
        }
      }
    }

    function hexToRgb(hex) {
      const value = hex.replace('#', '').trim();
      if (value.length === 3) {
        return {
          r: parseInt(value[0] + value[0], 16),
          g: parseInt(value[1] + value[1], 16),
          b: parseInt(value[2] + value[2], 16),
        };
      }

      return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
      };
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function getPastelRgb(cell, time) {
      const palette = activePalette;
      const cyclePos = time / PASTEL_CYCLE_MS + cell.x * 0.06 + cell.y * 0.04;
      const colorIndex = Math.floor(cyclePos) % palette.length;
      const nextIndex = (colorIndex + 1) % palette.length;
      const t = cyclePos - Math.floor(cyclePos);
      const current = palette[colorIndex];
      const next = palette[nextIndex];

      return {
        r: Math.round(lerp(current[0], next[0], t)),
        g: Math.round(lerp(current[1], next[1], t)),
        b: Math.round(lerp(current[2], next[2], t)),
      };
    }

    function blendRgb(base, target, amount) {
      return {
        r: Math.round(lerp(base.r, target.r, amount)),
        g: Math.round(lerp(base.g, target.g, amount)),
        b: Math.round(lerp(base.b, target.b, amount)),
      };
    }

    function getTitleMask() {
      const title = section.querySelector(titleSelector);
      if (!title) return null;

      const sectionRect = section.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();

      return {
        cx: (titleRect.left + titleRect.right) / 2 - sectionRect.left,
        cy: (titleRect.top + titleRect.bottom) / 2 - sectionRect.top,
        rx: titleRect.width / 2 + titleMaskRxPad,
        ry: titleRect.height / 2 + titleMaskRyPad,
      };
    }

    function titleVisibilityFactor(x, y, mask) {
      if (!mask) return 1;

      const nx = (x - mask.cx) / mask.rx;
      const ny = (y - mask.cy) / mask.ry;
      const dist = Math.hypot(nx, ny);

      if (dist >= titleMaskOuterDist) return 1;
      if (dist <= titleMaskInnerDist) return titleMaskMin;

      const t = (dist - titleMaskInnerDist) / (titleMaskOuterDist - titleMaskInnerDist);
      return titleMaskMin + t * (1 - titleMaskMin);
    }

    function draw() {
      const { width, height } = section.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      ctx.font = `500 ${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const baseRgb = hexToRgb(textColor);
      const interact = canHoverInteract() && !prefersReducedMotion();
      const titleMask = flipY ? null : getTitleMask();
      const now = performance.now();
      const burstAmt = burstFactor(now);

      if (flipY) {
        ctx.save();
        ctx.translate(0, height);
        ctx.scale(1, -1);
      }

      cells.forEach((cell) => {
        let opacity = BASE_OPACITY;
        let char = cell.baseChar;
        let cellRgb = baseRgb;

        if (interact && pointer.active) {
          const dx = cell.x - pointer.x;
          const dy = cell.y - pointer.y;
          const distance = Math.hypot(dx, dy);

          if (distance < HOVER_RADIUS) {
            const influence = 1 - distance / HOVER_RADIUS;
            opacity = BASE_OPACITY + (PEAK_OPACITY - BASE_OPACITY) * influence * influence;

            if (influence > 0.72) {
              char = CHARSET[Math.min(CHARSET.length - 1, Math.floor(influence * CHARSET.length))];
            } else if (influence > 0.35) {
              char = cell.char;
            }

            if (influence > 0.12) {
              const pastelRgb = getPastelRgb(cell, now);
              const colorMix = Math.min(1, influence * 0.55 + influence * influence * 0.65);
              cellRgb = blendRgb(baseRgb, pastelRgb, colorMix);
            }
          }
        }

        if (burstAmt > 0) {
          const pastelRgb = getPastelRgb(cell, now);
          cellRgb = blendRgb(cellRgb, pastelRgb, burstAmt);
          opacity = Math.max(opacity, BASE_OPACITY + (PEAK_OPACITY - BASE_OPACITY) * burstAmt);
        }

        const rippleAmt = rippleFactor(cell.x, cell.y, now);
        if (rippleAmt > 0) {
          const pastelRgb = getPastelRgb(cell, now);
          cellRgb = blendRgb(cellRgb, pastelRgb, rippleAmt);
          opacity = Math.max(opacity, BASE_OPACITY + (PEAK_OPACITY - BASE_OPACITY) * rippleAmt);
        }

        opacity *= titleVisibilityFactor(cell.x, cell.y, titleMask);

        ctx.fillStyle = `rgba(${cellRgb.r}, ${cellRgb.g}, ${cellRgb.b}, ${opacity})`;
        ctx.fillText(char, cell.x, cell.y);
      });

      if (flipY) {
        ctx.restore();
      }
    }

    function stopHoverAnimation() {
      if (hoverAnimId === null) return;
      cancelAnimationFrame(hoverAnimId);
      hoverAnimId = null;
    }

    function burstLoop() {
      draw();
      if (performance.now() - burst.start >= BURST_MS) {
        burst.active = false;
        burstAnimId = null;
        draw();
        return;
      }
      burstAnimId = requestAnimationFrame(burstLoop);
    }

    function triggerBurst() {
      if (prefersReducedMotion()) return;
      burst.active = true;
      burst.start = performance.now();
      if (burstAnimId === null) burstAnimId = requestAnimationFrame(burstLoop);
    }

    function rippleLoop() {
      const now = performance.now();
      ripples = ripples.filter((r) => now - r.start < RIPPLE_MS);
      draw();
      if (ripples.length === 0) {
        rippleAnimId = null;
        return;
      }
      rippleAnimId = requestAnimationFrame(rippleLoop);
    }

    function triggerRipple(clientX, clientY) {
      if (prefersReducedMotion()) return;
      const rect = section.getBoundingClientRect();
      const localY = clientY - rect.top;
      ripples.push({
        x: clientX - rect.left,
        y: flipY ? rect.height - localY : localY,
        start: performance.now(),
      });
      if (ripples.length > 6) ripples.shift();
      if (rippleAnimId === null) rippleAnimId = requestAnimationFrame(rippleLoop);
    }

    function hoverAnimationLoop() {
      draw();
      if (!pointer.active) {
        hoverAnimId = null;
        return;
      }
      hoverAnimId = requestAnimationFrame(hoverAnimationLoop);
    }

    function startHoverAnimation() {
      if (hoverAnimId !== null) return;
      hoverAnimId = requestAnimationFrame(hoverAnimationLoop);
    }

    function setPointer(clientX, clientY, active) {
      const rect = section.getBoundingClientRect();
      const localY = clientY - rect.top;
      pointer.x = clientX - rect.left;
      pointer.y = flipY ? rect.height - localY : localY;
      pointer.active = active;

      if (active && canHoverInteract() && !prefersReducedMotion()) {
        startHoverAnimation();
      } else {
        stopHoverAnimation();
        draw();
      }
    }

    function handleResize() {
      readTextColor();
      buildGrid();
      draw();
    }

    section.addEventListener('mousemove', (event) => {
      if (!canHoverInteract() || prefersReducedMotion()) return;
      setPointer(event.clientX, event.clientY, true);
    });

    section.addEventListener('mouseleave', () => {
      pointer.active = false;
      stopHoverAnimation();
      draw();
    });

    section.addEventListener('click', (event) => {
      triggerRipple(event.clientX, event.clientY);
    });

    window.addEventListener('resize', handleResize);

    // Parallax — as the reader scrolls down, ease the top hero's ASCII pattern
    // upward a little faster than the page so it drifts up smoothly. Lerped in a
    // rAF loop for a buttery feel; skipped when reduced motion is requested.
    if (isHomeHero && !prefersReducedMotion()) {
      const PARALLAX_FACTOR = 0.38;
      let targetY = 0;
      let currentY = 0;
      let parallaxId = null;

      canvas.style.willChange = 'transform';

      const stepParallax = () => {
        currentY += (targetY - currentY) * 0.06;
        if (Math.abs(targetY - currentY) < 0.15) currentY = targetY;
        canvas.style.transform = `translate3d(0, ${currentY.toFixed(2)}px, 0)`;
        parallaxId = currentY === targetY ? null : requestAnimationFrame(stepParallax);
      };

      const onParallaxScroll = () => {
        targetY = -window.scrollY * PARALLAX_FACTOR;
        if (parallaxId === null) parallaxId = requestAnimationFrame(stepParallax);
      };

      window.addEventListener('scroll', onParallaxScroll, { passive: true });
      onParallaxScroll();
    }

    const themeObserver = new MutationObserver(() => {
      readTextColor();
      activePalette = paletteForTheme();
      draw();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    if (flipY && 'IntersectionObserver' in window) {
      const burstObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          triggerBurst();
          burstObserver.unobserve(entry.target);
        });
      }, { threshold: 0.6 });
      burstObserver.observe(section);
    }

    readTextColor();
    buildGrid();
    draw();
    window.setTimeout(draw, 1400);
  }

  function boot() {
    document.querySelectorAll('.ascii-bg-section').forEach(initAsciiSection);
  }

  // Building the grid and the first paint are synchronous and heavy. Running them
  // during page load stutters the entry (fadeUp) animation — most noticeable when
  // returning home from a project page. Defer to an idle gap so the animation's
  // opening frames stay smooth; the faint background settling a beat later is
  // imperceptible.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(boot, { timeout: 300 });
  } else {
    setTimeout(boot, 60);
  }
})();
