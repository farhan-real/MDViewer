/**
 * Settings & Font Size Controller
 * Manages stepped document font sizes (reflected in screen & print) and Settings modal lifecycle.
 */
const SettingsManager = (() => {
  const FONT_STORAGE_KEY = 'mdviewer_fontsize';
  const FONT_STEPS = [12, 13, 14, 15, 16, 17, 18];
  const DEFAULT_STEP_INDEX = 3;

  const modal = document.getElementById('settingsModal');
  const openBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettingsBtn');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const resetBtn = document.getElementById('resetSettingsBtn');

  const fontSizeValue = document.getElementById('fontSizeValue');
  const fontDecreaseBtn = document.getElementById('fontDecreaseBtn');
  const fontIncreaseBtn = document.getElementById('fontIncreaseBtn');
  const fontStepsTrack = document.getElementById('fontStepsTrack');

  let currentStepIndex = DEFAULT_STEP_INDEX;
  let stepPips = [];

  function loadFontStep() {
    try {
      const saved = parseInt(localStorage.getItem(FONT_STORAGE_KEY), 10);
      const foundIndex = FONT_STEPS.indexOf(saved);
      return foundIndex !== -1 ? foundIndex : DEFAULT_STEP_INDEX;
    } catch {
      return DEFAULT_STEP_INDEX;
    }
  }

  function buildFontSteps() {
    if (!fontStepsTrack) return;
    fontStepsTrack.innerHTML = '';
    stepPips = FONT_STEPS.map((size, index) => {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = 'font-step-pip';
      if (index === DEFAULT_STEP_INDEX) {
        pip.classList.add('is-default');
      }
      pip.setAttribute('aria-label', `Set font size to ${size}px`);
      pip.title = index === DEFAULT_STEP_INDEX ? `${size}px (Default)` : `${size}px`;
      pip.addEventListener('click', () => applyFontStep(index, true));
      fontStepsTrack.appendChild(pip);
      return pip;
    });
  }

  function updateFontUI() {
    const size = FONT_STEPS[currentStepIndex];
    if (fontSizeValue) {
      fontSizeValue.textContent = currentStepIndex === DEFAULT_STEP_INDEX
        ? `${size}px (Default)`
        : `${size}px`;
    }
    if (fontDecreaseBtn) {
      fontDecreaseBtn.disabled = currentStepIndex <= 0;
    }
    if (fontIncreaseBtn) {
      fontIncreaseBtn.disabled = currentStepIndex >= FONT_STEPS.length - 1;
    }
    stepPips.forEach((pip, index) => {
      pip.classList.toggle('active', index === currentStepIndex);
      pip.setAttribute('aria-pressed', index === currentStepIndex ? 'true' : 'false');
    });
  }

  function applyFontStep(index, persist = false) {
    currentStepIndex = Math.max(0, Math.min(FONT_STEPS.length - 1, index));
    const size = FONT_STEPS[currentStepIndex];

    document.documentElement.style.setProperty('--doc-font-size', `${size}px`);
    updateFontUI();

    if (persist) {
      try {
        localStorage.setItem(FONT_STORAGE_KEY, String(size));
      } catch {}
    }

    requestAnimationFrame(() => {
      window.TocController?.refreshOffsets();
      window.CodeNavigator?.refreshOffsets();
    });
  }

  function openDialog() {
    window.ShortcutsManager?.cancelRecording();
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden', 'false');
  }

  function closeDialog() {
    window.ShortcutsManager?.cancelRecording();
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
  }

  if (openBtn) openBtn.addEventListener('click', openDialog);
  if (closeBtn) closeBtn.addEventListener('click', closeDialog);
  if (saveBtn) saveBtn.addEventListener('click', closeDialog);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDialog();
    });
  }

  if (fontDecreaseBtn) {
    fontDecreaseBtn.addEventListener('click', () => {
      applyFontStep(currentStepIndex - 1, true);
    });
  }

  if (fontIncreaseBtn) {
    fontIncreaseBtn.addEventListener('click', () => {
      applyFontStep(currentStepIndex + 1, true);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyFontStep(DEFAULT_STEP_INDEX, true);
      window.ShortcutsManager?.reset();
      window.App?.showToast('Reset all settings to defaults');
    });
  }

  buildFontSteps();
  applyFontStep(loadFontStep(), false);

  return {
    openDialog,
    closeDialog,
    applyFontStep,
    getFontSize: () => FONT_STEPS[currentStepIndex]
  };
})();

window.SettingsManager = SettingsManager;