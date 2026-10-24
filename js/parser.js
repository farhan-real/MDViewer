/**
 * Standalone Offline Markdown Parser
 * Extracts code fences, validates filenames via regex, and injects bottom document clearance.
 */
const MarkdownParser = (() => {
  // Regex to strictly validate filenames (e.g. app.js, config.yaml, src/main.rs, Dockerfile)
  const FILENAME_VALIDATOR = /^([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile|docker-compose\.ya?ml)$/i;

  // Regex to extract candidate filename patterns from heading text
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
      if (FILENAME_VALIDATOR.test(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  function parseInline(text) {
    let output = escapeHtml(text);
    output = output.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    output = output.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/\*(.*?)\*/g, '<em>$1</em>');
    output = output.replace(/~~(.*?)~~/g, '<del>$1</del>');
    output = output.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return output;
  }

  function parse(markdown) {
    if (!markdown) return { html: '<p class="empty-state">No content to preview.</p>', headings: [], codeBlocks: [] };

    const lines = markdown.split(/\r?\n/);
    const headings = [];
    const codeBlocks = [];

    let html = '';
    let inCodeBlock = false;
    let codeBuffer = [];
    let codeMeta = '';
    let inList = false;
    let listType = 'ul';
    let inTable = false;
    let tableBuffer = [];
    let lastHeading = '';
    let lastHeadingId = '';

    function flushList() {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
      }
    }

    function flushTable() {
      if (!inTable) return;
      if (tableBuffer.length >= 2) {
        html += '<table><thead>\n<tr>';
        const headers = tableBuffer[0].split('|').map(s => s.trim()).filter(Boolean);
        headers.forEach(h => { html += `<th>${parseInline(h)}</th>`; });
        html += '</tr>\n</thead><tbody>\n';

        for (let i = 2; i < tableBuffer.length; i++) {
          const cells = tableBuffer[i].split('|').map(s => s.trim()).filter(Boolean);
          if (cells.length) {
            html += '<tr>';
            cells.forEach(c => { html += `<td>${parseInline(c)}</td>`; });
            html += '</tr>\n';
          }
        }
        html += '</tbody></table>\n';
      }
      tableBuffer = [];
      inTable = false;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code Fence Toggle
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
          const blockIndex = codeBlocks.length;

          let lang = 'code';
          let filename = '';

          // Parse metadata if present in the fence
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

          // Validate or discover filename via regex from the heading directly above
          if (filename && !FILENAME_VALIDATOR.test(filename)) {
            filename = '';
          }

          if (!filename && lastHeading) {
            const detectedName = extractFilenameFromHeading(lastHeading);
            if (detectedName) {
              filename = detectedName;
            }
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

          // Syntax Highlighting
          const highlightedCode = (typeof SyntaxHighlighter !== 'undefined')
            ? SyntaxHighlighter.highlight(rawCode, lang)
            : escapeHtml(rawCode);

          html += `
          <div class="code-card" id="codeBlock${blockIndex}" data-block-index="${blockIndex}">
            <div class="code-header-bar">
              <div class="code-meta-wrap">
                <span class="code-seq">#${blockIndex + 1}</span>
                <span class="code-name-label" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
              </div>
              <button class="code-block-copy" data-block-target="${blockIndex}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="code-body-wrap">
              <pre><code class="language-${escapeHtml(lang)}">${highlightedCode}</code></pre>
            </div>
          </div>\n`;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Tables
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList();
        inTable = true;
        tableBuffer.push(line.trim());
        continue;
      } else {
        flushTable();
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const slug = slugify(text) || `heading-${headings.length}`;
        lastHeading = text;
        lastHeadingId = slug;
        headings.push({ level, text, id: slug });
        html += `<h${level} id="${slug}">${parseInline(text)}</h${level}>\n`;
        continue;
      }

      // Horizontal Rule
      if (/^(\*\*\*|---|___)$/.test(line.trim())) {
        flushList();
        html += '<hr>\n';
        continue;
      }

      // Blockquotes
      if (line.trim().startsWith('>')) {
        flushList();
        const quoteContent = line.replace(/^>\s?/, '');
        html += `<blockquote>${parseInline(quoteContent)}</blockquote>\n`;
        continue;
      }

      // Unordered Lists
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          html += '<ul>\n';
        }
        html += `<li>${parseInline(ulMatch[2])}</li>\n`;
        continue;
      }

      // Ordered Lists
      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
          html += '<ol>\n';
        }
        html += `<li>${parseInline(olMatch[2])}</li>\n`;
        continue;
      }

      if (line.trim() === '') {
        flushList();
        continue;
      }

      // Paragraphs
      flushList();
      html += `<p>${parseInline(line)}</p>\n`;
    }

    flushList();
    flushTable();

    // Injected physical end-of-document spacer to ensure trailing lines are never obscured by floating UI
    html += '<div class="doc-end-spacer" aria-hidden="true"></div>\n';

    return { html, headings, codeBlocks };
  }

  return { parse, extractFilenameFromHeading, FILENAME_VALIDATOR };
})();