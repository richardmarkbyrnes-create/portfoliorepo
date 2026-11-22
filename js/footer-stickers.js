// Footer sticker press. On the home page the foot of the page becomes a
// stamp pad: the cursor is a stamp, and pressing anywhere across the full
// width of the footer (off the links) drops a pixel-art sticker of the
// season's things at that spot, in the same 7x7 style as the Snake's food.
// The pad runs from under the links row to the foot of the page, the full
// width. Stickers last the visit (a reload clears them) and
// redraw in the new season when the theme is switched. They're drawn on a
// body-level layer above the bottom progressive blur, so they stay sharp.
(() => {
  if (document.body.dataset.page !== 'home') return;
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  const MAX = 80;
  // How long a pressed sticker holds before it starts to fade, and how long
  // the fade takes (kept in step with the CSS transition).
  const HOLD_MS = 4000;
  const FADE_MS = 3000;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Five stickers per season, each in its own colour within the season's
  // palette. Summer bright and seaside; spring soft pastels; autumn golds,
  // rusts and olive; winter snow, ice, a warm red and a green. The simpler
  // shapes are 7x7, the ones that need the room 9x9.
  const SETS = {
    normal: [
      // Sun
      { colour: '#f6c445', art: ['...#...', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '...#...'] },
      // Ice cream
      { colour: '#f7a8b8', art: ['..###..', '.#####.', '.#####.', '#######', '.#.#.#.', '..#.#..', '...#...'] },
      // Sunglasses
      { colour: '#3d6b8f', art: ['.........', '.........', '#########', '.###.###.', '.###.###.', '..#...#..', '.........', '.........', '.........'] },
      // Starfish
      { colour: '#f08a4b', art: ['....#....', '...###...', '...###...', '#.#####.#', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'] },
      // Sailboat
      { colour: '#4aa3df', art: ['...#...', '..##...', '.###...', '####...', '...#...', '#######', '.#####.'] },
    ],
    spring: [
      // Tulip
      { colour: '#f0a3c0', art: ['.#.#.#.', '.#####.', '.#####.', '..###..', '...#...', '.#.#...', '..##...'] },
      // Butterfly: antennae, big upper wings, small lower ones
      { colour: '#c7a3e6', art: ['.#.....#.', '..#.#.#..', '.##.#.##.', '####.####', '####.####', '.###.###.', '..##.##..', '..##.##..', '.........'] },
      // Raindrop
      { colour: '#6fb1e3', art: ['...#...', '...#...', '..###..', '.#####.', '#######', '#######', '.#####.'] },
      // Green leaf
      { colour: '#7cc47a', art: ['.......#.', '....####.', '..######.', '.#######.', '.#######.', '.######..', '..####...', '...#.....', '..#......'] },
      // Bunny
      { colour: '#f3dc7a', art: ['.##...##.', '.##...##.', '.##...##.', '.#######.', '#########', '##.###.##', '#########', '.#######.', '..#####..'] },
    ],
    autumn: [
      // Leaf
      { colour: '#d4a12a', art: ['....###', '...####', '..#####', '.#####.', '.####..', '.#.#...', '#......'] },
      // Acorn
      { colour: '#8f5a2b', art: ['...#...', '.#####.', '#######', '.#####.', '.#####.', '..###..', '...#...'] },
      // Mushroom
      { colour: '#b24a3a', art: ['..###..', '.#####.', '#######', '#######', '..###..', '..###..', '..###..'] },
      // Pumpkin (a carved one: the face makes it read)
      { colour: '#e07b2a', art: ['....#....', '...##....', '.#######.', '#########', '##.###.##', '#########', '#.#####.#', '##.....##', '.#######.'] },
      // Umbrella
      { colour: '#7f8c5a', art: ['..###..', '.#####.', '#######', '#######', '...#...', '...#...', '.##....'] },
    ],
    dark: [
      // Snowflake
      { colour: '#f2f2f4', art: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'] },
      // Snowman: head with eyes, stick arms, round body
      { colour: '#b8cbe0', art: ['..#####..', '.##.#.##.', '..#####..', '#..###..#', '.#######.', '#########', '#########', '#########', '.#######.'] },
      // Mitten: thumb out to the left, cuff below a gap
      { colour: '#c75b5b', art: ['...#####.', '..######.', '..######.', '#.######.', '##.#####.', '.#######.', '..######.', '.........', '..######.'] },
      // Fir tree
      { colour: '#6f9a7c', art: ['...#...', '..###..', '.#####.', '..###..', '.#####.', '#######', '...#...'] },
      // Hot drink
      { colour: '#d9b48f', art: ['.#...#.', '..#.#..', '.......', '#####..', '#####.#', '#####.#', '.###...'] },
    ],
  };

  const theme = () => document.documentElement.getAttribute('data-theme') || 'normal';
  const setFor = () => SETS[theme()] || SETS.normal;

  // Each sticker as an SVG: the art's cells, with a one-cell rim around
  // them (coloured in CSS: white on the light seasons, lifted grey in
  // winter), drawn crisp. One extra cell of margin all round for the rim.
  const cellPath = (cells) => cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('');
  function svgFor(kind) {
    const { art, colour } = kind;
    const cols = Math.max(...art.map((row) => row.length));
    const rows = art.length;
    const ink = [];
    const inkSet = new Set();
    art.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '#') { ink.push([x + 1, y + 1]); inkSet.add(`${x + 1},${y + 1}`); }
    }));
    const rim = [];
    const seen = new Set();
    ink.forEach(([x, y]) => {
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
        const k = `${x + dx},${y + dy}`;
        if (!inkSet.has(k) && !seen.has(k)) { seen.add(k); rim.push([x + dx, y + dy]); }
      }
    });
    return `<svg viewBox="0 0 ${cols + 2} ${rows + 2}" shape-rendering="crispEdges" aria-hidden="true"><path class="footer-sticker-rim" d="${cellPath(rim)}"/><path fill="${colour}" d="${cellPath(ink)}"/></svg>`;
  }

  // A ghost of a sticker: its cells only, in the text colour (set in CSS),
  // for the faint row that hints at the pad.
  function ghostSvgFor(kind) {
    const { art } = kind;
    const cols = Math.max(...art.map((row) => row.length));
    const cells = [];
    art.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') cells.push([x, y]); }));
    return `<svg viewBox="0 0 ${cols} ${art.length}" width="${cols * 4}" height="${art.length * 4}" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${cellPath(cells)}"/></svg>`;
  }

  // The stamp cursor, drawn here rather than in CSS so a 2px line under its
  // base can show the colour of the sticker that will be pressed next. The
  // same pixel stamp as before: white body, black outline, 2px a cell,
  // hotspot at the foot of the base; the pressed one has a shorter handle.
  const STAMP_UP = ['....####....', '....####....', '.....##.....', '.....##.....', '.....##.....', '..########..', '.##########.', '############', '############'];
  const STAMP_DOWN = ['....####....', '....####....', '.....##.....', '..########..', '.##########.', '############', '############'];
  function cursorFor(rows, colour) {
    const cell = 2;
    const ink = new Set();
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') ink.add(`${x},${y}`); }));
    const rim = new Set();
    ink.forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
        const n = `${x + dx},${y + dy}`;
        if (!ink.has(n)) rim.add(n);
      }
    });
    // Everything shifted one cell right and down for the rim; the colour
    // line sits one cell under the rim's bottom edge.
    const cols = rows[0].length + 2;
    const stampRows = rows.length + 2;
    const w = cols * cell;
    // Under the stamp: a 4px colour line with a 1px white border round it.
    const lineH = 4;
    const lineY = stampRows * cell;
    const h = lineY + lineH + 2;
    const path = (cells) => [...cells].map((k) => k.split(',').map(Number))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      .map(([x, y]) => `M${(x + 1) * cell} ${(y + 1) * cell}h${cell}v${cell}h-${cell}z`).join('');
    const lineW = w - cell * 2;
    const border = `M${cell - 1} ${lineY}h${lineW + 2}v${lineH + 2}h-${lineW + 2}z`;
    const line = `M${cell} ${lineY + 1}h${lineW}v${lineH}h-${lineW}z`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>`
      + `<path fill='#fff' d='${path(ink)}'/><path fill='#111' d='${path(rim)}'/><path fill='#fff' d='${border}'/><path fill='${colour}' d='${line}'/></svg>`;
    // Hotspot: the foot of the base, just above the colour line.
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${w / 2} ${stampRows * cell - cell}, pointer`;
  }
  function updateCursor() {
    const set = setFor();
    const colour = set[next % set.length].colour;
    footer.style.setProperty('--stamp-cursor', cursorFor(STAMP_UP, colour));
    footer.style.setProperty('--stamp-cursor-down', cursorFor(STAMP_DOWN, colour));
  }

  // The pad: a full-bleed box behind the footer's content, from just under
  // the links row to the foot of the page, that takes the presses.
  const base = footer.querySelector('.site-footer-base');
  const zone = document.createElement('div');
  zone.className = 'footer-sticker-zone';
  zone.setAttribute('aria-hidden', 'true');
  footer.prepend(zone);
  footer.classList.add('sticker-press');

  // The hint: the season's five stickers as ghosts, centred low on the pad.
  // They fade once the first sticker is pressed.
  const ghosts = document.createElement('div');
  ghosts.className = 'footer-sticker-ghosts';
  zone.append(ghosts);
  function renderGhosts() {
    ghosts.replaceChildren(...setFor().slice(0, 3).map((kind) => {
      const g = document.createElement('span');
      g.className = 'footer-sticker-ghost';
      g.innerHTML = ghostSvgFor(kind);
      return g;
    }));
  }

  // The stickers, on a body-level layer kept over the pad's document box so
  // they sit above the fixed bottom blur rather than under it.
  const layer = document.createElement('div');
  layer.className = 'footer-stickers';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  // The layer is clipped (CSS) so no sticker can lengthen the document; it
  // bleeds this far above the pad so stickers pressed near its top aren't
  // cut by the clip. Positions are stored relative to the pad itself.
  const BLEED = 40;
  // Document position from layout offsets, not getBoundingClientRect: the
  // page's entrance slides content with a transform, and a rect measured
  // mid-slide put the layer past the body's foot, lengthening the page
  // until the next fit.
  function docOffset(el) {
    let x = 0;
    let y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  }
  function fit() {
    if (base) {
      zone.style.top = `${Math.max(0, base.offsetTop + base.offsetHeight + 12)}px`;
    }
    const { x, y } = docOffset(zone);
    layer.style.left = `${x}px`;
    layer.style.top = `${y - BLEED}px`;
    layer.style.width = `${zone.offsetWidth}px`;
    layer.style.height = `${zone.offsetHeight + BLEED}px`;
  }

  // Stickers in CSS px from the pad's top centre, so they hold their place
  // (relative to the centred content) when the window changes width rather
  // than squeezing together; kind cycles through the season's set.
  let stickers = [];
  let next = 0;

  function place(el, s) {
    const art = setFor()[s.k % setFor().length].art;
    const w = (Math.max(...art.map((row) => row.length)) + 2) * 4;
    const h = (art.length + 2) * 4;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
    el.style.left = `calc(50% + ${s.x}px)`;
    el.style.top = `${s.y + BLEED}px`;
    el.style.setProperty('--rot', `${s.r}deg`);
    el.style.setProperty('--s', s.s || 1);
  }

  function render() {
    updateCursor();
    renderGhosts();
    const set = setFor();
    layer.replaceChildren(...stickers.map((s) => {
      const el = document.createElement('span');
      el.className = 'footer-sticker';
      el.innerHTML = svgFor(set[s.k % set.length]);
      place(el, s);
      return el;
    }));
  }

  function press(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('a, button, input, [data-copy-email], .site-footer-base')) return;
    const rect = zone.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Only within the pad: everything above it is left alone.
    if (e.clientY < rect.top) return;
    const set = setFor();
    const kind = set[next % set.length];
    const scale = Math.round((0.85 + Math.random() * 0.3) * 100) / 100;
    // Keep the sticker's whole box within the pad's bottom edge: anything
    // hanging below the page's foot would lengthen the document and nudge
    // the page as it lands.
    const half = (kind.art.length + 2) * 4 * scale * 0.75 + 6;
    const s = {
      x: Math.round(e.clientX - (rect.left + rect.width / 2)),
      y: Math.round(Math.min(e.clientY - rect.top, rect.height - half)),
      r: Math.round(-14 + Math.random() * 28),
      // A little size variation, so a run of stickers reads hand-placed.
      s: scale,
      k: next % set.length,
    };
    next += 1;
    stickers.push(s);
    updateCursor();
    ghosts.classList.add('is-done');
    while (stickers.length > MAX) stickers.shift();
    fit();

    const el = document.createElement('span');
    el.className = `footer-sticker${reduce ? '' : ' is-pressing'}`;
    el.innerHTML = svgFor(set[s.k]);
    place(el, s);
    if (layer.children.length >= MAX) layer.firstElementChild.remove();
    layer.append(el);
    el.addEventListener('animationend', () => el.classList.remove('is-pressing'), { once: true });
    // Stickers are passing: after a few seconds each starts a slow fade and
    // is cleared once it has gone.
    setTimeout(() => {
      el.classList.add('is-fading');
      const gone = () => { el.remove(); const i = stickers.indexOf(s); if (i >= 0) stickers.splice(i, 1); };
      el.addEventListener('transitionend', gone, { once: true });
      setTimeout(gone, FADE_MS + 200); // backstop
    }, HOLD_MS);

    // The stamp cursor dips for a beat.
    footer.classList.add('is-stamping');
    clearTimeout(press.t);
    press.t = setTimeout(() => footer.classList.remove('is-stamping'), 140);
  }

  footer.addEventListener('pointerdown', press);
  render();
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  // And again once the page's entrance has played out.
  document.addEventListener('page-entering-go', () => setTimeout(fit, 900));
  setTimeout(fit, 1600);
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(document.body);

  // Season switch: the same stickers, redrawn in the new season's set.
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
