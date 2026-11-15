/**
 * Document Collapsible Headings Controller
 * Independently collapses/expands sections under headings in #markdownViewer across .md-chunk boundaries.
 */
const DocCollapse = (() => {
  const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  let hiddenByMap = new WeakMap();
  let listenerAttached = false;

  function getHeadingLevel(el) {
    if (!el || !el.tagName) return 0;
    const match = el.tagName.match(/^H([1-6])$/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  function getNextBlock(node) {
    if (!node) return null;
    if (node.nextElementSibling) {
      return node.nextElementSibling.classList.contains('doc-end-spacer') ? null : node.nextElementSibling;
    }
    const parent = node.parentElement;
    if (parent && parent.classList.contains('md-chunk')) {
      let nextChunk = parent.nextElementSibling;
      while (nextChunk && nextChunk.classList.contains('md-chunk')) {
        if (nextChunk.firstElementChild) return nextChunk.firstElementChild;
        nextChunk = nextChunk.nextElementSibling;
      }
    }
    return null;
  }

  function setHeadingCollapsed(headingEl, shouldCollapse) {
    const level = getHeadingLevel(headingEl);
    if (!level) return;

    const currentlyCollapsed = headingEl.classList.contains('is-collapsed');
    if (currentlyCollapsed === shouldCollapse) return;

    headingEl.classList.toggle('is-collapsed', shouldCollapse);
    const btn = headingEl.querySelector('.doc-collapse-btn');
    if (btn) btn.setAttribute('aria-expanded', String(!shouldCollapse));

    let curr = getNextBlock(headingEl);
    while (curr) {
      const currLevel = getHeadingLevel(curr);
      if (currLevel > 0 && currLevel <= level) break;

      let set = hiddenByMap.get(curr);
      if (shouldCollapse) {
        if (!set) {
          set = new Set();
          hiddenByMap.set(curr, set);
        }
        set.add(headingEl);
        curr.classList.add('doc-section-hidden');
      } else if (set) {
        set.delete(headingEl);
        if (set.size === 0) {
          curr.classList.remove('doc-section-hidden');
        }
      }
      curr = getNextBlock(curr);
    }
  }

  function revealElement(targetEl) {
    if (!targetEl) return;
    const block = targetEl.closest('.md-chunk > *, #markdownViewer > *');
    if (!block || !block.classList.contains('doc-section-hidden')) return;

    const set = hiddenByMap.get(block);
    if (!set || !set.size) return;

    Array.from(set).forEach((headingEl) => {
      setHeadingCollapsed(headingEl, false);
    });

    window.TocController?.refreshOffsets();
    window.CodeNavigator?.refreshOffsets();
  }

  function attachDelegatedListener(viewer) {
    if (listenerAttached || !viewer) return;
    listenerAttached = true;

    viewer.addEventListener('click', (e) => {
      if (e.target.closest('.code-block-copy') || e.target.closest('a')) return;

      const btn = e.target.closest('.doc-collapse-btn');
      const heading = btn
        ? btn.closest('.doc-heading-collapsible')
        : e.target.closest('.doc-heading-collapsible');

      if (!heading) return;
      if (!btn && window.getSelection && window.getSelection().toString().length > 0) return;

      const nextState = !heading.classList.contains('is-collapsed');
      setHeadingCollapsed(heading, nextState);
      window.TocController?.refreshOffsets();
      window.CodeNavigator?.refreshOffsets();
    });
  }

  function init(viewer) {
    if (!viewer) return;
    hiddenByMap = new WeakMap();
    attachDelegatedListener(viewer);

    const headings = viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      const level = getHeadingLevel(h);
      const next = getNextBlock(h);
      const nextLevel = getHeadingLevel(next);
      if (!next || (nextLevel > 0 && nextLevel <= level)) continue;

      const textWrap = document.createElement('span');
      textWrap.className = 'doc-heading-text';
      while (h.firstChild) {
        textWrap.appendChild(h.firstChild);
      }

      const badge = document.createElement('span');
      badge.className = 'doc-collapsed-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = '…';
      textWrap.appendChild(badge);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'doc-collapse-btn';
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.setAttribute('aria-label', 'Toggle section');
      toggleBtn.innerHTML = CHEVRON_SVG;

      h.classList.add('doc-heading-collapsible');
      h.appendChild(toggleBtn);
      h.appendChild(textWrap);
    }
  }

  return { init, revealElement, setHeadingCollapsed };
})();

window.DocCollapse = DocCollapse;