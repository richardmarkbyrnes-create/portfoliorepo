(function () {
  const THEMES = [
    { id: 'normal', label: 'Light', short: 'Light' },
    { id: 'dark', label: 'Dark', short: 'Dark' },
  ];

  const THEME_STORAGE_KEY = 'portfolio-theme';

  const SUN_ICON = `<svg class="theme-toggle-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"></path></svg>`;

  const MOON_ICON = `<svg class="theme-toggle-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"></path></svg>`;

  const LINKEDIN_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true"><path d="M41,4H9C6.24,4,4,6.24,4,9v32c0,2.76,2.24,5,5,5h32c2.76,0,5-2.24,5-5V9C46,6.24,43.76,4,41,4z M17,20v19h-6V20H17z M11,14.47c0-1.4,1.2-2.47,3-2.47s2.93,1.07,3,2.47c0,1.4-1.12,2.53-3,2.53C12.2,17,11,15.87,11,14.47z M39,39h-6c0,0,0-9.26,0-10 c0-2-1-4-3.5-4.04h-0.08C27,24.96,26,27.02,26,29c0,0.91,0,10,0,10h-6V20h6v2.56c0,0,1.93-2.56,5.81-2.56 c3.97,0,7.19,2.73,7.19,8.26V39z"></path></svg>`;

  const LINKEDIN_URL = 'https://www.linkedin.com/in/richard-byrnes-/';

  const NAV_INTRO_KEY = 'portfolio-nav-intro-played';

  function getStoredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.some((theme) => theme.id === stored) ? stored : 'normal';
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function renderThemeSwitcher() {
    return `
      <button class="nav-icon-btn theme-toggle" id="theme-toggle" type="button" aria-label="Toggle light or dark theme">
        <span class="theme-toggle-icons" aria-hidden="true">
          ${SUN_ICON}
          ${MOON_ICON}
        </span>
      </button>
    `;
  }

  function initNavIntro() {
    if (sessionStorage.getItem(NAV_INTRO_KEY) || prefersReducedMotion()) return;

    sessionStorage.setItem(NAV_INTRO_KEY, '1');

    const primary = document.querySelector('.nav-primary');
    if (primary) primary.classList.add('nav-intro');
  }

  function renderNav() {
    const navRoot = document.getElementById('site-nav');
    if (!navRoot) return;

    navRoot.innerHTML = `
      <div class="nav-primary">
        <div class="nav-inner">
          ${renderThemeSwitcher()}
        </div>
      </div>
    `;
  }

  // Mobile hamburger menu (home) — collapses the theme button into a dropdown,
  // mirroring the project pages.
  function renderMobileMenu() {
    return `
      <div class="pc-menu-wrap nav-mobile-menu-wrap">
        <button class="pc-menu-btn" id="nav-menu-btn" type="button" aria-label="Menu" aria-expanded="false">
          <span class="pc-menu-bars" aria-hidden="true">
            <span class="pc-menu-bar"></span>
            <span class="pc-menu-bar"></span>
            <span class="pc-menu-bar"></span>
          </span>
        </button>
        <div class="pc-menu" id="nav-menu">
          <button class="pc-menu-item" id="nav-menu-theme" type="button">
            <span class="theme-toggle-icons pc-menu-toggle-icons" aria-hidden="true">${SUN_ICON}${MOON_ICON}</span>
            <span id="nav-menu-theme-label">Light</span>
          </button>
        </div>
      </div>
    `;
  }

  function initMobileMenu() {
    if (document.body.dataset.page !== 'home') return;

    const holder = document.createElement('div');
    holder.innerHTML = renderMobileMenu().trim();
    const menuWrap = holder.firstElementChild;
    document.body.appendChild(menuWrap);

    const btn = document.getElementById('nav-menu-btn');
    const menu = document.getElementById('nav-menu');
    const themeLabel = document.getElementById('nav-menu-theme-label');
    if (!btn || !menu) return;

    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!menu.classList.contains('is-open'));
    });
    document.addEventListener('click', (event) => {
      if (!menuWrap.contains(event.target)) setOpen(false);
    });

    const updateThemeLabel = () => {
      if (themeLabel) themeLabel.textContent = getStoredTheme() === 'dark' ? 'Dark' : 'Light';
    };
    updateThemeLabel();

    document.getElementById('nav-menu-theme').addEventListener('click', (event) => {
      event.stopPropagation();
      const real = document.getElementById('theme-toggle');
      if (real) real.click();
      updateThemeLabel();
    });
  }

  window.SiteNav = {
    THEMES,
    THEME_STORAGE_KEY,
    getStoredTheme,
    renderNav,
  };

  renderNav();
  initMobileMenu();
  initNavIntro();
})();
