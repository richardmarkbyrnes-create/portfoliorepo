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

  var theme = localStorage.getItem(THEME_KEY) || 'normal';
  var root = document.documentElement;

  if (theme !== 'normal') {
    root.setAttribute('data-theme', theme);
  }

  var bg = BG[theme] || BG.normal;
  root.style.backgroundColor = bg;
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
})();
