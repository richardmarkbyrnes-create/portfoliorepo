(function () {
  var THEME_KEY = 'portfolio-theme';
  var BG = {
    normal: '#fdfbf4',
    dark: '#151516',
    'pastel-blue': '#e8f4fc',
    'pastel-pink': '#fce8f0',
    'pastel-yellow': '#fcf6e8',
    'pastel-green': '#e8fbf0',
  };

  function applyStoredTheme() {
    var theme = localStorage.getItem(THEME_KEY) || 'normal';
    var root = document.documentElement;

    if (theme !== 'normal') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }

    var bg = BG[theme] || BG.normal;
    root.style.backgroundColor = bg;
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }

  applyStoredTheme();

  // The hero's muted-word settle is a first-impression flourish, so it runs once
  // per session — not every time you come back to the homepage from a project.
  // Flagged here in the head so the class lands before first paint and the words
  // don't flash. Only the homepage consumes the flag; landing on a project page
  // first shouldn't spend it.
  var HERO_INTRO_KEY = 'portfolio-hero-intro-played';

  function markHeroIntro() {
    var path = window.location.pathname;
    if (path !== '/' && !/\/index\.html$/.test(path)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    try {
      if (sessionStorage.getItem(HERO_INTRO_KEY)) return;
      sessionStorage.setItem(HERO_INTRO_KEY, '1');
    } catch (err) {
      return; // private mode with storage blocked — skip the flourish
    }

    document.documentElement.classList.add('hero-intro');
  }

  markHeroIntro();

  // Sound always starts off. Forced on every page load rather than just
  // defaulted, so an unmute never carries over into a later visit — nobody
  // should land here and get audio they didn't ask for. Set in the head, ahead
  // of the scripts that read this key to draw the volume icon.
  try {
    localStorage.setItem('portfolio-volume-muted', 'true');
  } catch (err) {
    // storage blocked — the readers below default to unmuted, nothing to undo
  }

  // When a page is restored from the back/forward cache (e.g. navigating with
  // the arrow keys / browser back), scripts don't re-run, so a theme changed on
  // another page would appear to revert. Re-apply the stored theme on restore.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) applyStoredTheme();
  });
})();
