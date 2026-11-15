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

  const SAMPLE_MARKDOWN = `# MDViewer System Architecture
A professional AMOLED markdown viewer with contextual code extraction and full $\\LaTeX$ support.

## Core Infrastructure

### \`gateway.config.json\`
The block below has no filename in its code fence, but its filename is automatically detected and validated from the heading above:

\`\`\`json
{
  "service": "api-gateway",
  "port": 8443,
  "rateLimit": {
    "windowMs": 60000,
    "maxRequests": 5000
  },
  "ssl": {
    "enabled": true,
    "cert": "/etc/ssl/certs/bundle.crt"
  }
}
\`\`\`

### File: \`src/engine/dispatcher.ts\`
This block also extracts its filename directly from the heading pattern using regex validation:

\`\`\`typescript
export interface TaskEnvelope<T> {
  id: string;
  payload: T;
  priority: number;
}

export class TaskDispatcher {
  public execute<T>(task: TaskEnvelope<T>): boolean {
    console.info(\`[Task \${task.id}] executing with priority \${task.priority}\`);
    return true;
  }
}
\`\`\`

### Deployment Configuration via \`docker-compose.yml\`

\`\`\`yaml
version: '3.9'
services:
  worker:
    build: .
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4096M
\`\`\`

### Mathematical & $\\LaTeX$ Rendering ($\\hat{H}\\ket{\\psi} = E\\ket{\\psi}$)
Inline formulas like $E = mc^2$ and \\(\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}\\) render alongside multi-line equations, physics notation, chemistry (\\(\\ce{2H2 + O2 -> 2H2O}\\)), and matrices:

$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}$$

\\begin{align}
\\mathcal{L}(\\theta) &= -\\frac{1}{N} \\sum_{i=1}^{N} \\Big[ y_i \\log(\\hat{y}_i) + (1 - y_i)\\log(1 - \\hat{y}_i) \\Big] \\\\
\\mathbf{A} &= \\begin{bmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{bmatrix}, \\quad \\mel{\\psi}{\\hat{H}}{\\phi} = \\cancel{0} + \\hbar\\omega
\\end{align}

\`\`\`math
P(A \\mid B) = \\frac{P(B \\mid A) \\, P(A)}{P(B)}
\`\`\`

### Comprehensive System Health Metrics

| Service Component | Operational Status | Latency Window | Formulation |
| :--- | :--- | :--- | :--- |
| Core Dispatcher | Active | $< 1.2\\text{ ms}$ | $\\mathcal{O}(\\log n)$ |
| Task Persistence | Active | $< 4.5\\text{ ms}$ | $\\|x\\|_2 \\le \\epsilon$ |
| Edge Ingress | Active | $< 0.8\\text{ ms}$ | $\\lambda \\approx 1.25\\times 10^4$ |

### \`scripts/backup.sh\`
Routine cold snapshotting utility:

\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/var/backups/mdviewer/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/data.tar.gz" /var/lib/mdviewer
echo "Backup saved to $BACKUP_DIR"
\`\`\`

Use the bottom-right **Code Copy Menu** or the copy button on any block header to copy code instantly.`;

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
    markdownInput.value = SAMPLE_MARKDOWN;
    renderMarkdownContent(SAMPLE_MARKDOWN, true);
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
  const initialContent = storedDocument !== null ? storedDocument : SAMPLE_MARKDOWN;
  markdownInput.value = initialContent;
  renderMarkdownContent(initialContent, false);

  return { showToast, triggerRender, triggerClose };
})();