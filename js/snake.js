// Snake at the bottom of the home page, as dithered squircles on a dot
// grid: a faint pixel marks every cell, the snake is a run of rounded
// squares in the season's accent, solid at the head and tapering and
// thinning out towards the tail, and the food is the season's icon (a sun,
// tulip, leaf or snowflake) in pixel art, gently pulsing.
// Drawn at one canvas pixel per 2 CSS px, each shape a crisp pixel
// squircle filled with a 4x4 ordered (Bayer) dither at its strength, like
// the texture; sized so the board spans the text column exactly. Click or
// tap the board (or focus it and press Enter / Space) to play; Space
// pauses and resumes; arrow keys or WASD steer while it has focus, swipes
// on touch. The best score is kept in localStorage. It pauses off screen
// and in a hidden tab.
(function () {
  const board = document.querySelector('.snake-board');
  if (!board) return;
  const ctx = board.getContext('2d');
  if (!ctx) return;
  const wrap = board.parentElement;
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
  const verb = window.matchMedia('(pointer: coarse)').matches ? 'tap' : 'click';
  // Before a first game: an invitation, with how to start under it.
  overlay.innerHTML = '';
  const invite = document.createElement('span');
  invite.className = 'snake-status-title';
  invite.textContent = 'Game of Snake?';
  const how = document.createElement('span');
  how.className = 'snake-status-hint';
  how.textContent = `${verb[0].toUpperCase()}${verb.slice(1)} to play`;
  overlay.append(invite, how);

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
    spring: { colour: '#e48fb0', art: [
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

  let cols = 0;
  let cellPx = TARGET_CELL;
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
  const ACCENTS = { normal: '#4f86e0', spring: '#4f9a62', autumn: '#c2703d', dark: '#7aa5d8' };
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
      food: rgb(food.colour),
      foodArt: food.art,
      // The grid as a solid faint colour (the text mixed 18% into the page),
      // since single dithered pixels can't carry transparency.
      grid: text.map((v, i) => Math.round(bg[i] + (v - bg[i]) * 0.18)),
    };
  }

  function size() {
    const width = wrap.clientWidth;
    const nextCols = Math.max(12, Math.round(width / TARGET_CELL));
    const changed = nextCols !== cols;
    cols = nextCols;
    cellPx = width / cols;
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
    dir = [1, 0];
    queued = [];
    score = 0;
    scoreEl.textContent = score;
    placeFood();
  }

  function placeFood() {
    const taken = new Set(snake.map(([x, y]) => `${x},${y}`));
    let spot;
    do { spot = [Math.floor(Math.random() * cols), Math.floor(Math.random() * ROWS)]; } while (taken.has(`${spot[0]},${spot[1]}`));
    food = spot;
  }

  const centre = (c) => (c + 0.5) * cellPx;

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
      dot(centre(snake[i][0]), centre(snake[i][1]), cellPx * (0.38 - 0.08 * k), colours.accent, 1);
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
        const gx = Math.floor((x + 0.5) * PX / cellPx);
        const st = strength.get(`${gx},${gy}`) ?? 1;
        d[i + 3] = st > bayer(x, y) ? 255 : 0;
      }
    }

    // 3. The food: the season's icon, centred in its cell, breathing a
    //    little through the same dither.
    if (food) {
      const art = colours.foodArt;
      const ox = Math.floor(centre(food[0]) / PX) - Math.floor(art[0].length / 2);
      const oy = Math.floor(centre(food[1]) / PX) - Math.floor(art.length / 2);
      const st = 0.8 + 0.2 * pulse;
      art.forEach((row, ry) => [...row].forEach((ch, rx) => {
        const x = ox + rx;
        const y = oy + ry;
        if (ch !== '#' || x < 0 || y < 0 || x >= W || y >= H || st <= bayer(x, y)) return;
        const i = (y * W + x) * 4;
        d[i] = colours.food[0]; d[i + 1] = colours.food[1]; d[i + 2] = colours.food[2]; d[i + 3] = 255;
      }));
    }

    // 4. The grid: one faint pixel at the centre of every empty cell.
    const foodKey = food ? `${food[0]},${food[1]}` : '';
    for (let gy = 0; gy < ROWS; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (strength.has(`${gx},${gy}`) || `${gx},${gy}` === foodKey) continue;
        const x = Math.floor(centre(gx) / PX);
        const y = Math.floor(centre(gy) / PX);
        const i = (y * W + x) * 4;
        d[i] = colours.grid[0]; d[i + 1] = colours.grid[1]; d[i + 2] = colours.grid[2]; d[i + 3] = 255;
      }
    }
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
    overlay.textContent = `Paused · space to resume`;
    overlay.hidden = false;
    wrap.classList.remove('is-playing');
    wrap.classList.add('is-paused');
  }

  function start() {
    if (state === 'playing') return;
    if (state === 'over') reset();
    state = 'playing';
    acc = 0;
    overlay.hidden = true;
    wrap.classList.add('is-playing');
    wrap.classList.remove('is-paused', 'is-over');
    board.focus({ preventScroll: true });
    kick();
  }

  function gameOver() {
    state = 'over';
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

  wrap.addEventListener('click', () => start());

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
