# Qwanvas

Offline-first minimalist canvas editor for lightweight social media pages and decks. The rebooted app lives at the repo root, runs entirely in the browser after first load, stores projects in local storage, supports text/image/shape editing, undo/redo, HTML/CSS import-export, and PNG export. The editor is intentionally shortcut-first: press **/** or **Ctrl+P** (or **⌘P** on macOS) to open the command palette and run app actions without hunting through panels. Press **Ctrl+,** (or **⌘,** on macOS) to open the status-bar settings menu.

AI is intentionally outside the app: use `AI-CONTEXT.md` as the guideline for generating or editing Qwanvas HTML files, then import the result. The older markdown-driven LinkedIn carousel generator is still kept under `scripts/`, `styles/`, and `projects/` as a salvageable legacy renderer/prototype.

## Command palette

Press **Ctrl+P** (or **⌘P** on macOS) or **/** to open the command palette with `/` already inserted. The slash is locked in place so every palette action uses the same slash-command syntax. Press **Ctrl+,** (or **⌘,** on macOS) to open the status-bar settings menu. Type commands such as `/text headline_text`, `/width 50`, `/height 20`, `/size 40 20`, `/x 50`, `/rotate 15`, `/color #74a6ff`, `/grid`, `/grid 3`, `/grid 0`, `/grid off`, `/export-png`, `/delete`, `/image`, `/import`, `/project linkedin-post`, `/rename-project`, `/RecentProject`, or `/background-settings`. Multi-word command arguments use dashes or underscores instead of spaces. Use ↑/↓ to choose a fuzzy result, then press **Tab** to replace the search text with that item’s slash-prefixed preset. The status-bar zoom control can also be typed as a percentage; press **Enter** or leave the field to apply it, or **Esc** to revert the edit. Commands reuse the same editor actions as the toolbar and inspector, so shortcut-driven edits stay in sync with the visible controls. Use `/RecentProject` to open a recent-project picker ordered by the last project you opened. On the canvas, press **T** to add text when nothing is selected, or **Del** to delete the selected element. The canvas guide grid supports 0–5 split lines per axis; `/grid` defaults to 2 lines for a 3×3 layout, and `/grid 0` hides all guide lines.

New blank projects default to the name **New Project**. Project templates set the canvas/export size when a project is created from the command palette. The app asks for a unique project name before creating a template project; use `/rename-project` to rename the current project with the same duplicate-name validation. Create, import, duplicate, and rename flows block duplicate project names. Each project stores automatic config metadata in the local library, including a default project-file name composed from the creation date and project name, such as `2026-06-27-new-project.html`.

- `/project linkedin-post` — image, 1200×1200
- `/project linkedin-carousel` — deck, 1200×1500
- `/project youtube-thumbnail` — thumbnail, 1280×720

## Text editing

Text elements use Markdown as their source. Type Markdown in the inspector text field or double-click text on the canvas to edit the raw Markdown directly; the canvas and exported HTML render it as styled text. Supported formatting includes headings, bold, italic, bold italic, strikethrough, inline code, links, blockquotes, and ordered/unordered lists.

## Commands

```bash
npm start           # Vite dev server at http://127.0.0.1:5173
npm run build:app   # typecheck + build the Vite app into dist/
npm test            # build app + run Vitest tests in tests/*.test.mjs
npm run test:watch  # Vitest watch mode
npm run test:e2e    # Playwright smoke/e2e tests
npm run build       # legacy HTML + PDF, using installed Chrome/Edge
npm run build:html  # legacy HTML only
npm run watch       # legacy markdown carousel watch mode
```

If PDF export is skipped, set `BROWSER_PATH` to Chrome/Edge:

```bash
BROWSER_PATH="C:/Program Files/Microsoft/Edge/Application/msedge.exe" npm run build
```

## Spec text markup

Inline text supports a small escaped markup layer:

- `{brand:text}` — render `text` in the carousel brand blue
- `**text**` — bold
- `` `text` `` — inline code

Example title:

```md
`{brand:package.json} n’est pas juste une liste de dépendances`
```

## Per-slide text alignment and padding

Add these YAML fields inside a slide block:

```yaml
blocks_align: left        # left | center | right
blocks_padding_left: "5cqw"
body_align: left
body_padding_left: "5cqw"
note_align: left
note_padding_left: "5cqw"
```

Use `blocks_*` for bullet lists, `body_*` for body paragraphs, and `note_*` for notes. Numeric padding defaults to `cqw`, so `"5"` means `"5cqw"`.

## Agent-friendly canvas elements

After saving in watch mode, each slide can contain a structured block AI agents can generate or edit directly:

````md
### Elements

```json
[
  {
    "id": "headline-1",
    "type": "text",
    "text": "Move and resize me",
    "x": "50%",
    "y": "22%",
    "width": "70%",
    "height": "12%",
    "zIndex": 4,
    "fontSize": "42px",
    "color": "#5aa7ff",
    "bold": true,
    "italic": false
  },
  {
    "id": "code-1",
    "type": "code",
    "lang": "json",
    "text": "{\n  \"ai\": \"friendly\"\n}",
    "x": "50%",
    "y": "48%",
    "width": "70%",
    "height": "24%",
    "zIndex": 5
  },
  {
    "id": "image-1",
    "type": "image",
    "src": "assets/example.png",
    "x": "50%",
    "y": "76%",
    "width": "55%",
    "height": "30%",
    "zIndex": 3
  }
]
```
````

If `### Elements` exists, it becomes the editable canvas layer for that slide. If it does not, the older Title/Body/Code/Blocks sections still render and can be converted by pressing **Save**.

## Absolute text positions

When you drag/resize text in watch mode and click **Save layout**, the generator adds per-element fields to the slide YAML:

```yaml
title_x: "50.0%"
title_y: "22.0%"
title_width: "70.0%"
title_height: "12.0%"
blocks_x: "55.0%"
blocks_y: "48.0%"
blocks_width: "52.0%"
blocks_height: "14.0%"
```

Supported text element prefixes: `title`, `code`, `blocks`, `body`, `note`, `question`. If these fields are absent, the classic centered layout is used.

## Workspace

- `projects/package-json/spec.md` — editable AI-generated spec
- `projects/package-json/source.md` — original writing draft
- `projects/package-json/index.html` — generated carousel preview
- `projects/package-json/carousel.pdf` — generated LinkedIn PDF
- `projects/package-json/reference/` — previous hand-built draft kept as reference

Create another carousel by copying `projects/package-json/` and running:

```bash
node scripts/generate.mjs projects/my-new-carousel
node scripts/watch.mjs projects/my-new-carousel
```
