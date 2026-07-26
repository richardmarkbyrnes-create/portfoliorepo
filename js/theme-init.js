(function () {
  var THEME_KEY = 'portfolio-theme';
  var BG = {
    normal: '#f0efeb',
    dark: '#141414',
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

  // When a page is restored from the back/forward cache (e.g. navigating with
  // the arrow keys / browser back), scripts don't re-run, so a theme changed on
  // another page would appear to revert. Re-apply the stored theme on restore.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) applyStoredTheme();
  });
})();
