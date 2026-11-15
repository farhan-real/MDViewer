/**
 * MathJax v3 Configuration & Asynchronous Typeset Queue
 * Configured for standalone file:// compatibility using tex-svg-full.js.
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
    blacker: 0,
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
  let isReady = false;
  let pendingTargets = [];
  let typesetQueue = Promise.resolve();

  function typeset(targets) {
    const elements = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    if (!elements.length) return Promise.resolve();

    if (!isReady || !window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
      pendingTargets = elements;
      return Promise.resolve();
    }

    typesetQueue = typesetQueue
      .then(() => {
        if (typeof window.MathJax.typesetClear === 'function') {
          window.MathJax.typesetClear(elements);
        }
        return window.MathJax.typesetPromise(elements);
      })
      .then(() => {
        document.dispatchEvent(new CustomEvent('mdviewer:typeset'));
      })
      .catch((err) => {
        console.warn('MathJax typeset warning:', err);
      });

    return typesetQueue;
  }

  function onReady() {
    isReady = true;
    if (pendingTargets.length) {
      const targets = pendingTargets;
      pendingTargets = [];
      typeset(targets);
    }
  }

  return { typeset, onReady };
})();

window.LatexRuntime = LatexRuntime;