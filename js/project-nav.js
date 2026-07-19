(function () {
  const PROJECT_TRANSITION_MS = 320;
  const LEAVE_KEY = 'portfolio-project-leave';

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
    if (leaveProject) sessionStorage.setItem(LEAVE_KEY, '1');
    window.setTimeout(() => { window.location.href = href; }, PROJECT_TRANSITION_MS);
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

      function go() {
        navigateWithFade(projectHref(slug));
      }
      row.addEventListener('click', go);
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        go();
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
    const centerTitle = document.getElementById('pc-title-center');
    if (centerTitle) centerTitle.textContent = project.title;

    const lead = document.getElementById('pc-lead');
    if (lead) {
      const text = project.headline || project.intro || project.title;
      const specials = [];
      if (project.headlineAccent) specials.push({ word: project.headlineAccent, className: 'pc-lead-muted' });
      if (project.headlineScramble) specials.push({ word: project.headlineScramble, className: 'pc-lead-scramble' });

      const matches = specials
        .map((s) => ({ ...s, idx: text.indexOf(s.word) }))
        .filter((m) => m.idx !== -1)
        .sort((a, b) => a.idx - b.idx);

      lead.textContent = '';
      let pos = 0;
      matches.forEach((m) => {
        if (m.idx < pos) return;
        if (m.idx > pos) lead.appendChild(document.createTextNode(text.slice(pos, m.idx)));
        const span = document.createElement('span');
        span.className = m.className;
        span.textContent = m.word;
        lead.appendChild(span);
        pos = m.idx + m.word.length;
      });
      if (pos < text.length) lead.appendChild(document.createTextNode(text.slice(pos)));

      // Inline icon after the accent word, matching its colour/opacity.
      if (project.headlineIcon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'pc-lead-icon' + (project.headlineIconBefore ? ' pc-lead-icon--before' : '');
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.innerHTML = project.headlineIcon;
        const accent = lead.querySelector('.pc-lead-muted');
        if (accent) accent[project.headlineIconBefore ? 'before' : 'after'](iconSpan);
        else lead.appendChild(iconSpan);
      }

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
    const leadTeam = document.getElementById('pc-lead-team');
    if (leadTeam) leadTeam.textContent = project.team || project.company || '';

    const imageSrcs = project.images || (project.heroImage ? [project.heroImage] : []);
    document.querySelectorAll('.pc-image').forEach((el, i) => {
      const src = imageSrcs[i];
      if (!src) return;
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add('has-image');
      if (src.toLowerCase().endsWith('.gif')) el.classList.add('pc-image--gif');
    });

    // Stickers scattered around the centre of the hero image, popping in one by one.
    const mainImage = document.querySelector('.pc-image--main');
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
        mainImage.appendChild(sticker);
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

    initProjectMobileMenu();

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
    if (quoteText && project.quote) quoteText.textContent = `“${project.quote}”`;
    if (quoteBy && project.quoteBy) quoteBy.textContent = `— ${project.quoteBy}`;

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
        if (label) label.textContent = nextProject.title;
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
            >= document.documentElement.scrollHeight - 420;
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
        nextPill.addEventListener('click', (event) => {
          event.preventDefault();
          goNext();
        });
      } else {
        nextPill.style.display = 'none';
      }
    }

    // Keyboard shortcuts: ← back, → next project
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
      }
    });
  }

  function initProjectMobileMenu() {
    const btn = document.getElementById('pc-menu-btn');
    const menu = document.getElementById('pc-menu');
    if (!btn || !menu) return;

    const getStoredTheme = window.SiteNav?.getStoredTheme || (() => 'normal');

    // Sound toggle
    const soundBtn = document.getElementById('pc-menu-sound');
    const soundLabel = document.getElementById('pc-menu-sound-label');
    const updateSound = () => {
      const muted = localStorage.getItem('portfolio-volume-muted') === 'true';
      if (soundLabel) soundLabel.textContent = muted ? 'Sound off' : 'Sound on';
      if (soundBtn) soundBtn.classList.toggle('is-muted', muted);
    };
    if (soundBtn) {
      updateSound();
      soundBtn.addEventListener('click', () => {
        const muted = localStorage.getItem('portfolio-volume-muted') === 'true';
        localStorage.setItem('portfolio-volume-muted', muted ? 'false' : 'true');
        updateSound();
      });
    }

    // Theme toggle (sun/moon), same behaviour as the desktop switcher
    const themeToggle = document.getElementById('pc-menu-theme-btn');
    const themeLabel = document.getElementById('pc-menu-theme-label');
    const updateThemeLabel = () => {
      if (themeLabel) themeLabel.textContent = getStoredTheme() === 'dark' ? 'Dark' : 'Light';
    };
    updateThemeLabel();
    if (themeToggle) {
      themeToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (typeof window.cycleTheme === 'function') {
          window.cycleTheme();
        } else if (typeof window.applyTheme === 'function') {
          window.applyTheme(getStoredTheme() === 'dark' ? 'normal' : 'dark');
        }
        updateThemeLabel();
      });
    }

    // Home
    const homeItem = document.getElementById('pc-menu-home');
    if (homeItem) {
      homeItem.addEventListener('click', (event) => {
        event.preventDefault();
        navigateWithFade(homeItem.getAttribute('href') || '/', { leaveProject: true });
      });
    }

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!menu.classList.contains('is-open'));
    });
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target) && event.target !== btn) setOpen(false);
    });
  }

  window.ProjectNav = { navigateWithFade, initWorkLinks, initHomeReturn, initProjectPage };

  // Clear the leaving state on every show (including back/forward-cache restores),
  // otherwise a page restored from history stays faded out (blank).
  window.addEventListener('pageshow', (event) => {
    document.body.classList.remove('page-is-leaving');

    // Restored from bfcache: entrance animations already finished, so replay them.
    if (event.persisted) {
      document.querySelectorAll('.animate-in').forEach((el) => {
        el.style.animation = 'none';
        void el.offsetWidth; // reflow
        el.style.animation = '';
      });
    }
  });

  initWorkLinks();
  initHomeReturn();
  initProjectPage();
})();
