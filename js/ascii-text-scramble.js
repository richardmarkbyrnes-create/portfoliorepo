(function () {
  const CHARSET = ['·', '.', ':', '-', '+', '*', '=', '#', '@'];
  const COLORS = ['#60a5fa', '#ec4899', '#facc15', '#34d399', '#a78bfa', '#fb923c'];
  const SCRAMBLE_INTERVAL = 68;
  const WARMUP_TICKS = 6;
  const TICKS_PER_CHAR = 4;

  const TARGETS = [
    {
      selector: '.hero-title-miro-scramble',
      finalText: 'miro',
      delay: 1030,
      trigger: 'load',
      once: true,
    },
    {
      selector: '.home-closing-reach-out',
      finalText: 'reach out',
      delay: 920,
      trigger: 'in-view',
      root: '.home-bottom-ascii.animate-on-scroll-root',
    },
  ];

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initAsciiTextScramble(config) {
    const container = document.querySelector(config.selector);
    if (!container) return;

    const finalText = config.finalText;
    const finalChars = finalText.split('');
    const charset = config.charset || CHARSET;
    let started = false;
    let intervalId = null;

    function buildCharSpans() {
      container.textContent = '';
      return finalChars.map((character) => {
        const span = document.createElement('span');
        span.className = 'hero-scramble-char';
        span.dataset.final = character;
        span.textContent = character === ' ' ? '\u00a0' : character;
        container.appendChild(span);
        return span;
      });
    }

    function randomGlyph() {
      return charset[Math.floor(Math.random() * charset.length)];
    }

    function randomColor() {
      return COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    function finish() {
      window.clearInterval(intervalId);
      intervalId = null;
      container.classList.remove('is-scrambling');
      container.textContent = finalText;
    }

    function runAnimation(chars) {
      if (started) return;
      started = true;
      container.classList.add('is-scrambling');

      chars.forEach((span) => {
        span.textContent = randomGlyph();
        span.style.color = randomColor();
      });

      let tick = 0;
      let lockedCount = 0;

      intervalId = window.setInterval(() => {
        if (tick >= WARMUP_TICKS && lockedCount < chars.length) {
          const lockTick = tick - WARMUP_TICKS;
          lockedCount = Math.min(chars.length, Math.floor(lockTick / TICKS_PER_CHAR) + 1);
        }

        chars.forEach((span, index) => {
          const character = span.dataset.final;

          if (index < lockedCount) {
            span.textContent = character === ' ' ? '\u00a0' : character;
            span.style.color = '';
            return;
          }

          span.textContent = randomGlyph();
          span.style.color = randomColor();
        });

        tick += 1;

        if (lockedCount >= chars.length) {
          finish();
        }
      }, SCRAMBLE_INTERVAL);
    }

    const chars = buildCharSpans();

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    function scheduleAnimation() {
      window.setTimeout(() => runAnimation(chars), config.delay);
    }

    if (config.trigger === 'load') {
      if (config.once) {
        const key = `scramble-played:${config.selector}`;
        if (sessionStorage.getItem(key)) {
          finish();
          return;
        }
        sessionStorage.setItem(key, '1');
      }
      scheduleAnimation();
      return;
    }

    const root = document.querySelector(config.root);
    if (!root) return;

    if (root.classList.contains('is-in-view')) {
      scheduleAnimation();
      return;
    }

    const observer = new MutationObserver(() => {
      if (!root.classList.contains('is-in-view')) return;
      observer.disconnect();
      scheduleAnimation();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  window.AsciiScramble = initAsciiTextScramble;

  TARGETS.forEach(initAsciiTextScramble);
})();
