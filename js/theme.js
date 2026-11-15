/**
 * Theme Toggle Controller
 * Defaults to AMOLED dark theme and persists light/dark preference locally.
 */
const ThemeController = (() => {
  const STORAGE_KEY = 'mdviewer_theme';
  const toggleBtn = document.getElementById('themeToggleBtn');
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  let currentTheme = 'dark';

  function loadTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  function applyTheme(theme, persist = false) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    const isLight = currentTheme === 'light';

    document.body.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('dark-theme', !isLight);

    if (metaColorScheme) {
      metaColorScheme.setAttribute('content', currentTheme);
    }
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isLight ? '#ffffff' : '#000000');
    }
    if (toggleBtn) {
      const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
      toggleBtn.setAttribute('aria-label', label);
      toggleBtn.setAttribute('title', label);
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, currentTheme);
      } catch {}
    }
  }

  function toggle() {
    const next = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
    window.App?.showToast(next === 'light' ? 'Switched to Light theme' : 'Switched to Dark theme');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggle);
  }

  applyTheme(loadTheme(), false);

  return { toggle, getTheme: () => currentTheme };
})();

window.ThemeController = ThemeController;