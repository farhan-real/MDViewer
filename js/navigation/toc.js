/**
 * Table of Contents & Scrollspy Controller
 * Coordinates TOC tree rendering via TocTree, offset caching, and clean directional smooth scrolling.
 */
const TocController = (() => {
  const container = document.getElementById('tocContainer');
  const counter = document.getElementById('tocCounter');
  const filterInput = document.getElementById('tocFilterInput');
  const scrollContainer = document.getElementById('viewerWorkspace');

  let cachedHeadings = [];
  let headingPositions = [];
  let tocNodes = [];
  let tocIndexMap = new Map();
  let currentActiveId = null;
  let isProgrammaticScroll = false;
  let awaitingScrollEnd = false;
  let activeNavToken = 0;
  let lockTimer = null;
  let listenersAttached = false;
  let rafScheduled = false;
  let offsetRefreshTimer = null;
  let tocScrollTimer = null;
  let filterRaf = false;
  let lastUserScrollTime = 0;
  let resizeObserver = null;

  function lockScrollspy(duration = 1600) {
    activeNavToken++;
    const token = activeNavToken;
    isProgrammaticScroll = true;
    awaitingScrollEnd = false;
    window.LatexRuntime?.setPaused?.(true);
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => unlockScrollspy(token), duration);
    return token;
  }

  function unlockScrollspy(token) {
    if (token !== undefined && token !== activeNavToken) return;
    isProgrammaticScroll = false;
    awaitingScrollEnd = false;
    clearTimeout(lockTimer);
    window.LatexRuntime?.setPaused?.(false);
    refreshOffsets();
  }

  function refreshOffsets() {
    if (!scrollContainer || !cachedHeadings.length) {
      headingPositions = [];
      return;
    }

    const baseTop = scrollContainer.getBoundingClientRect().top - scrollContainer.scrollTop;
    const nextPositions = [];
    for (let i = 0; i < cachedHeadings.length; i++) {
      const h = cachedHeadings[i];
      if (h.id && !h.classList.contains('doc-section-hidden')) {
        nextPositions.push({ id: h.id, top: h.getBoundingClientRect().top - baseTop });
      }
    }
    headingPositions = nextPositions;
  }

  function scheduleRefreshOffsets() {
    clearTimeout(offsetRefreshTimer);
    const elapsed = performance.now() - lastUserScrollTime;
    const delay = elapsed < 180 ? 200 : 80;
    offsetRefreshTimer = setTimeout(() => {
      offsetRefreshTimer = null;
      refreshOffsets();
    }, delay);
  }

  function getClampedTargetTop(target) {
    const tRect = target.getBoundingClientRect();
    const cRect = scrollContainer.getBoundingClientRect();
    const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    return Math.min(maxTop, Math.max(0, scrollContainer.scrollTop + (tRect.top - cRect.top) - 20));
  }

  function attachListeners() {
    if (listenersAttached || !scrollContainer) return;
    listenersAttached = true;

    scrollContainer.addEventListener('scroll', () => {
      if (isProgrammaticScroll) return;
      lastUserScrollTime = performance.now();
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        syncScrollspy();
      });
    }, { passive: true });

    scrollContainer.addEventListener('scrollend', () => {
      if (!isProgrammaticScroll || !awaitingScrollEnd) return;
      unlockScrollspy(activeNavToken);
    }, { passive: true });

    document.addEventListener('mdviewer:typeset', scheduleRefreshOffsets);
    window.addEventListener('resize', scheduleRefreshOffsets, { passive: true });

    const viewer = document.getElementById('markdownViewer');
    if (viewer && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleRefreshOffsets);
      resizeObserver.observe(viewer);
    }
  }

  async function navigateToHeading(id) {
    const target = document.getElementById(id);
    if (!target || !scrollContainer) return;

    window.DocCollapse?.revealElement(target);
    const token = lockScrollspy(1600);
    setActive(id, true);
    history.replaceState(null, '', `#${id}`);

    const nav = window.CodeNavigator || null;
    if (nav && typeof nav.syncToHeadingId === 'function') {
      nav.syncToHeadingId(id);
    }

    if (window.innerWidth <= 768) {
      document.getElementById('tocSidebar')?.classList.remove('open');
      document.getElementById('sidebarBackdrop')?.classList.remove('active');
    }

    const targetChunk = target.closest('.md-chunk');
    if (targetChunk && window.LatexRuntime?.ensureChunkReady) {
      await window.LatexRuntime.ensureChunkReady(targetChunk);
      if (token !== activeNavToken) return;
    }

    const targetY = getClampedTargetTop(target);
    if (Math.abs(targetY - scrollContainer.scrollTop) < 2) {
      unlockScrollspy(token);
      return;
    }

    awaitingScrollEnd = true;
    scrollContainer.scrollTo({ top: targetY, behavior: 'smooth' });
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  }

  function render(headings, docKey = '') {
    if (!container) return;
    container.innerHTML = '';
    tocNodes = [];
    tocIndexMap = new Map();
    currentActiveId = null;
    counter.textContent = `${headings.length} items`;

    if (!headings.length) {
      container.innerHTML = '<div style="padding:1rem;color:var(--text-faint);font-size:0.8rem;">No headings detected</div>';
      window.TocTree?.clear();
      cachedHeadings = [];
      headingPositions = [];
      return;
    }

    if (window.TocTree) {
      const built = window.TocTree.build(container, headings, docKey, navigateToHeading);
      tocNodes = built.nodes;
      tocIndexMap = built.indexMap;
    }

    cachedHeadings = Array.from(document.querySelectorAll('.markdown-viewer h1, .markdown-viewer h2, .markdown-viewer h3, .markdown-viewer h4, .markdown-viewer h5, .markdown-viewer h6'));
    attachListeners();
    refreshOffsets();
  }

  function setActive(id, immediateScroll = false) {
    if (!container || !id || id === currentActiveId) return;

    const prevIdx = currentActiveId ? tocIndexMap.get(currentActiveId) : undefined;
    if (prevIdx !== undefined && tocNodes[prevIdx]) {
      tocNodes[prevIdx].rowEl.classList.remove('active');
    }

    const nextIdx = tocIndexMap.get(id);
    currentActiveId = id;

    if (nextIdx !== undefined && tocNodes[nextIdx]) {
      const node = tocNodes[nextIdx];
      node.rowEl.classList.add('active');
      if (!node.isHidden) {
        clearTimeout(tocScrollTimer);
        if (immediateScroll) {
          node.rowEl.scrollIntoView({ block: 'nearest' });
        } else {
          tocScrollTimer = setTimeout(() => {
            if (currentActiveId === id && !node.isHidden) {
              node.rowEl.scrollIntoView({ block: 'nearest' });
            }
          }, 80);
        }
      }
    }
  }

  function syncScrollspy() {
    if (isProgrammaticScroll || !scrollContainer || !headingPositions.length) return;

    const scrollY = scrollContainer.scrollTop + 80;
    let lo = 0;
    let hi = headingPositions.length - 1;
    let activeId = headingPositions[0].id;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (headingPositions[mid].top <= scrollY) {
        activeId = headingPositions[mid].id;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    setActive(activeId, false);
  }

  filterInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (filterRaf) return;
    filterRaf = true;
    requestAnimationFrame(() => {
      filterRaf = false;
      window.TocTree?.setFilter(query);
    });
  });

  return { render, setActive, lockScrollspy, unlockScrollspy, refreshOffsets };
})();

window.TocController = TocController;