/**
 * MathJax v3 Configuration & Progressive Lazy Typeset Queue
 * Typesets visible chunks first and processes remaining equations in non-blocking batches.
 */
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    ignoreHtmlClass: 'tex2jax_ignore',
    processHtmlClass: 'math-tex',
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  },
  svg: {
    fontCache: 'local'
  },
  startup: {
    typeset: false,
    ready() {
      window.MathJax.startup.defaultReady();
      if (window.LatexRuntime && typeof window.LatexRuntime.onReady === 'function') {
        window.LatexRuntime.onReady();
      }
    }
  }
};

const LatexRuntime = (() => {
  const BATCH_SIZE = 12;

  let isReady = false;
  let generation = 0;
  let observer = null;
  let isDraining = false;
  let activeTargets = [];
  const pendingChunks = new Set();

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  function getUntypesetNodes(root) {
    if (!root) return [];
    const nodes = root.querySelectorAll('.math-tex');
    const pending = [];
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].querySelector('mjx-container')) {
        pending.push(nodes[i]);
      }
    }
    return pending;
  }

  async function typesetContainerBatched(container, gen) {
    const nodes = getUntypesetNodes(container);
    if (!nodes.length) return;

    const isChunk = container.classList && container.classList.contains('md-chunk');
    if (isChunk) container.style.contentVisibility = 'visible';

    try {
      for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
        if (gen !== generation) return;
        const slice = nodes.slice(i, i + BATCH_SIZE);
        await window.MathJax.typesetPromise(slice);
        if (i + BATCH_SIZE < nodes.length) {
          await nextFrame();
        }
      }
      if (isChunk) container.dataset.mathDone = '1';
      document.dispatchEvent(new CustomEvent('mdviewer:typeset'));
    } catch (err) {
      console.warn('MathJax typeset warning:', err);
    } finally {
      if (isChunk) container.style.contentVisibility = '';
    }
  }

  async function drainQueue(gen) {
    if (isDraining || !isReady) return;
    isDraining = true;

    try {
      while (pendingChunks.size > 0 && gen === generation) {
        const iterator = pendingChunks.values();
        const chunk = iterator.next().value;
        pendingChunks.delete(chunk);

        if (observer) observer.unobserve(chunk);
        await typesetContainerBatched(chunk, gen);
        await nextFrame();
      }
    } finally {
      isDraining = false;
      if (pendingChunks.size > 0 && gen === generation) {
        drainQueue(gen);
      }
    }
  }

  function observeViewer(viewer, tocContainer) {
    generation++;
    const gen = generation;
    pendingChunks.clear();

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (tocContainer) {
      typesetContainerBatched(tocContainer, gen);
    }

    if (!viewer) return;

    const chunks = viewer.querySelectorAll('.md-chunk');
    if (!chunks.length) {
      typesetContainerBatched(viewer, gen);
      return;
    }

    const scrollRoot = document.getElementById('viewerWorkspace');
    const mathChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].querySelector('.math-tex')) {
        mathChunks.push(chunks[i]);
      }
    }

    if (!mathChunks.length) return;

    if (typeof IntersectionObserver !== 'undefined' && scrollRoot) {
      observer = new IntersectionObserver((entries) => {
        if (gen !== generation) return;
        let added = false;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.isIntersecting && !entry.target.dataset.mathDone) {
            pendingChunks.add(entry.target);
            added = true;
          }
        }
        if (added) drainQueue(gen);
      }, { root: scrollRoot, rootMargin: '800px 0px' });

      for (let i = 0; i < mathChunks.length; i++) {
        observer.observe(mathChunks[i]);
      }
    }

    // Eagerly queue the first two math chunks so above-the-fold renders immediately
    pendingChunks.add(mathChunks[0]);
    if (mathChunks[1]) pendingChunks.add(mathChunks[1]);
    drainQueue(gen);
  }

  function typeset(targets) {
    const elements = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    if (!elements.length) return Promise.resolve();

    activeTargets = elements;
    if (!isReady || !window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
      return Promise.resolve();
    }

    observeViewer(elements[0], elements[1] || null);
    return Promise.resolve();
  }

  async function flushAll() {
    if (!isReady || !window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return;
    const viewer = activeTargets[0];
    if (!viewer) return;

    const chunks = viewer.querySelectorAll('.md-chunk');
    const gen = generation;
    for (let i = 0; i < chunks.length; i++) {
      if (gen !== generation) return;
      if (!chunks[i].dataset.mathDone && chunks[i].querySelector('.math-tex')) {
        await typesetContainerBatched(chunks[i], gen);
      }
    }
  }

  function flushSync() {
    if (!isReady || !window.MathJax || typeof window.MathJax.typeset !== 'function') return;
    const viewer = activeTargets[0];
    if (!viewer) return;

    const chunks = viewer.querySelectorAll('.md-chunk');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.dataset.mathDone) {
        const pending = getUntypesetNodes(chunk);
        if (pending.length) {
          chunk.style.contentVisibility = 'visible';
          window.MathJax.typeset(pending);
          chunk.style.contentVisibility = '';
        }
        chunk.dataset.mathDone = '1';
      }
    }
  }

  function hasPendingMath() {
    const viewer = activeTargets[0];
    if (!viewer) return false;
    return getUntypesetNodes(viewer).length > 0;
  }

  function onReady() {
    isReady = true;
    if (activeTargets.length) {
      observeViewer(activeTargets[0], activeTargets[1] || null);
    }
  }

  return { typeset, onReady, flushAll, flushSync, hasPendingMath };
})();

window.LatexRuntime = LatexRuntime;