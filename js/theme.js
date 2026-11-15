/**
 * Theme Toggle Controller
 * Defaults to AMOLED dark theme, persists preference locally, and syncs print page margins.
 */
const ThemeController = (() => {
  const STORAGE_KEY = 'mdviewer_theme';
  const toggleBtn = document.getElementById('themeToggleBtn');
  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  const PRINT_MARGIN_BOXES = [
    '@top-left-corner', '@top-left', '@top-center', '@top-right', '@top-right-corner',
    '@left-top', '@left-middle', '@left-bottom',
    '@right-top', '@right-middle', '@right-bottom',
    '@bottom-left-corner', '@bottom-left', '@bottom-center', '@bottom-right-corner'
  ];

  let currentTheme = 'dark';

  function loadTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  function updatePrintPageStyle(isLight) {
    let styleEl = document.getElementById('printPageThemeStyle');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'printPageThemeStyle';
      document.head.appendChild(styleEl);
    }

    const bg = isLight ? '#ffffff' : '#000000';
    const muted = isLight ? '#71717a' : '#a1a1aa';
    const blankBoxes = PRINT_MARGIN_BOXES
      .map((box) => `${box} { content: ""; background: ${bg}; }`)
      .join('\n      ');

    styleEl.textContent = `
      @media print {
        @page {
          size: auto;
          margin: 14mm;
          ${blankBoxes}
          @bottom-right {
            content: counter(page) " / " counter(pages);
            background: ${bg};
            color: ${muted};
            font-size: 8.5pt;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            vertical-align: bottom;
            padding-bottom: 4mm;
          }
        }
      }
    `;
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

    updatePrintPageStyle(isLight);

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