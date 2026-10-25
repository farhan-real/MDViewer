/**
 * Keyboard Shortcuts Manager
 * Handles multi-key combinations, interactive re-binding, tooltips, and localStorage persistence.
 */
const ShortcutsManager = (() => {
  const STORAGE_KEY = 'mdviewer_shortcuts_v2';
  const DEFAULT_SHORTCUTS = {
    prev: 'P',
    next: 'N',
    copy: 'C',
    render: 'Ctrl+Enter',
    close: 'Esc'
  };

  let shortcuts = { ...DEFAULT_SHORTCUTS };
  let activeRecordingAction = null;

  const modal = document.getElementById('shortcutsModal');
  const openBtn = document.getElementById('shortcutsBtn');
  const closeBtn = document.getElementById('closeShortcutsBtn');
  const saveBtn = document.getElementById('saveShortcutsBtn');
  const resetBtn = document.getElementById('resetShortcutsBtn');
  const renderHint = document.getElementById('renderShortcutHint');

  const actionButtons = {
    prev: document.getElementById('shortcutPrevBtn'),
    next: document.getElementById('shortcutNextBtn'),
    copy: document.getElementById('shortcutCopyBtn'),
    render: document.getElementById('shortcutRenderBtn'),
    close: document.getElementById('shortcutCloseBtn')
  };

  const codePrevBtn = document.getElementById('codePrevBtn');
  const codeNextBtn = document.getElementById('codeNextBtn');
  const codeCopyBtn = document.getElementById('codeCopyBtn');

  function formatKeyName(key) {
    if (!key) return '';
    if (key === ' ') return 'Space';
    if (key === 'Escape') return 'Esc';
    if (key.length === 1) return key.toUpperCase();
    return key;
  }

  function extractKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');

    const isModifierOnly = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
    if (isModifierOnly) {
      return { complete: false, display: parts.length ? parts.join('+') + '+...' : '...' };
    }

    parts.push(formatKeyName(e.key));
    return { complete: true, display: parts.join('+') };
  }

  function normalizeCombo(str) {
    if (!str) return '';
    return str
      .replace(/Command|Cmd/gi, 'Meta')
      .replace(/Control/gi, 'Ctrl')
      .replace(/Escape/gi, 'Esc')
      .split('+')
      .map(p => p.trim().toUpperCase())
      .sort()
      .join('+');
  }

  function isMatch(e, targetCombo) {
    if (!targetCombo) return false;
    const combo = extractKeyCombo(e);
    if (!combo.complete) return false;
    return normalizeCombo(combo.display) === normalizeCombo(targetCombo);
  }

  function loadShortcuts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        shortcuts = { ...DEFAULT_SHORTCUTS, ...parsed };
      }
    } catch {
      shortcuts = { ...DEFAULT_SHORTCUTS };
    }
    updateUI();
  }

  function saveShortcuts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    } catch {}
    updateUI();
  }

  function updateUI() {
    Object.keys(actionButtons).forEach((action) => {
      const btn = actionButtons[action];
      if (btn) btn.textContent = shortcuts[action];
    });

    if (codePrevBtn) codePrevBtn.title = `Previous Block (${shortcuts.prev})`;
    if (codeNextBtn) codeNextBtn.title = `Next Block (${shortcuts.next})`;
    if (codeCopyBtn) codeCopyBtn.title = `Copy Active Block (${shortcuts.copy})`;
    if (renderHint) renderHint.innerHTML = `Shortcut: <kbd>${shortcuts.render.replace(/\+/g, '</kbd> + <kbd>')}</kbd>`;
  }

  function openDialog() {
    cancelRecording();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeDialog() {
    cancelRecording();
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function startRecording(action, buttonEl) {
    cancelRecording();
    activeRecordingAction = action;
    buttonEl.classList.add('recording');
    buttonEl.textContent = 'Press combo...';
  }

  function cancelRecording() {
    if (!activeRecordingAction) return;
    Object.values(actionButtons).forEach(btn => btn?.classList.remove('recording'));
    activeRecordingAction = null;
    updateUI();
  }

  function handleKeydown(e) {
    // Multi-key Recording Mode
    if (activeRecordingAction) {
      e.preventDefault();
      e.stopPropagation();

      const combo = extractKeyCombo(e);
      const btn = actionButtons[activeRecordingAction];

      if (!combo.complete) {
        if (btn) btn.textContent = combo.display;
        return;
      }

      shortcuts[activeRecordingAction] = combo.display;
      saveShortcuts();
      cancelRecording();
      window.App?.showToast(`Shortcut set to "${combo.display}"`);
      return;
    }

    // Interactive Action Dispatching
    const isEditing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

    // 1. Render Document
    if (isMatch(e, shortcuts.render)) {
      e.preventDefault();
      window.App?.triggerRender();
      return;
    }

    // 2. Close Dialog
    if (isMatch(e, shortcuts.close)) {
      if (modal.classList.contains('open')) {
        closeDialog();
        e.preventDefault();
        return;
      }
      if (window.App?.triggerClose()) {
        e.preventDefault();
        return;
      }
    }

    // 3. Navigation & Copy (Only if not typing plain text in editor/search)
    const hasModifier = shortcuts.prev.includes('+') || shortcuts.next.includes('+') || shortcuts.copy.includes('+');
    if (isEditing && !hasModifier) return;

    const nav = window.CodeNavigator;
    if (!nav) return;

    if (isMatch(e, shortcuts.prev)) {
      e.preventDefault();
      nav.prev();
    } else if (isMatch(e, shortcuts.next)) {
      e.preventDefault();
      nav.next();
    } else if (isMatch(e, shortcuts.copy)) {
      e.preventDefault();
      nav.copyActive();
    }
  }

  if (openBtn) openBtn.addEventListener('click', openDialog);
  if (closeBtn) closeBtn.addEventListener('click', closeDialog);
  if (saveBtn) saveBtn.addEventListener('click', closeDialog);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDialog();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      shortcuts = { ...DEFAULT_SHORTCUTS };
      saveShortcuts();
      cancelRecording();
      window.App?.showToast('Reset all shortcuts to defaults');
    });
  }

  Object.entries(actionButtons).forEach(([action, btn]) => {
    if (btn) {
      btn.addEventListener('click', () => startRecording(action, btn));
    }
  });

  window.addEventListener('keydown', handleKeydown);
  loadShortcuts();

  return { getShortcuts: () => ({ ...shortcuts }) };
})();

window.ShortcutsManager = ShortcutsManager;