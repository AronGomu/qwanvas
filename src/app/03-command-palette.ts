function openCommandPalette({ query = COMMAND_PREFIX } = {}) {
  if (!els.shortcutHelp.hidden) closeShortcutHelp({ restoreFocus: false });
  if (!els.settingsMenu.hidden) closeSettingsMenu({ restoreFocus: false });
  commandPaletteReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  els.appShell.inert = true;
  els.commandPalette.hidden = false;
  els.commandSearch.value = commandInputValue(query);
  commandPaletteMode = null;
  activeCommandIndex = 0;
  renderCommandPalette();
  requestAnimationFrame(() => {
    els.commandSearch.focus({ preventScroll: true });
    keepCommandCaretAfterPrefix();
  });
}

function closeCommandPalette({ restoreFocus = true, commitPreview = false } = {}) {
  if (commandPaletteMode?.type === 'background' && !commitPreview) restoreBackgroundPreview();
  els.commandPalette.hidden = true;
  els.appShell.inert = false;
  els.commandSearch.value = '';
  commandPaletteMode = null;
  els.commandSearch.setAttribute('aria-expanded', 'false');
  els.commandSearch.removeAttribute('aria-activedescendant');
  els.commandStatus.textContent = '';
  if (restoreFocus && commandPaletteReturnFocus && !commandPaletteReturnFocus.closest('[hidden]')) commandPaletteReturnFocus.focus?.({ preventScroll: true });
  else if (restoreFocus) document.body.focus?.({ preventScroll: true });
  commandPaletteReturnFocus = null;
}

function openShortcutHelp() {
  if (!els.commandPalette.hidden) closeCommandPalette({ restoreFocus: false });
  if (!els.settingsMenu.hidden) closeSettingsMenu({ restoreFocus: false });
  shortcutHelpReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  els.appShell.inert = true;
  els.shortcutHelp.hidden = false;
  requestAnimationFrame(() => els.closeShortcutHelpBtn.focus({ preventScroll: true }));
}

function closeShortcutHelp({ restoreFocus = true } = {}) {
  els.shortcutHelp.hidden = true;
  els.appShell.inert = false;
  if (restoreFocus) shortcutHelpReturnFocus?.focus?.({ preventScroll: true });
  shortcutHelpReturnFocus = null;
}

function toggleSettingsMenu() {
  if (els.settingsMenu.hidden) openSettingsMenu();
  else closeSettingsMenu();
}

function openSettingsMenu() {
  if (!els.commandPalette.hidden) closeCommandPalette({ restoreFocus: false });
  if (!els.shortcutHelp.hidden) closeShortcutHelp({ restoreFocus: false });
  settingsMenuReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : els.settingsMenuBtn;
  els.settingsMenu.hidden = false;
  els.settingsMenuBtn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => firstSettingsMenuItem()?.focus({ preventScroll: true }));
}

function closeSettingsMenu({ restoreFocus = true } = {}) {
  els.settingsMenu.hidden = true;
  els.settingsMenuBtn.setAttribute('aria-expanded', 'false');
  if (restoreFocus) (settingsMenuReturnFocus || els.settingsMenuBtn)?.focus?.({ preventScroll: true });
  settingsMenuReturnFocus = null;
}

function firstSettingsMenuItem() {
  return els.settingsMenu.querySelector('[role="menuitem"]:not(:disabled)');
}

function settingsMenuItems() {
  return [...els.settingsMenu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
}

function closeSettingsMenuOnOutsidePointer(event) {
  if (els.settingsMenu.hidden) return;
  if (els.settingsMenu.contains(event.target) || els.settingsMenuBtn.contains(event.target)) return;
  closeSettingsMenu({ restoreFocus: false });
}

function handleSettingsMenuKeydown(event) {
  const items = settingsMenuItems();
  const index = Math.max(0, items.indexOf(document.activeElement));
  if (event.key === 'Escape') { event.preventDefault(); closeSettingsMenu(); return; }
  if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); return; }
  if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); return; }
  if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); }
}

function handleSettingsMenuClick(event) {
  const action = event.target.closest('[data-settings-action]')?.dataset.settingsAction;
  if (!action) return;
  closeSettingsMenu({ restoreFocus: false });
  if (action === 'commands') openCommandPalette();
  if (action === 'shortcuts') openShortcutHelp();
  if (action === 'reset-zoom') setCanvasZoom(1);
}

function shortcutLabel(key) {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? `⌘${key}` : `Ctrl+${key}`;
}

function commandPaletteShortcutLabel() {
  return `${shortcutLabel('P')} or /`;
}

function renderCommandPalette() {
  ensureCommandPrefix();
  if (commandPaletteMode?.type === 'background') {
    renderBackgroundCommandPalette();
    return;
  }
  if (commandPaletteMode?.type === 'recent-project') {
    renderRecentProjectCommandPalette();
    return;
  }
  const query = commandQuery(els.commandSearch.value);
  const matches = commandMatches(query);
  activeCommandIndex = clamp(activeCommandIndex, 0, Math.max(0, matches.length - 1), 0);
  els.commandList.innerHTML = '';
  els.commandSearch.setAttribute('aria-expanded', 'true');
  els.commandStatus.textContent = selectedId ? 'Actions will apply to the selected element. Grid commands apply to the current page.' : 'Use grid commands anytime; select an element before width, height, size, or delete commands.';
  for (const [index, command] of matches.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `command-option-${command.id}`;
    button.className = `command-item ${index === activeCommandIndex ? 'active' : ''}`;
    button.disabled = (command.needsSelection && (!selectedId || !commandCanApply(command, selected(current())))) || (!current() && !['new-project', 'recent-project', 'import-html'].includes(command.id));
    button.tabIndex = -1;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === activeCommandIndex ? 'true' : 'false');
    const shortcut = commandPreset(command);
    button.innerHTML = `<span><strong>${escapeHtml(shortcut)}</strong><small>${escapeHtml(command.detail)}</small></span><span class="command-kbd">${escapeHtml(command.title)}</span>`;
    button.onclick = () => runCommand(command, query);
    els.commandList.append(button);
  }
  if (matches[activeCommandIndex]) els.commandSearch.setAttribute('aria-activedescendant', `command-option-${matches[activeCommandIndex].id}`);
  else els.commandSearch.removeAttribute('aria-activedescendant');
  scrollActiveCommandOption();
}

function renderBackgroundCommandPalette() {
  activeCommandIndex = clamp(activeCommandIndex, 0, BACKGROUNDS.length - 1, 0);
  const activeBackground = BACKGROUNDS[activeCommandIndex];
  previewBackground(activeBackground.id);
  els.commandList.innerHTML = '';
  els.commandSearch.setAttribute('aria-expanded', 'true');
  els.commandStatus.textContent = 'Previewing backgrounds live. Use ↑/↓ to preview, Enter to apply, Esc to cancel.';
  for (const [index, background] of BACKGROUNDS.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `command-option-background-${background.id}`;
    button.className = `command-item ${index === activeCommandIndex ? 'active' : ''}`;
    button.tabIndex = -1;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === activeCommandIndex ? 'true' : 'false');
    button.innerHTML = `<span><strong>${escapeHtml(background.name)}</strong><small>Preview and apply this page background</small></span><span class="command-kbd">${index === activeCommandIndex ? 'Enter' : '↑↓'}</span>`;
    button.onpointerenter = () => previewBackgroundOption(index);
    button.onclick = () => commitBackgroundPreview(background.id);
    els.commandList.append(button);
  }
  els.commandSearch.setAttribute('aria-activedescendant', `command-option-background-${activeBackground.id}`);
  scrollActiveCommandOption();
}

function previewBackgroundOption(index) {
  activeCommandIndex = clamp(index, 0, BACKGROUNDS.length - 1, 0);
  const activeBackground = BACKGROUNDS[activeCommandIndex];
  previewBackground(activeBackground.id);
  els.commandList.querySelectorAll('.command-item').forEach((button, buttonIndex) => {
    const isActive = buttonIndex === activeCommandIndex;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.querySelector('.command-kbd').textContent = isActive ? 'Enter' : '↑↓';
  });
  els.commandSearch.setAttribute('aria-activedescendant', `command-option-background-${activeBackground.id}`);
  scrollActiveCommandOption();
}

function renderRecentProjectCommandPalette() {
  const recent = recentProjects(commandQuery(els.commandSearch.value));
  activeCommandIndex = clamp(activeCommandIndex, 0, Math.max(0, recent.length - 1), 0);
  els.commandList.innerHTML = '';
  els.commandSearch.setAttribute('aria-expanded', 'true');
  els.commandStatus.textContent = recent.length ? 'Recent projects are ordered by last opened. Use ↑/↓, then Enter to reopen.' : 'No recent projects yet.';
  if (!recent.length) {
    const empty = document.createElement('button');
    empty.type = 'button';
    empty.className = 'command-item';
    empty.disabled = true;
    empty.tabIndex = -1;
    empty.setAttribute('role', 'option');
    empty.innerHTML = '<span><strong>No recent projects</strong><small>Create a project first.</small></span><span class="command-kbd">—</span>';
    els.commandList.append(empty);
    els.commandSearch.removeAttribute('aria-activedescendant');
    return;
  }
  for (const [index, project] of recent.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `command-option-recent-${project.id}`;
    button.className = `command-item ${index === activeCommandIndex ? 'active' : ''}`;
    button.tabIndex = -1;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === activeCommandIndex ? 'true' : 'false');
    button.innerHTML = `<span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(recentProjectDetail(project))}</small></span><span class="command-kbd">${project.id === currentId ? 'Current' : 'Open'}</span>`;
    button.onpointerenter = () => previewRecentProjectOption(index);
    button.onclick = () => reopenRecentProject(project.id);
    els.commandList.append(button);
  }
  els.commandSearch.setAttribute('aria-activedescendant', `command-option-recent-${recent[activeCommandIndex].id}`);
  scrollActiveCommandOption();
}

function previewRecentProjectOption(index) {
  const recent = recentProjects(commandQuery(els.commandSearch.value));
  activeCommandIndex = clamp(index, 0, Math.max(0, recent.length - 1), 0);
  const activeProject = recent[activeCommandIndex];
  els.commandList.querySelectorAll('.command-item').forEach((button, buttonIndex) => {
    const isActive = buttonIndex === activeCommandIndex;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  if (activeProject) els.commandSearch.setAttribute('aria-activedescendant', `command-option-recent-${activeProject.id}`);
  scrollActiveCommandOption();
}

function commandMatches(query) {
  const normalized = commandQuery(query).toLowerCase();
  const direct = directCommand(normalized);
  const matches = COMMANDS
    .map((command) => ({ command, score: commandScore(command, normalized) }))
    .filter(({ score }) => score > -1)
    .sort((a, b) => b.score - a.score)
    .map(({ command }) => command);
  return direct ? [direct, ...matches.filter((command) => command.id !== direct.id)] : matches;
}

function commandScore(command, query) {
  if (!query) return 1;
  const haystack = `${commandQuery(commandPreset(command))} ${command.title} ${command.detail} ${command.keywords}`.toLowerCase();
  if (haystack.startsWith(query)) return 4;
  if (command.title.toLowerCase().includes(query)) return 3;
  if (haystack.includes(query)) return 2;
  return query.split(/\s+/).every((part) => haystack.includes(part)) ? 1 : -1;
}

function directCommand(query) {
  if (/^(text|add-text)(\s+.+)?$/.test(query)) return COMMANDS.find((command) => command.id === 'add-text');
  if (/^(w|width)\s+\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-width');
  if (/^(h|height)\s+\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-height');
  if (/^(size|resize)\s+\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-size');
  if (/^x\s+\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-x');
  if (/^y\s+\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-y');
  if (/^(rotate|rotation)\s+-?\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-rotation');
  if (/^(font|font-size)\s+\d/.test(query)) return COMMANDS.find((command) => command.id === 'set-font-size');
  if (/^color\s+#?[0-9a-f]{3,6}/.test(query)) return COMMANDS.find((command) => command.id === 'set-color');
  if (/^(grid|guide|guides|lines)(?:\s+(?:on|off|show|hide|\d))?/.test(query)) return COMMANDS.find((command) => command.id === 'set-guide-grid');
  if (/^(background-settings|background\s+settings|bg-settings|bg\s+settings)\b/.test(query)) return COMMANDS.find((command) => command.id === 'background-settings');
  if (/^(background|bg)\b/.test(query)) return COMMANDS.find((command) => command.id === 'choose-background');
  if (/^rename[-\s]+project\b/.test(query)) return COMMANDS.find((command) => command.id === 'rename-project');
  const alignMatch = query.match(/^align[-\s]+(\w+)\b/);
  if (alignMatch) return ALIGNMENT_ACTIONS.find((action) => action.id === `align-${alignMatch[1]}`) && COMMANDS.find((command) => command.id === `align-${alignMatch[1]}`);
  if (/^(recent-?project|recent\s+project|select-?project)\b/.test(query)) return COMMANDS.find((command) => command.id === 'recent-project');
  if (/^(new-)?project\b/.test(query)) return COMMANDS.find((command) => command.id === 'new-project');
  if (/^json\b/.test(query)) return COMMANDS.find((command) => command.id === 'export-json');
  return null;
}

function handleDialogTabTrap(event, dialog) {
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function handleCommandSearchInput() {
  ensureCommandPrefix();
  renderCommandPalette();
}

function handleCommandSearchKeydown(event) {
  const matches = commandPaletteMode?.type === 'background' ? BACKGROUNDS : commandPaletteMode?.type === 'recent-project' ? recentProjects() : commandMatches(commandQuery(els.commandSearch.value));
  if (event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); return; }
  if (event.key === 'Home') { event.preventDefault(); keepCommandCaretAfterPrefix(); return; }
  if (event.key === 'ArrowLeft' && els.commandSearch.selectionStart <= COMMAND_PREFIX.length) { event.preventDefault(); keepCommandCaretAfterPrefix(); return; }
  if (event.key === 'Backspace' && els.commandSearch.selectionStart <= COMMAND_PREFIX.length && els.commandSearch.selectionEnd <= COMMAND_PREFIX.length) { event.preventDefault(); return; }
  if (event.key === 'Delete' && els.commandSearch.selectionStart < COMMAND_PREFIX.length) { event.preventDefault(); keepCommandCaretAfterPrefix(); return; }
  if (event.key === 'ArrowDown') { event.preventDefault(); activeCommandIndex = Math.min(activeCommandIndex + 1, Math.max(0, matches.length - 1)); renderCommandPalette(); return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); activeCommandIndex = Math.max(activeCommandIndex - 1, 0); renderCommandPalette(); return; }
  if (event.key === 'Tab' && !commandPaletteMode) {
    const command = matches[activeCommandIndex] || matches[0];
    const preset = command && commandPreset(command);
    if (!preset) return;
    event.preventDefault();
    els.commandSearch.value = preset;
    activeCommandIndex = 0;
    renderCommandPalette();
    els.commandSearch.setSelectionRange(preset.length, preset.length);
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (commandPaletteMode?.type === 'background') { commitBackgroundPreview(BACKGROUNDS[activeCommandIndex]?.id); return; }
  if (commandPaletteMode?.type === 'recent-project') { reopenRecentProject(recentProjects(commandQuery(els.commandSearch.value))[activeCommandIndex]?.id); return; }
  const command = matches[activeCommandIndex] || matches[0];
  if (command) runCommand(command, commandQuery(els.commandSearch.value));
}

function commandPreset(command) {
  return commandInputValue(typeof command.shortcut === 'function' ? command.shortcut() : command.shortcut);
}

function commandInputValue(value = '') {
  const text = String(value || '').trim().replace(/^\/+/, '');
  return `${COMMAND_PREFIX}${text}`;
}

function ensureCommandPrefix() {
  const { selectionStart, selectionEnd } = els.commandSearch;
  const before = els.commandSearch.value;
  const next = commandInputValue(before);
  if (before !== next) {
    els.commandSearch.value = next;
    const delta = next.length - before.length;
    const start = Math.max(COMMAND_PREFIX.length, (selectionStart ?? next.length) + delta);
    const end = Math.max(COMMAND_PREFIX.length, (selectionEnd ?? next.length) + delta);
    els.commandSearch.setSelectionRange(start, end);
    return;
  }
  if ((selectionStart ?? COMMAND_PREFIX.length) < COMMAND_PREFIX.length) keepCommandCaretAfterPrefix();
}

function keepCommandCaretAfterPrefix() {
  els.commandSearch.setSelectionRange(COMMAND_PREFIX.length, COMMAND_PREFIX.length);
}

function commandQuery(value) {
  return String(value || '').trim().replace(/^\/+/, '');
}

function slashlessCommandQuery(value) {
  return commandQuery(value);
}

function runCommand(command, query) {
  if (!current() && !['new-project', 'recent-project', 'import-html'].includes(command.id)) {
    els.commandStatus.textContent = 'Create, import, or open a project first.';
    return;
  }
  if (command.needsSelection && (!selectedId || !commandCanApply(command, selected(current())))) {
    els.commandStatus.textContent = 'Select a compatible element first, then run this command.';
    return;
  }
  const commandText = commandQuery(query);
  if (!['choose-background', 'recent-project'].includes(command.id) || backgroundFromCommand(commandText)) closeCommandPalette();
  command.run(commandText);
}

function commandCanApply(command, element) {
  return !command.canApply || command.canApply(element);
}

function addTextCommand(query) {
  const text = query.replace(/^(add-)?text\s*/i, '').trim().replace(/[_-]+/g, ' ') || TEXT_DEFAULT.text;
  addElement({ ...TEXT_DEFAULT, text });
}

function newProjectCommand(query) {
  const template = templateFromCommand(query);
  startTemplateChoice(uniqueProjectName(template.id === 'blank' ? 'New Project' : template.name), template.id === 'blank' ? null : template.id);
}

function openNewProjectDialog(template) {
  startTemplateChoice(uniqueProjectName(template.id === 'blank' ? 'New Project' : template.name), template.id);
}

function startTemplateChoice(name, preferredTemplateId = null) {
  const normalized = normalizedProjectName(name);
  if (!normalized || projectNameError(normalized)) {
    els.launcherProjectName.value = normalized;
    renderLauncher();
    return;
  }
  pendingTemplateProjectName = normalized;
  openTemplateDialog(preferredTemplateId);
}

function openTemplateDialog(preferredTemplateId = null) {
  if (!els.commandPalette.hidden) closeCommandPalette({ restoreFocus: false });
  templateDialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeTemplateIndex = Math.max(0, PROJECT_TEMPLATES.findIndex((template) => template.id === preferredTemplateId));
  els.appShell.inert = true;
  els.templateModal.hidden = false;
  renderTemplateDialog();
  requestAnimationFrame(() => activeTemplateButton()?.focus({ preventScroll: true }));
}

function closeTemplateDialog({ restoreFocus = true } = {}) {
  els.templateModal.hidden = true;
  els.appShell.inert = false;
  pendingTemplateProjectName = '';
  if (restoreFocus) templateDialogReturnFocus?.focus?.({ preventScroll: true });
  templateDialogReturnFocus = null;
}

function renderTemplateDialog() {
  activeTemplateIndex = clamp(activeTemplateIndex, 0, PROJECT_TEMPLATES.length - 1, 0);
  els.templateDialogHint.textContent = `Creating “${pendingTemplateProjectName}”. Use ↑/↓ and Enter, or click a template.`;
  els.templateList.innerHTML = '';
  PROJECT_TEMPLATES.forEach((template, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `template-option-${template.id}`;
    button.className = `command-item ${index === activeTemplateIndex ? 'active' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === activeTemplateIndex ? 'true' : 'false');
    button.tabIndex = index === activeTemplateIndex ? 0 : -1;
    button.innerHTML = `<span><strong>${escapeHtml(template.name)}</strong><small>${template.kind === 'deck' ? 'Deck' : 'Single image'} · ${template.width}×${template.height}</small></span><span class="command-kbd">${index === activeTemplateIndex ? 'Enter' : '↑↓'}</span>`;
    button.onpointerenter = () => previewTemplateOption(index);
    button.onclick = () => chooseTemplate(index);
    els.templateList.append(button);
  });
}

function previewTemplateOption(index) {
  activeTemplateIndex = clamp(index, 0, PROJECT_TEMPLATES.length - 1, 0);
  els.templateList.querySelectorAll('.command-item').forEach((button, buttonIndex) => {
    const isActive = buttonIndex === activeTemplateIndex;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    (button as HTMLButtonElement).tabIndex = isActive ? 0 : -1;
    button.querySelector('.command-kbd').textContent = isActive ? 'Enter' : '↑↓';
  });
}

function activeTemplateButton() {
  return els.templateList.querySelector(`#template-option-${CSS.escape(PROJECT_TEMPLATES[activeTemplateIndex].id)}`);
}

function chooseTemplate(index = activeTemplateIndex) {
  const template = PROJECT_TEMPLATES[clamp(index, 0, PROJECT_TEMPLATES.length - 1, 0)];
  const name = pendingTemplateProjectName;
  closeTemplateDialog({ restoreFocus: false });
  withNewCurrent(createProject(name, template.id));
}

function handleTemplateDialogKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeTemplateDialog(); return; }
  if (event.key === 'ArrowDown') { event.preventDefault(); activeTemplateIndex = Math.min(activeTemplateIndex + 1, PROJECT_TEMPLATES.length - 1); renderTemplateDialog(); activeTemplateButton()?.focus({ preventScroll: true }); return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); activeTemplateIndex = Math.max(activeTemplateIndex - 1, 0); renderTemplateDialog(); activeTemplateButton()?.focus({ preventScroll: true }); return; }
  if (event.key === 'Home') { event.preventDefault(); activeTemplateIndex = 0; renderTemplateDialog(); activeTemplateButton()?.focus({ preventScroll: true }); return; }
  if (event.key === 'End') { event.preventDefault(); activeTemplateIndex = PROJECT_TEMPLATES.length - 1; renderTemplateDialog(); activeTemplateButton()?.focus({ preventScroll: true }); return; }
  if (event.key === 'Enter') { event.preventDefault(); chooseTemplate(); return; }
  handleDialogTabTrap(event, els.templateDialog);
}

function renameProjectCommand() {
  const project = current();
  if (!project) return;
  openProjectNameDialog({
    title: 'Rename project',
    hint: 'Choose a unique name for the current project.',
    defaultName: project.name,
    submitLabel: 'Rename Enter',
    excludeId: project.id,
    onSubmit: (name) => renameCurrentProject(name),
  });
}

function openRecentProjectPicker() {
  commandPaletteMode = { type: 'recent-project' };
  activeCommandIndex = 0;
  els.commandSearch.value = commandInputValue('RecentProject');
  renderCommandPalette();
}

function recentProjects(query = '') {
  const filter = slashlessCommandQuery(query).replace(/^(recent-?project|recent\s+project|select-?project)\b/i, '').trim().toLocaleLowerCase();
  const recent = projects.toSorted((a, b) => b.updatedAt - a.updatedAt);
  if (!filter) return recent;
  return recent.filter((project) => `${project.name} ${project.fileName || savedProjectFileName(project)}`.toLocaleLowerCase().includes(filter));
}

function scrollActiveCommandOption() {
  const id = els.commandSearch.getAttribute('aria-activedescendant');
  if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
}

function recentProjectDetail(project) {
  const size = pageSize(activePage(project), project);
  return `${project.pages.length} page${project.pages.length > 1 ? 's' : ''} · ${size.width}×${size.height} · ${project.fileName || savedProjectFileName(project)} · ${new Date(project.updatedAt).toLocaleString()}`;
}

function reopenRecentProject(projectId) {
  if (!projectId) { console.warn('RecentProject reopen skipped: missing project id'); return; }
  closeCommandPalette({ commitPreview: true, restoreFocus: false });
  openProject(projectId);
}

function handleLauncherProjectNameKeydown(event) {
  if (event.key === 'Enter') { event.preventDefault(); els.launcherCreateProjectBtn.click(); return; }
  if (event.key !== 'ArrowDown') return;
  const recent = sortedProjects();
  if (!recent.length) return;
  event.preventDefault();
  launcherActiveProjectIndex = 0;
  renderLauncher();
  focusLauncherActiveProject();
}

function handleLauncherRecentKeydown(event) {
  const recent = sortedProjects();
  if (!recent.length) return;
  if (event.key === 'ArrowDown') { event.preventDefault(); launcherActiveProjectIndex = Math.min(launcherActiveProjectIndex + 1, recent.length - 1); renderLauncher(); focusLauncherActiveProject(); return; }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (launcherActiveProjectIndex === 0) { focusLauncherProjectName(); return; }
    launcherActiveProjectIndex = Math.max(launcherActiveProjectIndex - 1, 0);
    renderLauncher();
    focusLauncherActiveProject();
    return;
  }
  if (event.key === 'Home') { event.preventDefault(); launcherActiveProjectIndex = 0; renderLauncher(); focusLauncherActiveProject(); return; }
  if (event.key === 'End') { event.preventDefault(); launcherActiveProjectIndex = recent.length - 1; renderLauncher(); focusLauncherActiveProject(); return; }
  if (event.key === 'Enter') { event.preventDefault(); openProject(recent[launcherActiveProjectIndex]?.id); }
}

function focusLauncherProjectName() {
  els.launcherProjectName.focus({ preventScroll: true });
}

function focusLauncherActiveProject() {
  els.launcherRecentProjects.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
}

function duplicateCurrentProject() {
  if (!current()) return;
  const copy = clone(current());
  const now = Date.now();
  copy.id = uid();
  copy.name = uniqueProjectName(`${current().name} copy`);
  copy.createdAt = now;
  copy.updatedAt = now;
  syncProjectFileMetadata(copy);
  withNewCurrent(copy);
}

function openProjectNameDialog({ title, hint, defaultName, submitLabel, excludeId = null, onSubmit }) {
  projectNameDialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  projectNameDialogSubmit = onSubmit;
  projectNameDialogExcludeId = excludeId;
  els.appShell.inert = true;
  els.projectNameModal.hidden = false;
  els.projectNameDialogTitle.textContent = title;
  els.projectNameDialogHint.textContent = hint;
  els.projectNameDialogInput.value = defaultName;
  els.projectNameSubmitBtn.textContent = submitLabel;
  validateProjectNameDialog();
  requestAnimationFrame(() => {
    els.projectNameDialogInput.focus({ preventScroll: true });
    els.projectNameDialogInput.select();
  });
}

function closeProjectNameDialog({ restoreFocus = true } = {}) {
  els.projectNameModal.hidden = true;
  els.appShell.inert = false;
  projectNameDialogSubmit = null;
  projectNameDialogExcludeId = null;
  els.projectNameDialogError.textContent = '';
  els.projectNameDialogInput.removeAttribute('aria-invalid');
  if (restoreFocus) projectNameDialogReturnFocus?.focus?.({ preventScroll: true });
  projectNameDialogReturnFocus = null;
}

function handleProjectNameDialogKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeProjectNameDialog(); return; }
  handleDialogTabTrap(event, els.projectNameDialog);
}

function submitProjectNameDialog(event) {
  event.preventDefault();
  const error = projectNameError(els.projectNameDialogInput.value, projectNameDialogExcludeId);
  if (error) { showProjectNameError(error); return; }
  const submit = projectNameDialogSubmit;
  const name = normalizedProjectName(els.projectNameDialogInput.value);
  closeProjectNameDialog({ restoreFocus: false });
  submit?.(name);
}

function validateProjectNameDialog() {
  const error = projectNameError(els.projectNameDialogInput.value, projectNameDialogExcludeId);
  showProjectNameError(error);
  return !error;
}

function showProjectNameError(error = '') {
  els.projectNameDialogError.textContent = error;
  els.projectNameDialogInput.toggleAttribute('aria-invalid', Boolean(error));
  els.projectNameSubmitBtn.disabled = Boolean(error);
}

function normalizedProjectName(name) {
  return String(name || '').trim();
}

function projectNameKey(name) {
  return normalizedProjectName(name).toLocaleLowerCase();
}

function projectNameExists(name, excludeId = null) {
  const key = projectNameKey(name);
  return projects.some((project) => project.id !== excludeId && projectNameKey(project.name) === key);
}

function projectNameError(name, excludeId = null) {
  const normalized = normalizedProjectName(name);
  if (!normalized) return 'Project name is required.';
  if (projectNameExists(normalized, excludeId)) return `A project named “${normalized}” already exists.`;
  if (projectFileNameExists(normalized, excludeId)) return `A project save file named “${savedProjectFileName({ name: normalized, createdAt: projectCreatedAtForValidation(excludeId) })}” already exists.`;
  return '';
}

function projectFileNameExists(name, excludeId = null) {
  const fileName = savedProjectFileName({ name, createdAt: projectCreatedAtForValidation(excludeId) });
  return projects.some((project) => project.id !== excludeId && (project.fileName || savedProjectFileName(project)) === fileName);
}

function projectCreatedAtForValidation(projectId = null) {
  return projects.find((project) => project.id === projectId)?.createdAt || Date.now();
}

function uniqueProjectName(baseName) {
  const base = normalizedProjectName(baseName) || 'New Project';
  if (!projectNameExists(base) && !projectFileNameExists(base)) return base;
  let index = 2;
  while (projectNameExists(`${base} ${index}`) || projectFileNameExists(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function templateFromCommand(query) {
  const normalized = query.toLowerCase().replace(/^(new-)?project\b/, '').trim().replace(/[_-]+/g, ' ');
  if (!normalized) return projectTemplate('blank');
  return PROJECT_TEMPLATES.find((template) => template.aliases.some((alias) => normalized.includes(alias))) || projectTemplate('blank');
}

function projectTemplate(templateId = 'blank') {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId) || PROJECT_TEMPLATES[0];
}

function handleProjectPageNavigationKeydown(event) {
  if (!(event.ctrlKey || event.metaKey) || !['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.key) || !current()) return false;
  event.preventDefault();
  const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
  mutate((project) => {
    const index = Math.max(0, project.pages.findIndex((page) => page.id === project.activePageId));
    const next = clamp(index + direction, 0, project.pages.length - 1, index);
    project.activePageId = project.pages[next].id;
    selectedId = null; editingId = null; editBefore = null;
    saveUiState('navigatePage');
  }, false, 'navigatePage');
  return true;
}

function canvasDimension(value, fallback) {
  return Math.trunc(clamp(value, 1, 10000, fallback));
}

function canvasPercent(value, min, max, fallback) {
  const normalized = typeof value === 'string' ? value.trim().replace(/%$/, '') : value;
  return clamp(normalized, min, max, fallback);
}

function chooseBackgroundCommand(query) {
  const background = backgroundFromCommand(query);
  if (background) {
    mutate((project) => {
      if (/\ball\b/i.test(query)) project.pages.forEach((page) => setPageBackground(page, background.id));
      else setPageBackground(activePage(project), background.id);
    });
    return;
  }
  openBackgroundPicker();
}

function openBackgroundSettings() {
  if (!current()) return;
  backgroundSettingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  els.backgroundSettingsPanel.hidden = false;
  renderBackgroundSettings(current());
  requestAnimationFrame(() => (pageBackgroundImage(activePage(current())) ? els.backgroundXControl : els.chooseBackgroundImageBtn).focus({ preventScroll: true }));
}

function closeBackgroundSettings() {
  els.backgroundSettingsPanel.hidden = true;
  backgroundSettingsReturnFocus?.focus?.({ preventScroll: true });
  backgroundSettingsReturnFocus = null;
}

function backgroundFromCommand(query) {
  const normalized = query.toLowerCase().replace(/^(background|bg)\b/, '').replace(/\ball\b/g, '').trim().replace(/[_-]+/g, ' ');
  if (!normalized) return null;
  return BACKGROUNDS.find((background) => background.id === normalized || background.name.toLowerCase() === normalized || background.name.toLowerCase().includes(normalized));
}

function openBackgroundPicker() {
  if (!current()) return;
  const currentBackground = pageBackground(activePage(current()));
  commandPaletteMode = { type: 'background', originalBackgroundId: currentBackground.id };
  activeCommandIndex = Math.max(0, BACKGROUNDS.findIndex((background) => background.id === currentBackground.id));
  els.commandSearch.value = commandInputValue('background');
  renderCommandPalette();
}

function previewBackground(backgroundId) {
  const background = BACKGROUNDS.find((item) => item.id === backgroundId) || BACKGROUNDS[0];
  applyCanvasBackground(background);
}

function restoreBackgroundPreview() {
  previewBackground(commandPaletteMode.originalBackgroundId);
}

function commitBackgroundPreview(backgroundId) {
  if (!backgroundId) return;
  mutate((project) => setPageBackground(activePage(project), backgroundId));
  closeCommandPalette({ commitPreview: true });
}

function setGuideGridCommand(query) {
  const normalized = query.toLowerCase();
  const requestedLines = numberFromCommand(query);
  mutate((project) => {
    const page = activePage(project);
    const currentGrid = pageGuideGrid(page);
    const nextLines = clamp(requestedLines ?? (currentGrid.lines || GUIDE_GRID_DEFAULT.lines), GUIDE_GRID_MIN_LINES, GUIDE_GRID_MAX_LINES, GUIDE_GRID_DEFAULT.lines);
    const hidden = /\b(off|hide|hidden|none)\b/.test(normalized) || nextLines === 0;
    page.guideGrid = {
      visible: !hidden,
      lines: hidden ? 0 : Math.trunc(nextLines),
    };
  });
}

function setSelectedDimension(field, query, label) {
  const value = numberFromCommand(query) ?? Number(prompt(`${label} percentage`, selected(current())?.[field] ?? 50));
  if (!Number.isFinite(value)) return;
  patchSelected((el) => { if (el.type !== 'text') setElementSize(el, { [field]: value, source: field }); });
}

function setSelectedSize(query) {
  const numbers = numbersFromCommand(query);
  let [w, h] = numbers;
  if (!Number.isFinite(w)) w = Number(prompt('Width percentage', selected(current())?.w ?? 50));
  if (!Number.isFinite(h)) h = Number(prompt('Height percentage', selected(current())?.h ?? 20));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return;
  patchSelected((el) => { if (el.type !== 'text') setElementSize(el, { w, h }); });
}

function setSelectedNumber(field, query, label, min, max, canApply: any = () => true) {
  const currentElement = selected(current());
  if (!currentElement || !canApply(currentElement)) return;
  const value = numberFromCommand(query) ?? Number(prompt(label, currentElement[field] ?? min));
  if (!Number.isFinite(value)) return;
  patchSelected((el) => { if (canApply(el)) el[field] = clamp(value, min, max); });
}

function setSelectedColor(query) {
  const value = query.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i)?.[0] || prompt('Color hex', selected(current())?.color || '#111827');
  if (!isHexColor(value)) return;
  patchSelected((el) => el.color = value);
}

function numberFromCommand(query) {
  return numbersFromCommand(query)[0];
}

function numbersFromCommand(query) {
  return [...query.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}
