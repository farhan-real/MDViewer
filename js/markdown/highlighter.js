/**
 * Standalone Offline Syntax Highlighter
 * Tokenizes JavaScript, TypeScript, Python, JSON, Bash, YAML, SQL, and HTML/XML without external dependencies.
 */
const SyntaxHighlighter = (() => {
  const KEYWORDS = {
    js: new Set([
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
      'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for',
      'from', 'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof', 'interface',
      'let', 'new', 'of', 'package', 'private', 'protected', 'public', 'return', 'set',
      'static', 'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof', 'var', 'void',
      'while', 'with', 'yield'
    ]),
    py: new Set([
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
      'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
      'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
      'with', 'yield', 'match', 'case'
    ]),
    sh: new Set([
      'case', 'do', 'done', 'elif', 'else', 'esac', 'fi', 'for', 'function', 'if', 'in',
      'select', 'then', 'until', 'while', 'echo', 'exit', 'set', 'export', 'source',
      'local', 'return', 'alias', 'mkdir', 'cd', 'curl', 'tar', 'rm', 'cp', 'mv'
    ]),
    sql: new Set([
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
      'ALTER', 'TABLE', 'VIEW', 'INDEX', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
      'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
      'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS', 'CASE',
      'WHEN', 'THEN', 'ELSE', 'END'
    ])
  };

  const BOOLEANS = new Set([
    'true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil', 'NaN', 'Infinity'
  ]);

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeLang(lang) {
    if (!lang) return 'code';
    const l = lang.toLowerCase().trim();
    if (['javascript', 'js', 'jsx', 'ts', 'typescript', 'tsx'].includes(l)) return 'js';
    if (['python', 'py'].includes(l)) return 'py';
    if (['bash', 'sh', 'shell', 'zsh'].includes(l)) return 'sh';
    if (['json'].includes(l)) return 'json';
    if (['yaml', 'yml'].includes(l)) return 'yaml';
    if (['sql'].includes(l)) return 'sql';
    if (['html', 'xml', 'svg'].includes(l)) return 'html';
    return 'generic';
  }

  function highlight(code, lang) {
    const language = normalizeLang(lang);
    if (!code) return '';
    if (language === 'json') return highlightJson(code);
    if (language === 'html') return highlightHtml(code);
    return highlightCode(code, language);
  }

  function highlightJson(code) {
    const jsonRegex = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
    return escapeHtml(code).replace(jsonRegex, (match, stringVal, isKey, boolVal) => {
      if (stringVal) {
        if (isKey) return `<span class="token-property">${stringVal}</span>${isKey}`;
        return `<span class="token-string">${stringVal}</span>`;
      }
      if (boolVal) return `<span class="token-boolean">${boolVal}</span>`;
      return `<span class="token-number">${match}</span>`;
    });
  }

  function highlightHtml(code) {
    const escaped = escapeHtml(code);
    return escaped.replace(/(&lt;\/?)([a-zA-Z0-9\-]+)((?:\s+[a-zA-Z0-9\-:]+(?:="[^"]*"|='[^']*'|=[^\s&gt;]+)?)*\s*)(\/?&gt;)/g, (m, open, tag, attrs, close) => {
      const formattedAttrs = attrs.replace(/([a-zA-Z0-9\-:]+)(=)("[^"]*"|'[^']*'|[^\s&gt;]+)/g, (am, aname, eq, aval) => {
        return `<span class="token-attr">${aname}</span>${eq}<span class="token-string">${aval}</span>`;
      });
      return `${open}<span class="token-tag">${tag}</span>${formattedAttrs}${close}`;
    });
  }

  function highlightCode(code, language) {
    const masterRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|--[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|0x[0-9a-fA-F]+\b)|([a-zA-Z_$][a-zA-Z0-9_$]*)|([+\-*/%=<>!&|^~?:;.,()[\]{}]+)/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    const keywords = KEYWORDS[language] || KEYWORDS.js;

    while ((match = masterRegex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        parts.push(escapeHtml(code.slice(lastIndex, match.index)));
      }

      const [full, comment, stringVal, numberVal, wordVal, opVal] = match;

      if (comment) {
        parts.push(`<span class="token-comment">${escapeHtml(comment)}</span>`);
      } else if (stringVal) {
        parts.push(`<span class="token-string">${escapeHtml(stringVal)}</span>`);
      } else if (numberVal) {
        parts.push(`<span class="token-number">${numberVal}</span>`);
      } else if (wordVal) {
        const lower = wordVal.toLowerCase();
        const upper = wordVal.toUpperCase();

        if (BOOLEANS.has(wordVal)) {
          parts.push(`<span class="token-boolean">${wordVal}</span>`);
        } else if (keywords.has(language === 'sql' ? upper : wordVal) || keywords.has(lower)) {
          parts.push(`<span class="token-keyword">${wordVal}</span>`);
        } else {
          const nextCharIndex = match.index + full.length;
          const lookahead = code.slice(nextCharIndex, nextCharIndex + 10).trim();
          if (lookahead.startsWith('(')) {
            parts.push(`<span class="token-function">${wordVal}</span>`);
          } else {
            parts.push(`<span class="token-variable">${wordVal}</span>`);
          }
        }
      } else if (opVal) {
        parts.push(`<span class="token-operator">${escapeHtml(opVal)}</span>`);
      }

      lastIndex = masterRegex.lastIndex;
    }

    if (lastIndex < code.length) {
      parts.push(escapeHtml(code.slice(lastIndex)));
    }

    return parts.join('');
  }

  return { highlight };
})();