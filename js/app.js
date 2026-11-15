/**
 * Master Application Coordinator
 * Manages document rendering, delegated copy handling, LaTeX flushing for print, and modals.
 */
const App = (() => {
  const STORAGE_KEY = 'mdviewer_document';
  const MOBILE_BREAKPOINT = 768;

  const viewer = document.getElementById('markdownViewer');
  const pasteModal = document.getElementById('pasteModal');
  const markdownInput = document.getElementById('markdownInput');
  const openEditorBtn = document.getElementById('openEditorBtn');
  const closeEditorBtn = document.getElementById('closeEditorBtn');
  const cancelEditorBtn = document.getElementById('cancelEditorBtn');
  const applyEditorBtn = document.getElementById('applyEditorBtn');
  const clearEditorBtn = document.getElementById('clearEditorBtn');
  const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
  const sampleBtn = document.getElementById('sampleBtn');
  const printBtn = document.getElementById('printBtn');
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  const tocSidebar = document.getElementById('tocSidebar');
  const tocContainer = document.getElementById('tocContainer');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const toast = document.getElementById('toastNotification');

  const statWords = document.getElementById('statWords');
  const statReadTime = document.getElementById('statReadTime');
  const statCodeCount = document.getElementById('statCodeCount');

  let activeCodeBlocks = [];
  let toastTimer;
  let sidebarAnimTimer;

  function saveToStorage(content) {
    try {
      localStorage.setItem(STORAGE_KEY, content);
    } catch {}
  }

  function loadFromStorage() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  function countWordsFast(text) {
    let words = 0;
    let inWord = false;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const isSpace = code === 32 || code === 10 || code === 13 || code === 9;
      if (isSpace) {
        inWord = false;
      } else if (!inWord) {
        inWord = true;
        words++;
      }
    }
    return words;
  }

  function updateDocumentStats(text, codeBlockCount) {
    const words = countWordsFast(text);
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    statWords.textContent = `${words.toLocaleString()} words`;
    statReadTime.textContent = `${readMinutes} min read`;
    statCodeCount.textContent = `${codeBlockCount} code blocks`;
  }

  function renderMarkdownContent(source, persist = true) {
    const { html, headings, codeBlocks } = MarkdownParser.parse(source);
    activeCodeBlocks = codeBlocks;
    viewer.innerHTML = html;

    if (persist) {
      saveToStorage(source);
    }

    TocController.render(headings);
    CodeNavigator.init(codeBlocks);
    updateDocumentStats(source, codeBlocks.length);

    if (typeof LatexEngine !== 'undefined') {
      LatexEngine.typeset([viewer, tocContainer]);
    }
  }

  viewer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.code-block-copy');
    if (!btn) return;
    const targetIndex = parseInt(btn.dataset.blockTarget, 10);
    const block = activeCodeBlocks[targetIndex];
    if (!block) return;

    try {
      await navigator.clipboard.writeText(block.code);
    } catch {}

    const labelEl = btn.querySelector('span');
    if (labelEl) {
      const original = labelEl.textContent;
      labelEl.textContent = '✓ Copied';
      showToast(`Copied: ${block.name}`);
      setTimeout(() => { labelEl.textContent = original; }, 1800);
    }
  });

  function openDialog() {
    pasteModal.classList.add('open');
    pasteModal.setAttribute('aria-hidden', 'false');
    markdownInput.focus();
  }

  function closeDialog() {
    pasteModal.classList.remove('open');
    pasteModal.setAttribute('aria-hidden', 'true');
  }

  function clearSidebarFlip() {
    clearTimeout(sidebarAnimTimer);
    tocSidebar.style.transition = '';
    tocSidebar.style.transform = '';
    viewer.style.transition = '';
    viewer.style.transform = '';
  }

  function toggleSidebar() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      const isOpen = tocSidebar.classList.toggle('open');
      sidebarBackdrop.classList.toggle('active', isOpen);
      return;
    }

    clearTimeout(sidebarAnimTimer);
    tocSidebar.style.transition = 'none';
    tocSidebar.style.transform = '';
    viewer.style.transition = 'none';
    viewer.style.transform = '';

    const beforeViewerLeft = viewer.getBoundingClientRect().left;
    const isCollapsed = tocSidebar.classList.toggle('collapsed');
    const afterViewerLeft = viewer.getBoundingClientRect().left;

    const viewerDx = beforeViewerLeft - afterViewerLeft;
    const sidebarWidth = tocSidebar.offsetWidth || 290;
    const sidebarDx = isCollapsed ? sidebarWidth : -sidebarWidth;

    tocSidebar.style.transform = `translate3d(${sidebarDx}px, 0, 0)`;
    viewer.style.transform = `translate3d(${viewerDx}px, 0, 0)`;

    void tocSidebar.offsetWidth;

    const ease = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
    tocSidebar.style.transition = ease;
    viewer.style.transition = ease;
    tocSidebar.style.transform = 'translate3d(0, 0, 0)';
    viewer.style.transform = 'translate3d(0, 0, 0)';

    sidebarAnimTimer = setTimeout(() => {
      clearSidebarFlip();
      TocController.refreshOffsets();
      CodeNavigator.refreshOffsets();
    }, 195);
  }

  openEditorBtn.addEventListener('click', openDialog);
  closeEditorBtn.addEventListener('click', closeDialog);
  cancelEditorBtn.addEventListener('click', closeDialog);

  pasteModal.addEventListener('click', (e) => {
    if (e.target === pasteModal) closeDialog();
  });

  sampleBtn.addEventListener('click', () => {
    const sample = window.SAMPLE_MARKDOWN || '';
    markdownInput.value = sample;
    renderMarkdownContent(sample, true);
    showToast('Loaded sample documentation');
  });

  if (printBtn) {
    printBtn.addEventListener('click', async () => {
      if (window.LatexRuntime?.hasPendingMath?.()) {
        showToast('Preparing equations for print...');
        await window.LatexRuntime.flushAll();
      }
      window.print();
    });
  }

  window.addEventListener('beforeprint', () => {
    window.LatexRuntime?.flushSync?.();
  });

  applyEditorBtn.addEventListener('click', () => {
    const content = markdownInput.value;
    closeDialog();
    requestAnimationFrame(() => {
      renderMarkdownContent(content, true);
      showToast('Document rendered and saved');
    });
  });

  clearEditorBtn.addEventListener('click', () => {
    markdownInput.value = '';
    markdownInput.focus();
  });

  pasteClipboardBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      markdownInput.value = text;
      showToast('Pasted from clipboard');
    } catch {
      showToast('Clipboard access denied. Paste manually.');
    }
  });

  toggleSidebarBtn.addEventListener('click', toggleSidebar);
  sidebarBackdrop.addEventListener('click', () => {
    tocSidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('active');
  });

  window.addEventListener('resize', () => {
    clearSidebarFlip();
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      tocSidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    }
  });

  function triggerRender() {
    if (pasteModal.classList.contains('open')) {
      applyEditorBtn.click();
      return true;
    }
    return false;
  }

  function triggerClose() {
    if (pasteModal.classList.contains('open')) {
      closeDialog();
      return true;
    }
    return false;
  }

  const storedDocument = loadFromStorage();
  const initialContent = storedDocument !== null ? storedDocument : (window.SAMPLE_MARKDOWN || '');
  markdownInput.value = initialContent;
  renderMarkdownContent(initialContent, false);

  return { showToast, triggerRender, triggerClose };
})();