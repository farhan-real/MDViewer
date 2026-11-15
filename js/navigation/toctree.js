/**
 * TOC Tree Builder & Collapse Persistence
 * Builds hierarchical TOC rows, manages search filtering, and persists collapsed TOC headings.
 */
const TocTree = (() => {
  const STORAGE_KEY = 'mdviewer_toc_collapsed';
  const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  let nodes = [];
  let indexMap = new Map();
  let collapsedIds = new Set();
  let currentDocKey = '';
  let currentFilter = '';

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

  function loadCollapsed(docKey) {
    if (!docKey) return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (parsed && parsed.hash === docKey && Array.isArray(parsed.ids)) {
        return new Set(parsed.ids);
      }
    } catch {}
    return new Set();
  }

  function saveCollapsed() {
    if (!currentDocKey) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        hash: currentDocKey,
        ids: Array.from(collapsedIds)
      }));
    } catch {}
  }

  function updateVisibility() {
    const filtering = currentFilter.length > 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nextHidden = filtering
        ? !node.titleLower.includes(currentFilter)
        : (node.parentIndex !== -1 && (nodes[node.parentIndex].collapsed || nodes[node.parentIndex].isHidden));

      if (nextHidden !== node.isHidden) {
        node.isHidden = nextHidden;
        node.rowEl.style.display = nextHidden ? 'none' : 'flex';
      }
    }
  }

  function build(container, headings, docKey, onNavigate) {
    nodes = [];
    indexMap = new Map();
    currentDocKey = docKey || '';
    collapsedIds = loadCollapsed(currentDocKey);

    const fragment = document.createDocumentFragment();
    const stack = [];

    headings.forEach((h, index) => {
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      const parentIndex = stack.length ? stack[stack.length - 1].index : -1;
      stack.push({ level: h.level, index });

      const hasChildren = index + 1 < headings.length && headings[index + 1].level > h.level;
      const isCollapsed = hasChildren && collapsedIds.has(h.id);
      if (!isCollapsed) collapsedIds.delete(h.id);

      const row = document.createElement('div');
      row.className = `toc-row toc-level-${h.level}`;
      if (isCollapsed) row.classList.add('is-collapsed');

      if (hasChildren) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'toc-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle subheadings');
        toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
        toggleBtn.setAttribute('tabindex', '-1');
        toggleBtn.innerHTML = CHEVRON_SVG;
        toggleBtn.addEventListener('mousedown', (e) => e.preventDefault());
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const node = nodes[index];
          node.collapsed = !node.collapsed;
          if (node.collapsed) {
            collapsedIds.add(node.id);
          } else {
            collapsedIds.delete(node.id);
          }
          row.classList.toggle('is-collapsed', node.collapsed);
          toggleBtn.setAttribute('aria-expanded', String(!node.collapsed));
          saveCollapsed();
          updateVisibility();
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
        onNavigate(h.id);
      });

      row.appendChild(link);
      fragment.appendChild(row);

      indexMap.set(h.id, index);
      nodes.push({
        index,
        level: h.level,
        id: h.id,
        titleLower: h.text.toLowerCase().replace(/`/g, ''),
        parentIndex,
        collapsed: isCollapsed,
        isHidden: false,
        rowEl: row
      });
    });

    container.appendChild(fragment);
    updateVisibility();
    return { nodes, indexMap };
  }

  function setFilter(query) {
    currentFilter = query || '';
    updateVisibility();
  }

  function clear() {
    nodes = [];
    indexMap = new Map();
    collapsedIds = new Set();
  }

  return { build, setFilter, clear };
})();

window.TocTree = TocTree;