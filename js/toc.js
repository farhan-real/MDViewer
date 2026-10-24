/**
 * Table of Contents & Scrollspy Controller
 * Provides non-truncated heading tree with search filtering and active scrolling.
 */
const TocController = (() => {
  const container = document.getElementById('tocContainer');
  const counter = document.getElementById('tocCounter');
  const filterInput = document.getElementById('tocFilterInput');

  let headingElements = [];
  let currentFilter = '';

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
      link.dataset.title = h.text.toLowerCase();
      link.textContent = h.text;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(h.id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', `#${h.id}`);
          setActive(h.id);
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
    scrollContainer.onscroll = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncScrollspy, 30);
    };
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