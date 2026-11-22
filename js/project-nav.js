// The next-project pill drawn as one rounded path. A glass layer is clipped to
// it (fill and blur); an SVG traces it for the shadow (masked to the outside,
// so it never darkens the glass) and the hairline border. Rebuilt whenever the
// pill changes size.
function buildBubble(pill) {
  const NS = 'http://www.w3.org/2000/svg';
  // Room round the shape for the blurred shadow (7px blur, nudged 4px down).
  const PAD = 32;
  const R = 18;
  const glass = document.createElement('span');
  glass.className = 'pc-bubble-glass';
  glass.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pc-bubble-svg');
  svg.setAttribute('aria-hidden', 'true');
  const uid = `bubble-${Math.random().toString(36).slice(2, 8)}`;
  svg.innerHTML = `
    <defs><mask id="${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect x="0" y="0" width="100%" height="100%" fill="#fff"/><path class="m" fill="#000"/></mask></defs>
    <path class="pc-bubble-shadow" mask="url(#${uid})"/>
    <path class="pc-bubble-line"/>`;
  pill.prepend(svg);
  pill.prepend(glass);
  pill.classList.add('has-bubble');

  const shapeAt = (ox, oy, w, h) => {
    const r = Math.min(R, h / 2);
    return [
      `M${ox + r},${oy}`, `H${ox + w - r}`, `A${r},${r} 0 0 1 ${ox + w},${oy + r}`,
      `V${oy + h - r}`, `A${r},${r} 0 0 1 ${ox + w - r},${oy + h}`,
      `H${ox + r}`, `A${r},${r} 0 0 1 ${ox},${oy + h - r}`,
      `V${oy + r}`, `A${r},${r} 0 0 1 ${ox + r},${oy}`, 'Z',
    ].join(' ');
  };

  const layout = () => {
    // Fractional size, not offsetWidth: that rounds to whole pixels, which
    // left the bubble a sliver short of the pill's right edge. The pill is
    // border-box, so its computed width/height are the full outer size,
    // unaffected by its hover/dock transforms.
    const cs = getComputedStyle(pill);
    const w = parseFloat(cs.width);
    const h = parseFloat(cs.height);
    if (!w || !h) return;
    // The pill's 1px border sits outside its padding box, where absolute
    // children are measured from.
    svg.style.left = `${-PAD - 1}px`;
    svg.style.top = `${-PAD - 1}px`;
    svg.setAttribute('width', w + PAD * 2);
    svg.setAttribute('height', h + PAD * 2);
    const outer = shapeAt(PAD, PAD, w, h);
    svg.querySelector('.m').setAttribute('d', outer);
    const shadow = svg.querySelector('.pc-bubble-shadow');
    shadow.setAttribute('d', shapeAt(PAD, PAD + 4, w, h));
    const line = shapeAt(PAD + 0.5, PAD + 0.5, w - 1, h - 1);
    svg.querySelector('.pc-bubble-line').setAttribute('d', line);
    glass.style.clipPath = `path('${shapeAt(0, 0, w, h)}')`;
  };
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(pill);
  if (document.fonts?.ready) document.fonts.ready.then(layout);
}

// Quote reveal: the quote's words start light grey and darken one by one as
// it scrolls up through the screen, all dark by the time it reaches the upper
// third (or the end of the page, whichever comes first). Reduced motion shows it fully dark from the start.
function initQuoteReveal(el) {
  const words = el.textContent.split(/(\s+)/);
  el.textContent = '';
  const spans = [];
  words.forEach((part) => {
    if (/^\s+$/.test(part)) {
      el.append(part);
    } else if (part) {
      const span = document.createElement('span');
      span.className = 'pc-quote-word';
      span.textContent = part;
      el.append(span);
      spans.push(span);
    }
  });
  el.classList.add('is-revealing');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    spans.forEach((s) => s.classList.add('is-lit'));
    return;
  }
  let queued = false;
  const update = () => {
    queued = false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const y = window.scrollY;
    const top = rect.top + y;
    const maxScroll = document.documentElement.scrollHeight - vh;
    // Starts as soon as the quote's top enters the screen; finishes when its
    // bottom reaches halfway up — or at the end of the page, if it's too near
    // the bottom to ever get that high.
    const startY = top - vh * 1.0;
    const endY = Math.min(top + rect.height - vh * 0.5, maxScroll);
    const progress = endY <= startY ? 1 : Math.min(1, Math.max(0, (y - startY) / (endY - startY)));
    const lit = Math.round(progress * spans.length);
    spans.forEach((s, i) => s.classList.toggle('is-lit', i < lit));
  };
  const onScroll = () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

(function () {
  const PROJECT_TRANSITION_MS = 320;
  const LEAVE_KEY = 'portfolio-project-leave';
  const FROM_HOME_KEY = 'portfolio-from-home';
  // Which way the next page should arrive from. Read and cleared by
  // theme-init.js in the head — keep the name in step there.

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function projectHref(slug) {
    return `/${slug}/`;
  }

  function openLightbox(src) {
    let lb = document.querySelector('.pc-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'pc-lightbox';
      const img = document.createElement('img');
      img.className = 'pc-lightbox-img';
      img.alt = '';
      lb.appendChild(img);
      document.body.appendChild(lb);
      lb.addEventListener('click', () => lb.classList.remove('is-open'));
    }
    lb.querySelector('.pc-lightbox-img').src = src;
    lb.classList.add('is-open');
  }

  function navigateWithFade(href, { leaveProject = false } = {}) {
    if (prefersReducedMotion()) {
      window.location.href = href;
      return;
    }
    document.body.classList.add('page-is-leaving');
    // Heading home: the close button slides out and the toolbar slides over
    // into its home-page corner (CSS). Leaving home for a project, the
    // toolbar slides left to where it sits on a project page, and the flag
    // tells that page to slide the close button in beside it (theme-init.js).
    // Project to project: the back button and toolbar stay put, so flag the
    // hop for the arriving page (theme-init.js) and hold them here.
    const hopTarget = new URL(href, window.location.href).pathname.split('/').filter(Boolean)[0];
    if (!leaveProject && document.body.dataset.page === 'project' && hopTarget && window.PROJECTS?.[hopTarget]) {
      try { sessionStorage.setItem('portfolio-project-hop', '1'); } catch (e) { /* storage blocked */ }
      document.body.classList.add('is-hopping');
    }
    if (leaveProject) {
      sessionStorage.setItem(LEAVE_KEY, '1');
      document.body.classList.add('is-leaving-home');
    } else if (document.body.dataset.page === 'home') {
      const target = new URL(href, window.location.href).pathname.split('/').filter(Boolean)[0];
      if (target && window.PROJECTS?.[target]) {
        sessionStorage.setItem(FROM_HOME_KEY, '1');
        document.body.classList.add('is-leaving-to-project');
      }
    }
    window.setTimeout(() => { window.location.href = href; }, PROJECT_TRANSITION_MS);
  }

  // Everything that isn't a work row or the project pill: nav links, the back
  // link, the next-project pill. They were plain navigations, so most of the site
  // cut straight to the next page while a couple of routes faded.
  function initLinkTransitions() {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a[href]');
      if (!link) return;
      if (link.hasAttribute('download')) return;
      if (link.target && link.target !== '_self') return;

      // Anything the browser shouldn't treat as a page load: mailto:, tel:,
      // javascript:, and off-site links.
      let url;
      try {
        url = new URL(link.getAttribute('href'), window.location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

      // A same-document jump (#main-content, the skip link) isn't a page change —
      // fading out and never navigating would leave the page blank.
      const samePage = url.pathname === window.location.pathname
        && url.search === window.location.search;
      if (samePage) return;

      event.preventDefault();
      navigateWithFade(url.href);
    });
  }

  // Fetch a project ahead of the click: its page and its hero image, the
  // moment the pointer reaches a link to it (or a finger touches down, or
  // focus lands on it). The fade-out before navigating then covers the
  // download, so the page arrives ready instead of building up in front of
  // you. Each project is only fetched once.
  const prefetched = new Set();

  function projectSlugFor(link) {
    let url;
    try {
      url = new URL(link.getAttribute('href'), window.location.href);
    } catch (err) {
      return null;
    }
    if (url.origin !== window.location.origin) return null;
    const slug = url.pathname.split('/').filter(Boolean)[0];
    return slug && window.PROJECTS?.[slug] && slug !== document.body.dataset.project ? slug : null;
  }

  function prefetchProject(slug) {
    if (prefetched.has(slug)) return;
    prefetched.add(slug);
    const page = document.createElement('link');
    page.rel = 'prefetch';
    page.href = `/${slug}/`;
    document.head.appendChild(page);
    const project = window.PROJECTS[slug];
    const hero = (project.images && project.images[0]) || project.heroImage || project.previewImage;
    if (hero) {
      const img = new Image();
      img.src = `/${hero.replace(/^\//, '')}`;
    }
  }

  function initPrefetch() {
    const onIntent = (event) => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      const slug = projectSlugFor(link);
      if (slug) prefetchProject(slug);
    };
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('touchstart', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
  }

  // The class only needs to survive the animation. Left on, it would replay the
  // entrance on anything that later re-runs the rule.
  function clearEntrance() {
    const root = document.documentElement;
    if (!root.classList.contains('page-entering')) return;

    const page = document.querySelector('.page');
    if (!page) {
      root.classList.remove('page-entering');
      return;
    }

    const done = () => root.classList.remove('page-entering');
    page.addEventListener('animationend', (event) => {
      if (event.animationName === 'pageBlurIn' || event.animationName === 'pageFadeIn') done();
    }, { once: true });
    // The timeout is the backstop in case animationend never comes, and it has
    // to outlast the entrance (0.52s). It only starts counting once the
    // entrance is released (theme-init.js holds it until the page has
    // painted); counted from here, it could strip the class mid-move.
    const arm = () => window.setTimeout(done, 800);
    if (root.classList.contains('page-entering-hold')) {
      document.addEventListener('page-entering-go', arm, { once: true });
    } else {
      arm();
    }
  }

  function initWorkLinks() {
    if (document.body.dataset.page !== 'home') return;

    document.querySelectorAll('.work-column--experience .work-row-main[data-project]').forEach((row) => {
      const slug = row.dataset.project;
      if (!window.PROJECTS?.[slug]) return;

      // In-progress rows don't navigate — nudge to signal they aren't clickable yet.
      if (row.classList.contains('work-row-main--wip')) {
        const nudge = () => {
          row.classList.remove('is-nudging');
          void row.offsetWidth; // restart the animation
          row.classList.add('is-nudging');
        };
        row.addEventListener('click', nudge);
        row.addEventListener('animationend', () => row.classList.remove('is-nudging'));
        row.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          nudge();
        });
        return;
      }

      // The row is a real link, so it works with JS off, opens in a new tab on
      // cmd-click, and needs no key handling — Enter activates it natively. The
      // handler only exists to swap the jump for the fade.
      row.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigateWithFade(projectHref(slug));
      });
    });
  }

  function initHomeReturn() {
    if (document.body.dataset.page !== 'home') return;
    if (!sessionStorage.getItem(LEAVE_KEY)) return;
    sessionStorage.removeItem(LEAVE_KEY);
    const navPrimary = document.querySelector('.nav-primary');
    if (navPrimary && !prefersReducedMotion()) navPrimary.classList.add('nav-returning');
    // The project page's frame carries over and eases out here, on the same
    // 0.7s curve it eased in on, then goes.
    if (!prefersReducedMotion() && window.matchMedia('(min-width: 769px)').matches) {
      const frame = document.createElement('div');
      frame.className = 'pc-back-frame pc-back-frame--leaving';
      frame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(frame);
      frame.addEventListener('animationend', () => frame.remove(), { once: true });
      setTimeout(() => frame.remove(), 1200);
    }
  }

  // Stipple shading on the hairline drawings: each plate's silhouette is
  // filled with a dot pattern that's sparse up top and thickens towards its
  // lower edge, like the side of a stippled engraving. Patterns are sized
  // in the shape's own bounding box so they ride along as the plates move,
  // with the dot size worked out per shape so it reads the same everywhere.
  function initHairlineStipple() {
    if (document.body.dataset.page !== 'project') return;
    const NS = 'http://www.w3.org/2000/svg';
    const CELL = 1.1; // dither grid, in drawing units
    const DOT = 0.8;  // square dot size, in drawing units
    let uid = 0;

    // 4x4 Bayer matrix: the order cells switch on as the shading deepens.
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    // How deep the shading reaches up from a plate's lower edge, in drawing
    // units: about a plate's thickness, so it sits on the side faces.
    const BAND = 7;
    // Dot probability by distance above the lower edge: dense at the edge,
    // thinning to nothing by the top of the band.
    const density = (d) => (d >= BAND ? 0 : 0.85 * Math.pow(1 - d / BAND, 1.2));
    function stipple(svg, shape) {
      let box;
      try { box = shape.getBBox(); } catch { return; }
      if (!box.width || !box.height) return;
      let defs = svg.querySelector(':scope > defs.hl-stipple-defs');
      if (!defs) {
        defs = document.createElementNS(NS, 'defs');
        defs.setAttribute('class', 'hl-stipple-defs');
        svg.prepend(defs);
      }
      const id = `hl-stipple-${++uid}`;
      const pat = document.createElementNS(NS, 'pattern');
      pat.setAttribute('id', id);
      pat.setAttribute('patternUnits', 'objectBoundingBox');
      pat.setAttribute('patternContentUnits', 'objectBoundingBox');
      pat.setAttribute('width', '1');
      pat.setAttribute('height', '1');
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('width', '1');
      bg.setAttribute('height', '1');
      bg.setAttribute('class', 'hl-stipple-bg');
      const dw = DOT / box.width;
      const dh = DOT / box.height;
      const pt = svg.createSVGPoint();
      const inside = (x, y) => { pt.x = x; pt.y = y; return shape.isPointInFill(pt); };
      let d = '';
      // Ordered dither: a fixed grid shared by every shape (so neighbouring
      // plates line up), each cell switched on when the shading there beats
      // its threshold in a 4x4 Bayer matrix.
      const i0 = Math.floor(box.x / CELL);
      const j0 = Math.floor(box.y / CELL);
      const i1 = Math.ceil((box.x + box.width) / CELL);
      const j1 = Math.ceil((box.y + box.height) / CELL);
      for (let j = j0; j < j1; j++) {
        for (let i = i0; i < i1; i++) {
          const x = (i + 0.5) * CELL;
          const y = (j + 0.5) * CELL;
          if (!inside(x, y)) continue;
          // Distance straight down to the shape's edge, capped at the band.
          let dist = 0;
          while (dist < BAND && inside(x, y + dist + 1)) dist += 1;
          const threshold = (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16;
          if (density(dist) <= threshold) continue;
          const u = (i * CELL - box.x) / box.width;
          const v = (j * CELL - box.y) / box.height;
          d += `M${u.toFixed(4)} ${v.toFixed(4)}h${dw.toFixed(4)}v${dh.toFixed(4)}h${(-dw).toFixed(4)}z`;
        }
      }
      const dots = document.createElementNS(NS, 'path');
      dots.setAttribute('d', d);
      dots.setAttribute('class', 'hl-stipple-dots');
      pat.append(bg, dots);
      defs.appendChild(pat);
      shape.style.fill = `url(#${id})`;
      shape.dataset.stipple = id;
    }

    // One shape per idle moment, so building the dots never holds up a
    // frame while the page is arriving or scrolling.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 16));
    function apply(svg) {
      svg.querySelectorAll('path.sil:not([data-stipple])').forEach((el) => {
        if (el.classList.contains('nf')) return;
        el.dataset.stipple = 'pending';
        idle(() => { if (el.isConnected) stipple(svg, el); }, { timeout: 1500 });
      });
    }

    function watch(host) {
      const run = () => { const svg = host.querySelector(':scope > svg'); if (svg) apply(svg); };
      run();
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; run(); });
      }).observe(host, { childList: true, subtree: true });
    }

    const start = () => {
      const hosts = document.querySelectorAll('[data-hairline]');
      if (hosts.length) { hosts.forEach(watch); return true; }
      return false;
    };
    // The figures mount from their own modules, so wait for them to appear.
    if (!start()) {
      const mo = new MutationObserver(() => { if (start()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 10000);
    }
  }

  function initProjectPage() {
    if (document.body.dataset.page !== 'project') return;

    const params = new URLSearchParams(window.location.search);
    const querySlug = params.get('p');
    if (querySlug && window.PROJECTS?.[querySlug]) {
      window.location.replace(projectHref(querySlug));
      return;
    }

    const pathSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    const slug = document.body.dataset.project || pathSlug;
    const project = window.PROJECTS?.[slug];

    if (!project) {
      window.location.replace('/');
      return;
    }

    document.body.dataset.project = slug;
    document.title = `${project.title} — Richard Mark Byrnes`;

    const backTitle = document.getElementById('pc-back-title');
    if (backTitle) backTitle.textContent = project.title;
    const backCompany = document.getElementById('pc-back-company');
    if (backCompany) backCompany.textContent = project.company;
    // The company's logo leads the breadcrumb, just after the chevron.
    const logoSrc = window.COMPANY_LOGOS?.[project.company];
    const backLink = document.getElementById('project-back');
    // Only the old breadcrumb carried the logo; the "Back home" pill doesn't.
    if (logoSrc && backLink && backCompany && !backLink.querySelector('.pc-back-logo')) {
      const logo = document.createElement('img');
      logo.className = 'company-logo pc-back-logo';
      logo.src = logoSrc;
      logo.alt = '';
      logo.width = 160;
      logo.height = 160;
      backLink.insertBefore(logo, backCompany || backLink.firstChild);
    }
    const centerTitle = document.getElementById('pc-title-center');
    if (centerTitle) centerTitle.textContent = project.title;

    const lead = document.getElementById('pc-lead');
    if (lead) {
      const text = project.headline || project.intro || project.title;
      // Titles read in a single weight now — no muted accent word.
      const specials = [];
      if (project.headlineScramble) specials.push({ word: project.headlineScramble, className: 'pc-lead-scramble' });

      const matches = specials
        .map((s) => ({ ...s, idx: text.indexOf(s.word) }))
        .filter((m) => m.idx !== -1)
        .sort((a, b) => a.idx - b.idx);

      // Append plain text, converting "\n" in the headline into <br> line breaks.
      const appendText = (str) => {
        str.split('\n').forEach((part, i) => {
          if (i > 0) lead.appendChild(document.createElement('br'));
          if (part) lead.appendChild(document.createTextNode(part));
        });
      };

      lead.textContent = '';
      let pos = 0;
      matches.forEach((m) => {
        if (m.idx < pos) return;
        if (m.idx > pos) appendText(text.slice(pos, m.idx));
        const span = document.createElement('span');
        span.className = m.className;
        span.textContent = m.word;
        lead.appendChild(span);
        pos = m.idx + m.word.length;
      });
      if (pos < text.length) appendText(text.slice(pos));

      if (project.headlineScramble && typeof window.AsciiScramble === 'function') {
        window.AsciiScramble({
          selector: '.pc-lead-scramble',
          finalText: project.headlineScramble,
          delay: 450,
          trigger: 'load',
          once: false,
          charset: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        });
      }
    }

    // Company, year and status above the title, e.g. "Miro · 2025 · Shipped".
    // Projects that never went out carry their own status in projects.js.
    if (lead && project.year && !document.getElementById('pc-lead-meta')) {
      const meta = document.createElement('p');
      meta.className = 'pc-lead-meta';
      meta.id = 'pc-lead-meta';
      meta.textContent = [project.company, project.year, project.status || 'Shipped']
        .filter(Boolean).join(' \u00b7 ');
      lead.before(meta);
    }

    // Two-line summary under the title, styled like the home hero subtext.
    if (lead && project.intro) {
      let summary = document.getElementById('pc-lead-summary');
      if (!summary) {
        summary = document.createElement('p');
        summary.id = 'pc-lead-summary';
        summary.className = 'pc-lead-summary';
        lead.insertAdjacentElement('afterend', summary);
      }
      summary.textContent = project.intro;
    }

    const imageSrcs = project.images || (project.heroImage ? [project.heroImage] : []);
    document.querySelectorAll('.pc-image').forEach((el, i) => {
      const src = imageSrcs[i];
      if (!src) return;
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add('has-image');
      if (src.toLowerCase().endsWith('.gif')) el.classList.add('pc-image--gif');
    });

    const mainImage = document.querySelector('.pc-image--main');
    if (mainImage) {
      if (project.heroAspect) mainImage.style.aspectRatio = project.heroAspect;
      if (project.heroFit === 'contain') mainImage.classList.add('pc-image--fit');
    }

    // Stickers scattered around the centre of the hero image, popping in one by one.
    if (mainImage && Array.isArray(project.heroStickers) && project.heroStickers.length) {
      const POSITIONS = [
        { x: 50, y: 50, s: 26, r: -4 },
        { x: 30, y: 37, s: 22, r: -12 },
        { x: 70, y: 36, s: 23, r: 10 },
        { x: 25, y: 62, s: 20, r: 7 },
        { x: 75, y: 61, s: 21, r: -9 },
        { x: 43, y: 72, s: 19, r: 5 },
        { x: 52, y: 29, s: 18, r: -7 },
        { x: 57, y: 66, s: 20, r: 12 },
      ];
      mainImage.classList.add('has-stickers');
      project.heroStickers.forEach((src, i) => {
        const p = POSITIONS[i % POSITIONS.length];
        const sticker = document.createElement('img');
        sticker.className = 'pc-sticker';
        sticker.src = src;
        sticker.alt = '';
        sticker.setAttribute('aria-hidden', 'true');
        sticker.style.setProperty('--x', `${p.x}%`);
        sticker.style.setProperty('--y', `${p.y}%`);
        sticker.style.setProperty('--s', `${p.s}%`);
        sticker.style.setProperty('--r', `${p.r}deg`);
        sticker.style.setProperty('--d', `${450 + i * 150}ms`);
        sticker.draggable = false;
        mainImage.appendChild(sticker);

        // Drag the sticker around; it springs back to its original spot on release.
        const base = `translate(-50%, -50%) rotate(${p.r}deg)`;
        let dragging = false;
        let startX = 0;
        let startY = 0;

        sticker.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          dragging = true;
          startX = event.clientX;
          startY = event.clientY;
          // Cancel the pop-in animation so inline transforms take effect (keep it visible).
          sticker.style.animation = 'none';
          sticker.style.opacity = '1';
          sticker.style.transition = 'none';
          sticker.classList.add('is-dragging');
          try { sticker.setPointerCapture(event.pointerId); } catch (e) { /* no-op */ }
        });

        sticker.addEventListener('pointermove', (event) => {
          if (!dragging) return;
          const dx = event.clientX - startX;
          const dy = event.clientY - startY;
          sticker.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${p.r}deg)`;
        });

        const release = () => {
          if (!dragging) return;
          dragging = false;
          sticker.classList.remove('is-dragging');
          sticker.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
          sticker.style.transform = base;
        };
        sticker.addEventListener('pointerup', release);
        sticker.addEventListener('pointercancel', release);
      });
    }

    // Photos/mockups overlaid on image slots, with white border + drop shadow.
    if (Array.isArray(project.photoOverlays)) {
      const imgEls = document.querySelectorAll('.pc-image');
      project.photoOverlays.forEach((group) => {
        const slot = imgEls[group.slot];
        if (!slot || !Array.isArray(group.items)) return;
        slot.classList.add('has-stickers');
        if (group.background) {
          slot.style.background = group.background;
          slot.style.border = 'none';
        }
        group.items.forEach((p, i) => {
          const isStatic = !!group.static;
          const photo = document.createElement(isStatic ? 'div' : 'button');
          if (!isStatic) photo.type = 'button';
          photo.className = 'pc-photo'
            + (group.plain ? ' pc-photo--plain' : '')
            + (isStatic ? ' pc-photo--static' : '');
          if (isStatic) photo.setAttribute('aria-hidden', 'true');
          else photo.setAttribute('aria-label', 'View larger');
          photo.style.setProperty('--x', `${p.x}%`);
          photo.style.setProperty('--y', `${p.y}%`);
          photo.style.setProperty('--s', `${p.w}%`);
          photo.style.setProperty('--r', `${p.r || 0}deg`);
          photo.style.setProperty('--d', `${450 + i * 160}ms`);
          const img = document.createElement('img');
          img.className = 'pc-photo-img';
          img.src = p.src;
          img.alt = '';
          photo.appendChild(img);
          if (!isStatic) photo.addEventListener('click', () => openLightbox(p.src));
          slot.appendChild(photo);
        });
      });
    }

    const pool = (project.paragraphs && project.paragraphs.length)
      ? project.paragraphs
      : [project.intro || ''];
    for (let i = 0; i < 2; i += 1) {
      const el = document.getElementById(`pc-desc-${i + 1}`);
      if (el) el.textContent = pool[i % pool.length];
    }

    // Standalone polaroid photos placed in the flow above the quote divider.
    const polaroidsEl = document.getElementById('pc-polaroids');
    if (polaroidsEl && Array.isArray(project.polaroids) && project.polaroids.length) {
      polaroidsEl.hidden = false;
      project.polaroids.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pc-polaroid';
        btn.setAttribute('aria-label', 'Flip photo');
        btn.setAttribute('aria-pressed', 'false');
        btn.style.setProperty('--r', `${p.r || 0}deg`);
        btn.style.setProperty('--d', `${520 + i * 120}ms`);
        // Two faces stacked in one flipper: the photo on the front, a
        // handwritten note about it on the back.
        const inner = document.createElement('span');
        inner.className = 'pc-polaroid-inner';
        const front = document.createElement('span');
        front.className = 'pc-polaroid-face pc-polaroid-front';
        const img = document.createElement('img');
        // Below the fold: leave the bandwidth to the hero first.
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = p.src;
        img.alt = '';
        front.appendChild(img);
        const back = document.createElement('span');
        back.className = 'pc-polaroid-face pc-polaroid-back';
        const note = document.createElement('span');
        note.className = 'pc-polaroid-note';
        note.textContent = p.note || '';
        back.appendChild(note);
        inner.append(front, back);
        btn.appendChild(inner);
        btn.addEventListener('click', () => {
          const flipped = btn.classList.toggle('is-flipped');
          btn.setAttribute('aria-pressed', String(flipped));
        });
        polaroidsEl.appendChild(btn);
      });
    }

    const quoteText = document.getElementById('pc-quote-text');
    const quoteBy = document.getElementById('pc-quote-by');
    if (project.quote) {
      if (quoteText) {
        quoteText.textContent = `“${project.quote}”`;
        initQuoteReveal(quoteText);
      }
      if (quoteBy && project.quoteBy) quoteBy.textContent = `— ${project.quoteBy}`;
    } else {
      // No quote for this project — hide the quote block and the rules that bracket
      // it, or they'd stack up as two dividers with nothing in between.
      const quoteReveal = document.querySelector('.pc-quote-reveal');
      if (quoteReveal) {
        quoteReveal.hidden = true;
        [quoteReveal.previousElementSibling, quoteReveal.nextElementSibling]
          .forEach((el) => {
            if (el && el.classList.contains('pc-rule')) el.hidden = true;
          });
      }
    }

    // Top blur (and, on mobile, the centered title) only appear once the user scrolls
    const topBlur = document.querySelector('.top-blur');
    const centerTitleEl = document.getElementById('pc-title-center');
    // Hovering the back button eases in a framed outline round the page,
    // nudged in from the left edge: a hint of the card being let go (CSS).
    const backBtn = document.getElementById('project-back');
    if (backBtn && !document.querySelector('.pc-back-frame')) {
      const frame = document.createElement('div');
      frame.className = 'pc-back-frame';
      frame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(frame);
    }

    // Hovering the back button shows "Back home" in the season nudge's
    // glass card, pointing up at the button.
    if (backBtn && !backBtn.querySelector('.pc-back-tip')) {
      const tip = document.createElement('span');
      tip.className = 'theme-nudge pc-back-tip';
      tip.setAttribute('aria-hidden', 'true');
      tip.innerHTML = '<span class="theme-nudge-title">Back home</span>';
      backBtn.appendChild(tip);
    }

    // The breadcrumb beside the back button: the company's logo and the
    // project title. Always visible.
    let topCompany = document.getElementById('pc-top-company');
    if (!topCompany && project.company) {
      topCompany = document.createElement('div');
      topCompany.className = 'pc-top-company';
      topCompany.id = 'pc-top-company';
      topCompany.setAttribute('aria-hidden', 'true');
      topCompany.classList.add('is-visible');
      // Breadcrumb: the company's logo, then the project title.
      const topLogoSrc = window.COMPANY_LOGOS?.[project.company];
      if (topLogoSrc) {
        const topLogo = document.createElement('img');
        topLogo.className = 'company-logo pc-top-company-logo';
        topLogo.src = topLogoSrc;
        topLogo.alt = '';
        topLogo.width = 160;
        topLogo.height = 160;
        topCompany.appendChild(topLogo);
      }
      const topTitle = document.createElement('span');
      topTitle.className = 'pc-top-company-title';
      topTitle.textContent = project.title;
      topCompany.appendChild(topTitle);
      document.body.appendChild(topCompany);
      // It's built a moment after the back button has started arriving, so
      // put its entrance on the button's clock: the two appear as one.
      const backEl = document.getElementById('project-back');
      const backAnim = backEl?.getAnimations?.()[0];
      const crumbAnim = topCompany.getAnimations?.()[0];
      if (backAnim && crumbAnim && backAnim.currentTime != null) {
        crumbAnim.currentTime = backAnim.currentTime;
        if (backAnim.playState === 'paused') crumbAnim.pause();
      }
    }
    const onScroll = () => {
      const scrolled = window.scrollY > 20;
      if (topBlur) topBlur.classList.toggle('is-visible', scrolled);
      if (centerTitleEl) centerTitleEl.classList.toggle('is-visible', scrolled);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    ['project-back', 'project-close'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (event) => {
        event.preventDefault();
        navigateWithFade(el.getAttribute('href') || '/', { leaveProject: true });
      });
    });

    // Next project button (bottom-right, fades in near the page bottom)
    const order = window.PROJECT_ORDER || [];
    const index = order.indexOf(slug);
    const hasNext = index !== -1 && order.length > 1;
    // Skip the in-progress project, and the ones taken off the home page
    // list, when cycling to the next one.
    const SKIP_SLUGS = ['onboarding', 'navigation', 'design-systems'];
    let nextSlug = null;
    if (hasNext) {
      let n = (index + 1) % order.length;
      let guard = 0;
      while (SKIP_SLUGS.includes(order[n]) && guard < order.length) {
        n = (n + 1) % order.length;
        guard += 1;
      }
      nextSlug = order[n];
    }
    // And the one before, cycling the same way, for the back arrow.
    let prevSlug = null;
    if (hasNext) {
      let n = (index - 1 + order.length) % order.length;
      let guard = 0;
      while (SKIP_SLUGS.includes(order[n]) && guard < order.length) {
        n = (n - 1 + order.length) % order.length;
        guard += 1;
      }
      prevSlug = order[n];
    }
    const nextBtn = document.getElementById('project-next');
    if (nextBtn && hasNext) {
      const nextProject = window.PROJECTS?.[nextSlug];
      const label = document.getElementById('pc-next-title');
      if (nextProject) {
        if (label) label.textContent = 'Jump to next project';
        nextBtn.setAttribute('aria-label', `Jump to next project: ${nextProject.title}`);
        nextBtn.setAttribute('href', projectHref(nextSlug));
        nextBtn.addEventListener('click', (event) => {
          event.preventDefault();
          navigateWithFade(projectHref(nextSlug));
        });

        const hint = document.getElementById('pc-key-hint');
        const HINT_KEY = 'portfolio-keynav-hint';
        let hintTimer = null;
        const revealNext = () => {
          const nearBottom = window.innerHeight + window.scrollY
            >= document.documentElement.scrollHeight - 760;
          nextBtn.classList.toggle('is-visible', nearBottom);

          if (hint && nearBottom && !localStorage.getItem(HINT_KEY)) {
            localStorage.setItem(HINT_KEY, '1');
            hint.classList.add('is-visible');
            hintTimer = window.setTimeout(() => hint.classList.remove('is-visible'), 5000);
          } else if (hint && !nearBottom && hintTimer) {
            hint.classList.remove('is-visible');
          }
        };
        window.addEventListener('scroll', revealNext, { passive: true });
        window.addEventListener('resize', revealNext);
        revealNext();
      }
    }

    // Shared nav actions for the arrow keys and the bottom pill.
    const goBack = () => {
      if (window.history.length > 1) {
        if (prefersReducedMotion()) {
          window.history.back();
        } else {
          document.body.classList.add('page-is-leaving');
          window.setTimeout(() => window.history.back(), PROJECT_TRANSITION_MS);
        }
      } else {
        navigateWithFade('/', { leaveProject: true });
      }
    };
    const goNext = () => {
      if (nextSlug) navigateWithFade(projectHref(nextSlug));
    };
    const goPrev = () => {
      if (prevSlug) navigateWithFade(projectHref(prevSlug));
      else goBack();
    };

    // Bottom "Next project" pill.
    const nextPill = document.getElementById('pc-next-pill');
    if (nextPill) {
      if (nextSlug) {
        nextPill.setAttribute('href', projectHref(nextSlug));

        // The pill reads the same on every page; the project it leads to is
        // named for screen readers only.
        const next = window.PROJECTS?.[nextSlug];
        const nameEl = document.getElementById('pc-next-name');
        if (nameEl) nameEl.textContent = 'Jump to next project';
        document.getElementById('pc-next-company')?.remove();
        nextPill.querySelector('.pc-next-sep')?.remove();
        if (next) {
          nextPill.setAttribute('aria-label', `Jump to next project: ${next.title}`);
          // The project's name, revealed as a second line on hover/focus (CSS).
          const copy = nextPill.querySelector('.pc-next-copy');
          if (copy && !copy.querySelector('.pc-next-sub')) {
            const sub = document.createElement('span');
            sub.className = 'pc-next-sub';
            sub.setAttribute('aria-hidden', 'true');
            const subText = document.createElement('span');
            subText.textContent = next.title;
            sub.appendChild(subText);
            copy.appendChild(sub);
          }
          // Lets CSS tint the bottom wash in the colour of the project the pill
          // leads to.
          document.body.dataset.nextProject = nextSlug;
        }
        nextPill.addEventListener('click', (event) => {
          event.preventDefault();
          goNext();
        });

        // Hovering the pill blooms that tint up from the bottom edge. The layer
        // is created here so the ten project pages don't each need the markup.
        let hoverGlow = document.querySelector('.pc-next-hover-glow');
        if (!hoverGlow) {
          hoverGlow = document.createElement('div');
          hoverGlow.className = 'pc-next-hover-glow';
          hoverGlow.setAttribute('aria-hidden', 'true');
          document.body.appendChild(hoverGlow);
        }
        const setHover = (on) => document.body.classList.toggle('next-pill-hover', on);
        nextPill.addEventListener('pointerenter', () => setHover(true));
        nextPill.addEventListener('pointerleave', () => setHover(false));
        nextPill.addEventListener('focus', () => setHover(true));
        nextPill.addEventListener('blur', () => setHover(false));

        // The pill is fixed and docks to the bottom of the screen. Move it out to
        // <body> so it isn't trapped in the `.page` stacking context (which sits
        // below the bottom blur).
        if (nextPill.parentNode !== document.body) document.body.appendChild(nextPill);
        buildBubble(nextPill);

        // Dock the pill to the bottom of the screen once the user scrolls into the
        // last 20% of the page (CSS handles the magnetic slide-in).
        const updatePillDock = () => {
          const bottom = window.scrollY + window.innerHeight;
          const height = document.documentElement.scrollHeight;
          nextPill.classList.toggle('is-docked', bottom >= height * 0.8);
        };
        window.addEventListener('scroll', updatePillDock, { passive: true });
        window.addEventListener('resize', updatePillDock);
        updatePillDock();
      } else {
        nextPill.style.display = 'none';
      }
    }

    initShortcutsHint(Boolean(nextSlug));

    // Keyboard shortcuts: ← back, → next project, Esc home
    document.addEventListener('keydown', (event) => {
      const t = event.target;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // While the photo lightbox is open, Escape closes it and arrows don't navigate.
      const lb = document.querySelector('.pc-lightbox.is-open');
      if (lb) {
        if (event.key === 'Escape') lb.classList.remove('is-open');
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight' && nextSlug) {
        event.preventDefault();
        goNext();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        navigateWithFade('/', { leaveProject: true });
      }
    });
  }

  // Faded keyboard glyph in the bottom-left corner; hovering (or focusing) it lists
  // every shortcut the site listens for. Project pages only.
  const SHORTCUTS = [
    { keys: ['←'], label: 'Previous project' },
    { keys: ['→'], label: 'Next project' },
    { keys: ['Esc'], label: 'Back home' },
    { keys: ['T'], label: 'Switch theme' },
  ];

  const KEYBOARD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" height="22" width="22" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M260-120q-58 0-99-41t-41-99q0-58 41-99t99-41h60v-160h-60q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99v60h160v-60q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41h-60v160h60q58 0 99 41t41 99q0 58-41 99t-99 41q-58 0-99-41t-41-99v-60H400v60q0 58-41 99t-99 41Zm0-80q25 0 42.5-17.5T320-260v-60h-60q-25 0-42.5 17.5T200-260q0 25 17.5 42.5T260-200Zm440 0q25 0 42.5-17.5T760-260q0-25-17.5-42.5T700-320h-60v60q0 25 17.5 42.5T700-200ZM400-400h160v-160H400v160ZM260-640h60v-60q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm380 0h60q25 0 42.5-17.5T760-700q0-25-17.5-42.5T700-760q-25 0-42.5 17.5T640-700v60Z"/></svg>';

  function initShortcutsHint(hasNext) {
    if (document.getElementById('pc-shortcuts')) return;

    const wrap = document.createElement('div');
    wrap.className = 'pc-shortcuts';
    wrap.id = 'pc-shortcuts';

    const panel = document.createElement('div');
    panel.className = 'pc-shortcuts-panel';
    panel.setAttribute('role', 'tooltip');
    panel.id = 'pc-shortcuts-panel';

    SHORTCUTS.forEach((shortcut) => {
      // The last project has nowhere to go next, so don't advertise it.
      if (shortcut.label === 'Next project' && !hasNext) return;
      // Label first, then its key, so the keys line up down the right edge.
      const row = document.createElement('span');
      row.className = 'pc-shortcuts-row';
      const label = document.createElement('span');
      label.className = 'pc-shortcuts-label';
      label.textContent = shortcut.label;
      row.appendChild(label);
      shortcut.keys.forEach((key) => {
        const kbd = document.createElement('kbd');
        kbd.className = 'pc-shortcuts-key';
        kbd.textContent = key;
        row.appendChild(kbd);
      });
      panel.appendChild(row);
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-shortcuts-btn';
    button.setAttribute('aria-label', 'Keyboard shortcuts');
    button.setAttribute('aria-describedby', panel.id);
    button.innerHTML = KEYBOARD_ICON;

    wrap.appendChild(panel);
    wrap.appendChild(button);
    document.body.appendChild(wrap);
  }

  window.ProjectNav = { navigateWithFade, initWorkLinks, initHomeReturn, initProjectPage };

  // Clear the leaving state on every show (including back/forward-cache restores),
  // otherwise a page restored from history stays faded out (blank).
  window.addEventListener('pageshow', (event) => {
    document.body.classList.remove('page-is-leaving');

    // Restored from bfcache: the head script doesn't run again, so the page
    // would come back with its entrance already spent. Replay it, and the
    // in-page reveals with it, so coming back reads the same as arriving.
    if (event.persisted && !prefersReducedMotion()) {
      const root = document.documentElement;
      root.classList.remove('page-entering');
      void document.body.offsetWidth; // reflow, so re-adding restarts it
      root.classList.add('page-entering');
      clearEntrance();

      document.querySelectorAll('.animate-in').forEach((el) => {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      });
    }
  });

  clearEntrance();
  initLinkTransitions();
  initPrefetch();
  initWorkLinks();
  initHomeReturn();
  initProjectPage();
  initHairlineStipple();
})();

// Ask Insights hero: the page grain (body::before) is masked out over the
// hero frame, so the landscape and footage sit above it and carry their own
// animated grain instead (CSS). The hole follows the frame's document box,
// measured from layout offsets so the entrance transform can't skew it.
(() => {
  if (document.body.dataset.project !== 'ask-ai') return;
  const hero = document.querySelector('.pc-image--scene');
  if (!hero) return;
  const fit = () => {
    let x = 0;
    let y = 0;
    for (let n = hero; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    const b = document.body.style;
    b.setProperty('--hero-x', `${x}px`);
    b.setProperty('--hero-y', `${y}px`);
    b.setProperty('--hero-w', `${hero.offsetWidth}px`);
    b.setProperty('--hero-h', `${hero.offsetHeight}px`);
  };
  // The hole opens once the hero's own entrance (fade, rise and blur) has
  // played, so a clean rectangle never shows on the page before the frame.
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    fit();
    document.body.classList.add('has-hero-hole');
  };
  if (hero.classList.contains('animate-in') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('animationend', (e) => { if (e.target === hero) open(); });
    setTimeout(open, 3000); // backstop
  } else {
    open();
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(document.body);
})();
