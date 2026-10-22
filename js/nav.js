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

  const EMAIL = 'richardmarkbyrnes@gmail.com';

  const MAIL_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"></path></svg>`;
  const CHECK_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`;
  // Phosphor "file-text", same set and weight as the mail icon.
  const RESUME_ICON = `<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"/></svg>`;

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

  // Contact: an envelope that opens a small glass menu with LinkedIn and
  // email. Hover opens it on a pointer; a click or tap toggles it everywhere
  // else (and for keyboards), closing on Escape or a click outside.
  function renderContact() {
    return `
      <div class="nav-contact" id="nav-contact">
        <button class="nav-icon-btn nav-contact-btn" id="nav-contact-btn" type="button" aria-label="Contact" aria-haspopup="true" aria-expanded="false" aria-controls="nav-contact-menu">
          ${MAIL_ICON}
        </button>
        <div class="nav-contact-menu" id="nav-contact-menu">
          <div class="nav-contact-panel">
            <div class="nav-contact-header">
              <img class="nav-contact-avatar" src="/images/avatar-little-richard.png?v=1" width="96" height="96" alt="">
              <span>Richard Byrnes</span>
            </div>
            <span class="nav-contact-divider" aria-hidden="true"></span>
            <a class="nav-contact-item" href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">
              ${LINKEDIN_ICON}<span>LinkedIn</span>
            </a>
            <a class="nav-contact-item" href="/Richard-Byrnes-Resume.pdf" target="_blank" rel="noopener" aria-label="Resume (PDF, opens in a new tab)">
              ${RESUME_ICON}<span>Resume</span>
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
  initContact();
  initNavIntro();
})();
