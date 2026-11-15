# MDViewer

MDViewer is a standalone, hyper-modular Markdown viewer engineered with a custom AMOLED dark default theme and a crisp light mode. It runs directly from `index.html` over `file://` with no installation, build step, or local server required, featuring automatic code block extraction, regex-driven filename detection, full LaTeX math typesetting, theme-aware A4 print export, customizable settings, an interactive Table of Contents outline, and a dedicated sequential Code Copy Menu.

---

## Live App

Launch the application directly in your browser:

**[Github Pages](https://farhan-real.github.io/MDViewer) or [Cloudflare Pages](https://farhan-mdviewer.pages.dev/) (Both are identical)**

Alternatively, run locally without any installation or server required:
1. Download or clone this repository.
2. Open `index.html` directly in any desktop or mobile browser (`file://`).

---

## Key Features

- **AMOLED Dark & Light Themes**: Pure black AMOLED dark mode by default with Indigo accents, plus an instant header toggle to a clean light theme with persisted preference in `localStorage`.
- **Full LaTeX Support**: Powered by MathJax v3 (`tex-svg-full.js`) with `ams`, `cancel`, `mhchem`, `mathtools`, `boldsymbol`, `bussproofs`, `amscd`, `extpfeil`, and `braket` enabled out of the box (plus `\require{physics}` on demand)—working directly when `index.html` is opened locally via `file://`.
  - **Inline Math**: `$...$` and `\(...\)` inside paragraphs, headings, lists, blockquotes, TOC headings, and table cells (with pipe-safe splitting for expressions like `$|x|$`).
  - **Display Math**: `$$...$$`, `\[...\]`, fenced ` ```math ` blocks, blockquote math, and standalone environments (`\begin{align}`, `\begin{aligned}`, `\begin{equation}`, `\begin{gather}`, `\begin{cases}`, `\begin{bmatrix}`, etc.).
- **Theme-Aware Print / PDF Support**: Clean A4 Portrait and Landscape printing from either Dark or Light mode, with dynamically themed `@page` margins and page counters, proportional font scaling, line-wrapped code cards, repeating table headers, and crisp auto-scaled MathJax SVGs.
- **Settings & Font Size Control**: Unified Settings modal featuring a 7-step font size selector (`12px`–`18px` with `15px` middle default) reflected in both the viewer and print output, alongside customizable multi-key keyboard shortcuts.
- **Syntax Highlighting**: Built-in offline syntax highlighting for JavaScript, TypeScript, Python, JSON, Bash, YAML, SQL, and HTML with adaptive dark and light token palettes.
- **Dedicated Code Copy Menu**: Docked floating navigator showing block sequence numbers, context names (filename or parent heading), traversal, and one-click clipboard copying.
- **Smart Heading Filename Extractor**: When a code block fence omits a filename (e.g., ` ```python `), MDViewer inspects the heading directly above it using strict regex validation to extract and display filenames like `gateway.config.json` or `dispatcher.ts`.
- **Smooth 200Hz Interactive TOC**: Hierarchical left sidebar with GPU-composited FLIP/drawer transitions, `requestAnimationFrame` cached binary-search scrollspy, search filtering, inline LaTeX rendering, and backtick code styling.
- **Local Persistence**: Automatically saves your active document, theme, font size, and custom shortcuts to browser `localStorage`.

---

## File Architecture

```text
.
├── index.html              # Application layout, TOC drawer, viewer, MathJax loader, and modals
├── README.md               # Project documentation and specifications
├── ai.md                   # Project structure and development guidelines
├── css/
│   ├── themes.css          # AMOLED dark (default) and light theme variables & font size token
│   ├── base.css            # Core reset, scrollbars, header, buttons, and workspace layout
│   ├── syntax.css          # Dark and light syntax highlighting token styles
│   ├── print.css           # Theme-aware A4 portrait and landscape print stylesheet
│   └── ui/
│       ├── sidebar.css     # TOC sidebar, outline tree, search filter, and mobile drawer
│       ├── components.css  # Markdown typography, LaTeX math containers, and code cards
│       ├── modals.css      # Modal backdrop and Paste Markdown dialog styling
│       ├── settings.css    # Settings dialog, 7-step font-size selector, and shortcut rows
│       └── overlays.css    # Floating Code Copy Menu, toast notifications, and mobile tweaks
└── js/
    ├── app.js              # Master state coordinator, FLIP sidebar toggle, and storage sync
    ├── theme.js            # Light/dark theme toggle and dynamic print page margin styling
    ├── settings.js         # Settings dialog lifecycle and 7-step font-size controller
    ├── shortcuts.js        # Multi-key shortcut configurator and global key dispatcher
    ├── sample.js           # Default sample Markdown and LaTeX documentation preset
    ├── latex/
    │   ├── mathjax.js      # MathJax v3 configuration and asynchronous SVG typesetting queue
    │   └── latex.js        # LaTeX extraction, Markdown protection, and table-safe splitting
    ├── markdown/
    │   ├── highlighter.js  # Offline multi-language syntax highlighting engine
    │   └── parser.js       # Markdown parser, LaTeX block integration, and filename regex engine
    └── navigation/
        ├── toc.js          # Table of Contents builder, search filter, and rAF scrollspy
        └── codenav.js      # Code Copy Menu controller and cached binary-search scrollsync
```

---

## Regex Filename Validation

When parsing code blocks without an explicit filename in the fence, `js/markdown/parser.js` extracts filename candidates from the preceding heading:

```javascript
const FILENAME_VALIDATOR = /^([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile|docker-compose\.ya?ml)$/i;
const HEADING_FILENAME_EXTRACTOR = /(?:(?:file(?:name)?|path):\s*)?`?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,8}|Dockerfile|Makefile|Vagrantfile)`?/i;
```

If matched, the code block adopts the filename as its primary label in both the block header and the bottom Code Copy Menu.

---

## Keyboard Shortcuts

Default shortcuts (all customizable with single keys or multi-key combinations in **Settings**):

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `P` | Global Viewer | Jump to previous code block and highlight |
| `N` | Global Viewer | Jump to next code block and highlight |
| `C` | Global Viewer | Copy active code block to clipboard |
| `Ctrl` + `Enter` | Paste Dialog | Render document and save to storage |
| `Escape` | Active Dialog | Dismiss active Settings or Paste dialog |

---

## Quick Usage

1. Open **[https://farhan-real.github.io/MDViewer/](https://farhan-real.github.io/MDViewer/)** or open `index.html` locally.
2. Click **Paste / Edit** in the top navigation bar, enter Markdown + LaTeX, and click **Render**.
3. Use the header controls to switch **Light / Dark theme**, adjust **Font Size & Shortcuts** in **Settings**, or **Print / Save as PDF** (`Ctrl+P`).
4. Use the bottom-right **Code Copy Menu** or block headers to navigate and copy code snippets instantly.

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.