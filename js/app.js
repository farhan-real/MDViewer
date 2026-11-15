/**
 * Master Application Coordinator
 * Manages document rendering, LaTeX typesetting, modal dialogs, and external shortcut triggers.
 */
const App = (() => {
  const STORAGE_KEY = 'mdviewer_document';

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
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  const tocSidebar = document.getElementById('tocSidebar');
  const tocContainer = document.getElementById('tocContainer');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const toast = document.getElementById('toastNotification');

  const statWords = document.getElementById('statWords');
  const statReadTime = document.getElementById('statReadTime');
  const statCodeCount = document.getElementById('statCodeCount');

  let toastTimer;

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

  function updateDocumentStats(text, codeBlockCount) {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    statWords.textContent = `${words.toLocaleString()} words`;
    statReadTime.textContent = `${readMinutes} min read`;
    statCodeCount.textContent = `${codeBlockCount} code blocks`;
  }

  function renderMarkdownContent(source, persist = true) {
    const { html, headings, codeBlocks } = MarkdownParser.parse(source);
    viewer.innerHTML = html;

    if (persist) {
      saveToStorage(source);
    }

    viewer.querySelectorAll('.code-block-copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetIndex = parseInt(btn.dataset.blockTarget, 10);
        const block = codeBlocks[targetIndex];
        if (block) {
          await navigator.clipboard.writeText(block.code);
          const original = btn.innerHTML;
          btn.innerHTML = '<span>✓ Copied</span>';
          showToast(`Copied: ${block.name}`);
          setTimeout(() => { btn.innerHTML = original; }, 1800);
        }
      });
    });

    TocController.render(headings);
    CodeNavigator.init(codeBlocks);
    updateDocumentStats(source, codeBlocks.length);

    if (typeof LatexEngine !== 'undefined') {
      LatexEngine.typeset([viewer, tocContainer]);
    }
  }

  function openDialog() {
    pasteModal.classList.add('open');
    pasteModal.setAttribute('aria-hidden', 'false');
    markdownInput.focus();
  }

  function closeDialog() {
    pasteModal.classList.remove('open');
    pasteModal.setAttribute('aria-hidden', 'true');
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      const isOpen = tocSidebar.classList.toggle('open');
      sidebarBackdrop.classList.toggle('active', isOpen);
    } else {
      tocSidebar.classList.toggle('collapsed');
    }
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

  applyEditorBtn.addEventListener('click', () => {
    const content = markdownInput.value;
    renderMarkdownContent(content, true);
    closeDialog();
    showToast('Document rendered and saved');
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
    if (window.innerWidth > 768) {
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