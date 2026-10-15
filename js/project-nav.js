// The next-project pill drawn as a speech bubble: rounded body plus a small
// pointer under its middle, as one path. A glass layer is clipped to it (fill
// and blur); an SVG traces it for the shadow (masked to the outside, so it
// never darkens the glass), the hairline border and the end-of-page swoop.
// Rebuilt whenever the pill changes size.
function buildBubble(pill) {
  const NS = 'http://www.w3.org/2000/svg';
  // Room round the shape for the blurred shadow (7px blur, nudged 4px down).
  const PAD = 32;
  const R = 18;
  const PW = 12;
  const PH = 6;
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
    <path class="pc-bubble-line"/>
    <path class="pc-bubble-swoop pc-bubble-swoop--tail"/>
    <path class="pc-bubble-swoop"/>`;
  pill.prepend(svg);
  pill.prepend(glass);
  pill.classList.add('has-bubble');

  const shapeAt = (ox, oy, w, h) => {
    const r = Math.min(R, h / 2);
    const cx = ox + w / 2;
    return [
      `M${ox + r},${oy}`, `H${ox + w - r}`, `A${r},${r} 0 0 1 ${ox + w},${oy + r}`,
      `V${oy + h - r}`, `A${r},${r} 0 0 1 ${ox + w - r},${oy + h}`,
      `H${cx + PW / 2}`, `Q${cx + 1.5},${oy + h + PH - 0.5} ${cx},${oy + h + PH}`,
      `Q${cx - 1.5},${oy + h + PH - 0.5} ${cx - PW / 2},${oy + h}`,
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
    svg.setAttribute('height', h + PH + PAD * 2);
    const outer = shapeAt(PAD, PAD, w, h);
    svg.querySelector('.m').setAttribute('d', outer);
    const shadow = svg.querySelector('.pc-bubble-shadow');
    shadow.setAttribute('d', shapeAt(PAD, PAD + 4, w, h));
    const line = shapeAt(PAD + 0.5, PAD + 0.5, w - 1, h - 1);
    svg.querySelector('.pc-bubble-line').setAttribute('d', line);
    const ring = shapeAt(PAD - 1, PAD - 1, w + 2, h + 2);
    svg.querySelectorAll('.pc-bubble-swoop').forEach((path, i) => {
      path.setAttribute('d', ring);
      const len = path.getTotalLength();
      const seg = i === 0 ? len * 0.28 : len * 0.12;
      path.setAttribute('stroke-dasharray', `${seg} ${len}`);
      path.style.setProperty('--len', `${len}px`);
      // The tail starts a little ahead so it trails the head round.
      path.setAttribute('stroke-dashoffset', '0');
    });
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
      if (event.animationName === 'pageBlurIn') done();
    }, { once: true });
    // This script runs after the animation has already started, and on a fast
    // paint it can have finished before the listener lands — in which case
    // animationend never comes. The timeout is the backstop, and it has to
    // outlast the entrance (0.52s). Strip the class early and the page snaps
    // mid-move.
    window.setTimeout(done, 800);
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
    if (logoSrc && backLink && !backLink.querySelector('.pc-back-logo')) {
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
        btn.setAttribute('aria-label', 'View larger');
        btn.style.setProperty('--r', `${p.r || 0}deg`);
        btn.style.setProperty('--d', `${520 + i * 120}ms`);
        const img = document.createElement('img');
        img.src = p.src;
        img.alt = '';
        btn.appendChild(img);
        btn.addEventListener('click', () => openLightbox(p.src));
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

    // Team credit at the end of the page under the quote: a grey tray of photo
    // cards, styled like the Music tab's records — photo, then name, then role.
    const teamAnchorQuote = document.querySelector('.pc-quote-reveal');
    const members = (project.teamMembers || []).filter((m) => m && !m.break);
    if (teamAnchorQuote && members.length) {
      const initials = (name) => name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

      const team = document.createElement('div');
      team.className = 'pc-team animate-in';

      const label = document.createElement('span');
      label.className = 'pc-team-label';
      label.textContent = 'Shoutout to the team';
      team.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'pc-team-grid';

      members.forEach((member, i) => {
        const name = typeof member === 'string' ? member : member.name;
        const photo = typeof member === 'string' ? null : member.photo;
        const role = typeof member === 'string' ? null : member.role;

        const card = document.createElement('figure');
        card.className = 'pc-team-card';

        const frame = document.createElement('span');
        frame.className = 'pc-team-photo';
        if (photo) {
          const img = document.createElement('img');
          img.src = photo;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          frame.appendChild(img);
        } else {
          frame.classList.add('pc-team-photo--initials');
          frame.style.setProperty('--avatar-hue', `${(i * 67) % 360}`);
          frame.textContent = initials(name);
        }

        const caption = document.createElement('figcaption');
        caption.className = 'pc-team-caption';
        // First names only; the full name stays on the card for screen readers.
        const nm = document.createElement('span');
        nm.className = 'pc-team-name';
        nm.textContent = name.split(/\s+/)[0];
        card.setAttribute('aria-label', role ? `${name}, ${role}` : name);
        caption.appendChild(nm);
        if (role) {
          const rl = document.createElement('span');
          rl.className = 'pc-team-role';
          rl.textContent = role;
          caption.appendChild(rl);
        }

        card.appendChild(frame);
        card.appendChild(caption);
        grid.appendChild(card);
      });
      team.appendChild(grid);

      // Dashed divider between the quote and the team shoutout. Without a quote the
      // divider sits straight under the last paragraph, so it drops its top margin to
      // avoid doubling up on the paragraph's own bottom spacing.
      const teamDivider = document.createElement('hr');
      teamDivider.className = project.quote
        ? 'pc-rule pc-team-divider'
        : 'pc-rule pc-team-divider pc-team-divider--no-quote';
      teamDivider.setAttribute('aria-hidden', 'true');

      // Hang the team off whichever element actually ends the section.
      // A learning section, where a page has one, stays directly under the quote.
      const teamAnchor = document.querySelector('.pc-learning') || document.querySelector('.pc-stat') || teamAnchorQuote;
      teamAnchor.insertAdjacentElement('afterend', teamDivider);
      teamDivider.insertAdjacentElement('afterend', team);
    }

    // Top blur (and, on mobile, the centered title) only appear once the user scrolls
    const topBlur = document.querySelector('.top-blur');
    const centerTitleEl = document.getElementById('pc-title-center');
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
    // Skip the in-progress project when cycling to the next one.
    const SKIP_SLUGS = ['onboarding'];
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
          // At the very end of the page a gradient sweeps once round its border
          // (CSS). Leaving the end resets it, so arriving again replays it.
          nextPill.classList.toggle('is-at-end', bottom >= height - 4);
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
        goBack();
      } else if (event.key === 'ArrowRight' && nextSlug) {
        event.preventDefault();
        goNext();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        navigateWithFade('/', { leaveProject: true });
      }
    });
  }

  // Faded keyboard glyph in the bottom-right corner; hovering (or focusing) it lists
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
  initWorkLinks();
  initHomeReturn();
  initProjectPage();
})();
