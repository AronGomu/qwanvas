# Qwanvas Agent Guide

Qwanvas is an offline-first editor for lightweight social-media visuals and slide decks. The app edits portable HTML project files with embedded JSON project data; AI generation/editing happens outside the app and users import the result.

## Where to look

- `index.html` — PWA shell and DOM IDs the editor code wires to.
- `src/app/00-types.ts` — shared TypeScript domain and UI helper types.
- `src/app/01-state.ts` — app constants, defaults, mutable editor state, DOM lookup map, bootstrap.
- `src/app/02-wire-commands.ts` — event listeners, keyboard shortcuts, command registry.
- `src/app/03-command-palette.ts` — command palette, first-run helper, template picker, project naming dialog, RecentProject picker, background/grid commands.
- `src/app/04-render-inspector.ts` — render loop, canvas/page/project list rendering, inspector, selection toolbar, direct text editing.
- `src/app/05-interactions.ts` — dragging, resizing, crop handles, zoom/pan geometry helpers, image add/drop helpers, undo mutation helpers.
- `src/app/06-project-model.ts` — current project/page lookup, background normalization, page/project creation, save-file metadata.
- `src/app/07-import-export.ts` — HTML/JSON/CSS import-export, PNG export, markdown rendering, safe link/image handling.
- `src/app/08-storage-utils.ts` — localStorage load/save/recovery plus small browser utility helpers.
- `src/styles.css` — editor layout and interaction styling. App shell intentionally targets 1024px+ screens.
- `src/app-entry.ts` — Vite browser entry; imports the virtual concatenated editor bundle.
- `vite.config.mjs` — Vite dev/build config, Vitest config, and the small virtual-module plugin that concatenates `src/app/*.ts` in order.
- `dist/app.js` / `dist/style.css` — generated Vite production assets. Do not edit by hand.
- `tests/helpers.mjs` — shared Vitest helpers.
- `tests/*.test.mjs` — focused Vitest smoke/regression tests.
- `tests/e2e/app-smoke.spec.ts` — the intentional long Playwright user journey covering startup, templates, hotkeys, project resume, deck pages, JSON export/import, and responsiveness timing.
- `playwright.config.ts` — Playwright config with Vite web server wiring.
- `scripts/check.mjs` / `tests/check.mjs` — compatibility wrappers that run Vitest.
- `scripts/generate.mjs`, `scripts/watch.mjs`, `scripts/client.js`, `styles/carousel.css` — legacy deck/spec generator and live layout editor.
- `CONTEXT.md` — canonical product language and domain relationships.
- `AI-CONTEXT.md` — contract for AI-generated portable project files.

## Build and verification

- `npm start` — run the Vite dev server at `http://127.0.0.1:5173` with hot reload.
- `npm run build:app` — typecheck, then build the Vite production app into `dist/`.
- `npm test` — build the app, then run the Vitest smoke/regression suite.
- `npm run test:watch` — run Vitest in watch mode.
- `npm run test:e2e` — run Playwright browser tests. If browsers are missing, run `npx playwright install chromium` once.
- `npm run build` / `npm run build:html` — generate the sample project output after compiling the app.

## Testing strategy

- This project intentionally keeps one long Playwright journey in `tests/e2e/app-smoke.spec.ts`. It should exercise as much of the app as a real user can in one sequence: first start, helper dialog, launcher, template choice, hotkeys, canvas edits, persistence/resume, deck navigation, background changes, and JSON export/import.
- The long e2e logs a baseline chronometer annotation/console line: `full-journey-duration-ms`. Do not add a hard failure limit until enough baseline runs exist; later agents may add a warning threshold if the app gets slower.
- Prefer clickable/keyboard user-level interactions in Playwright. Do not poke app internals from e2e unless the browser platform requires it for file upload/download assertions.
- Split separate Playwright tests only for flows that are clearer or less flaky in isolation. Use Vitest/source-contract/unit tests for small deterministic functions and parser/normalizer rules.

## Architecture rules

- Keep the browser editor simple: no backend, no cloud persistence, no in-app AI prompt flow.
- `src/app/*.ts` files are concatenated by the virtual module in `vite.config.mjs`. If a new app file is added, add it to `appSourceFiles` there explicitly.
- Keep source split by concern. Do not create a new catch-all utility file unless repeated use proves it is needed.
- `dist/` is generated. Change TypeScript/CSS/source files, then run `npm run build:app`.
- Preserve DOM IDs in `index.html` unless all wiring/tests are updated in the same change.
- Keep KISS/YAGNI: prefer local functions and existing browser APIs over dependencies.
- The app shell is laptop/desktop first: 1024px+ only, no body/app scrolling, panels should fit or clip instead of introducing page scroll.

## Domain language

Use these terms consistently:

- **Project**: editable saved work containing one or more pages.
- **Page**: one visual canvas exported as one image or one deck slide.
- **Deck**: a project with multiple ordered pages.
- **Canvas**: editing surface for one page.
- **Element**: editable item on a canvas (`text`, `image`, or `shape`).
- **Template**: reusable starting layout/style for a project.
- **Draft**: AI-generated starting point represented as a portable project file.
- **Project File**: portable HTML file with rendered project plus embedded editable JSON.
- **Style File**: CSS controlling presentation of a project file.
- **Manual Edit**: direct user change on the canvas.
- **AI Edit**: external AI-generated change imported as an updated project file.
- **Local Library**: browser-stored projects and reusable assets.
- **Export**: rendered output for sharing outside the app.

## Domain relationships

- A Project contains one or more Pages.
- A Deck is a Project with multiple ordered Pages.
- A Page has exactly one Canvas.
- A Canvas contains zero or more Elements.
- A Draft can create a Project from a Project File.
- A Project File may reference or embed a Style File.
- A Manual Edit or AI Edit changes a Project.
- The Local Library stores Projects and reusable assets in browser storage.
- An Export is produced from a Page or Deck.

## Safety notes

- Project JSON embedded in exported HTML is the re-import source of truth; visible HTML should match it.
- Coordinates and sizes are percentages of the page (`x`, `y`, `w`, `h` from 0–100-ish and clamped at boundaries).
- Sanitize imported/project-provided URLs; keep `safeLinkUrl` and `safeImageSrc` behavior intact.
- Keep project-name duplicate validation and save-file metadata in sync when changing project lifecycle code.
