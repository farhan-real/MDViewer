/**
 * Local File Loader for Paste / Edit Dialog
 * Supports selecting .md / .txt files via file picker or drag-and-drop offline.
 */
const FileOpenManager = (() => {
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const BINARY_MIME_RE = /^(image|video|audio)\/|\/(pdf|zip|gzip|x-tar|x-7z-compressed|x-rar-compressed|wasm)$/i;

  const openFileBtn = document.getElementById('openFileBtn');
  const fileInput = document.getElementById('markdownFileInput');
  const markdownInput = document.getElementById('markdownInput');

  if (!openFileBtn || !fileInput || !markdownInput) {
    return null;
  }

  // Android file pickers can gray out .md files when extension filters are strict
  if (/Android/i.test(navigator.userAgent)) {
    fileInput.removeAttribute('accept');
  }

  function readFileText(file) {
    if (typeof file.text === 'function') {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('File read failed'));
      reader.readAsText(file);
    });
  }

  async function loadFile(file) {
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      window.App?.showToast('File is too large (max 15 MB)');
      return;
    }

    if (file.type && BINARY_MIME_RE.test(file.type)) {
      window.App?.showToast('Unsupported binary file. Choose a Markdown or text file.');
      return;
    }

    try {
      const text = await readFileText(file);
      markdownInput.value = text;
      markdownInput.scrollTop = 0;
      markdownInput.focus();
      window.App?.showToast(`Loaded "${file.name}"`);
    } catch {
      window.App?.showToast('Unable to read selected file');
    }
  }

  openFileBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
    fileInput.value = '';
  });

  markdownInput.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      markdownInput.classList.add('drag-over');
    }
  });

  markdownInput.addEventListener('dragleave', () => {
    markdownInput.classList.remove('drag-over');
  });

  markdownInput.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    markdownInput.classList.remove('drag-over');
    if (file) {
      e.preventDefault();
      loadFile(file);
    }
  });

  return { loadFile };
})();

window.FileOpenManager = FileOpenManager;