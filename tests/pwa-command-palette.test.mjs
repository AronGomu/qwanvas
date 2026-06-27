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

test('pwa canvas: command palette controls the page guide grid', () => {
  const app = appSource();
  const css = file('src/styles.css');
  const readme = file('README.md');

  assert.match(app, /id: 'set-guide-grid'/, 'command palette should expose a guide grid command');
  assert.match(app, /shortcut: 'grid 2'/, 'guide grid command should advertise typed arguments');
  assert.match(app, /\^\(grid\|guide\|guides\|lines\)/, 'direct command routing should accept grid typed commands');
  assert.match(app, /const hidden = [\s\S]*?\|\| nextLines === 0;/, 'grid 0 should be treated as a hidden guide grid');
  assert.match(app, /page\.guideGrid = \{[\s\S]*?visible: !hidden,[\s\S]*?lines: hidden \? 0 : Math\.trunc\(nextLines\)/, 'grid command should persist 0 lines when hidden and clamped line count when visible');
  assert.match(app, /els\.canvas\.classList\.toggle\('guide-grid', guideGrid\.visible\)/, 'canvas should toggle the visible guide grid class');
  assert.match(app, /--guide-grid-lines/, 'canvas should pass line count to CSS');
  assert.match(app, /guideGrid: normalizeGuideGrid\(page\.guideGrid\)/, 'stored and imported pages should normalize guide grid settings');
  assert.match(css, /\.canvas\.guide-grid::after/, 'guide grid should render as a non-interactive canvas overlay');
  assert.match(css, /var\(--guide-grid-lines, 2\) \+ 1/, 'grid cells should be line count plus one per axis');
  assert.match(readme, /`\/grid 3`/);
  assert.match(readme, /`\/grid 0`/);
  assert.match(readme, /0–5 split lines per axis/);
  assert.match(readme, /`\/grid 0` hides all guide lines/);
});

test('pwa canvas: command palette chooses page backgrounds with live preview', () => {
  const app = appSource();

  assert.match(app, /id: 'choose-background'/, 'command palette should expose a background command');
  assert.match(app, /shortcut: 'background aurora-grid'/, 'background command should advertise direct typed names');
  assert.match(app, /\^\(background\|bg\)\\b/, 'direct command routing should accept background typed commands');
  assert.match(app, /function backgroundFromCommand\(query\)[\s\S]*?background\.name\.toLowerCase\(\)\.includes\(normalized\)/, 'typed background names should resolve from existing backgrounds');
  assert.match(app, /function openBackgroundPicker\(\)[\s\S]*?commandPaletteMode = \{ type: 'background'/, 'empty background command should enter background picker mode');
  assert.match(app, /Previewing backgrounds live\. Use ↑\/↓ to preview, Enter to apply, Esc to cancel\./, 'background picker should explain live preview controls');
  assert.match(app, /if \(commandPaletteMode\?\.type === 'background'\) \{ commitBackgroundPreview\(BACKGROUNDS\[activeCommandIndex\]\?\.id\); return; \}/, 'Enter should commit the previewed background');
  assert.match(app, /if \(commandPaletteMode\?\.type === 'background' && !commitPreview\) restoreBackgroundPreview\(\);/, 'closing without commit should restore the original background');
  assert.match(app, /function previewBackground\(backgroundId\)[\s\S]*?applyCanvasBackground\(background\)/, 'background navigation should preview without saving first');
});

test('pwa canvas: command palette Tab completes the selected fuzzy result', () => {
  const app = appSource();

  assert.match(app, /if \(event\.key === 'Tab' && !commandPaletteMode\)/, 'Tab should complete the selected command palette result into the input only in the normal command list');
  assert.match(app, /commandPaletteMode\?\.type === 'recent-project' \? recentProjects\(\)/, 'recent-project picker should own arrow/enter selection while it is open');
  assert.match(app, /function renderRecentProjectCommandPalette\(\)/, 'RecentProject should render a picker list in the command palette');
  assert.match(app, /Recent projects are ordered by last opened/, 'RecentProject picker should explain its ordering');
  assert.match(app, /els\.commandSearch\.value = preset;/, 'Tab completion should replace the command search text with the selected preset');
  assert.match(app, /els\.commandSearch\.setSelectionRange\(preset\.length, preset\.length\)/, 'completed presets should leave the caret at the end');
  assert.match(app, /function commandPreset\(command\)/, 'command presets should reuse the displayed command shortcut text');
  assert.match(app, /function commandPreset\(command\)[\s\S]*?commandInputValue/, 'command presets should reuse the displayed command shortcut text with a slash prefix');
  assert.match(app, /const COMMAND_PREFIX = '\/';/, 'command input should have one locked slash prefix');
  assert.match(app, /function ensureCommandPrefix\(\)/, 'command input should repair missing slash prefixes');
  assert.match(app, /event\.key === 'Backspace'[\s\S]*?selectionStart <= COMMAND_PREFIX\.length/, 'Backspace should not delete the slash prefix');
  assert.match(app, /event\.key === 'Delete'[\s\S]*?selectionStart < COMMAND_PREFIX\.length/, 'Delete should not remove the slash prefix');
});
