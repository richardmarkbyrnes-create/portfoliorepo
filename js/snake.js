// Snake at the bottom of the home page, as dithered squircles on a dot
// grid: a faint pixel marks every cell, the snake is a run of rounded
// squares in the season's accent, solid at the head and tapering and
// thinning out towards the tail, and the food is the season's icon (a sun,
// tulip, leaf or snowflake) in pixel art, gently pulsing.
// Drawn at one canvas pixel per 2 CSS px, each shape a crisp pixel
// squircle filled with a 4x4 ordered (Bayer) dither at its strength, like
// the texture; sized so the board spans the text column exactly. Click or
// tap the board (or focus it and press Enter / Space) to play; a click,
// tap or Space pauses and resumes; arrow keys or WASD steer while it has focus, swipes
// on touch. The best score is kept in localStorage. It pauses off screen
// and in a hidden tab.
(function () {
  const board = document.querySelector('.snake-board');
  if (!board) return;
  const ctx = board.getContext('2d');
  if (!ctx) return;
  const wrap = board.parentElement;
  // The column the play area matches (the section's inner, text-width box).
  const playArea = wrap.closest('.work-column-inner') || wrap.parentElement;
  // The status line under the board: how to play, paused, game over.
  const overlay = document.querySelector('[data-snake-overlay]');
  // The score now only shows in the game-over line; these stay optional.
  const scoreEl = document.querySelector('[data-snake-score]') || {};
  const bestEl = document.querySelector('[data-snake-best]') || {};

  const TARGET_CELL = 18; // CSS px a cell aims for; the exact size divides the width evenly
  const PX = 2; // CSS px per canvas pixel
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const ROWS = 12;
  const TICK = 150; // ms per step
  const BEST_KEY = 'portfolio-snake-best';
  // "Tap" on touch screens, "click" with a mouse.
  const verb = (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches) ? 'tap' : 'click';
  // Before a first game: one line, "Click below to play" (or "Tap").
  overlay.innerHTML = '';
  const invite = document.createElement('span');
  // In the light grey of the second lines, not the title colour.
  invite.className = 'snake-status-hint';
  invite.textContent = `${verb[0].toUpperCase()}${verb.slice(1)} below to play`;
  overlay.append(invite);

  // The food is the season's icon, as 7x7 pixel art: a sun in summer, a
  // tulip in spring, a leaf in autumn and a snowflake in winter (the dark
  // theme), each in its own colour.
  const FOOD = {
    normal: { colour: '#e5a13a', art: [
      '...#...',
      '.#...#.',
      '..###..',
      '#.###.#',
      '..###..',
      '.#...#.',
      '...#...',
    ] },
    spring: { colour: '#8fcf86', art: [
      '.#.#.#.',
      '.#####.',
      '.#####.',
      '..###..',
      '...#...',
      '.#.#...',
      '..##...',
    ] },
    autumn: { colour: '#e0b13a', art: [
      '....###',
      '...####',
      '..#####',
      '.#####.',
      '.####..',
      '.#.#...',
      '#......',
    ] },
    dark: { colour: '#a9c8ee', art: [
      '...#...',
      '.#.#.#.',
      '..###..',
      '#######',
      '..###..',
      '.#.#.#.',
      '...#...',
    ] },
  };

  // Eat bursts: a dithered ring and a few sparks where an item was eaten,
  // fading out through the dither over BURST_MS (skipped for reduced motion).
  const BURST_MS = 440;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bursts = [];

  // The pointer over the board, for the idle grid's hover glow (CSS px in
  // the board's space); amount eases in and out.
  const HOVER_RADIUS = 120;
  // Columns over which the outer dots fade from game to faint.
  const FADE_CELLS = 6;
  const hover = { x: 0, y: 0, on: false, amount: 0 };

  let cols = 0;
  let cellPx = TARGET_CELL;
  let offX = 0; // CSS px from the board's left edge to the play area
  let extra = 0; // decorative grid columns either side of the play area
  let snake = [];
  let dir = [1, 0];
  let queued = [];
  let food = null;
  let score = 0;
  let best = 0;
  let state = 'idle'; // idle | playing | paused | over
  let visible = true;
  let last = 0;
  let acc = 0;
  let raf = 0;

  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { /* storage blocked */ }
  bestEl.textContent = best;

  // Colours: the snake and food in the season's accent, the grid in a faint
  // tint of the text colour.
  const ACCENTS = { normal: '#9ed49a', spring: '#7fb2e0', autumn: '#c2703d', dark: '#7aa5d8' };
  let colours = null;
  function readColours() {
    const css = getComputedStyle(document.documentElement);
    const theme = document.documentElement.getAttribute('data-theme') || 'normal';
    // Theme colours as plain rgb, via a probe element that resolves them.
    const rgb = (value) => {
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const out = getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number);
      probe.remove();
      return out;
    };
    const text = rgb(css.getPropertyValue('--text').trim() || '#333');
    const bg = rgb(css.getPropertyValue('--bg').trim() || '#fff');
    const food = FOOD[theme] || FOOD.normal;
    colours = {
      accent: ACCENTS[theme] || ACCENTS.normal,
      accentRgb: rgb(ACCENTS[theme] || ACCENTS.normal),
      food: rgb(food.colour),
      foodArt: food.art,
      // The grid as a solid faint colour (the text mixed 18% into the page),
      // since single dithered pixels can't carry transparency.
      grid: text.map((v, i) => Math.round(bg[i] + (v - bg[i]) * 0.18)),
      gridFaint: text.map((v, i) => Math.round(bg[i] + (v - bg[i]) * 0.08)),
      // The head's face, cut out of it in the page colour.
      face: bg,
    };
  }

  function size() {
    // The play area is the text column's width; the board itself runs the
    // full width of the page, the dot grid carrying on either side of it.
    // Measured from the column's content box (its padding excluded), and
    // placed where that box actually sits relative to the board.
    const pcs = getComputedStyle(playArea);
    const padL = parseFloat(pcs.paddingLeft) || 0;
    const padR = parseFloat(pcs.paddingRight) || 0;
    const playWidth = playArea.clientWidth - padL - padR;
    const width = wrap.clientWidth;
    const nextCols = Math.max(12, Math.round(playWidth / TARGET_CELL));
    const changed = nextCols !== cols;
    cols = nextCols;
    cellPx = playWidth / cols;
    offX = Math.max(0, playArea.getBoundingClientRect().left + padL - wrap.getBoundingClientRect().left);
    extra = Math.ceil(offX / cellPx);
    const height = cellPx * ROWS;
    // One canvas pixel per PX CSS px, scaled up without smoothing (CSS), so
    // the dither reads as chunky pixels.
    board.width = Math.round(width / PX);
    board.height = Math.round(height / PX);
    board.style.width = `${width}px`;
    board.style.height = `${height}px`;
    if (changed && state !== 'playing') reset();
    draw(performance.now());
  }

  function reset() {
    const y = Math.floor(ROWS / 2);
    const x = Math.floor(cols / 3);
    snake = [[x, y], [x - 1, y], [x - 2, y], [x - 3, y]];
    bursts = [];
    dir = [1, 0];
    queued = [];
    score = 0;
    scoreEl.textContent = score;
    placeFood();
  }

  function placeFood() {
    const taken = new Set(snake.map(([x, y]) => `${x},${y}`));
    let spot;
    // Never in the top row, where the grid fades into the page.
    do { spot = [Math.floor(Math.random() * cols), 1 + Math.floor(Math.random() * (ROWS - 1))]; } while (taken.has(`${spot[0]},${spot[1]}`));
    food = spot;
  }

  // Cell centres in CSS px on the board. The play area sits in the middle
  // of a wider, full-width board, offX in from its left edge.
  const cx = (c) => (c + 0.5) * cellPx + offX;
  const cy = (c) => (c + 0.5) * cellPx;

  // Every shape is a squircle (a superellipse, |x|^4 + |y|^4 = r^4): the
  // soft rounded square of an app icon rather than a circle. Traced as a
  // polygon fine enough to read as a smooth curve at these sizes.
  const SQUIRCLE = (() => {
    const pts = [];
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      pts.push([Math.sign(c) * Math.sqrt(Math.abs(c)), Math.sign(s) * Math.sqrt(Math.abs(s))]);
    }
    return pts;
  })();

  function dot(x, y, r, colour, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.beginPath();
    SQUIRCLE.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * r, y + py * r) : ctx.moveTo(x + px * r, y + py * r)));
    ctx.closePath();
    ctx.fill();
  }

  function draw(now) {
    if (!colours) readColours();
    const W = board.width;
    const H = board.height;
    ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
    ctx.clearRect(0, 0, W * PX, H * PX);

    // How strong each of the snake's cells is: solid at the head, fainter
    // towards the tail.
    const strength = new Map();
    const n = snake.length;
    const pulse = Math.sin(now / 260);
    for (let i = n - 1; i >= 0; i--) {
      const k = n > 1 ? i / (n - 1) : 0;
      strength.set(`${snake[i][0]},${snake[i][1]}`, i === 0 ? 1 : 0.9 - 0.55 * k);
    }

    // 1. The snake as plain coverage (full alpha): tail first, head on top.
    ctx.globalAlpha = 1;
    for (let i = n - 1; i >= 0; i--) {
      const k = n > 1 ? i / (n - 1) : 0;
      // The head is the same size as the body (only solid where the rest
      // dithers); from there the segments taper a little to the tail.
      dot(cx(snake[i][0]), cy(snake[i][1]), cellPx * (0.38 - 0.08 * k), colours.accent, 1);
    }

    // 2. Dither: a pixel inside a shape (coverage past half, so the outline
    //    stays a crisp pixel squircle) is lit when its cell's strength
    //    clears the Bayer threshold, so fainter segments break into the
    //    ordered pattern and the head stays solid.
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const gy = Math.floor((y + 0.5) * PX / cellPx);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
        const gx = Math.floor(((x + 0.5) * PX - offX) / cellPx);
        const st = strength.get(`${gx},${gy}`) ?? 1;
        d[i + 3] = st > bayer(x, y) ? 255 : 0;
      }
    }

    // 2b. A little smiley face on the head, in pixels, cut out in the page
    //     colour: two eyes and a smile, kept upright whichever way the snake
    //     is heading, so it always reads as a face. (x, y) from the head's
    //     centre, y down.
    if (n) {
      const [hx, hy] = snake[0];
      const ox = cx(hx) / PX;
      const oy = cy(hy) / PX;
      const smile = [[-1, -1], [1, -1], [-2, 1], [-1, 2], [0, 2], [1, 2], [2, 1]];
      smile.forEach(([a, b]) => {
        const x = Math.floor(ox + a);
        const y = Math.floor(oy + b);
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const i = (y * W + x) * 4;
        if (!d[i + 3]) return;
        d[i] = colours.face[0]; d[i + 1] = colours.face[1]; d[i + 2] = colours.face[2];
      });
    }

    // 3. The food: the season's icon, centred in its cell, breathing a
    //    little through the same dither.
    if (food) {
      const art = colours.foodArt;
      const ox = Math.floor(cx(food[0]) / PX) - Math.floor(art[0].length / 2);
      const oy = Math.floor(cy(food[1]) / PX) - Math.floor(art.length / 2);
      const st = 0.8 + 0.2 * pulse;
      art.forEach((row, ry) => [...row].forEach((ch, rx) => {
        const x = ox + rx;
        const y = oy + ry;
        if (ch !== '#' || x < 0 || y < 0 || x >= W || y >= H || st <= bayer(x, y)) return;
        const i = (y * W + x) * 4;
        d[i] = colours.food[0]; d[i + 1] = colours.food[1]; d[i + 2] = colours.food[2]; d[i + 3] = 255;
      }));
    }

    // 4. The grid: one faint pixel at the centre of every empty cell. While
    //    no game is running, the dots near the pointer swell into little
    //    blocks (in the grid's own colour), shrinking back with distance
    //    through the dither, with a slow ripple running out from the cursor.
    const foodKey = food ? `${food[0]},${food[1]}` : '';
    hover.amount += ((hover.on && state !== 'playing' ? 1 : 0) - hover.amount) * 0.12;
    const lit = hover.amount > 0.01;
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = -extra; gx < cols + extra; gx++) {
        if (strength.has(`${gx},${gy}`) || `${gx},${gy}` === foodKey) continue;
        // Outside the play area the dots are a step fainter, so the field
        // you can actually play in still reads.
        // Outside the play area the dots ease from the game's strength at its
        // edge down to the faint outer one over FADE_CELLS, so there's no
        // hard line where the field ends. The top row is faint throughout.
        const away = gx < 0 ? -gx : gx >= cols ? gx - cols + 1 : 0;
        const fadeRow = gy === 0;
        const mixK = fadeRow ? 1 : Math.min(1, away / FADE_CELLS);
        const dotColour = mixK === 0 ? colours.grid : mixK === 1 ? colours.gridFaint
          : colours.grid.map((v, i) => Math.round(v + (colours.gridFaint[i] - v) * (mixK * mixK * (3 - 2 * mixK))));
        const x = Math.floor(cx(gx) / PX);
        const y = Math.floor(cy(gy) / PX);
        let st = 0;
        if (lit) {
          const dist = Math.hypot(cx(gx) - hover.x, cy(gy) - hover.y);
          const near = Math.max(0, 1 - dist / HOVER_RADIUS);
          const ripple = 0.7 + 0.3 * Math.sin(dist / 14 - now / 170);
          st = Math.min(1, near * (0.55 + 0.45 * near) * ripple * hover.amount * 1.15);
        }
        const size = st > 0.1 ? 1 + Math.round(st * 3) : 1;
        const off = Math.floor((size - 1) / 2);
        for (let py = 0; py < size; py++) {
          for (let px = 0; px < size; px++) {
            const X = x - off + px;
            const Y = y - off + py;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const i = (Y * W + X) * 4;
            // The block's core is solid accent; its outer pixels dither in.
            const core = Math.abs(px - off) <= 0 && Math.abs(py - off) <= 0;
            const on = st > bayer(X, Y) * (core ? 0.5 : 1);
            if (!on && !(px === off && py === off)) continue;
            const c = dotColour;
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
          }
        }
      }
    }
    // 5. Eat bursts, over everything else: a ring that grows out of the
    //    eaten cell and thins as it goes, and six single-pixel sparks,
    //    both lit through the Bayer threshold at a fading strength.
    bursts = bursts.filter((bt) => now - bt.t < BURST_MS);
    bursts.forEach((bt) => {
      const k = (now - bt.t) / BURST_MS;
      const ease = 1 - Math.pow(1 - k, 3);
      const fade = 1 - k;
      const cx = bt.x / PX;
      const cy = bt.y / PX;
      const cellC = cellPx / PX;
      const radius = cellC * (0.35 + 0.8 * ease);
      const thick = Math.max(0.6, cellC * 0.22 * fade);
      const reach = Math.ceil(radius + thick + 1);
      const lit = (x, y, st) => {
        if (x < 0 || y < 0 || x >= W || y >= H || st <= bayer(x, y)) return;
        const i = (y * W + x) * 4;
        d[i] = bt.c[0]; d[i + 1] = bt.c[1]; d[i + 2] = bt.c[2]; d[i + 3] = 255;
      };
      for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
        for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
          const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (Math.abs(dist - radius) <= thick) lit(x, y, fade * 0.6);
        }
      }
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + Math.PI / 6;
        const r = cellC * (0.6 + 1.3 * ease);
        const sx = Math.floor(cx + Math.cos(ang) * r);
        const sy = Math.floor(cy + Math.sin(ang) * r);
        lit(sx, sy, fade * 0.8);
      }
    });

    ctx.putImageData(img, 0, 0);
  }

  function step() {
    if (queued.length) dir = queued.shift();
    const [hx, hy] = snake[0];
    const head = [(hx + dir[0] + cols) % cols, (hy + dir[1] + ROWS) % ROWS];
    const eating = food && head[0] === food[0] && head[1] === food[1];
    // Into itself (the tail's square is fine unless it's about to grow).
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some(([x, y]) => x === head[0] && y === head[1])) return gameOver();
    snake.unshift(head);
    if (eating) {
      score += 1;
      scoreEl.textContent = score;
      if (score > best) {
        best = score;
        bestEl.textContent = best;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage blocked */ }
      }
      if (!reduceMotion) bursts.push({ x: cx(food[0]), y: cy(food[1]), t: performance.now(), c: colours.food });
      placeFood();
    } else {
      snake.pop();
    }
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    if (state === 'playing') {
      acc += Math.min(250, now - last);
      while (acc >= TICK && state === 'playing') { acc -= TICK; step(); }
    }
    last = now;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function kick() {
    if (!raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    clearHint();
    // A pause icon on a little bordered tile (styled like the "More about
    // me" thumbnails), then how to resume.
    overlay.innerHTML = '';
    const line = document.createElement('span');
    line.className = 'snake-status-hint snake-status-paused';
    const icon = document.createElement('span');
    icon.className = 'snake-pause-icon';
    icon.setAttribute('aria-hidden', 'true');
    line.append(icon, `${verb[0].toUpperCase()}${verb.slice(1)} to resume`);
    overlay.append(line);
    overlay.hidden = false;
    wrap.classList.remove('is-playing');
    wrap.classList.add('is-paused');
  }

  // A new game (not a resume) shows how to steer under the board for a
  // few seconds (3.5s), then fades it away.
  const HINT_MS = 3500;
  // The season's line under the steering hint.
  const GOALS = {
    spring: 'Snag every blossom!',
    normal: 'Chase the summer rays!',
    autumn: 'Sweep up the falling leaves!',
    dark: 'Catch the snowflakes!',
  };
  let hintTimer = 0;
  function clearHint() {
    clearTimeout(hintTimer);
    overlay.classList.remove('is-fading');
  }
  function showHint() {
    clearHint();
    // How to steer, then a line for the season's item.
    overlay.innerHTML = '';
    const how = document.createElement('span');
    how.className = 'snake-status-title';
    how.textContent = verb === 'tap' ? 'Use the arrows below to steer' : 'Use arrow keys to navigate';
    const goal = document.createElement('span');
    goal.className = 'snake-status-hint';
    goal.textContent = GOALS[document.documentElement.getAttribute('data-theme')] || GOALS.normal;
    overlay.append(how, goal);
    overlay.hidden = false;
    hintTimer = setTimeout(() => {
      if (state !== 'playing') return;
      overlay.classList.add('is-fading');
      hintTimer = setTimeout(() => {
        if (state === 'playing') overlay.hidden = true;
        overlay.classList.remove('is-fading');
      }, 400);
    }, HINT_MS);
  }

  function start() {
    if (state === 'playing') return;
    const fresh = state !== 'paused';
    if (state === 'over') reset();
    state = 'playing';
    acc = 0;
    if (fresh) {
      showHint();
    } else {
      clearHint();
      overlay.hidden = true;
    }
    wrap.classList.add('is-playing');
    wrap.classList.remove('is-paused', 'is-over');
    board.focus({ preventScroll: true });
    kick();
  }

  function gameOver() {
    state = 'over';
    clearHint();
    overlay.textContent = `Game over · ${score} (best ${best}) · ${verb} to play again`;
    overlay.hidden = false;
    wrap.classList.remove('is-playing');
    wrap.classList.add('is-over');
  }

  function turn(next) {
    const lastDir = queued.length ? queued[queued.length - 1] : dir;
    // No reversing straight back into yourself, and no repeats.
    if (next[0] === -lastDir[0] && next[1] === -lastDir[1]) return;
    if (next[0] === lastDir[0] && next[1] === lastDir[1]) return;
    if (queued.length < 3) queued.push(next);
  }

  const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
  };

  board.addEventListener('keydown', (event) => {
    // Space pauses and resumes; it (or Enter) also starts a new game.
    if (event.key === ' ') {
      event.preventDefault();
      if (state === 'playing') pause();
      else start();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (state !== 'playing') start();
      return;
    }
    const next = KEYS[event.key];
    if (!next) return;
    // Only while the board has focus, so the arrows never steal the page's
    // own scrolling anywhere else.
    event.preventDefault();
    if (state !== 'playing') start();
    turn(next);
  });

  // A click (or tap) on the board starts a game, and mid-game pauses and
  // resumes it, as Space does.
  wrap.addEventListener('click', () => {
    if (state === 'playing') pause();
    else start();
  });

  // Touch screens get the on-screen arrows (.is-touch on the section):
  // detected up front where the browser says so, and otherwise the first
  // time the board is touched.
  const section = board.closest('section') || wrap;
  const touchy = window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches
    || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches;
  if (touchy) section.classList.add('is-touch');
  board.addEventListener('touchstart', () => section.classList.add('is-touch'), { passive: true, once: true });

  // The on-screen arrows (touch screens): each turns the snake the moment a
  // finger lands, rather than on release, so it keeps up with play.
  document.querySelectorAll('.snake-dpad-btn').forEach((btn) => {
    const next = btn.dataset.dir.split(',').map(Number);
    btn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (state === 'playing') turn(next);
    });
    // Keyboard / assistive activation still works through click.
    btn.addEventListener('click', (event) => {
      if (event.detail === 0 && state === 'playing') turn(next);
    });
  });

  // Track the pointer for the idle grid's hover glow (mouse only).
  board.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const r = board.getBoundingClientRect();
    hover.x = event.clientX - r.left;
    hover.y = event.clientY - r.top;
    hover.on = true;
  });
  board.addEventListener('pointerleave', () => { hover.on = false; });

  // Swipes on touch: the direction of the larger movement.
  let touch = null;
  board.addEventListener('touchstart', (event) => {
    const t = event.touches[0];
    touch = [t.clientX, t.clientY];
  }, { passive: true });
  board.addEventListener('touchmove', (event) => {
    if (state === 'playing') event.preventDefault();
  }, { passive: false });
  board.addEventListener('touchend', (event) => {
    if (!touch) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touch[0];
    const dy = t.clientY - touch[1];
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; // a tap: the click starts it
    turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
  });

  // Pause off screen and in a hidden tab; carry on when back.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }).observe(board);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  // New theme, new colours.
  new MutationObserver(() => { colours = null; draw(performance.now()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.addEventListener('resize', size);
  reset();
  size();
  kick();
})();
