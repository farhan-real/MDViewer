/**
 * Simple Code Copy Menu Controller
 * Uses cached code card references, throttled offset refreshes, and rAF binary search.
 */
const CodeNavigator = (() => {
  let blocks = [];
  let cachedElements = [];
  let blockTops = [];
  let activeIndex = 0;
  let isUserScrolling = true;
  let pendingJumpEl = null;
  let correctionCount = 0;
  let scrollReleaseTimer;
  let highlightTimer;
  let offsetRefreshTimer = null;
  let highlightedCard = null;
  let listenersAttached = false;
  let rafScheduled = false;

  const menu = document.getElementById('codeCopyMenu');
  const posBadge = document.getElementById('codeNavPosition');
  const titleText = document.getElementById('codeNavTitle');
  const prevBtn = document.getElementById('codePrevBtn');
  const nextBtn = document.getElementById('codeNextBtn');
  const copyBtn = document.getElementById('codeCopyBtn');
  const copyText = document.getElementById('codeCopyBtnText');
  const scrollContainer = document.getElementById('viewerWorkspace');

  function refreshOffsets() {
    if (!scrollContainer || !cachedElements.length) {
      blockTops = [];
      return;
    }
    const baseTop = scrollContainer.getBoundingClientRect().top - scrollContainer.scrollTop;
    const nextTops = new Array(cachedElements.length);
    let lastKnownTop = 0;
    for (let i = 0; i < cachedElements.length; i++) {
      const el = cachedElements[i];
      if (el && !el.classList.contains('doc-section-hidden')) {
        lastKnownTop = el.getBoundingClientRect().top - baseTop;
      }
      nextTops[i] = lastKnownTop;
    }
    blockTops = nextTops;
  }

  function scheduleRefreshOffsets() {
    if (offsetRefreshTimer) return;
    offsetRefreshTimer = setTimeout(() => {
      offsetRefreshTimer = null;
      refreshOffsets();
    }, 120);
  }

  function finishProgrammaticScroll() {
    pendingJumpEl = null;
    correctionCount = 0;
    isUserScrolling = true;
    clearTimeout(scrollReleaseTimer);
    refreshOffsets();
  }

  function attachListeners() {
    if (listenersAttached || !scrollContainer) return;
    listenersAttached = true;

    scrollContainer.addEventListener('scroll', () => {
      if (!isUserScrolling || rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        syncScrollPosition();
      });
    }, { passive: true });

    scrollContainer.addEventListener('scrollend', () => {
      if (pendingJumpEl && correctionCount < 2) {
        const elRect = pendingJumpEl.getBoundingClientRect();
        const cRect = scrollContainer.getBoundingClientRect();
        const offset = (elRect.top - cRect.top) - (cRect.height / 2) + (elRect.height / 2);
        if (Math.abs(offset) > 32) {
          correctionCount++;
          scrollContainer.scrollTo({ top: Math.max(0, scrollContainer.scrollTop + offset), behavior: 'smooth' });
          return;
        }
      }
      finishProgrammaticScroll();
    }, { passive: true });

    document.addEventListener('mdviewer:typeset', scheduleRefreshOffsets);
    window.addEventListener('resize', scheduleRefreshOffsets, { passive: true });
  }

  function init(codeBlockData) {
    blocks = codeBlockData || [];
    activeIndex = 0;
    highlightedCard = null;
    pendingJumpEl = null;
    correctionCount = 0;

    if (!blocks.length) {
      menu.style.display = 'none';
      cachedElements = [];
      blockTops = [];
      return;
    }

    cachedElements = blocks.map((b) => document.getElementById(b.id));
    menu.style.display = 'flex';
    updateUI();
    attachListeners();
    refreshOffsets();
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
      if (/^H[1-6]$/i.test(prev.tagName) && prev.id) return prev.id;
      prev = prev.previousElementSibling;
    }
    return null;
  }

  function scrollToElementCenter(el) {
    if (!scrollContainer || !el) return;
    const elRect = el.getBoundingClientRect();
    const cRect = scrollContainer.getBoundingClientRect();
    const targetY = Math.max(0, scrollContainer.scrollTop + (elRect.top - cRect.top) - (cRect.height / 2) + (elRect.height / 2));

    if (Math.abs(targetY - scrollContainer.scrollTop) < 2) {
      finishProgrammaticScroll();
      return;
    }

    pendingJumpEl = el;
    correctionCount = 0;
    scrollContainer.scrollTo({ top: targetY, behavior: 'smooth' });
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  }

  function syncScrollPosition() {
    if (!blocks.length || !blockTops.length || !isUserScrolling || !scrollContainer) return;

    const scrollTarget = scrollContainer.scrollTop + (scrollContainer.clientHeight * 0.4);
    let lo = 0;
    let hi = blockTops.length - 1;
    let targetIndex = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (blockTops[mid] <= scrollTarget) {
        targetIndex = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (targetIndex !== activeIndex) {
      activeIndex = targetIndex;
      updateUI();

      const headingId = getHeadingIdForBlock(blocks[activeIndex]);
      const toc = window.TocController || null;
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
    const el = cachedElements[activeIndex] || document.getElementById(current.id);
    if (!scroll) return;

    const headingId = getHeadingIdForBlock(current);
    const toc = window.TocController || null;
    if (toc) {
      if (typeof toc.lockScrollspy === 'function') toc.lockScrollspy(1400);
      if (headingId) toc.setActive(headingId);
    }

    if (el && scrollContainer) {
      window.DocCollapse?.revealElement(el);
      isUserScrolling = false;
      clearTimeout(scrollReleaseTimer);
      clearTimeout(highlightTimer);

      if (highlightedCard && highlightedCard !== el) {
        highlightedCard.classList.remove('target-highlight');
      }
      el.classList.add('target-highlight');
      highlightedCard = el;

      scrollToElementCenter(el);

      highlightTimer = setTimeout(() => {
        el.classList.remove('target-highlight');
        if (highlightedCard === el) highlightedCard = null;
      }, 750);

      scrollReleaseTimer = setTimeout(finishProgrammaticScroll, 1400);
    }
  }

  function syncToHeadingId(headingId) {
    if (!blocks.length || !headingId) return;

    let targetIndex = blocks.findIndex((b) => b.parentHeadingId === headingId);
    if (targetIndex === -1) {
      const hEl = document.getElementById(headingId);
      if (hEl && scrollContainer) {
        const baseTop = scrollContainer.getBoundingClientRect().top - scrollContainer.scrollTop;
        const hTop = hEl.getBoundingClientRect().top - baseTop;
        targetIndex = blockTops.findIndex((t) => t >= hTop);
        if (targetIndex === -1) targetIndex = blocks.length - 1;
      }
    }

    if (targetIndex !== -1 && targetIndex !== activeIndex) {
      isUserScrolling = false;
      jumpTo(targetIndex, false);
      clearTimeout(scrollReleaseTimer);
      scrollReleaseTimer = setTimeout(() => {
        isUserScrolling = true;
      }, 1400);
    }
  }

  function next() {
    if (activeIndex < blocks.length - 1) jumpTo(activeIndex + 1);
  }

  function prev() {
    if (activeIndex > 0) jumpTo(activeIndex - 1);
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

  return { init, jumpTo, next, prev, copyActive, syncToHeadingId, refreshOffsets };
})();

window.CodeNavigator = CodeNavigator;