/**
 * MathJax v3 Configuration & Progressive Lazy Typeset Queue
 * Typesets only near-viewport chunks in tiny 3-item batches so fast scrolling stays 200Hz smooth.
 */
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
    macros: {
      unicodeInt: ['\\mathop{\\vcenter{\\mathchoice{\\huge\\unicode{#1}\\,}{\\unicode{#1}}{\\unicode{#1}}{\\unicode{#1}}}\\,}\\nolimits', 1],
      oiint: '\\unicodeInt{x222F}',
      oiiint: '\\unicodeInt{x2230}',
      ointclockwise: '\\unicodeInt{x2232}',
      varointclockwise: '\\unicodeInt{x2232}',
      ointctrclockwise: '\\unicodeInt{x2233}',
      sqint: '\\unicodeInt{x2A16}'
    }
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
  const BATCH_SIZE = 3;
  const LOOKAHEAD_PX = 550;

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

  function isChunkNearViewport(chunk, scrollRoot) {
    if (!scrollRoot || !chunk.isConnected) return true;
    const cRect = chunk.getBoundingClientRect();
    const rRect = scrollRoot.getBoundingClientRect();
    return cRect.bottom >= (rRect.top - LOOKAHEAD_PX) && cRect.top <= (rRect.bottom + LOOKAHEAD_PX);
  }

  async function typesetContainerBatched(container, gen, forceVisible = false) {
    const nodes = getUntypesetNodes(container);
    if (!nodes.length) return;

    const isChunk = container.classList && container.classList.contains('md-chunk');
    if (isChunk && forceVisible) container.style.contentVisibility = 'visible';

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
      if (isChunk && forceVisible) container.style.contentVisibility = '';
    }
  }

  async function drainQueue(gen) {
    if (isDraining || !isReady) return;
    isDraining = true;
    const scrollRoot = document.getElementById('viewerWorkspace');

    try {
      while (pendingChunks.size > 0 && gen === generation) {
        const iterator = pendingChunks.values();
        const chunk = iterator.next().value;
        pendingChunks.delete(chunk);

        // Skip intermediate chunks scrolled past during fast flings; IO re-queues if revisited
        if (scrollRoot && !isChunkNearViewport(chunk, scrollRoot)) {
          continue;
        }

        await typesetContainerBatched(chunk, gen, false);
        if (chunk.dataset.mathDone && observer) {
          observer.unobserve(chunk);
        }
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
      typesetContainerBatched(tocContainer, gen, false);
    }

    if (!viewer) return;

    const chunks = viewer.querySelectorAll('.md-chunk');
    if (!chunks.length) {
      typesetContainerBatched(viewer, gen, false);
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
          } else if (!entry.isIntersecting) {
            pendingChunks.delete(entry.target);
          }
        }
        if (added) drainQueue(gen);
      }, { root: scrollRoot, rootMargin: '450px 0px' });

      for (let i = 0; i < mathChunks.length; i++) {
        observer.observe(mathChunks[i]);
      }
    }

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
        await typesetContainerBatched(chunks[i], gen, true);
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