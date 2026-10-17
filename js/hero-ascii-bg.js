(function () {
  const CHARSET = ['·', '.', ':', '-', '+', '*', '=', '#', '@'];

  // The field is drawn as little hand-drawn marks rather than glyphs: shamrocks
  // and tulips, for an Irish-Dutch background. Each CHARSET entry is a
  // "density level" (its index), and each level gets twelve pre-built variants,
  // lightest to busiest — tiny shamrocks and tulip buds at the light end, through
  // three-leaf shamrocks and tulip cups, to full stemmed shamrocks (the odd
  // four-leaf one) and tulips with a leaf — so the hover swap from light to
  // dense characters still reads as the marks getting busier. Built once as
  // Path2D, centred on 0,0, with a little jitter and tilt baked in so no two
  // look machine-made.
  const SQUIGGLE_VARIANTS = 12;
  const LEVEL_OF = Object.fromEntries(CHARSET.map((c, i) => [c, i]));
  const SQUIGGLES = (() => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const j = (amt) => (rand() - 0.5) * amt;
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const flip = () => (rand() < 0.5 ? -1 : 1);

    // A heart-shaped shamrock leaf as one closed stroke, its point at (cx, cy)
    // and its lobes reaching out along `angle`, `len` long.
    const leaf = (pts, cx, cy, angle, len) => {
      const n = 26;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const k = len / 17;
      for (let i = 0; i <= n; i += 1) {
        const t = (i / n) * Math.PI * 2;
        // The classic heart curve, lobes up, point at the origin (y grows up).
        const hx = 16 * Math.sin(t) ** 3;
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 17;
        // Turn "up" to point along `angle` (canvas y grows down).
        const ux = hx * k + j(0.2);
        const uy = hy * k + j(0.2);
        pts.push([cx + ux * sin + uy * cos, cy + uy * sin - ux * cos]);
      }
    };

    // A tulip cup as one closed stroke: a bowl that bulges a little past its
    // rim, from the left petal's tip down round to the right one's, then the
    // rim dips between three petal points. Bowl bottom at (0, cy).
    const cup = (pts, cy, w, h) => {
      const n = 16;
      for (let i = 0; i <= n; i += 1) {
        const t = (i / n) * Math.PI;
        const bulge = 1 + 0.18 * Math.sin(t);
        pts.push([-Math.cos(t) * (w / 2) * bulge + j(0.15), cy - h + Math.sin(t) * h + j(0.15)]);
      }
      pts.push(
        [w / 4 + j(0.2), cy - h * (0.62 + rand() * 0.1)],
        [j(0.3), cy - h * 1.12],
        [-w / 4 + j(0.2), cy - h * (0.62 + rand() * 0.1)],
        [-w / 2 + j(0.15), cy - h],
      );
    };

    // A stem curving gently down from (0, top) to (bend, bottom).
    const stem = (pts, top, bottom, bend) => {
      for (let i = 0; i <= 6; i += 1) {
        const t = i / 6;
        pts.push([Math.sin(t * Math.PI * 0.5) * bend + j(0.15), top + (bottom - top) * t]);
      }
    };

    // Shape families. Each draws one mark into `pts`, calling `more()` for
    // each extra stroke; `size` (0-1) grows with the density level.
    const SHAPES = {
      // The light end: small, stemless.
      tinyShamrock: (pts, size, more) => {
        const len = 2.4 + size * 3;
        [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]
          .forEach((a, i) => leaf(i ? more() : pts, 0, 0.5, a + j(0.25), len));
      },
      tulipBud: (pts, size) => {
        cup(pts, 2.5, 4 + size * 4, 4 + size * 3.5);
      },
      shamrock: (pts, size, more) => {
        const len = 4 + size * 4;
        leaf(pts, 0, 0, -Math.PI / 2 + j(0.2), len);
        leaf(more(), 0, 0, -Math.PI / 2 + (Math.PI * 2) / 3 + j(0.2), len);
        leaf(more(), 0, 0, -Math.PI / 2 - (Math.PI * 2) / 3 + j(0.2), len);
      },
      shamrockStem: (pts, size, more) => {
        const len = 4 + size * 4;
        const four = size > 0.8 && rand() < 0.2;
        const angles = four ? [-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]
          : [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
        angles.forEach((a, i) => leaf(i ? more() : pts, 0, -2, a + j(0.2), len));
        stem(more(), -2, len * 1.2, (1 + size * 2) * flip());
      },
      tulip: (pts, size, more) => {
        const w = 5 + size * 3;
        const h = 4.5 + size * 3;
        cup(pts, 0, w, h);
        stem(more(), 0, h * 0.6 + size * 2, (0.4 + size * 0.6) * flip());
      },
      tulipLeaf: (pts, size, more) => {
        const w = 5 + size * 3;
        const h = 4.5 + size * 3;
        const bottom = h * 0.75 + size * 2.5;
        cup(pts, 0, w, h);
        stem(more(), 0, bottom, 0.6 * flip());
        // A long pointed leaf rising from low on the stem.
        const side = flip();
        const blade = more();
        const base = bottom * 0.8;
        for (let i = 0; i <= 8; i += 1) {
          const t = i / 8;
          blade.push([side * Math.sin(t * Math.PI) * (2 + size * 1.5) + j(0.15), base - t * bottom * 0.7]);
        }
      },
    };

    // Which families each density level draws from, lightest to densest:
    // shamrocks and tulips in roughly equal measure at every level.
    const LEVEL_SHAPES = [
      ['tinyShamrock', 'tulipBud'],
      ['tinyShamrock', 'tulipBud'],
      ['tinyShamrock', 'tulipBud', 'shamrock', 'tulip'],
      ['shamrock', 'tulip', 'tinyShamrock', 'tulipBud'],
      ['shamrock', 'tulip'],
      ['shamrock', 'tulip', 'shamrockStem', 'tulipLeaf'],
      ['shamrockStem', 'tulipLeaf', 'shamrock', 'tulip'],
      ['shamrockStem', 'tulipLeaf'],
      ['shamrockStem', 'tulipLeaf'],
    ];

    const build = (level) => {
      // A mark is one or more strokes. Shapes draw into `pts` (the first
      // stroke) and can call `more()` for extra strokes (crosses, asterisks).
      const strokes = [[]];
      const more = () => {
        const next = [];
        strokes.push(next);
        return next;
      };
      const size = level / (CHARSET.length - 1);
      SHAPES[pick(LEVEL_SHAPES[level])](strokes[0], size, more);
      // Tilt the whole mark a little and trace it with smooth curves.
      // A gentler tilt than loose squiggles could take: these need to stay
      // recognisably upright.
      const tilt = (rand() - 0.5) * 0.6;
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      let rotated = strokes
        .filter((st) => st.length > 1)
        .map((st) => st.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]));
      // Keep every mark inside its cell (about 16px across), or the loopier
      // ones run into their neighbours and join up into long chains.
      const extent = Math.max(...rotated.flat().map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
      // Then three quarters of that, so they sit small in the field.
      const fit = Math.min(1, 8 / extent) * 0.75;
      rotated = rotated.map((st) => st.map(([x, y]) => [x * fit, y * fit]));
      const path = new Path2D();
      rotated.forEach((rot) => {
        path.moveTo(rot[0][0], rot[0][1]);
        for (let i = 1; i < rot.length - 1; i += 1) {
          const mx = (rot[i][0] + rot[i + 1][0]) / 2;
          const my = (rot[i][1] + rot[i + 1][1]) / 2;
          path.quadraticCurveTo(rot[i][0], rot[i][1], mx, my);
        }
        const last = rot[rot.length - 1];
        path.lineTo(last[0], last[1]);
      });
      return path;
    };
    return CHARSET.map((_, level) => Array.from({ length: SQUIGGLE_VARIANTS }, () => build(level)));
  })();
  const CELL = 26;
  const FONT_SIZE = 15;
  const HOVER_RADIUS = 160;
  const BASE_OPACITY = 0.13;
  // 4x4 Bayer order, for the dither over the marks (see ditherCanvas).
  const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
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
  // The bottom pattern meets the section above it on a hard edge. Ramping the top
  // few rows down to near-nothing lets the grid look like it emerges out of the
  // page instead of starting abruptly. Row centres sit at CELL/2 + n*CELL, so a
  // linear ramp over TOP_FADE_ROWS cells resolves to one value per row.
  const TOP_FADE_ROWS = 5;
  const PASTEL_CYCLE_MS = 380;
  // Each column drifts at its own scroll speed, BASE ± AMP. Two out-of-phase sine
  // waves across the column index keep neighbours close (so it reads as a rippling
  // curtain, not noise) without the pattern repeating on screen.
  const PARALLAX_BASE = 0.2;
  const PARALLAX_AMP = 0.16;

  function columnParallax(col) {
    const wave = 0.62 * Math.sin(col * 0.37) + 0.38 * Math.sin(col * 0.13 + 1.7);
    return PARALLAX_BASE + PARALLAX_AMP * wave;
  }

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

    // A slight ordered dither over the drawn marks: every pixel's alpha is
    // snapped to one of a few steps, the step chosen by the pixel's place in a
    // 4x4 Bayer matrix, then mixed halfway back with its smooth value — enough
    // grain to read as dithered while the shapes keep their outline.
    const DITHER_STEPS = 4;
    const DITHER_MIX = 0.5;
    function ditherCanvas() {
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let y = 0; y < h; y += 1) {
        const rowOff = (y % 4) * 4;
        for (let x = 0; x < w; x += 1) {
          const i = (y * w + x) * 4 + 3;
          const a = d[i];
          if (!a) continue;
          const t = (BAYER_4[rowOff + (x % 4)] + 0.5) / 16;
          const q = Math.min(255, Math.floor((a / 255) * DITHER_STEPS + t) * (255 / DITHER_STEPS));
          d[i] = a + (q - a) * DITHER_MIX;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
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
    let gridHeight = 0;
    let parallaxEnabled = false;
    let parallaxOffset = 0;
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

    let viewWidth = 0;
    let viewHeight = 0;

    function readTextColor() {
      textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#3b3b3b';
    }

    function buildGrid() {
      const width = section.clientWidth;
      const height = section.clientHeight;
      // One canvas pixel per CSS pixel, scaled up with hard edges (the CSS
      // sets image-rendering), so the dither below reads as visible pixels
      // rather than vanishing into a high-density screen.
      const dpr = 1;

      // Remembered for draw(), which used to re-measure with
      // getBoundingClientRect. Those two agree on a whole-number layout and
      // disagree once anything scales the page: clientWidth is rounded, the
      // rect is fractional, and when the rect comes out the smaller of the two
      // the clear misses a sliver down the right-hand edge — so the last frame
      // stays there and smears while the pattern moves.
      viewWidth = width;
      viewHeight = height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rippleMaxRadius = Math.hypot(width, height);

      const cols = Math.ceil(width / CELL);
      const rows = Math.ceil(height / CELL);
      cells = [];
      gridHeight = rows * CELL;

      const speeds = [];
      for (let col = 0; col < cols; col += 1) speeds.push(columnParallax(col));

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          cells.push({
            x: col * CELL + CELL / 2,
            y: row * CELL + CELL / 2,
            speed: speeds[col],
            char: pickChar(),
            baseChar: pickChar(),
            variant: Math.floor(Math.random() * SQUIGGLE_VARIANTS),
          });
        }
      }
    }

    // Columns travel at different speeds, so they'd run out of glyphs at different
    // times — wrapping recycles each one back around its own grid height.
    function parallaxY(cell) {
      if (!parallaxEnabled || !gridHeight) return cell.y;
      const shifted = cell.y + parallaxOffset * cell.speed;
      return ((shifted % gridHeight) + gridHeight) % gridHeight;
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

    // `y` is the pre-flip grid coordinate; for the flipped section the drawn
    // distance from the visual top of the block is height - y.
    //
    // The flipped band's top edge is a curve rather than a straight line: the
    // fade starts lower toward the middle (a parabola, deepest at the centre,
    // nothing at the edges), so the field dips like a smile.
    function topSag(x, width) {
      if (!flipY || !width) return 0;
      const n = (x - width / 2) / (width / 2);
      const depth = Math.min(viewHeight * 0.7, 150);
      return depth * Math.max(0, 1 - n * n);
    }

    function topFadeFactor(y, height, x, width) {
      const span = TOP_FADE_ROWS * CELL;
      const fromTop = (flipY ? height - y : y) - topSag(x, width);
      if (fromTop >= span) return 1;
      return Math.max(0, fromTop / span);
    }

    // The top band's lower edge mirrors the bottom band's curve: the field
    // rises toward the middle (the same parabola), fading out over three rows
    // above that edge. It only ever takes away — the canvas's CSS mask still
    // does the overall fade — so the curve leaves the band lighter, never
    // stronger. Sized to the band, which is only a few hundred pixels tall.
    function bottomCurveFactor(y, height, x, width) {
      if (flipY || !width) return 1;
      const n = (x - width / 2) / (width / 2);
      const span = 3 * CELL;
      const sideEnd = height * 0.5;
      const rise = height * 0.3 * Math.max(0, 1 - n * n);
      const past = y - (sideEnd - rise - span);
      if (past <= 0) return 1;
      return Math.max(0, 1 - past / span);
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
      const width = viewWidth;
      const height = viewHeight;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const baseRgb = hexToRgb(textColor);
      const interact = canHoverInteract() && !prefersReducedMotion();
      const titleMask = flipY ? null : getTitleMask();
      const now = performance.now();
      const burstAmt = burstFactor(now);
      // The top band reads louder on the dark canvas than the light one, so it
      // is dimmed a little there (the bottom band, already faded, is left be).
      const themeDim = !flipY && document.documentElement.getAttribute('data-theme') === 'dark' ? 0.65 : 1;

      if (flipY) {
        ctx.save();
        ctx.translate(0, height);
        ctx.scale(1, -1);
      }

      cells.forEach((cell) => {
        let opacity = BASE_OPACITY;
        let char = cell.baseChar;
        let cellRgb = baseRgb;
        // Where this glyph actually lands this frame — hover, ripples and the title
        // mask all have to read the drawn position, not the grid slot.
        const y = parallaxY(cell);

        if (interact && pointer.active) {
          const dx = cell.x - pointer.x;
          const dy = y - pointer.y;
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

        const rippleAmt = rippleFactor(cell.x, y, now);
        if (rippleAmt > 0) {
          const pastelRgb = getPastelRgb(cell, now);
          cellRgb = blendRgb(cellRgb, pastelRgb, rippleAmt);
          opacity = Math.max(opacity, BASE_OPACITY + (PEAK_OPACITY - BASE_OPACITY) * rippleAmt);
        }

        opacity *= titleVisibilityFactor(cell.x, y, titleMask) * themeDim;
        if (flipY) opacity *= topFadeFactor(y, height, cell.x, width);
        else opacity *= bottomCurveFactor(y, height, cell.x, width);

        ctx.strokeStyle = `rgba(${cellRgb.r}, ${cellRgb.g}, ${cellRgb.b}, ${opacity})`;
        // The flipped band mirrors the whole canvas; un-mirror each mark so
        // the shapes read the same way up in both bands.
        ctx.translate(cell.x, y);
        if (flipY) ctx.scale(1, -1);
        ctx.stroke(SQUIGGLES[LEVEL_OF[char] || 0][cell.variant]);
        if (flipY) ctx.scale(1, -1);
        ctx.translate(-cell.x, -y);
      });

      if (flipY) {
        ctx.restore();
      }

      ditherCanvas();
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

    // Parallax — as the reader scrolls, the top hero's ASCII pattern drifts upward
    // a little faster than the page, and every column drifts at its own rate so the
    // grid shears into bands. That rules out transforming the canvas as one layer:
    // the offsets are applied per glyph, so each frame is a redraw. A persistent
    // rAF loop reads scrollY and eases toward it, so the motion stays buttery
    // regardless of how bursty the scroll events are (event-driven updates jump on
    // fast flicks). The loop only runs while the hero is on screen. Skipped under
    // reduced motion.
    if (isHomeHero && !prefersReducedMotion()) {
      const EASE = 0.09;
      let rafId = null;
      let drawnAt = null;

      parallaxEnabled = true;

      const loop = () => {
        const target = -window.scrollY;
        parallaxOffset += (target - parallaxOffset) * EASE;
        if (Math.abs(target - parallaxOffset) < 0.05) parallaxOffset = target;

        // Skip the redraw when nothing moved, and leave it to the hover loop when
        // that one is already painting every frame.
        if (drawnAt === null || Math.abs(parallaxOffset - drawnAt) >= 0.05) {
          drawnAt = parallaxOffset;
          if (hoverAnimId === null) draw();
        }

        rafId = requestAnimationFrame(loop);
      };

      const startParallax = () => {
        if (rafId === null) rafId = requestAnimationFrame(loop);
      };
      const stopParallax = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };

      if ('IntersectionObserver' in window) {
        const parallaxObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) startParallax();
            else stopParallax();
          });
        });
        parallaxObserver.observe(section);
      } else {
        startParallax();
      }
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
