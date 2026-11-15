/**
 * LaTeX & MathJax Engine
 * Configures MathJax v3 for local file:// loading, protects math from Markdown mangling,
 * extracts display blocks, and queues asynchronous SVG typesetting.
 */
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
    packages: { '[+]': ['physics'] }
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
      if (window.LatexEngine && typeof window.LatexEngine.onReady === 'function') {
        window.LatexEngine.onReady();
      }
    }
  }
};

const LatexEngine = (() => {
  const MATH_ENVS = new Set([
    'equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*',
    'flalign', 'flalign*', 'gather', 'gather*', 'multline', 'multline*',
    'eqnarray', 'eqnarray*', 'cases', 'dcases', 'rcases', 'matrix',
    'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix',
    'split', 'array', 'subequations', 'CD'
  ]);

  let isReady = false;
  let pendingTargets = [];
  let typesetQueue = Promise.resolve();

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findClosingBackslash(str, start, closeSeq) {
    for (let i = start; i < str.length - 1; i++) {
      if (str[i] === '\\' && str[i + 1] === closeSeq[1]) {
        let backslashes = 0;
        for (let b = i - 1; b >= 0 && str[b] === '\\'; b--) backslashes++;
        if (backslashes % 2 === 0) return i;
      }
    }
    return -1;
  }

  function findClosingDollar(str, start, isDouble) {
    for (let i = start; i < str.length; i++) {
      if (str[i] === '\\') {
        i++;
        continue;
      }
      if (str[i] === '$') {
        if (isDouble) {
          if (str[i + 1] === '$') return i;
        } else {
          if (str[i + 1] === '$') {
            i++;
            continue;
          }
          const prev = str[i - 1];
          const next = str[i + 1];
          if (i > start && !/\s/.test(prev) && !(next && /\d/.test(next))) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  function extractInlineMath(str, mathTokens) {
    let out = '';
    let i = 0;
    while (i < str.length) {
      if (str[i] === '\\' && (str[i + 1] === '(' || str[i + 1] === '[')) {
        const closeSeq = str[i + 1] === '(' ? '\\)' : '\\]';
        const end = findClosingBackslash(str, i + 2, closeSeq);
        if (end !== -1) {
          const expr = str.slice(i, end + 2);
          const idx = mathTokens.length;
          mathTokens.push(`<span class="math-tex math-inline">${escapeHtml(expr)}</span>`);
          out += `\uE000M${idx}\uE001`;
          i = end + 2;
          continue;
        }
      }

      if (str[i] === '$' && (i === 0 || str[i - 1] !== '\\')) {
        if (str[i + 1] === '$') {
          const end = findClosingDollar(str, i + 2, true);
          if (end !== -1 && end > i + 2) {
            const expr = str.slice(i, end + 2);
            const idx = mathTokens.length;
            mathTokens.push(`<span class="math-tex math-inline">${escapeHtml(expr)}</span>`);
            out += `\uE000M${idx}\uE001`;
            i = end + 2;
            continue;
          }
        } else if (i + 1 < str.length && !/\s/.test(str[i + 1])) {
          const end = findClosingDollar(str, i + 1, false);
          if (end !== -1) {
            const expr = str.slice(i, end + 1);
            const idx = mathTokens.length;
            mathTokens.push(`<span class="math-tex math-inline">${escapeHtml(expr)}</span>`);
            out += `\uE000M${idx}\uE001`;
            i = end + 1;
            continue;
          }
        }
      }

      out += str[i];
      i++;
    }
    return out;
  }

  function formatInline(text, codeClass = 'inline-code') {
    const codeTokens = [];
    const mathTokens = [];

    let masked = text.replace(/`([^`]+)`/g, (_, code) => {
      const idx = codeTokens.length;
      codeTokens.push(`<code class="${codeClass}">${escapeHtml(code)}</code>`);
      return `\uE000C${idx}\uE001`;
    });

    masked = extractInlineMath(masked, mathTokens);
    let output = escapeHtml(masked);

    if (codeClass !== 'toc-code') {
      output = output.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
      output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      output = output.replace(/\*(.*?)\*/g, '<em>$1</em>');
      output = output.replace(/~~(.*?)~~/g, '<del>$1</del>');
      output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    output = output.replace(/\uE000M(\d+)\uE001/g, (_, idx) => mathTokens[Number(idx)]);
    output = output.replace(/\uE000C(\d+)\uE001/g, (_, idx) => codeTokens[Number(idx)]);
    return output;
  }

  function renderDisplayBlock(rawContent) {
    const trimmed = rawContent.trim();
    const isDelimited = trimmed.startsWith('$$') || trimmed.startsWith('\\[') || /^\\begin\{/.test(trimmed);
    const expr = isDelimited ? trimmed : `$$\n${trimmed}\n$$`;
    return `<div class="math-tex math-display">${escapeHtml(expr)}</div>\n`;
  }

  function consumeDisplayBlock(lines, startIndex) {
    const trimmed = lines[startIndex].trim();

    if (trimmed.startsWith('$$')) {
      const closeIdx = trimmed.indexOf('$$', 2);
      if (closeIdx !== -1 && closeIdx === trimmed.length - 2) {
        return { html: renderDisplayBlock(trimmed), endIndex: startIndex };
      }
      if (closeIdx === -1) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].includes('$$')) {
            return { html: renderDisplayBlock(lines.slice(startIndex, j + 1).join('\n')), endIndex: j };
          }
        }
      }
    }

    if (trimmed.startsWith('\\[')) {
      const closeIdx = trimmed.indexOf('\\]', 2);
      if (closeIdx !== -1 && closeIdx === trimmed.length - 2) {
        return { html: renderDisplayBlock(trimmed), endIndex: startIndex };
      }
      if (closeIdx === -1) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].includes('\\]')) {
            return { html: renderDisplayBlock(lines.slice(startIndex, j + 1).join('\n')), endIndex: j };
          }
        }
      }
    }

    const envMatch = trimmed.match(/^\\begin\{([a-zA-Z*]+)\}/);
    if (envMatch && MATH_ENVS.has(envMatch[1])) {
      const endTag = `\\end{${envMatch[1]}}`;
      if (trimmed.endsWith(endTag)) {
        return { html: renderDisplayBlock(trimmed), endIndex: startIndex };
      }
      if (!trimmed.includes(endTag)) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].includes(endTag)) {
            return { html: renderDisplayBlock(lines.slice(startIndex, j + 1).join('\n')), endIndex: j };
          }
        }
      }
    }

    return null;
  }

  function splitTableRow(rowLine) {
    const inner = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '');
    const dummyTokens = [];
    let masked = inner.replace(/`([^`]+)`/g, (m) => {
      const idx = dummyTokens.length;
      dummyTokens.push(m);
      return `\uE000T${idx}\uE001`;
    });
    const mathRaw = [];
    let i = 0;
    let rebuilt = '';
    while (i < masked.length) {
      if (masked[i] === '\\' && masked[i + 1] === '(') {
        const end = findClosingBackslash(masked, i + 2, '\\)');
        if (end !== -1) {
          mathRaw.push(masked.slice(i, end + 2));
          rebuilt += `\uE000N${mathRaw.length - 1}\uE001`;
          i = end + 2;
          continue;
        }
      }
      if (masked[i] === '$' && (i === 0 || masked[i - 1] !== '\\') && masked[i + 1] !== '$' && masked[i + 1] && !/\s/.test(masked[i + 1])) {
        const end = findClosingDollar(masked, i + 1, false);
        if (end !== -1) {
          mathRaw.push(masked.slice(i, end + 1));
          rebuilt += `\uE000N${mathRaw.length - 1}\uE001`;
          i = end + 1;
          continue;
        }
      }
      rebuilt += masked[i++];
    }

    return rebuilt
      .split('|')
      .map((cell) => cell
        .replace(/\uE000N(\d+)\uE001/g, (_, idx) => mathRaw[Number(idx)])
        .replace(/\uE000T(\d+)\uE001/g, (_, idx) => dummyTokens[Number(idx)])
        .trim());
  }

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

  return { formatInline, renderDisplayBlock, consumeDisplayBlock, splitTableRow, typeset, onReady };
})();

window.LatexEngine = LatexEngine;