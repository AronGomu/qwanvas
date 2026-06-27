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

test('pwa app: local project lifecycle and portable import/export contracts are present', () => {
  const app = appSource();
  for (const token of [
    'localStorage', 'serviceWorker', 'createProject', 'createPage', 'addElement', 'COMMANDS', 'openCommandPalette', 'undo()', 'redo()',
    'setSelectedDimension', 'setSelectedSize', 'projectToHtml', 'projectToJson', 'projectToCss', 'projectFromHtml', 'projectFromJson', 'normalizeImportedProject', 'normalizeImportedElement',
    'RecentProject', 'openRecentProjectPicker', 'recentProjects', 'reopenRecentProject', 'projectNameError', 'syncProjectFileMetadata', 'savedProjectFileName',
    'BLANK_BACKGROUND_ID', 'BACKGROUNDS', 'chooseBackgroundCommand', 'setPageBackground',
    'GUIDE_GRID_DEFAULT', 'setGuideGridCommand', 'pageGuideGrid', 'normalizeGuideGrid',
    'markdownToHtml', 'markdownInlineToHtml', 'markdownToPlainText', 'safeLinkUrl',
    'exportPng', 'openSettingsMenu', 'closeSettingsMenu', 'handleSettingsMenuKeydown', 'commitStatusZoomInput', 'handleStatusZoomInputKeydown', 'commandPaletteShortcutLabel', 'openProjectNameDialog', 'projectNameError', 'uniqueProjectName', 'ALIGNMENT_ACTIONS', 'alignSelectedElement', 'alignmentActionFromEvent', 'renderSelectionToolbar', 'updateProjectUrl', 'projectUrlPath', 'escapeHtml', 'escapeAttr', 'escapeScriptJson',
  ]) assert.match(app, new RegExp(token.replace(/[()]/g, '\\$&')), `missing ${token}`);
  assert.match(app, /const PROJECT_FILE_EXTENSION = 'html'/, 'project save files should default to HTML project files');
  assert.match(app, /const UI_STATE_KEY = 'qwanvas\.uiState\.v1'/, 'UI state should have a separate localStorage key from project content');
  assert.match(app, /let currentId: Id \| undefined = initialProjectIdFromLocation\(\) \|\| restoredCurrentProjectId\(uiState\);/, 'startup should reopen the deep-linked project or the last remembered project');
  assert.match(app, /let selectedId: Id \| null = restoredSelectedElementId\(uiState, currentId\);/, 'startup should restore the remembered selected element when it is still valid');
  assert.match(app, /function initialProjectIdFromLocation\(\)[\s\S]*?projectFromLocationPath\(\)\?\.id/, 'startup deep links should resolve through the project URL matcher');
  assert.match(app, /function projectUrlPath\(project\)[\s\S]*?`\/\$\{slug\(project\.name \|\| project\.id \|\| 'project'\)\}`/, 'project URLs should use the project name slug');
  assert.match(app, /function updateProjectUrl\(project\)[\s\S]*?history\.pushState\(null, '', nextPath\)/, 'opening or creating projects should write the project path to browser history');
  assert.match(app, /launcherProjectName/, 'launcher should collect a new project name before template selection');
  assert.match(app, /project\.fileName = savedProjectFileName\(project\)/, 'project metadata should include a generated save filename');
  assert.match(app, /`\$\{projectDateStamp\(project\.createdAt \|\| project\.updatedAt\)\}-\$\{slug\(project\.name\)\}\.\$\{PROJECT_FILE_EXTENSION\}`/, 'save filename should be composed from date and project name');
  assert.match(app, /if \(projectNameExists\(normalized, excludeId\)\) return `A project named/, 'duplicate project names should produce a blocking validation error');
  assert.match(app, /function canvasPercent\(value, min, max, fallback\)[\s\S]*?replace\(\/%\$\/, ''\)/, 'stored/imported percentage geometry should normalize before CSS vars are rendered');
  assert.match(app, /function normalizeStoredElement\(element\)[\s\S]*?const defaults = storedElementGeometryDefaults\(element\.type\)[\s\S]*?w: canvasPercent\(element\.w \?\? element\.width, 1, defaults\.maxSize, defaults\.w\)/, 'recent projects should normalize legacy element geometry on load');
  assert.match(app, /function normalizeImportedElement\(element\)[\s\S]*?x: canvasPercent\(element\.x, 0, 100, 50\)[\s\S]*?w: canvasPercent\(element\.w \?\? element\.width/, 'imported projects should accept percentage/legacy element geometry');
  assert.doesNotMatch(app, /generateDraft\(/, 'local draft generator should not be wired into the app');
});

test('pwa canvas: command palette creates project templates with export sizes', () => {
  const app = appSource();
  const css = file('src/styles.css');
  const readme = file('README.md');

  assert.match(app, /const PROJECT_TEMPLATES = \[/, 'project templates should be centralized');
  assert.match(app, /id: 'linkedin-post'[\s\S]*?width: 1200, height: 1200/, 'LinkedIn post should be a 1200x1200 image template');
  assert.match(app, /id: 'linkedin-carousel'[\s\S]*?width: 1200, height: 1500/, 'LinkedIn carousel should be a 1200x1500 deck template');
  assert.match(app, /id: 'youtube-thumbnail'[\s\S]*?width: 1280, height: 720/, 'YouTube thumbnail should be a 1280x720 image template');
  assert.match(app, /shortcut: 'project linkedin-post'/, 'command palette should advertise a typed project-template argument');
  assert.match(app, /\^\(new-\)\?project\\b/, 'direct command routing should accept slash-style project typed commands');
  assert.match(app, /function templateFromCommand\(query\)/, 'new project command should resolve template aliases from typed arguments');
  assert.match(app, /function openNewProjectDialog\(template\)[\s\S]*?startTemplateChoice\([\s\S]*?template\.id/, 'new project entry points should route through template selection');
  assert.match(app, /function chooseTemplate\(index = activeTemplateIndex\)[\s\S]*?withNewCurrent\(createProject\(name, template\.id\)\)/, 'template picker should create the named project from the selected template');
  assert.match(app, /function projectNameError\(name, excludeId = null\)[\s\S]*?Project name is required\.[\s\S]*?already exists/, 'project name dialog should reject empty and duplicate names');
  assert.match(app, /id: 'rename-project'/, 'command palette should expose a rename project command');
  assert.match(app, /function renameProjectCommand\(\)[\s\S]*?openProjectNameDialog\([\s\S]*?excludeId: project\.id/, 'rename project should reuse the project name dialog while allowing the current name');
  assert.match(app, /els\.statusProjectName\.textContent = project\.name/, 'renaming should update the visible status-bar project label');
  assert.doesNotMatch(app, /els\.statusProjectName\.value = project\.name/, 'status-bar project label should not be updated as an input value');
  assert.match(app, /width: template\.width, height: template\.height/, 'created projects should persist template dimensions');
  assert.match(app, /width: template\.width, height: template\.height, backgroundId/, 'created pages should persist template dimensions');
  assert.match(app, /els\.canvas\.style\.setProperty\('--canvas-ratio', size\.width \/ size\.height\)/, 'editor canvas should resize to the active template ratio');
  assert.match(css, /aspect-ratio: var\(--canvas-aspect-ratio, 4 \/ 5\)/, 'canvas CSS should use dynamic template aspect ratios');
  assert.match(app, /canvas\.width = size\.width; canvas\.height = size\.height;/, 'PNG export should use the active page dimensions');
  assert.match(app, /--page-width:\$\{size\.width\};--page-height:\$\{size\.height\}/, 'HTML export should preserve page dimensions');
  assert.match(readme, /`\/project linkedin-post`/);
  assert.match(readme, /1200×1500/);
  assert.match(readme, /1280×720/);
});

test('pwa projects: New Project, RecentProject, and save-file metadata stay coherent', () => {
  const html = file('index.html');
  const app = appSource();
  const readme = file('README.md');

  assert.match(html, />Create new project<\/button>/, 'launcher create action should remain available after emptying the left panel');
  assert.doesNotMatch(html, /id="(?:newProjectBtn|duplicateProjectBtn|projectList|importHtmlInput)"/, 'left panel should not retain hidden project-library controls');
  assert.match(html, /Run any slash command/);
  assert.match(app, /title: 'New Project'/, 'command palette create action should be named New Project');
  assert.match(app, /title: 'RecentProject'/, 'command palette should expose the RecentProject command');
  assert.match(app, /els\.commandSearch\.value = commandInputValue\('RecentProject'\)/, 'RecentProject command should keep the picker item visible with the locked slash prefix');
  assert.match(app, /launcherProjectName\.addEventListener\('keydown', handleLauncherProjectNameKeydown\)/, 'launcher name input should own create and recents keyboard shortcuts');
  assert.match(app, /function handleLauncherProjectNameKeydown\(event\)[\s\S]*?event\.key === 'Enter'[\s\S]*?els\.launcherCreateProjectBtn\.click\(\)[\s\S]*?event\.key !== 'ArrowDown'[\s\S]*?launcherActiveProjectIndex = 0;[\s\S]*?focusLauncherActiveProject\(\)/, 'launcher input Enter should create and ArrowDown should focus the first recent project');
  assert.match(app, /function handleLauncherRecentKeydown\(event\)[\s\S]*?event\.key === 'ArrowUp'[\s\S]*?launcherActiveProjectIndex === 0[\s\S]*?focusLauncherProjectName\(\)/, 'ArrowUp on the first recent project should return focus to the launcher input');
  assert.match(app, /function openProject\(projectId\)[\s\S]*?project\.updatedAt = Date\.now\(\);[\s\S]*?currentId = project\.id;[\s\S]*?selectedId = restoredSelectedElementId\(uiState, project\.id\);[\s\S]*?saveProjects\('openProject'\)[\s\S]*?saveUiState\('openProject'\)/, 'opening a recent project should update recency and restore/persist its selection');
  assert.match(app, /function selectElement\(id, options = \{\}\) \{[\s\S]*?selectedId = id;[\s\S]*?saveUiState\('selectElement'\)/, 'selecting an element should immediately persist UI memory');
  assert.match(app, /function restoredSelectedElementId\(uiState, projectId\)[\s\S]*?activePage\(project\)\?\.elements\.some\(\(element\) => element\.id === id\)/, 'restored selection should be ignored when the element no longer exists on the active page');
  assert.match(app, /showProjectError\(error\); render\(\); return false;/, 'duplicate rename attempts should show an error and restore the current name');
  assert.match(app, /projects\.forEach\(syncProjectFileMetadata\)/, 'save should automatically refresh project config metadata');
  assert.match(readme, /`\/RecentProject`/);
  assert.match(readme, /2026-06-27-new-project\.html/);
});
