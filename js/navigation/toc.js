/**
 * Table of Contents & Scrollspy Controller
 * Uses cached heading elements, throttled offset refreshes, and rAF binary search for large docs.
 */
const TocController = (() => {
  const container = document.getElementById('tocContainer');
  const counter = document.getElementById('tocCounter');
  const filterInput = document.getElementById('tocFilterInput');
  const scrollContainer = document.getElementById('viewerWorkspace');

  let cachedHeadings = [];
  let headingPositions = [];
  let tocLinkMap = new Map();
  let currentActiveId = null;
  let currentFilter = '';
  let isProgrammaticScroll = false;
  let lockTimer = null;
  let listenersAttached = false;
  let rafScheduled = false;
  let offsetRefreshTimer = null;
  let filterRaf = false;
  let resizeObserver = null;

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTocHtml(rawText) {
    if (typeof LatexEngine !== 'undefined') {
      return LatexEngine.formatInline(rawText, 'toc-code');
    }
    const escaped = escapeHtml(rawText);
    return escaped.replace(/`([^`]+)`/g, '<code class="toc-code">$1</code>');
  }

  function lockScrollspy(duration = 700) {
    isProgrammaticScroll = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      isProgrammaticScroll = false;
    }, duration);
  }

  function unlockScrollspy() {
    isProgrammaticScroll = false;
    clearTimeout(lockTimer);
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
      if (h.id) {
        nextPositions.push({ id: h.id, top: h.getBoundingClientRect().top - baseTop });
      }
    }
    headingPositions = nextPositions;
  }

  function scheduleRefreshOffsets() {
    if (offsetRefreshTimer) return;
    offsetRefreshTimer = setTimeout(() => {
      offsetRefreshTimer = null;
      refreshOffsets();
    }, 120);
  }

  function scrollToElementTop(target) {
    if (!scrollContainer || !target) return;
    const measureAndScroll = () => {
      const tRect = target.getBoundingClientRect();
      const cRect = scrollContainer.getBoundingClientRect();
      const targetY = scrollContainer.scrollTop + (tRect.top - cRect.top) - 20;
      scrollContainer.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    };

    measureAndScroll();
    setTimeout(() => {
      const diff = (target.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top) - 20;
      if (Math.abs(diff) > 28) {
        measureAndScroll();
      }
    }, 340);

    if (window.scrollY !== 0) window.scrollTo(0, 0);
  }

  function attachListeners() {
    if (listenersAttached || !scrollContainer) return;
    listenersAttached = true;

    scrollContainer.addEventListener('scroll', () => {
      if (isProgrammaticScroll || rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        syncScrollspy();
      });
    }, { passive: true });

    scrollContainer.addEventListener('scrollend', unlockScrollspy, { passive: true });
    document.addEventListener('mdviewer:typeset', scheduleRefreshOffsets);
    window.addEventListener('resize', scheduleRefreshOffsets, { passive: true });

    const viewer = document.getElementById('markdownViewer');
    if (viewer && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleRefreshOffsets);
      resizeObserver.observe(viewer);
    }
  }

  function render(headings) {
    if (!container) return;
    container.innerHTML = '';
    tocLinkMap.clear();
    currentActiveId = null;
    counter.textContent = `${headings.length} items`;

    if (!headings.length) {
      container.innerHTML = '<div style="padding:1rem;color:var(--text-faint);font-size:0.8rem;">No headings detected</div>';
      cachedHeadings = [];
      headingPositions = [];
      return;
    }

    const fragment = document.createDocumentFragment();

    headings.forEach((h) => {
      const link = document.createElement('a');
      link.href = `#${h.id}`;
      link.className = `toc-item toc-level-${h.level}`;
      link.dataset.targetId = h.id;
      link.dataset.title = h.text.toLowerCase().replace(/`/g, '');
      link.innerHTML = formatTocHtml(h.text);
      link.setAttribute('tabindex', '-1');

      link.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      link.addEventListener('click', (e) => {
        e.preventDefault();
        link.blur();

        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }

        const target = document.getElementById(h.id);
        if (target && scrollContainer) {
          lockScrollspy(700);
          setActive(h.id);
          scrollToElementTop(target);
          history.replaceState(null, '', `#${h.id}`);

          const nav = window.CodeNavigator || null;
          if (nav && typeof nav.syncToHeadingId === 'function') {
            nav.syncToHeadingId(h.id);
          }

          if (window.innerWidth <= 768) {
            document.getElementById('tocSidebar')?.classList.remove('open');
            document.getElementById('sidebarBackdrop')?.classList.remove('active');
          }
        }
      });

      tocLinkMap.set(h.id, link);
      fragment.appendChild(link);
    });

    container.appendChild(fragment);
    cachedHeadings = Array.from(document.querySelectorAll('.markdown-viewer h1, .markdown-viewer h2, .markdown-viewer h3, .markdown-viewer h4'));
    applyFilter();
    attachListeners();
    refreshOffsets();
  }

  function setActive(id) {
    if (!container || !id || id === currentActiveId) return;

    const prevLink = currentActiveId ? tocLinkMap.get(currentActiveId) : null;
    if (prevLink) prevLink.classList.remove('active');

    const nextLink = tocLinkMap.get(id);
    currentActiveId = id;

    if (nextLink) {
      nextLink.classList.add('active');
      nextLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

    setActive(activeId);
  }

  function applyFilter() {
    tocLinkMap.forEach((el) => {
      const shouldShow = el.dataset.title.includes(currentFilter);
      const isHidden = el.dataset.hidden === '1';
      if (shouldShow && isHidden) {
        el.style.display = 'block';
        el.dataset.hidden = '0';
      } else if (!shouldShow && !isHidden) {
        el.style.display = 'none';
        el.dataset.hidden = '1';
      }
    });
  }

  filterInput.addEventListener('input', (e) => {
    currentFilter = e.target.value.toLowerCase().trim();
    if (filterRaf) return;
    filterRaf = true;
    requestAnimationFrame(() => {
      filterRaf = false;
      applyFilter();
    });
  });

  return { render, setActive, lockScrollspy, unlockScrollspy, refreshOffsets };
})();

window.TocController = TocController;