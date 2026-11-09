(function () {
  // The four seasons are the site's themes. Summer is the plain light theme
  // ('normal') and winter the dark one ('dark'); spring and autumn are light
  // with a tint. The ids stay the data-theme values the CSS keys off.
  const THEMES = [
    { id: 'spring', label: 'Spring', short: 'Spring' },
    { id: 'normal', label: 'Summer', short: 'Summer' },
    { id: 'autumn', label: 'Autumn', short: 'Autumn' },
    { id: 'dark', label: 'Winter', short: 'Winter' },
  ];

  const THEME_STORAGE_KEY = 'portfolio-theme';

  const SUN_ICON = `<svg class="theme-toggle-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"></path></svg>`;

  const MOON_ICON = `<svg class="theme-toggle-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"></path></svg>`;

  // Season icons (Phosphor, regular weight, filled paths on a 256 grid):
  // a flower, a sun, a leaf and a snowflake.
  const SPRING_ICON = `<svg class="theme-toggle-spring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M210.35,129.36c-.81-.47-1.7-.92-2.62-1.36.92-.44,1.81-.89,2.62-1.36a40,40,0,1,0-40-69.28c-.81.47-1.65,1-2.48,1.59.08-1,.13-2,.13-3a40,40,0,0,0-80,0c0,.94,0,1.94.13,3-.83-.57-1.67-1.12-2.48-1.59a40,40,0,1,0-40,69.28c.81.47,1.7.92,2.62,1.36-.92.44-1.81.89-2.62,1.36a40,40,0,1,0,40,69.28c.81-.47,1.65-1,2.48-1.59-.08,1-.13,2-.13,2.95a40,40,0,0,0,80,0c0-.94-.05-1.94-.13-2.95.83.57,1.67,1.12,2.48,1.59A39.79,39.79,0,0,0,190.29,204a40.43,40.43,0,0,0,10.42-1.38,40,40,0,0,0,9.64-73.28ZM104,128a24,24,0,1,1,24,24A24,24,0,0,1,104,128Zm74.35-56.79a24,24,0,1,1,24,41.57c-6.27,3.63-18.61,6.13-35.16,7.19A40,40,0,0,0,154.53,98.1C163.73,84.28,172.08,74.84,178.35,71.21ZM128,32a24,24,0,0,1,24,24c0,7.24-4,19.19-11.36,34.06a39.81,39.81,0,0,0-25.28,0C108,75.19,104,63.24,104,56A24,24,0,0,1,128,32ZM44.86,80a24,24,0,0,1,32.79-8.79c6.27,3.63,14.62,13.07,23.82,26.89A40,40,0,0,0,88.81,120c-16.55-1.06-28.89-3.56-35.16-7.18A24,24,0,0,1,44.86,80ZM77.65,184.79a24,24,0,1,1-24-41.57c6.27-3.63,18.61-6.13,35.16-7.19a40,40,0,0,0,12.66,21.87C92.27,171.72,83.92,181.16,77.65,184.79ZM128,224a24,24,0,0,1-24-24c0-7.24,4-19.19,11.36-34.06a39.81,39.81,0,0,0,25.28,0C148,180.81,152,192.76,152,200A24,24,0,0,1,128,224Zm83.14-48a24,24,0,0,1-32.79,8.79c-6.27-3.63-14.62-13.07-23.82-26.89A40,40,0,0,0,167.19,136c16.55,1.06,28.89,3.56,35.16,7.18A24,24,0,0,1,211.14,176Z"/></svg>`;

  const AUTUMN_ICON = `<svg class="theme-toggle-autumn" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49c.57,15.92,5.21,32,13.79,47.85l-19.51,19.5a8,8,0,0,0,11.32,11.32l19.5-19.51C81,210.73,97.09,215.37,113,215.94q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07ZM153.75,189.5c-22.75,13.78-49.68,14-76.71.77l88.63-88.62a8,8,0,0,0-11.32-11.32L65.73,179c-13.19-27-13-54,.77-76.71,22.09-36.47,74.6-56.44,141.31-54.06C210.2,114.89,190.22,167.41,153.75,189.5Z"/></svg>`;

  const SNOW_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M223.77,150.09a8,8,0,0,1-5.86,9.68l-24.64,6,6.46,24.11a8,8,0,0,1-5.66,9.8A8.25,8.25,0,0,1,192,200a8,8,0,0,1-7.72-5.93l-7.72-28.8L136,141.86v46.83l21.66,21.65a8,8,0,0,1-11.32,11.32L128,203.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L120,188.69V141.86L79.45,165.27l-7.72,28.8A8,8,0,0,1,64,200a8.25,8.25,0,0,1-2.08-.27,8,8,0,0,1-5.66-9.8l6.46-24.11-24.64-6a8,8,0,0,1,3.82-15.54l29.45,7.23L112,128,71.36,104.54l-29.45,7.23A7.85,7.85,0,0,1,40,112a8,8,0,0,1-1.91-15.77l24.64-6L56.27,66.07a8,8,0,0,1,15.46-4.14l7.72,28.8L120,114.14V67.31L98.34,45.66a8,8,0,0,1,11.32-11.32L128,52.69l18.34-18.35a8,8,0,0,1,11.32,11.32L136,67.31v46.83l40.55-23.41,7.72-28.8a8,8,0,0,1,15.46,4.14l-6.46,24.11,24.64,6A8,8,0,0,1,216,112a7.85,7.85,0,0,1-1.91-.23l-29.45-7.23L144,128l40.64,23.46,29.45-7.23A8,8,0,0,1,223.77,150.09Z"/></svg>`;

  const SUN_LINE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M120,40V32a8,8,0,0,1,16,0v8a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-8-8A8,8,0,0,0,50.34,61.66Zm0,116.68-8,8a8,8,0,0,0,11.32,11.32l8-8a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l8-8a8,8,0,0,0-11.32-11.32l-8,8A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l8,8a8,8,0,0,0,11.32-11.32ZM40,120H32a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Zm88,88a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-8A8,8,0,0,0,128,208Zm96-88h-8a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Z"/></svg>`;

  const LINKEDIN_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" fill="currentColor" aria-hidden="true"><path d="M41,4H9C6.24,4,4,6.24,4,9v32c0,2.76,2.24,5,5,5h32c2.76,0,5-2.24,5-5V9C46,6.24,43.76,4,41,4z M17,20v19h-6V20H17z M11,14.47c0-1.4,1.2-2.47,3-2.47s2.93,1.07,3,2.47c0,1.4-1.12,2.53-3,2.53C12.2,17,11,15.87,11,14.47z M39,39h-6c0,0,0-9.26,0-10 c0-2-1-4-3.5-4.04h-0.08C27,24.96,26,27.02,26,29c0,0.91,0,10,0,10h-6V20h6v2.56c0,0,1.93-2.56,5.81-2.56 c3.97,0,7.19,2.73,7.19,8.26V39z"></path></svg>`;

  const LINKEDIN_URL = 'https://www.linkedin.com/in/richard-byrnes-/';

  const EMAIL = 'richardmarkbyrnes@gmail.com';

  const MAIL_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"></path></svg>`;
  // A small external-link arrow, shown on hover at the end of the rows that
  // open another site or a file.
  const EXT_ICON = `<svg class="nav-contact-ext" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h6v6"/><path d="M12 4 4.5 11.5"/></svg>`;
  const CHECK_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`;
  // Phosphor "file-text", same set and weight as the mail icon.
  const RESUME_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"/></svg>`;

  const NAV_INTRO_KEY = 'portfolio-nav-intro-played';

  function getStoredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.some((theme) => theme.id === stored) ? stored : 'normal';
  }

  // Menu icons, one per season (the sun and moon double as summer and winter).
  const OPTION_ICONS = {
    spring: SPRING_ICON.replace(' class="theme-toggle-spring"', ''),
    normal: SUN_LINE_ICON,
    autumn: AUTUMN_ICON.replace(' class="theme-toggle-autumn"', ''),
    dark: SNOW_ICON,
  };

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // The season switcher: the button shows the current season's icon and
  // opens a small glass menu of all four (hover on a pointer, click or tap
  // anywhere). Picking one is handled in main.js (site-theme-select), which
  // runs the reveal; T still steps through them in order.
  function renderThemeSwitcher() {
    const current = getStoredTheme();
    const options = THEMES.map((t) => `
            <button class="nav-contact-item season-option${t.id === current ? ' is-active' : ''}" type="button" role="menuitemradio" aria-checked="${t.id === current}" data-theme-id="${t.id}">
              <span class="nav-icon">${OPTION_ICONS[t.id]}</span><span>${t.label}</span>
            </button>`).join('');
    return `
      <div class="nav-theme" id="nav-theme">
        <button class="nav-icon-btn nav-label-btn theme-toggle" id="theme-toggle" type="button" aria-label="Season theme" aria-haspopup="true" aria-expanded="false" aria-controls="nav-theme-menu">
          <span class="theme-toggle-icons" aria-hidden="true">
            ${SPRING_ICON}
            ${SUN_LINE_ICON.replace('<svg ', '<svg class="theme-toggle-sun" ')}
            ${AUTUMN_ICON}
            ${SNOW_ICON.replace('<svg ', '<svg class="theme-toggle-moon" ')}
          </span>
          <span class="nav-btn-label" id="theme-toggle-label">${(THEMES.find((t) => t.id === current) || THEMES[1]).label}</span>
        </button>
        <div class="nav-contact-menu nav-theme-menu" id="nav-theme-menu">
          <div class="nav-contact-panel" role="menu" aria-label="Season theme">${options}
          </div>
        </div>
      </div>
    `;
  }

  function initThemeMenu() {
    const wrap = document.getElementById('nav-theme');
    const btn = document.getElementById('theme-toggle');
    if (!wrap || !btn) return;
    const setOpen = (open) => {
      wrap.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!wrap.classList.contains('is-open'));
    });
    wrap.querySelectorAll('.season-option').forEach((opt) => {
      opt.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(false);
        // Close the hover-open state too until the pointer comes back.
        wrap.classList.add('is-picked');
        // Drop focus, or :focus-within would hold the menu open.
        opt.blur();
        document.dispatchEvent(new CustomEvent('site-theme-select', { detail: { id: opt.dataset.themeId, origin: btn } }));
      });
    });
    wrap.addEventListener('pointerleave', () => wrap.classList.remove('is-picked'));
    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && wrap.classList.contains('is-open')) {
        setOpen(false);
        btn.focus();
      }
    });
  }

  function initNavIntro() {
    if (sessionStorage.getItem(NAV_INTRO_KEY) || prefersReducedMotion()) return;

    sessionStorage.setItem(NAV_INTRO_KEY, '1');

    const primary = document.querySelector('.nav-primary');
    if (primary) primary.classList.add('nav-intro');
  }

  // Contact: an envelope that opens a small glass menu with LinkedIn and
  // email. Hover opens it on a pointer; a click or tap toggles it everywhere
  // else (and for keyboards), closing on Escape or a click outside.
  function renderContact() {
    return `
      <div class="nav-contact" id="nav-contact">
        <button class="nav-icon-btn nav-label-btn nav-contact-btn" id="nav-contact-btn" type="button" aria-label="Contact" aria-haspopup="true" aria-expanded="false" aria-controls="nav-contact-menu">
          ${MAIL_ICON}<span class="nav-btn-label">Contact</span>
        </button>
        <div class="nav-contact-menu" id="nav-contact-menu">
          <div class="nav-contact-panel">
            <div class="nav-contact-header">
              <img class="nav-contact-avatar" src="/images/avatar-little-richard.png?v=1" width="96" height="96" alt="">
              <span>Richard Byrnes</span>
            </div>
            <span class="nav-contact-divider" aria-hidden="true"></span>
            <a class="nav-contact-item" href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">
              ${LINKEDIN_ICON}<span>LinkedIn</span>${EXT_ICON}
            </a>
            <a class="nav-contact-item" href="/Richard-Byrnes-Resume.pdf" target="_blank" rel="noopener" aria-label="Resume (PDF, opens in a new tab)">
              ${RESUME_ICON}<span>Resume</span>${EXT_ICON}
            </a>
            <a class="nav-contact-item nav-contact-email" href="mailto:${EMAIL}" aria-label="Email me at ${EMAIL}">
              <span class="nav-contact-email-icon">${MAIL_ICON}${CHECK_ICON}</span><span class="nav-contact-email-label" aria-live="polite">Email me</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function initContact() {
    const wrap = document.getElementById('nav-contact');
    const btn = document.getElementById('nav-contact-btn');
    if (!wrap || !btn) return;
    const setOpen = (open) => {
      wrap.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!wrap.classList.contains('is-open'));
    });
    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && wrap.classList.contains('is-open')) {
        setOpen(false);
        btn.focus();
      }
    });
    // "Email me" copies the address as well as following the mailto:, so it
    // still does something for visitors with no mail app set up. The label
    // and icon (envelope to tick, CSS does the swap) confirm the copy for a
    // couple of seconds.
    const email = wrap.querySelector('.nav-contact-email');
    const emailLabel = email && email.querySelector('.nav-contact-email-label');
    let labelTimer;
    if (email && emailLabel) {
      email.addEventListener('click', () => {
        const copy = navigator.clipboard && navigator.clipboard.writeText
          ? navigator.clipboard.writeText(EMAIL)
          : Promise.reject();
        copy.then(() => {
          email.classList.add('is-copied');
          emailLabel.textContent = 'Email copied';
          clearTimeout(labelTimer);
          labelTimer = setTimeout(() => {
            email.classList.remove('is-copied');
            emailLabel.textContent = 'Email me';
          }, 2000);
        }).catch(() => { /* clipboard blocked: the mailto: still runs */ });
      });
    }

    // Hover state mirrors into aria-expanded for assistive tech.
    if (window.matchMedia('(hover: hover)').matches) {
      wrap.addEventListener('pointerenter', () => btn.setAttribute('aria-expanded', 'true'));
      wrap.addEventListener('pointerleave', () => {
        if (!wrap.classList.contains('is-open')) btn.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function renderNav() {
    const navRoot = document.getElementById('site-nav');
    if (!navRoot) return;

    navRoot.innerHTML = `
      <div class="nav-primary">
        <div class="nav-inner">
          ${renderThemeSwitcher()}
          <span class="nav-divider" aria-hidden="true"></span>
          ${renderContact()}
        </div>
      </div>
    `;
  }

  window.SiteNav = {
    THEMES,
    THEME_STORAGE_KEY,
    getStoredTheme,
    renderNav,
  };

  renderNav();
  initThemeMenu();
  initContact();
  initNavIntro();
})();
