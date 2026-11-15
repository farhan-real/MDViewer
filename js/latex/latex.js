/**
 * LaTeX Extraction & Markdown Protection Engine
 * Protects inline/display LaTeX from Markdown formatting and table pipe splitting.
 */
const LatexEngine = (() => {
  const DISPLAY_ENVS = new Set([
    'equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*',
    'xalignat', 'xalignat*', 'xxalignat', 'flalign', 'flalign*',
    'gather', 'gather*', 'multline', 'multline*', 'eqnarray', 'eqnarray*',
    'numcases', 'subnumcases', 'empheq', 'prooftree', 'subequations', 'CD'
  ]);

  const INNER_MATH_ENVS = new Set([
    'aligned', 'alignedat', 'gathered', 'split', 'cases', 'dcases', 'rcases',
    'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
    'smallmatrix', 'array'
  ]);

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

  function renderDisplayBlock(rawContent, forceWrap = false) {
    const trimmed = rawContent.trim();
    const isDelimited = !forceWrap && (trimmed.startsWith('$$') || trimmed.startsWith('\\[') || /^\\begin\{/.test(trimmed));
    const expr = isDelimited ? trimmed : `$$\n${trimmed}\n$$`;
    return `<div class="math-tex math-display">${escapeHtml(expr)}</div>\n`;
  }

  function normalizeClosingPunct(raw, delim) {
    const escapedDelim = delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escapedDelim}\\s*([.,;:!?]+)\\s*$`);
    return raw.replace(re, `$1${delim}`);
  }

  function consumeDisplayBlock(lines, startIndex) {
    const trimmed = lines[startIndex].trim();

    if (trimmed.startsWith('$$')) {
      const closeIdx = trimmed.indexOf('$$', 2);
      if (closeIdx !== -1 && /^\$\$\s*[.,;:!?]*$/.test(trimmed.slice(closeIdx))) {
        return { html: renderDisplayBlock(normalizeClosingPunct(trimmed, '$$')), endIndex: startIndex };
      }
      if (closeIdx === -1) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].includes('$$')) {
            const raw = normalizeClosingPunct(lines.slice(startIndex, j + 1).join('\n'), '$$');
            return { html: renderDisplayBlock(raw), endIndex: j };
          }
        }
      }
    }

    if (trimmed.startsWith('\\[')) {
      const closeIdx = trimmed.indexOf('\\]', 2);
      if (closeIdx !== -1 && /^\\\]\s*[.,;:!?]*$/.test(trimmed.slice(closeIdx))) {
        return { html: renderDisplayBlock(normalizeClosingPunct(trimmed, '\\]')), endIndex: startIndex };
      }
      if (closeIdx === -1) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].includes('\\]')) {
            const raw = normalizeClosingPunct(lines.slice(startIndex, j + 1).join('\n'), '\\]');
            return { html: renderDisplayBlock(raw), endIndex: j };
          }
        }
      }
    }

    const envMatch = trimmed.match(/^\\begin\{([a-zA-Z*]+)\}/);
    const envName = envMatch ? envMatch[1] : '';
    const isOuterEnv = DISPLAY_ENVS.has(envName);
    const isInnerEnv = INNER_MATH_ENVS.has(envName);

    if (isOuterEnv || isInnerEnv) {
      const endTag = `\\end{${envName}}`;
      if (trimmed.endsWith(endTag)) {
        return { html: renderDisplayBlock(trimmed, isInnerEnv), endIndex: startIndex };
      }
      if (!trimmed.includes(endTag)) {
        for (let j = startIndex + 1; j < lines.length; j++) {
          if (lines[j].includes(endTag)) {
            return { html: renderDisplayBlock(lines.slice(startIndex, j + 1).join('\n'), isInnerEnv), endIndex: j };
          }
        }
      }
    }

    return null;
  }

  function splitTableRow(rowLine) {
    const inner = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '');
    const dummyTokens = [];
    const masked = inner.replace(/`([^`]+)`/g, (m) => {
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
    return window.LatexRuntime ? window.LatexRuntime.typeset(targets) : Promise.resolve();
  }

  return { formatInline, renderDisplayBlock, consumeDisplayBlock, splitTableRow, typeset };
})();

window.LatexEngine = LatexEngine;