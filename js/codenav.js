/**
 * Simple Code Copy Menu Controller
 * Displays block sequence, regex-validated filename / heading above, and synchronizes via container-scoped scrolling.
 */
const CodeNavigator = (() => {
  let blocks = [];
  let activeIndex = 0;
  let isUserScrolling = true;
  let scrollReleaseTimer;

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
    attachScrollspy();
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

  function getHeadingIdForBlock(block) {
    if (block && block.parentHeadingId) return block.parentHeadingId;
    const el = document.getElementById(block.id);
    if (!el) return null;
    let prev = el.previousElementSibling;
    while (prev) {
      if (/^H[1-6]$/i.test(prev.tagName) && prev.id) {
        return prev.id;
      }
      prev = prev.previousElementSibling;
    }
    return null;
  }

  function scrollToElementCenter(container, el) {
    if (!container || !el) return;
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const targetY = container.scrollTop + (elRect.top - cRect.top) - (cRect.height / 2) + (elRect.height / 2);
    container.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  }

  function attachScrollspy() {
    const scrollContainer = document.getElementById('viewerWorkspace');
    if (!scrollContainer) return;

    let debounceTimer;
    scrollContainer.addEventListener('scroll', () => {
      if (!isUserScrolling) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncScrollPosition, 25);
    }, { passive: true });

    scrollContainer.addEventListener('scrollend', () => {
      isUserScrolling = true;
    }, { passive: true });
  }

  function syncScrollPosition() {
    if (!blocks.length || !isUserScrolling) return;
    const scrollContainer = document.getElementById('viewerWorkspace');
    if (!scrollContainer) return;

    const scrollTarget = scrollContainer.scrollTop + (scrollContainer.clientHeight * 0.4);
    let targetIndex = 0;

    for (let i = 0; i < blocks.length; i++) {
      const el = document.getElementById(blocks[i].id);
      if (el && el.offsetTop <= scrollTarget) {
        targetIndex = i;
      } else {
        break;
      }
    }

    if (targetIndex !== activeIndex) {
      activeIndex = targetIndex;
      updateUI();

      // Synchronize TOC heading with active scrolling code block
      const current = blocks[activeIndex];
      const headingId = getHeadingIdForBlock(current);
      const toc = window.TocController || (typeof TocController !== 'undefined' ? TocController : null);
      if (toc && headingId) {
        toc.setActive(headingId);
      }
    }
  }

  function jumpTo(index, scroll = true) {
    if (index < 0 || index >= blocks.length) return;
    activeIndex = index;
    updateUI();

    const current = blocks[activeIndex];
    const headingId = getHeadingIdForBlock(current);
    const toc = window.TocController || (typeof TocController !== 'undefined' ? TocController : null);

    // Instantly lock both scrollspies and update TOC active heading
    if (toc) {
      if (typeof toc.lockScrollspy === 'function') {
        toc.lockScrollspy(700);
      }
      if (headingId) {
        toc.setActive(headingId);
      }
    }

    const el = document.getElementById(current.id);
    const scrollContainer = document.getElementById('viewerWorkspace');

    if (el && scroll && scrollContainer) {
      isUserScrolling = false;
      clearTimeout(scrollReleaseTimer);

      document.querySelectorAll('.code-card').forEach(c => c.classList.remove('target-highlight'));
      el.classList.add('target-highlight');
      scrollToElementCenter(scrollContainer, el);

      scrollReleaseTimer = setTimeout(() => {
        isUserScrolling = true;
        el.classList.remove('target-highlight');
      }, 700);
    }
  }

  function syncToHeadingId(headingId) {
    if (!blocks.length || !headingId) return;

    let targetIndex = blocks.findIndex(b => b.parentHeadingId === headingId);

    if (targetIndex === -1) {
      const hEl = document.getElementById(headingId);
      if (hEl) {
        const hTop = hEl.offsetTop;
        for (let i = 0; i < blocks.length; i++) {
          const bEl = document.getElementById(blocks[i].id);
          if (bEl && bEl.offsetTop >= hTop) {
            targetIndex = i;
            break;
          }
        }
        if (targetIndex === -1) targetIndex = blocks.length - 1;
      }
    }

    if (targetIndex !== -1 && targetIndex !== activeIndex) {
      isUserScrolling = false;
      jumpTo(targetIndex, false);
      clearTimeout(scrollReleaseTimer);
      scrollReleaseTimer = setTimeout(() => {
        isUserScrolling = true;
      }, 700);
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
    setTimeout(() => { copyText.textContent = 'Copy'; }, 1800);
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  copyBtn.addEventListener('click', copyActive);

  return { init, jumpTo, next, prev, copyActive, syncToHeadingId };
})();

// Explicitly register on global scope
window.CodeNavigator = CodeNavigator;