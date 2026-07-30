const { THEMES, THEME_STORAGE_KEY, getStoredTheme } = window.SiteNav;

function applyTheme(themeId) {
  if (themeId === 'normal') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeId);
  }
  localStorage.setItem(THEME_STORAGE_KEY, themeId);

  document.querySelectorAll('.theme-option, .pc-menu-swatch').forEach((button) => {
    const isActive = button.dataset.theme === themeId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  updateFooterTheme();
}

function cycleTheme() {
  const currentIndex = THEMES.findIndex((theme) => theme.id === getStoredTheme());
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEMES.length;
  applyTheme(THEMES[nextIndex].id);
}

function initThemeSwitcher() {
  applyTheme(getStoredTheme());

  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    cycleTheme();
    playThemeTransitionSound();
    playTapAnimation(toggle.querySelector('.theme-toggle-icons'), 'is-tapped');
  });
}

const VOLUME_STORAGE_KEY = 'portfolio-volume-muted';
const EXPERIENCE_TAP_SOUND = 'sounds/tap_04.wav';

function isSoundMuted() {
  return localStorage.getItem(VOLUME_STORAGE_KEY) === 'true';
}

const THEME_TRANSITION_SOUND = 'sounds/button.wav';
let themeTransitionAudio;

function playThemeTransitionSound() {
  if (isSoundMuted()) return;

  if (!themeTransitionAudio) {
    themeTransitionAudio = new Audio(THEME_TRANSITION_SOUND);
    themeTransitionAudio.preload = 'auto';
    themeTransitionAudio.volume = 0.4;
  }

  themeTransitionAudio.currentTime = 0;
  themeTransitionAudio.play().catch(() => {});
}

const CLICK_SPARK_SOUNDS = ['sounds/tap_01.wav', 'sounds/tap_02.wav', 'sounds/tap_03.wav', 'sounds/tap_04.wav'];
let clickSparkAudios = null;
let clickSparkSoundIndex = 0;

function playClickSparkSound() {
  if (!clickSparkAudios) {
    clickSparkAudios = CLICK_SPARK_SOUNDS.map((src) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = 0.4;
      return audio;
    });
  }
  const audio = clickSparkAudios[clickSparkSoundIndex % clickSparkAudios.length];
  clickSparkSoundIndex += 1;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function sparkRayColor(theme, index, total) {
  if (theme === 'dark') {
    const lightness = 78 + (index / Math.max(1, total - 1)) * 22; // 78%–100% white
    return `hsl(0, 0%, ${lightness}%)`;
  }
  return '#111111';
}

function spawnClickSpark(x, y) {
  const theme = document.documentElement.getAttribute('data-theme');
  const spark = document.createElement('div');
  spark.className = 'click-spark';
  spark.style.left = `${x}px`;
  spark.style.top = `${y}px`;

  const rays = 6;
  for (let i = 0; i < rays; i += 1) {
    const ray = document.createElement('span');
    ray.className = 'click-spark-ray';
    ray.style.setProperty('--a', `${(360 / rays) * i}deg`);
    ray.style.background = sparkRayColor(theme, i, rays);
    spark.appendChild(ray);
  }

  document.body.appendChild(spark);
  spark.addEventListener('animationend', () => spark.remove(), { once: true });
  window.setTimeout(() => spark.remove(), 700);
}

function initClickSpark() {
  document.addEventListener('click', (event) => {
    if (isSoundMuted()) return;
    playClickSparkSound();
    if (!prefersReducedMotion()) spawnClickSpark(event.clientX, event.clientY);
  });
}

function playTapAnimation(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  // force reflow so the animation restarts on rapid re-clicks
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

function initVolumeToggle() {
  const button = document.getElementById('nav-volume');
  if (!button) return;

  let muted = isSoundMuted();

  function updateVolumeUI() {
    button.classList.toggle('is-muted', muted);
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
    button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  button.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(VOLUME_STORAGE_KEY, muted ? 'true' : 'false');
    updateVolumeUI();
    playTapAnimation(button.querySelector('.nav-icon-stack'), 'is-tapped');
  });

  updateVolumeUI();
}

function initExperienceHoverSound() {
  const rows = document.querySelectorAll('.work-column--interactive .work-row-main');
  if (!rows.length) return;

  const tapAudio = new Audio(EXPERIENCE_TAP_SOUND);
  tapAudio.preload = 'auto';
  tapAudio.volume = 0.4;

  rows.forEach((row) => {
    row.addEventListener('mouseenter', () => {
      if (isSoundMuted()) return;

      tapAudio.currentTime = 0;
      tapAudio.play().catch(() => {});
    });
  });
}

const SMOOTH_SCROLL_MS = 2800;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutQuart(progress) {
  return 1 - Math.pow(1 - progress, 4);
}

function smoothScrollToY(targetY, duration = SMOOTH_SCROLL_MS) {
  if (prefersReducedMotion()) {
    window.scrollTo(0, targetY);
    return;
  }

  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 1) return;

  const startTime = performance.now();

  function step(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const eased = easeOutQuart(progress);
    window.scrollTo(0, startY + distance * eased);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function smoothScrollToElement(element, duration = SMOOTH_SCROLL_MS) {
  const scrollPaddingTop = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const targetY = element.getBoundingClientRect().top + window.scrollY - scrollPaddingTop;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  smoothScrollToY(Math.max(0, Math.min(targetY, maxScroll)), duration);
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href').slice(1);
      if (!id) return;

      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      smoothScrollToElement(target);
      history.pushState(null, '', `#${id}`);
    });
  });
}

function initSmoothWheel() {
  if (prefersReducedMotion()) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const EASE = 0.08;
  let target = window.scrollY;
  let current = window.scrollY;
  let animating = false;
  let lowPower = false;

  // Best-effort low-power detection (no direct browser API): disable smooth
  // scroll when the battery is low and not charging.
  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      const update = () => { lowPower = battery.level <= 0.2 && !battery.charging; };
      update();
      battery.addEventListener('levelchange', update);
      battery.addEventListener('chargingchange', update);
    }).catch(() => {});
  }

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function loop() {
    current += (target - current) * EASE;
    if (Math.abs(target - current) < 0.4) {
      current = target;
      window.scrollTo(0, current);
      animating = false;
      return;
    }
    window.scrollTo(0, current);
    requestAnimationFrame(loop);
  }

  window.addEventListener('wheel', (event) => {
    if (lowPower) return;
    if (event.ctrlKey) return;
    if (event.target.closest && event.target.closest('.project-overlay, .theme-switcher-options, .work-slideshow-thumbs')) return;

    const mult = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    event.preventDefault();

    if (!animating) {
      current = window.scrollY;
      target = window.scrollY;
    }
    target = Math.max(0, Math.min(maxScroll(), target + event.deltaY * mult));
    if (!animating) {
      animating = true;
      requestAnimationFrame(loop);
    }
  }, { passive: false });

  window.addEventListener('scroll', () => {
    if (!animating) {
      target = window.scrollY;
      current = window.scrollY;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    target = window.scrollY;
    current = window.scrollY;
  });
}

function initKeyboardNav() {
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target.isContentEditable) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      cycleTheme();
      playThemeTransitionSound();
      playTapAnimation(document.querySelector('.theme-toggle-icons'), 'is-tapped');
    }
  });
}

function restartGif(img) {
  if (!img) return;
  const src = img.getAttribute('src');
  if (!src || !src.toLowerCase().includes('.gif')) return;
  img.src = '';
  img.src = src;
}

function initDogPhotoPopover(triggerSelector, popoverId, { restartGifOnShow = false } = {}) {
  const trigger = document.querySelector(triggerSelector);
  const popover = document.getElementById(popoverId);
  if (!trigger || !popover) return;

  const image = popover.querySelector('img');

  function movePopover(clientX, clientY) {
    popover.style.left = `${clientX}px`;
    popover.style.top = `${clientY}px`;
  }

  function showPopover(event) {
    movePopover(event.clientX, event.clientY);
    popover.classList.add('is-visible');
    popover.setAttribute('aria-hidden', 'false');
    if (restartGifOnShow) restartGif(image);
  }

  function hidePopover() {
    popover.classList.remove('is-visible');
    popover.setAttribute('aria-hidden', 'true');
  }

  trigger.addEventListener('mouseenter', showPopover);
  trigger.addEventListener('mousemove', (event) => movePopover(event.clientX, event.clientY));
  trigger.addEventListener('mouseleave', hidePopover);
}

function initDogPhotoPopovers() {
  initDogPhotoPopover('.about-line-art-dog--setter', 'eddie-photo-popover', { restartGifOnShow: true });
  initDogPhotoPopover('.about-line-art-dog--berner', 'berner-photo-popover');
}

function initProjectPreview() {
  const preview = document.getElementById('project-preview');
  if (!preview) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const image = preview.querySelector('.project-preview-img');
  const rows = document.querySelectorAll('.work-column--interactive .work-row-main[data-project]');
  if (!image || !rows.length) return;

  const projects = window.PROJECTS || {};
  const heroFor = (slug) => {
    const project = projects[slug];
    if (!project) return null;
    // previewImage wins — some heroes are built up on the page (empty board plus
    // animated stickers) and don't read as a still.
    if (project.previewImage) return project.previewImage;
    const images = project.images || (project.heroImage ? [project.heroImage] : []);
    return images[0] || null;
  };

  // Offset from the title's left edge — this is also the resting point the cursor
  // drift leans out from. Plus how far the frame dips over the row.
  const SHIFT_X = 176;
  const OVERLAP = 10;

  let shown = null;
  let activeRow = null;

  // Park the frame above the hovered title, overlapping it slightly, and flip below
  // when the top of the viewport is too close to fit.
  function position(row) {
    const title = row.querySelector('.work-col--project') || row;
    const rect = title.getBoundingClientRect();
    // offsetWidth/Height, not the rect — the rect is inflated by the rotation.
    const width = preview.offsetWidth || preview.getBoundingClientRect().width;
    const height = preview.offsetHeight || preview.getBoundingClientRect().height;
    const fitsAbove = rect.top + OVERLAP - height >= 8;

    const left = Math.min(rect.left + SHIFT_X, window.innerWidth - width - 16);
    preview.style.left = `${Math.max(16, left)}px`;

    if (fitsAbove) {
      preview.classList.remove('is-below');
      preview.style.top = 'auto';
      preview.style.bottom = `${window.innerHeight - rect.top - OVERLAP}px`;
    } else {
      preview.classList.add('is-below');
      preview.style.bottom = 'auto';
      preview.style.top = `${rect.bottom - OVERLAP}px`;
    }
  }

  function show(row, src) {
    if (src !== shown) {
      shown = src;
      image.src = src;
    } else {
      // Same preview as last time — replay it from the first frame if it's a gif.
      restartGif(image);
    }
    activeRow = row;
    position(row);
    preview.classList.add('is-visible');
    preview.setAttribute('aria-hidden', 'false');
  }

  function hide() {
    shown = null;
    activeRow = null;
    drift(0, 0);
    preview.classList.remove('is-visible');
    preview.setAttribute('aria-hidden', 'true');
  }

  function drift(x, y) {
    preview.style.setProperty('--px', `${x}px`);
    preview.style.setProperty('--py', `${y}px`);
  }

  // The frame keeps its parked spot and just leans towards the cursor — horizontally
  // it tracks hard, since that's the axis the pointer actually travels along a row.
  const FOLLOW_X = 0.32;
  const FOLLOW_Y = 0.4;
  const MAX_X = 56;
  const MAX_Y = 12;
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

  let queuedMove = false;
  function follow(event, row) {
    if (prefersReducedMotion() || queuedMove) return;
    queuedMove = true;
    const { clientX, clientY } = event;
    requestAnimationFrame(() => {
      queuedMove = false;
      if (activeRow !== row) return;
      const rect = row.getBoundingClientRect();
      drift(
        clamp((clientX - (rect.left + rect.width / 2)) * FOLLOW_X, MAX_X),
        clamp((clientY - (rect.top + rect.height / 2)) * FOLLOW_Y, MAX_Y)
      );
    });
  }

  // The page scrolls under a fixed preview, so keep it pinned to its title.
  let queued = false;
  function trackRow() {
    if (!activeRow || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (activeRow) position(activeRow);
    });
  }

  window.addEventListener('scroll', trackRow, { passive: true });
  window.addEventListener('resize', trackRow);

  const withHero = [];
  rows.forEach((row) => {
    // Projects without a hero image simply show nothing on hover.
    const src = heroFor(row.dataset.project);
    if (!src) return;
    withHero.push(src);
    row.addEventListener('mouseenter', () => show(row, src));
    row.addEventListener('mousemove', (event) => follow(event, row));
    row.addEventListener('mouseleave', hide);
    row.addEventListener('focus', () => show(row, src));
    row.addEventListener('blur', hide);
  });

  // Warm every hero the first time the pointer reaches the list, so switching
  // between rows never flashes an empty frame.
  const list = document.querySelector('.work-column--interactive');
  if (!list || !withHero.length) return;
  list.addEventListener('mouseenter', function preloadHeroes() {
    list.removeEventListener('mouseenter', preloadHeroes);
    withHero.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  });
}

function initScrollAnimations() {
  const roots = document.querySelectorAll('.animate-on-scroll-root');
  if (!roots.length) return;

  if (prefersReducedMotion()) {
    roots.forEach((root) => root.classList.add('is-in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }
  );

  roots.forEach((root) => observer.observe(root));
}

function initBottomBlurVisibility() {
  if (document.body.dataset.page !== 'home') return;

  const closingTitle = document.querySelector('.home-closing-title');
  if (!closingTitle) return;

  let ticking = false;

  function updateBottomBlur() {
    const atPageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const pastTitle = closingTitle.getBoundingClientRect().bottom < window.innerHeight;
    document.body.classList.toggle('bottom-blur-hidden', atPageBottom && pastTitle);
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateBottomBlur);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateBottomBlur);
  updateBottomBlur();
}

function initClosingHeart() {
  const heart = document.querySelector('.home-closing-heart');
  if (!heart) return;

  const path = heart.querySelector('.home-closing-heart-path');
  if (!path) return;

  const outlinePath = path.getAttribute('d');
  const filledPath =
    'M240,102a62.07,62.07,0,0,0-62-62c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40A62.07,62.07,0,0,0,16,102c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102Z';
  const ANIM_MS = 550;
  let animTimer = null;

  function playHeartAnimation() {
    if (prefersReducedMotion()) return;

    heart.classList.remove('is-animating');
    void heart.offsetWidth;
    heart.classList.add('is-animating');

    if (animTimer) window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => {
      heart.classList.remove('is-animating');
      animTimer = null;
    }, ANIM_MS);
  }

  heart.addEventListener('click', () => {
    const liked = heart.classList.toggle('is-liked');
    heart.setAttribute('aria-pressed', liked ? 'true' : 'false');
    path.setAttribute('d', liked ? filledPath : outlinePath);
    playHeartAnimation();
  });
}

function updateClock() {
  const clockEl = document.getElementById('utc-clock');
  if (!clockEl) return;

  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  const seconds = now.getUTCSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  clockEl.textContent = `${displayHours}:${minutes}:${seconds} ${ampm} UTC`;
}

function updateFooterTime() {
  const el = document.getElementById('footer-local-time');
  if (!el) return;
  const tz = el.dataset.tz || 'Europe/Amsterdam';
  el.textContent = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).format(new Date());
}

function updateFooterTheme() {
  const el = document.getElementById('footer-theme');
  if (!el) return;
  const activeId = getStoredTheme();
  const match = THEMES.find((theme) => theme.id === activeId);
  el.textContent = match ? match.label : 'Normal';
}

function initFooter() {
  updateFooterTime();
  setInterval(updateFooterTime, 1000);
  updateFooterTheme();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
}

function initContactCopy() {
  document.querySelectorAll('.contact-copy').forEach((btn) => {
    const item = btn.closest('.contact-item');
    const link = item ? item.querySelector('.contact-link') : null;
    let fadeTimer = null;

    function reset() {
      if (fadeTimer) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
      btn.classList.remove('is-copied', 'is-fading');
    }

    async function handleCopy(event) {
      event.preventDefault();
      await copyText(btn.dataset.copy || '');

      if (fadeTimer) clearTimeout(fadeTimer);
      btn.classList.remove('is-fading');
      btn.classList.add('is-copied');
      fadeTimer = setTimeout(() => {
        btn.classList.add('is-fading');
      }, 900);
    }

    btn.addEventListener('click', handleCopy);
    if (link) link.addEventListener('click', handleCopy);
    if (item) item.addEventListener('mouseleave', reset);
  });
}


function initInProgressStatus() {
  if (document.body.dataset.page !== 'home') return;
  const row = document.querySelector('.work-row-main--wip');
  if (!row) return;
  const wordEl = row.querySelector('.wip-word-text');
  if (!wordEl) return;

  const WORDS = [
    'Baking', 'Blanching', 'Brewing', 'Caramelizing',
    'Flambéing', 'Sautéing', 'Whisking', 'Zesting',
    'Simmering', 'Marinating', 'Kneading', 'Roasting',
  ];

  let timer = null;
  let queue = [];
  let last = null;

  // Shuffle-bag: cycle through every word once before any repeats.
  const pick = () => {
    if (!queue.length) {
      queue = WORDS.slice();
      for (let i = queue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      // Avoid the reshuffled bag starting with the word just shown.
      if (queue.length > 1 && queue[0] === last) {
        [queue[0], queue[1]] = [queue[1], queue[0]];
      }
    }
    last = queue.shift();
    return last;
  };

  // Fade the word out (with blur), swap it, fade back in.
  const rotate = () => {
    wordEl.classList.add('is-fading');
    window.setTimeout(() => {
      wordEl.textContent = pick();
      wordEl.classList.remove('is-fading');
    }, 260);
  };

  // Only cycle words while the row is hovered (every 3s).
  row.addEventListener('mouseenter', () => {
    wordEl.textContent = pick();
    if (!timer) timer = window.setInterval(rotate, 3000);
  });
  row.addEventListener('mouseleave', () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    wordEl.classList.remove('is-fading');
  });
}

initThemeSwitcher();
initVolumeToggle();
initExperienceHoverSound();
initSmoothScroll();
initSmoothWheel();
initKeyboardNav();
initScrollAnimations();
initBottomBlurVisibility();
initClosingHeart();
initDogPhotoPopovers();
initProjectPreview();
initFooter();
initContactCopy();
initClickSpark();
initInProgressStatus();
updateClock();
setInterval(updateClock, 1000);
