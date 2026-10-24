/**
 * Table of Contents & Scrollspy Controller
 * Formats inline backticks as styled code blocks in the outline tree.
 */
const TocController = (() => {
  const container = document.getElementById('tocContainer');
  const counter = document.getElementById('tocCounter');
  const filterInput = document.getElementById('tocFilterInput');

  let headingElements = [];
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
    const escaped = escapeHtml(rawText);
    // Replace backticked text with styled inline code chip
    return escaped.replace(/`([^`]+)`/g, '<code class="toc-code">$1</code>');
  }

  function render(headings) {
    if (!container) return;
    container.innerHTML = '';
    counter.textContent = `${headings.length} items`;

    if (!headings.length) {
      container.innerHTML = '<div style="padding:1rem;color:var(--text-faint);font-size:0.8rem;">No headings detected</div>';
      return;
    }

    headings.forEach((h) => {
      const link = document.createElement('a');
      link.href = `#${h.id}`;
      link.className = `toc-item toc-level-${h.level}`;
      link.dataset.targetId = h.id;
      // Plain text without backticks for seamless search matching
      link.dataset.title = h.text.toLowerCase().replace(/`/g, '');
      // Render as rich HTML with <code> tags instead of raw backticks
      link.innerHTML = formatTocHtml(h.text);

      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(h.id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', `#${h.id}`);
          setActive(h.id);

          // Auto-close drawer on mobile when an item is selected
          if (window.innerWidth <= 768) {
            document.getElementById('tocSidebar')?.classList.remove('open');
            document.getElementById('sidebarBackdrop')?.classList.remove('active');
          }
        }
      });

      container.appendChild(link);
    });

    applyFilter();
    attachObserver();
  }

  function setActive(id) {
    const items = container.querySelectorAll('.toc-item');
    items.forEach((item) => {
      if (item.dataset.targetId === id) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  function attachObserver() {
    headingElements = Array.from(document.querySelectorAll('.markdown-viewer h1, .markdown-viewer h2, .markdown-viewer h3, .markdown-viewer h4'));
    if (!headingElements.length) return;

    const scrollContainer = document.getElementById('viewerWorkspace');
    if (!scrollContainer) return;

    let debounceTimer;
    scrollContainer.addEventListener('scroll', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncScrollspy, 25);
    }, { passive: true });
  }

  function syncScrollspy() {
    const scrollContainer = document.getElementById('viewerWorkspace');
    const scrollY = scrollContainer.scrollTop + 80;

    let activeId = null;
    for (let i = 0; i < headingElements.length; i++) {
      const heading = headingElements[i];
      if (heading.offsetTop <= scrollY) {
        activeId = heading.id;
      } else {
        break;
      }
    }

    if (activeId) {
      setActive(activeId);
    } else if (headingElements[0]) {
      setActive(headingElements[0].id);
    }
  }

  function applyFilter() {
    const items = container.querySelectorAll('.toc-item');
    items.forEach((el) => {
      const match = el.dataset.title.includes(currentFilter);
      el.style.display = match ? 'block' : 'none';
    });
  }

  filterInput.addEventListener('input', (e) => {
    currentFilter = e.target.value.toLowerCase().trim();
    applyFilter();
  });

  return { render, setActive };
})();