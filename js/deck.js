(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  if (!slides.length) return;

  const dotsWrap = document.getElementById('deck-dots');
  const countEl = document.getElementById('deck-count');
  const prevBtn = document.getElementById('deck-prev');
  const nextBtn = document.getElementById('deck-next');

  // The work list comes from the same source as the site, so the deck can't
  // drift out of date when a project is added or renamed.
  const rows = document.getElementById('deck-work-rows');
  if (rows && window.PROJECTS && window.PROJECT_ORDER) {
    const skip = ['onboarding'];
    rows.innerHTML = window.PROJECT_ORDER
      .filter((slug) => !skip.includes(slug) && window.PROJECTS[slug])
      .map((slug) => {
        const p = window.PROJECTS[slug];
        return `<div class="slide-row">
            <span class="slide-row-company">${p.company}</span>
            <span class="slide-row-project">${p.title}</span>
            <span class="slide-row-year">${p.year}</span>
          </div>`;
      })
      .join('');
  }

  // Light or dark, stored under its own key so the deck never changes the theme
  // the portfolio site is using.
  const THEME_KEY = 'deck-theme';
  const themeBtn = document.getElementById('deck-theme');

  function applyTheme(dark) {
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  let dark = false;
  try {
    dark = localStorage.getItem(THEME_KEY) === 'dark';
  } catch (error) {
    dark = false;
  }
  applyTheme(dark);

  themeBtn?.addEventListener('click', () => {
    dark = !dark;
    applyTheme(dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch (error) {
      /* private mode — the switch still works, it just won't be remembered */
    }
  });

  const dots = slides.map((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'deck-dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => show(i, { revealAll: true }));
    dotsWrap?.appendChild(dot);
    return dot;
  });

  let index = 0;
  // Lines that reveal one keypress at a time, for slides that build up.
  let steps = [];
  let step = 0;

  function stepsFor(slide) {
    return Array.from(slide.querySelectorAll('.step'));
  }

  function paintSteps() {
    steps.forEach((el, i) => el.classList.toggle('is-revealed', i < step));
    paintActiveLine();
  }

  // The marker on the line that just arrived reads at full strength; the ones
  // above it sit back. Line 0 is always on screen, so step is its index.
  function paintActiveLine() {
    const lines = Array.from(slides[index].querySelectorAll('.career-line'));
    if (!lines.length) return;
    const active = Math.min(step, lines.length - 1);
    lines.forEach((line, i) => line.classList.toggle('is-active', i === active));
  }

  function show(next, { revealAll = false } = {}) {
    const target = Math.min(Math.max(next, 0), slides.length - 1);
    // Coming backwards onto a build slide, everything should already be there.
    const backwards = target < index;
    index = target;
    slides.forEach((slide, i) => {
      const current = i === index;
      slide.classList.toggle('is-current', current);
      // Keep the off-screen slides out of the reading order entirely.
      slide.setAttribute('aria-hidden', current ? 'false' : 'true');
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    if (countEl) countEl.textContent = `${index + 1} / ${slides.length}`;
    document.body.dataset.deckSlide = String(index + 1);
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === slides.length - 1;
    window.location.hash = index === 0 ? '' : `#${index + 1}`;

    steps = stepsFor(slides[index]);
    // Nothing pre-revealed: a slide decides what's visible on arrival by which
    // lines carry .step at all.
    step = (backwards || revealAll) ? steps.length : 0;
    paintSteps();
  }

  // Walks the build first, then moves slide. The arrows disable only at the very
  // ends, so a half-built slide still reads as "more to come".
  function go(delta) {
    if (delta > 0) {
      if (step < steps.length) {
        step += 1;
        paintSteps();
        return;
      }
      show(index + 1);
      return;
    }
    if (step > 0) {
      step -= 1;
      paintSteps();
      return;
    }
    show(index - 1);
  }

  // Arrow keys drive the same buttons, so flash their press state too.
  function flash(button) {
    if (!button || button.disabled) return;
    button.classList.add('is-pressed');
    window.setTimeout(() => button.classList.remove('is-pressed'), 140);
  }

  prevBtn?.addEventListener('click', () => go(-1));
  nextBtn?.addEventListener('click', () => go(1));

  const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
  const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp'];

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (NEXT_KEYS.includes(event.key)) {
      event.preventDefault();
      flash(nextBtn);
      go(1);
    } else if (PREV_KEYS.includes(event.key)) {
      event.preventDefault();
      flash(prevBtn);
      go(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      show(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      show(slides.length - 1, { revealAll: true });
    }
  });

  // Touch swipe.
  let startX = null;
  window.addEventListener('touchstart', (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });
  window.addEventListener('touchend', (event) => {
    if (startX === null) return;
    const dx = event.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });

  const fromHash = parseInt(window.location.hash.replace('#', ''), 10);
  show(Number.isFinite(fromHash) ? fromHash - 1 : 0);
})();
