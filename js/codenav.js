/**
 * Simple Code Copy Menu Controller
 * Displays block sequence, regex-validated filename / heading above, and handles navigation.
 */
const CodeNavigator = (() => {
  let blocks = [];
  let activeIndex = 0;

  const menu = document.getElementById('codeCopyMenu');
  const posBadge = document.getElementById('codeNavPosition');
  const titleText = document.getElementById('codeNavTitle');
  const prevBtn = document.getElementById('codePrevBtn');
  const nextBtn = document.getElementById('codeNextBtn');
  const copyBtn = document.getElementById('codeCopyBtn');
  const copyText = document.getElementById('codeCopyBtnText');

  function init(codeBlockData) {
    blocks = codeBlockData || [];
    activeIndex = 0;

    if (!blocks.length) {
      menu.style.display = 'none';
      return;
    }

    menu.style.display = 'flex';
    updateUI();
  }

  function updateUI() {
    if (!blocks.length) {
      posBadge.textContent = '0 / 0';
      titleText.textContent = 'No code blocks';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      copyBtn.disabled = true;
      return;
    }

    const current = blocks[activeIndex];
    posBadge.textContent = `${activeIndex + 1} / ${blocks.length}`;

    // Displays the filename (validated by regex) or the heading exactly above
    const label = current.name || current.parentHeading || `Block #${activeIndex + 1}`;
    titleText.textContent = label;
    titleText.title = `Block #${activeIndex + 1} (${current.language}) - in: ${current.parentHeading}`;

    prevBtn.disabled = activeIndex === 0;
    nextBtn.disabled = activeIndex === blocks.length - 1;
    copyBtn.disabled = false;
  }

  function jumpTo(index, scroll = true) {
    if (index < 0 || index >= blocks.length) return;
    activeIndex = index;
    updateUI();

    const current = blocks[activeIndex];
    const el = document.getElementById(current.id);

    if (el && scroll) {
      document.querySelectorAll('.code-card').forEach(c => c.classList.remove('target-highlight'));
      el.classList.add('target-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        el.classList.remove('target-highlight');
      }, 1500);
    }
  }

  function next() {
    if (activeIndex < blocks.length - 1) {
      jumpTo(activeIndex + 1);
    }
  }

  function prev() {
    if (activeIndex > 0) {
      jumpTo(activeIndex - 1);
    }
  }

  async function copyActive() {
    if (!blocks.length) return;
    const current = blocks[activeIndex];
    try {
      await navigator.clipboard.writeText(current.code);
      notifyCopied();
    } catch {
      fallbackCopy(current.code);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    notifyCopied();
  }

  function notifyCopied() {
    copyText.textContent = 'Copied!';
    window.App?.showToast(`Copied #${activeIndex + 1} (${blocks[activeIndex].name})`);

    setTimeout(() => {
      copyText.textContent = 'Copy';
    }, 1800);
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  copyBtn.addEventListener('click', copyActive);

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.altKey && e.key === ']') {
      e.preventDefault();
      next();
    } else if (e.altKey && e.key === '[') {
      e.preventDefault();
      prev();
    }
  });

  return { init, jumpTo, next, prev, copyActive };
})();