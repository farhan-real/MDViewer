/**
 * Table of Contents & Scrollspy Controller
 * Supports independent TOC collapsing, idle-deferred offset caching, and jitter-free far jumps.
 */
const TocController = (() => {
  const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  const container = document.getElementById('tocContainer');
  const counter = document.getElementById('tocCounter');
  const filterInput = document.getElementById('tocFilterInput');
  const scrollContainer = document.getElementById('viewerWorkspace');

  let cachedHeadings = [];
  let headingPositions = [];
  let tocNodes = [];
  const tocIndexMap = new Map();
  let currentActiveId = null;
  let currentFilter = '';
  let isProgrammaticScroll = false;
  let awaitingScrollEnd = false;
  let expectedEndY = null;
  let activeNavToken = 0;
  let lockTimer = null;
  let listenersAttached = false;
  let rafScheduled = false;
  let offsetRefreshTimer = null;
  let tocScrollTimer = null;
  let filterRaf = false;
  let lastUserScrollTime = 0;
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
    return escapeHtml(rawText).replace(/`([^`]+)`/g, '<code class="toc-code">$1</code>');
  }

  function lockScrollspy(duration = 1800) {
    activeNavToken++;
    const token = activeNavToken;
    isProgrammaticScroll = true;
    awaitingScrollEnd = false;
    expectedEndY = null;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => unlockScrollspy(token), duration);
    return token;
  }

  function unlockScrollspy(token) {
    if (token !== undefined && token !== activeNavToken) return;
    isProgrammaticScroll = false;
    awaitingScrollEnd = false;
    expectedEndY = null;
    clearTimeout(lockTimer);
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

  function scrollToElementTop(target, token) {
    if (!scrollContainer || !target) return;
    const initialY = getClampedTargetTop(target);
    const distance = Math.abs(initialY - scrollContainer.scrollTop);

    if (distance < 2) {
      unlockScrollspy(token);
      return;
    }

    if (distance <= scrollContainer.clientHeight * 2.2) {
      expectedEndY = initialY;
      awaitingScrollEnd = true;
      scrollContainer.scrollTo({ top: initialY, behavior: 'smooth' });
    } else {
      scrollContainer.scrollTop = initialY;
      requestAnimationFrame(() => {
        if (token !== activeNavToken) return;
        const exactY = getClampedTargetTop(target);
        const preY = exactY > 40 ? exactY - 40 : exactY;
        scrollContainer.scrollTop = preY;
        if (Math.abs(exactY - preY) >= 2) {
          expectedEndY = exactY;
          requestAnimationFrame(() => {
            if (token === activeNavToken) awaitingScrollEnd = true;
          });
          scrollContainer.scrollTo({ top: exactY, behavior: 'smooth' });
        } else {
          unlockScrollspy(token);
        }
      });
    }

    if (window.scrollY !== 0) window.scrollTo(0, 0);
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
      if (expectedEndY !== null && Math.abs(scrollContainer.scrollTop - expectedEndY) > 10) return;
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

  function updateTocVisibility() {
    const filtering = currentFilter.length > 0;
    for (let i = 0; i < tocNodes.length; i++) {
      const node = tocNodes[i];
      const nextHidden = filtering
        ? !node.titleLower.includes(currentFilter)
        : (node.parentIndex !== -1 && (tocNodes[node.parentIndex].collapsed || tocNodes[node.parentIndex].isHidden));

      if (nextHidden !== node.isHidden) {
        node.isHidden = nextHidden;
        node.rowEl.style.display = nextHidden ? 'none' : 'flex';
      }
    }
  }

  function navigateToHeading(id) {
    const target = document.getElementById(id);
    if (!target || !scrollContainer) return;

    window.DocCollapse?.revealElement(target);
    const token = lockScrollspy(1800);
    setActive(id, true);
    scrollToElementTop(target, token);
    history.replaceState(null, '', `#${id}`);

    const nav = window.CodeNavigator || null;
    if (nav && typeof nav.syncToHeadingId === 'function') {
      nav.syncToHeadingId(id);
    }

    if (window.innerWidth <= 768) {
      document.getElementById('tocSidebar')?.classList.remove('open');
      document.getElementById('sidebarBackdrop')?.classList.remove('active');
    }
  }

  function render(headings) {
    if (!container) return;
    container.innerHTML = '';
    tocNodes = [];
    tocIndexMap.clear();
    currentActiveId = null;
    counter.textContent = `${headings.length} items`;

    if (!headings.length) {
      container.innerHTML = '<div style="padding:1rem;color:var(--text-faint);font-size:0.8rem;">No headings detected</div>';
      cachedHeadings = [];
      headingPositions = [];
      return;
    }

    const fragment = document.createDocumentFragment();
    const stack = [];

    headings.forEach((h, index) => {
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      const parentIndex = stack.length ? stack[stack.length - 1].index : -1;
      stack.push({ level: h.level, index });

      const hasChildren = index + 1 < headings.length && headings[index + 1].level > h.level;
      const row = document.createElement('div');
      row.className = `toc-row toc-level-${h.level}`;

      if (hasChildren) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toc-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle subheadings');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.setAttribute('tabindex', '-1');
        toggleBtn.innerHTML = CHEVRON_SVG;
        toggleBtn.addEventListener('mousedown', (e) => e.preventDefault());
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const node = tocNodes[index];
          node.collapsed = !node.collapsed;
          row.classList.toggle('is-collapsed', node.collapsed);
          toggleBtn.setAttribute('aria-expanded', String(!node.collapsed));
          updateTocVisibility();
        });
        row.appendChild(toggleBtn);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'toc-toggle-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        row.appendChild(spacer);
      }

      const link = document.createElement('a');
      link.href = `#${h.id}`;
      link.className = 'toc-link';
      link.innerHTML = formatTocHtml(h.text);
      link.setAttribute('tabindex', '-1');
      link.addEventListener('mousedown', (e) => e.preventDefault());
      link.addEventListener('click', (e) => {
        e.preventDefault();
        link.blur();
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        navigateToHeading(h.id);
      });

      row.appendChild(link);
      fragment.appendChild(row);

      tocIndexMap.set(h.id, index);
      tocNodes.push({
        index,
        level: h.level,
        id: h.id,
        titleLower: h.text.toLowerCase().replace(/`/g, ''),
        parentIndex,
        collapsed: false,
        isHidden: false,
        rowEl: row
      });
    });

    container.appendChild(fragment);
    cachedHeadings = Array.from(document.querySelectorAll('.markdown-viewer h1, .markdown-viewer h2, .markdown-viewer h3, .markdown-viewer h4, .markdown-viewer h5, .markdown-viewer h6'));
    updateTocVisibility();
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
    currentFilter = e.target.value.toLowerCase().trim();
    if (filterRaf) return;
    filterRaf = true;
    requestAnimationFrame(() => {
      filterRaf = false;
      updateTocVisibility();
    });
  });

  return { render, setActive, lockScrollspy, unlockScrollspy, refreshOffsets };
})();

window.TocController = TocController;