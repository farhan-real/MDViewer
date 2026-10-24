# MDViewer

MDViewer is a standalone, offline, hyper-modular Markdown viewer engineered with a custom AMOLED dark theme. It features automatic code block extraction, regex-driven filename detection, an interactive Table of Contents outline, and a dedicated sequential Code Copy Menu.

---

## Live App

Launch the application directly in your browser:

**[https://farhan-real.github.io/MDViewer/](https://farhan-real.github.io/MDViewer/)**

Alternatively, run locally without any installation or server required:
1. Download or clone this repository.
2. Open `index.html` directly in any desktop or mobile browser.

---

## Key Features

- **AMOLED Dark Mode**: Pure black background tailored for modern displays, with clean and professional Indigo accents.
- **Syntax Highlighting**: Built-in syntax highlighting for JavaScript, TypeScript, Python, JSON, Bash, YAML, SQL, and HTML.
- **Dedicated Code Copy Menu**: Docked floating navigator showing block sequence numbers, context names (filename or parent heading), traversal, and one-click clipboard copying.
- **Smart Heading Filename Extractor**: When a code block fence omits a filename (e.g., ` ```python `), MDViewer inspects the heading directly above it using strict regex validation to extract and display filenames like `gateway.config.json` or `dispatcher.ts`.
- **Interactive TOC**: Hierarchical TOC on the left sidebar with live highlighting, search filtering, and code formatting for headings with backticks (e.g., `` `src/app.js` ``).
- **Local Persistence**: Automatically saves the active document to browser `localStorage`, ensuring instant restoration between sessions without cloud reliance.
- **Zero Dependencies**: 100% self-contained JavaScript, CSS, and HTML with no external libraries or CDN requests.

---

## File Architecture

```text
.
├── index.html          # Application layout, TOC drawer, viewer, and modal markup
├── README.md           # Project documentation and specifications
├── css/
│   ├── base.css        # Core AMOLED variables, typography, and responsive grid
│   ├── components.css  # TOC tree, code blocks, copy menu, and modal card styling
│   └── syntax.css      # AMOLED syntax highlighting token styles
└── js/
    ├── highlighter.js  # Offline multi-language syntax highlighting engine
    ├── parser.js       # Offline Markdown parser and regex heading filename engine
    ├── toc.js          # Table of Contents builder, search filter, and scrollspy
    ├── codenav.js      # Code Copy Menu controller and keyboard traversal
    └── app.js          # State coordinator, modal lifecycle, and localStorage sync
```

---

## Regex Filename Validation

When parsing code blocks without an explicit filename in the fence, `js/parser.js` extracts filename candidates from the preceding heading:

```javascript
// Filename regex validator
const FILENAME_VALIDATOR = /^([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile|docker-compose\.ya?ml)$/i;

// Extraction pattern from heading text
const HEADING_FILENAME_EXTRACTOR = /(?:(?:file(?:name)?|path):\s*)?`?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile)`?/i;
```

If matched, the code block adopts the filename as its primary label in both the block header and the bottom Code Copy Menu.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `P` | Global Viewer | Jump to previous code block and highlight |
| `N` | Global Viewer | Jump to next code block and highlight |
| `C` | Global Viewer | Copy active code block to clipboard |
| `Ctrl` + `Enter` | Paste Dialog | Render document and save to storage |
| `Escape` | Paste Dialog | Dismiss dialog without applying |

---

## Quick Usage

1. Open **[https://farhan-real.github.io/MDViewer/](https://farhan-real.github.io/MDViewer/)**.
2. Click **Paste / Edit** in the top navigation bar.
3. Enter your raw Markdown content and click **Render**.
4. Use the bottom-right **Code Copy Menu** or block headers to copy code snippets instantly.