/**
 * Standalone Offline Markdown Parser
 * Chunks large documents for content-visibility performance, extracts code fences, and supports LaTeX.
 */
const MarkdownParser = (() => {
  const CHUNK_BLOCK_LIMIT = 20;
  const FILENAME_VALIDATOR = /^([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile|docker-compose\.ya?ml)$/i;
  const HEADING_FILENAME_EXTRACTOR = /(?:(?:file(?:name)?|path):\s*)?`?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile)`?/i;

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  function extractFilenameFromHeading(headingText) {
    if (!headingText) return null;
    const match = headingText.match(HEADING_FILENAME_EXTRACTOR);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (FILENAME_VALIDATOR.test(candidate)) return candidate;
    }
    return null;
  }

  function parseInline(text) {
    if (typeof LatexEngine !== 'undefined') {
      return LatexEngine.formatInline(text, 'inline-code');
    }
    let output = escapeHtml(text);
    output = output.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/\*(.*?)\*/g, '<em>$1</em>');
    output = output.replace(/~~(.*?)~~/g, '<del>$1</del>');
    output = output.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return output;
  }

  function splitCells(rowLine) {
    if (typeof LatexEngine !== 'undefined') {
      return LatexEngine.splitTableRow(rowLine).filter(Boolean);
    }
    return rowLine.split('|').map(s => s.trim()).filter(Boolean);
  }

  function parse(markdown, isNested = false) {
    if (!markdown) return { html: isNested ? '' : '<p class="empty-state">No content to preview.</p>', headings: [], codeBlocks: [] };

    const lines = markdown.split(/\r?\n/);
    const headings = [];
    const codeBlocks = [];
    const slugCounts = new Map();
    const out = [];

    let chunkParts = [];
    let chunkBlocks = 0;
    let chunkEstHeight = 0;

    let inCodeBlock = false;
    let codeBuffer = [];
    let codeMeta = '';
    let inList = false;
    let listType = 'ul';
    let inTable = false;
    let tableBuffer = [];
    let lastHeading = '';
    let lastHeadingId = '';

    function flushChunk() {
      if (isNested || !chunkParts.length) return;
      const est = Math.max(120, Math.round(chunkEstHeight));
      out.push(`<section class="md-chunk" style="contain-intrinsic-size: auto ${est}px;">\n`, chunkParts.join(''), '</section>\n');
      chunkParts = [];
      chunkBlocks = 0;
      chunkEstHeight = 0;
    }

    function pushBlock(htmlStr, estPx = 42) {
      if (isNested) {
        out.push(htmlStr);
        return;
      }
      chunkParts.push(htmlStr);
      chunkBlocks++;
      chunkEstHeight += estPx;
      if (chunkBlocks >= CHUNK_BLOCK_LIMIT && !inList && !inTable) {
        flushChunk();
      }
    }

    function flushList() {
      if (inList) {
        pushBlock(`</${listType}>\n`, 12);
        inList = false;
      }
    }

    function flushTable() {
      if (!inTable) return;
      if (tableBuffer.length >= 2) {
        const t = ['<table><thead>\n<tr>'];
        splitCells(tableBuffer[0]).forEach(h => t.push(`<th>${parseInline(h)}</th>`));
        t.push('</tr>\n</thead><tbody>\n');
        for (let i = 2; i < tableBuffer.length; i++) {
          const cells = splitCells(tableBuffer[i]);
          if (cells.length) {
            t.push('<tr>');
            cells.forEach(c => t.push(`<td>${parseInline(c)}</td>`));
            t.push('</tr>\n');
          }
        }
        t.push('</tbody></table>\n');
        pushBlock(t.join(''), 44 + tableBuffer.length * 38);
      }
      tableBuffer = [];
      inTable = false;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          flushList();
          flushTable();
          inCodeBlock = true;
          codeMeta = line.trim().slice(3).trim();
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          const rawCode = codeBuffer.join('\n');
          let lang = 'code';
          let filename = '';

          if (codeMeta) {
            if (codeMeta.includes(':')) {
              const parts = codeMeta.split(':');
              lang = parts[0].trim() || 'code';
              filename = parts.slice(1).join(':').trim();
            } else if (codeMeta.includes(' ')) {
              const parts = codeMeta.split(' ');
              lang = parts[0].trim();
              filename = parts.slice(1).join(' ').trim();
            } else {
              lang = codeMeta.trim();
            }
          }

          if (lang.toLowerCase() === 'math' && typeof LatexEngine !== 'undefined') {
            pushBlock(LatexEngine.renderDisplayBlock(rawCode, true), 90);
            continue;
          }

          const blockIndex = codeBlocks.length;
          if (filename && !FILENAME_VALIDATOR.test(filename)) filename = '';
          if (!filename && lastHeading) {
            const detectedName = extractFilenameFromHeading(lastHeading);
            if (detectedName) filename = detectedName;
          }

          const displayName = filename || (lastHeading ? lastHeading : `${lang.toUpperCase()} snippet`);
          codeBlocks.push({
            id: `codeBlock${blockIndex}`,
            index: blockIndex,
            language: lang,
            name: displayName,
            parentHeading: lastHeading || 'General',
            parentHeadingId: lastHeadingId || '',
            hasDirectFilename: Boolean(filename),
            code: rawCode
          });

          const highlightedCode = (typeof SyntaxHighlighter !== 'undefined')
            ? SyntaxHighlighter.highlight(rawCode, lang)
            : escapeHtml(rawCode);

          pushBlock(
            `<div class="code-card" id="codeBlock${blockIndex}" data-block-index="${blockIndex}"><div class="code-header-bar"><div class="code-meta-wrap"><span class="code-seq">#${blockIndex + 1}</span><span class="code-name-label" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span></div><button class="code-block-copy" data-block-target="${blockIndex}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span></button></div><div class="code-body-wrap"><pre><code class="language-${escapeHtml(lang)}">${highlightedCode}</code></pre></div></div>\n`,
            80 + codeBuffer.length * 22
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      if (typeof LatexEngine !== 'undefined') {
        const displayMatch = LatexEngine.consumeDisplayBlock(lines, i);
        if (displayMatch) {
          flushList();
          flushTable();
          pushBlock(displayMatch.html, 64 + (displayMatch.endIndex - i) * 26);
          i = displayMatch.endIndex;
          continue;
        }
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList();
        inTable = true;
        tableBuffer.push(line.trim());
        continue;
      } else {
        flushTable();
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const baseSlug = slugify(text) || `heading-${headings.length}`;
        const count = (slugCounts.get(baseSlug) || 0) + 1;
        slugCounts.set(baseSlug, count);
        const slug = count === 1 ? baseSlug : `${baseSlug}-${count}`;
        lastHeading = text;
        lastHeadingId = slug;
        if (!isNested) headings.push({ level, text, id: slug });
        pushBlock(`<h${level} id="${slug}">${parseInline(text)}</h${level}>\n`, 64);
        continue;
      }

      if (/^(\*\*\*|---|___)$/.test(line.trim())) {
        flushList();
        pushBlock('<hr>\n', 34);
        continue;
      }

      if (line.trim().startsWith('>')) {
        flushList();
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        i--;
        pushBlock(`<blockquote>${parse(quoteLines.join('\n'), true).html}</blockquote>\n`, 48 + quoteLines.length * 26);
        continue;
      }

      const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          pushBlock('<ul>\n', 8);
        }
        pushBlock(`<li>${parseInline(ulMatch[2])}</li>\n`, 28);
        continue;
      }

      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
          pushBlock('<ol>\n', 8);
        }
        pushBlock(`<li>${parseInline(olMatch[2])}</li>\n`, 28);
        continue;
      }

      if (line.trim() === '') {
        flushList();
        continue;
      }

      flushList();
      pushBlock(`<p>${parseInline(line)}</p>\n`, 36 + Math.ceil(line.length / 80) * 24);
    }

    flushList();
    flushTable();
    flushChunk();

    if (!isNested) {
      out.push('<div class="doc-end-spacer" aria-hidden="true"></div>\n');
    }

    return { html: out.join(''), headings, codeBlocks };
  }

  return { parse, extractFilenameFromHeading, FILENAME_VALIDATOR };
})();