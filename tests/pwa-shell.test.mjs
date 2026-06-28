import {
  appSource,
  assert,
  existsSync,
  file,
  join,
  mkdirSync,
  mkdtempSync,
  parseSpec,
  readFileSync,
  rmSync,
  root,
  spawnSync,
  test,
  tmpdir,
  writeFileSync,
} from './helpers.mjs';

test('pwa shell: required offline editor assets and controls stay wired', () => {
  for (const path of ['index.html', 'dist/app.js', 'src/app/00-types.ts', 'src/app/01-state.ts', 'src/styles.css', 'manifest.webmanifest', 'sw.js', 'icons/icon.svg']) {
    assert.equal(existsSync(join(root, path)), true, `missing ${path}`);
  }

  const html = file('index.html');
  const app = appSource();
  assert.match(html, /<script type="module" src="\/src\/app-entry\.ts"><\/script>/);
  assert.match(html, /Import Project/);
  assert.match(html, /Export HTML/);
  assert.match(html, /Export JSON/);
  assert.match(html, /Export CSS/);
  assert.match(html, /Export PNG/);
  assert.match(html, /commandPaletteBtn/);
  assert.match(html, /settingsMenuBtn/);
  assert.match(html, /settingsMenu/);
  assert.match(html, /statusZoomInput/);
  assert.match(html, /Open settings menu/);
  assert.match(html, /Command palette/);
  assert.match(html, /<span id="statusProjectName" class="status-project-name" aria-label="Current project name">Qwanvas<\/span>/, 'status project name should be a read-only label');
  assert.doesNotMatch(html, /<input id="statusProjectName"/, 'status project name should not be editable inline');
  assert.match(html, /id="projectLauncher"/, 'startup should show a launcher before opening a canvas');
  assert.match(html, /placeholder="new project name"/, 'launcher should expose the requested new-project placeholder');
  assert.doesNotMatch(html, /id="firstRunHelper"|keyboard-first|First shortcuts|Got it/, 'startup should not show an introduction dialog');
  assert.match(html, /id="templateModal"/, 'project creation should show a template chooser');
  assert.match(html, /id="projectNameModal"/, 'project naming should use a dedicated dialog');
  assert.match(html, /id="projectNameDialogInput"/, 'project naming dialog should expose a text input');
  assert.match(html, /Commands Ctrl\+P or \//);
  assert.match(html, /aria-keyshortcuts="Control\+P Meta\+P \/"/);
  assert.match(html, /Run any slash command/);
  assert.match(html, /locked in place/);
  assert.match(html, /aria-label="Slash command"/);
  assert.match(html, /placeholder="\/command argument"/);
  assert.match(html, /id="commandSearch"/);
  assert.match(html, /<button id="addTextBtn">Text T<\/button>/);
  assert.match(html, /<button id="deleteBtn" class="danger inspector-delete"[^>]*aria-label="Delete element"[^>]*>🗑<\/button>/);
  assert.match(html, /Add text when nothing is selected/);
  assert.match(html, /Align selected left \/ center \/ right/);
  assert.match(html, /Align selected top \/ middle \/ bottom/);
  assert.match(html, /Delete selected element<\/span><kbd>Del<\/kbd>/);
  assert.doesNotMatch(html, /backgroundControl|Apply to all pages/, 'page background controls should not live in the selected-element inspector');
  assert.doesNotMatch(html, /Markdown supported|markdownHelp/);
  assert.match(html, /textarea id="textControl" hidden aria-hidden="true"/);
  assert.match(html, /<label for="fontControl">Font<\/label><input id="fontControl"/);
  assert.match(html, /id="fontResults" class="font-results" role="listbox"/);
  assert.match(html, /id="fontWarning" class="font-warning"/);
  assert.match(app, /const FONT_OPTIONS = \[[\s\S]*?'Times New Roman'[\s\S]*?\] as const;/);
  assert.match(app, /const FONT_OPTIONS = \[[\s\S]*?'Verdana'[\s\S]*?\] as const;/);
  assert.match(app, /const FONT_OPTIONS = \[[\s\S]*?'Consolas'[\s\S]*?\] as const;/);
  assert.match(app, /const FONT_OPTIONS = \[[\s\S]*?'IBM Plex Sans'[\s\S]*?\] as const;/);
  assert.match(app, /const FONT_OPTIONS = \[[\s\S]*?'JetBrains Mono'[\s\S]*?\] as const;/);
  assert.match(app, /const FONT_OPTIONS = \[[\s\S]*?'Roboto'[\s\S]*?\] as const;/);
  assert.doesNotMatch(html, /Generate draft|ideaInput|boldBtn|italicBtn/, 'AI prompt flow and legacy text-style buttons should remain outside the app');

  const css = file('src/styles.css');
  assert.match(css, /\[hidden\] \{ display: none !important; \}/, 'hidden controls should stay hidden even when component classes set display');
  assert.match(css, /html, body \{ width: 100%; height: 100%; overflow: hidden; \}/, 'app shell should never body-scroll');
  assert.match(css, /\.app-shell \{[^}]*width: 100vw; height: 100dvh; overflow: hidden;/, 'app shell should be viewport-bound');
  assert.match(css, /\.stage-wrap \{[\s\S]*?overflow: auto;/, 'canvas stage should allow native scrolling when zoomed');
  assert.match(css, /\.page-strip \{[\s\S]*?overflow: hidden;/, 'page strip should fit instead of horizontal scrolling');
  assert.doesNotMatch(css, /\.command-palette \{[^}]*backdrop-filter:/, 'command palette should not blur the canvas behind live previews');

  const aiContext = file('AI-CONTEXT.md');
  assert.match(aiContext, /laptop-size screens and larger only \(1024px wide and up\)/);
  assert.match(aiContext, /no body\/app scrolling/);

  const manifest = JSON.parse(file('manifest.webmanifest'));
  assert.equal(manifest.name, 'Qwanvas');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
});
