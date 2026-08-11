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

// Pitch follows the theme: descending into dark, ascending back into light.
const THEME_TRANSITION_SOUNDS = {
  dark: '/sounds/transition_down.wav',
  light: '/sounds/transition_up.wav',
};
const themeTransitionAudios = {};

// Call after the theme has been applied — the direction is read from the new theme.
function playThemeTransitionSound() {
  if (isSoundMuted()) return;

  const direction = getStoredTheme() === 'dark' ? 'dark' : 'light';
  let audio = themeTransitionAudios[direction];
  if (!audio) {
    audio = new Audio(THEME_TRANSITION_SOUNDS[direction]);
    audio.preload = 'auto';
    audio.volume = 0.4;
    // Play the clip slow to drop its pitch. Browsers preserve pitch by default when
    // you change rate, which would only make it slower — turning that off gives the
    // tape-speed effect we want. Prefixes cover Safari and older Firefox.
    audio.preservesPitch = false;
    audio.webkitPreservesPitch = false;
    audio.mozPreservesPitch = false;
    audio.playbackRate = 0.82;
    themeTransitionAudios[direction] = audio;
  }

  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// Root-relative: project pages live one directory down, so a bare 'sounds/...'
// would resolve against /<slug>/ and 404.
const PAGE_TURN_SOUND = '/sounds/book-page.mp3';
let pageTurnAudio = null;

function loadPageTurnSound() {
  if (pageTurnAudio) return pageTurnAudio;
  pageTurnAudio = new Audio(PAGE_TURN_SOUND);
  pageTurnAudio.preload = 'auto';
  pageTurnAudio.volume = 0.55;
  return pageTurnAudio;
}

function playPageTurnSound() {
  if (isSoundMuted()) return;
  const audio = loadPageTurnSound();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// Page-turn on "Next project". The clip is buffered up front rather than on the
// click itself, since the page starts fading out immediately after.
function initPageTurnSound() {
  const pill = document.getElementById('pc-next-pill');
  if (!pill) return;
  loadPageTurnSound();
  pill.addEventListener('click', playPageTurnSound);
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

// Controls have their own press feedback, so the spark only fires on plain page
// clicks. The sound still plays on them — except where the control brings its own,
// which would otherwise stack two sounds on one click.
const SPARK_EXEMPT = 'button, a, [role="button"], input, select, textarea, label, summary';
// The theme buttons have their own transition sound — no tap on top of it.
const CLICK_SOUND_EXEMPT = '#pc-next-pill, #theme-toggle, #nav-menu-theme';

function initClickSpark() {
  document.addEventListener('click', (event) => {
    if (isSoundMuted()) return;
    const target = event.target;
    if (target.closest?.(CLICK_SOUND_EXEMPT)) return;
    playClickSparkSound();
    if (prefersReducedMotion()) return;
    if (target.closest?.(SPARK_EXEMPT)) return;
    spawnClickSpark(event.clientX, event.clientY);
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

function initDogPhotoPopover(triggerSelector, popoverId) {
  const trigger = document.querySelector(triggerSelector);
  const popover = document.getElementById(popoverId);
  if (!trigger || !popover) return;

  const image = popover.querySelector('img');
  // The dog photos are looping webm clips (they were gifs, ~30x the bytes). They
  // carry `loop`, so playback repeats on its own; JS only starts them from the top
  // on hover and pauses them again on the way out, so nothing runs unseen.
  const video = popover.querySelector('video');

  function movePopover(clientX, clientY) {
    popover.style.left = `${clientX}px`;
    popover.style.top = `${clientY}px`;
  }

  function showPopover(event) {
    movePopover(event.clientX, event.clientY);
    popover.classList.add('is-visible');
    popover.setAttribute('aria-hidden', 'false');
    restartGif(image);
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }

  function hidePopover() {
    popover.classList.remove('is-visible');
    popover.setAttribute('aria-hidden', 'true');
    if (video) video.pause();
  }

  trigger.addEventListener('mouseenter', showPopover);
  trigger.addEventListener('mousemove', (event) => movePopover(event.clientX, event.clientY));
  trigger.addEventListener('mouseleave', hidePopover);

  return video;
}

function initDogPhotoPopovers() {
  const videos = [
    initDogPhotoPopover('.about-line-art-dog--setter', 'eddie-photo-popover'),
    initDogPhotoPopover('.about-line-art-dog--berner', 'berner-photo-popover'),
  ].filter(Boolean);
  if (!videos.length) return;

  // preload="metadata" keeps the clips off the initial page load. Fetch them in full
  // the first time the pointer reaches the line art, so the hover itself is instant.
  const lineArt = document.querySelector('.about-line-art');
  if (!lineArt) return;
  lineArt.addEventListener('mouseenter', function warmVideos() {
    lineArt.removeEventListener('mouseenter', warmVideos);
    videos.forEach((video) => {
      video.preload = 'auto';
      video.load();
    });
  });
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
    // Opening a project fades the page out, but the preview is fixed and the pointer
    // never leaves the row — so it would hang around over the transition.
    row.addEventListener('click', hide);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') hide();
    });
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
  let ticking = false;

  function updateBottomBlur() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    // Hidden at rest, fades in once the page starts moving, then fades out over
    // the last 10% of the scroll. Pages too short to scroll never show it.
    const atTop = window.scrollY < 40;
    const inLastTenth = maxScroll <= 0 || window.scrollY / maxScroll >= 0.9;
    document.body.classList.toggle('bottom-blur-visible', !atTop && !inLastTenth);
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

// Count-up stats. Held at zero until the number scrolls into view, then eased to
// its target once — re-running it on every pass would be noise, not delight.
function initCountUp() {
  const values = document.querySelectorAll('[data-count-to]');
  if (!values.length) return;

  const COUNT_MS = 1100;
  const format = (n) => n.toLocaleString('en-US');
  // Gentler than an ease-out: it doesn't sprint away from the start value, so the
  // tick reads steadier even though the whole thing is over sooner.
  const easeInOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

  values.forEach((el) => {
    const target = Number(el.dataset.countTo);
    if (!Number.isFinite(target)) return;

    // Only the last three digits roll — the leading figures hold, so the eye reads
    // the magnitude straight away and just watches the tail settle.
    const from = Math.max(0, target - (target % 1000));

    // No observer under reduced motion — the figure is the point, not the tally.
    if (prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
      el.textContent = format(target);
      return;
    }

    el.textContent = format(from);

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();

      const start = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - start) / COUNT_MS);
        el.textContent = format(Math.round(from + (target - from) * easeInOutQuad(progress)));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.45 });

    observer.observe(el);
  });
}

function initFooter() {
  updateFooterTheme();
  if (!document.getElementById('footer-local-time')) return;
  updateFooterTime();
  setInterval(updateFooterTime, 1000);
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

// "in sunny Amsterdam" — swapped for the real weather there. Open-Meteo needs no
// key and sends CORS headers, so this is a plain fetch with no proxy.
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=52.3676&longitude=4.9041&current=weather_code,temperature_2m';
const WEATHER_CACHE_KEY = 'portfolio-amsterdam-weather';
const WEATHER_CACHE_MS = 15 * 60 * 1000;

// WMO codes, collapsed to the three daytime words. Snow and thunder land under
// "rainy" — it's the closest of the options, and both are rare enough here.
function weatherWordFromCode(code) {
  if (code <= 1) return 'sunny';
  if (code <= 48) return 'cloudy';
  return 'rainy';
}

// Amsterdam's clock, not the visitor's — the sentence is about where Richard is.
function amsterdamTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

// CEST in summer, CET in winter — read off the date rather than hardcoded.
function amsterdamZone() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    timeZoneName: 'short',
  }).formatToParts(new Date());
  return parts.find((part) => part.type === 'timeZoneName')?.value || 'CET';
}

function isAmsterdamNight() {
  return Number(amsterdamTime().slice(0, 2)) >= 22 || Number(amsterdamTime().slice(0, 2)) < 6;
}

function initHeroWeather() {
  const el = document.getElementById('hero-weather');
  if (!el) return;

  const word = el.querySelector('.hero-weather-word') || el;
  const tip = document.createElement('span');
  tip.className = 'hero-weather-tip';
  tip.setAttribute('aria-hidden', 'true');
  el.appendChild(tip);

  // Time is stamped on hover rather than on load, so it's right whenever it's read.
  let temperature = null;
  const refreshTip = () => {
    const stamp = `${amsterdamTime()} ${amsterdamZone()}`;
    tip.textContent = temperature === null
      ? stamp
      : `${Math.round(temperature)}°C · ${stamp}`;
  };
  el.addEventListener('mouseenter', refreshTip);
  el.addEventListener('focus', refreshTip);
  refreshTip();

  const apply = (reading) => {
    temperature = reading.temp;
    word.textContent = isAmsterdamNight() ? 'sleepy' : reading.word;
    refreshTip();
  };

  // Show a recent reading immediately, so the word doesn't change under the
  // reader's eye on every navigation.
  let cached = null;
  try {
    cached = JSON.parse(sessionStorage.getItem(WEATHER_CACHE_KEY) || 'null');
  } catch (error) {
    cached = null;
  }
  if (cached && Date.now() - cached.at < WEATHER_CACHE_MS) {
    apply(cached);
    return;
  }

  fetch(WEATHER_URL)
    .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((data) => {
      const code = data?.current?.weather_code;
      if (typeof code !== 'number') return;
      const reading = { word: weatherWordFromCode(code), temp: data.current.temperature_2m ?? null };
      apply(reading);
      try {
        sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ...reading, at: Date.now() }));
      } catch (error) {
        /* private mode — the word still updated, it just won't be remembered */
      }
    })
    // Offline or rate-limited: the markup's "sunny" stands, and the tip shows the time alone.
    .catch(() => {});
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
initCountUp();
initFooter();
initContactCopy();
initClickSpark();
initPageTurnSound();
initInProgressStatus();
initHeroWeather();
updateClock();
setInterval(updateClock, 1000);
