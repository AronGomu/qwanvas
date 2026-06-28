function integerFontSize(value) {
  return Math.round(clamp(value, TEXT_FONT_SIZE_MIN, TEXT_FONT_SIZE_MAX, TEXT_DEFAULT.fontSize));
}

function syncFontSizeControls(value) {
  const fontSize = integerFontSize(value);
  const optionValue = String(fontSize);
  if (![...els.fontSizeControl.options].some((option) => option.value === optionValue)) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    els.fontSizeControl.append(option);
  }
  els.fontSizeControl.value = optionValue;
  els.fontSizeSliderControl.value = optionValue;
}

function normalizedFontQuery(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function fontFuzzyScore(font, query) {
  const normalizedFont = font.toLocaleLowerCase();
  const normalizedQuery = normalizedFontQuery(query);
  if (!normalizedQuery) return 0;
  if (normalizedFont === normalizedQuery) return -100;
  if (normalizedFont.startsWith(normalizedQuery)) return -50 + normalizedFont.length - normalizedQuery.length;
  if (normalizedFont.includes(normalizedQuery)) return normalizedFont.indexOf(normalizedQuery);
  let score = 0;
  let cursor = 0;
  for (const char of normalizedQuery) {
    const index = normalizedFont.indexOf(char, cursor);
    if (index === -1) return Infinity;
    score += index - cursor + 1;
    cursor = index + 1;
  }
  return score + normalizedFont.length;
}

function fontResults(query = els.fontControl.value) {
  return FONT_OPTIONS
    .map((font, order) => ({ font, order, score: fontFuzzyScore(font, query) }))
    .filter((result) => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map((result) => result.font);
}

function exactFontOption(value) {
  const normalized = normalizedFontQuery(value);
  return FONT_OPTIONS.find((font) => font.toLocaleLowerCase() === normalized) || null;
}

function fontOptionId(index) {
  return `font-option-${index}`;
}

function openFontResults() {
  fontResultIndex = -1;
  renderFontResults();
}

function closeFontResults() {
  els.fontResults.hidden = true;
  els.fontControl.setAttribute('aria-expanded', 'false');
  fontResultIndex = -1;
}

function handleFontInput() {
  fontResultIndex = -1;
  const exact = exactFontOption(els.fontControl.value);
  previewSelectedFont(exact || selected(current())?.font || TEXT_DEFAULT.font);
  renderFontResults();
}

function renderFontResults() {
  const results = fontResults();
  els.fontResults.innerHTML = '';
  els.fontResults.hidden = !results.length;
  els.fontControl.setAttribute('aria-expanded', results.length ? 'true' : 'false');
  syncFontValidation();
  if (fontResultIndex >= results.length) fontResultIndex = results.length - 1;
  for (const [index, font] of results.entries()) {
    const option = document.createElement('button');
    option.type = 'button';
    option.id = fontOptionId(index);
    option.className = `font-result ${index === fontResultIndex ? 'active' : ''}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', index === fontResultIndex ? 'true' : 'false');
    option.tabIndex = -1;
    option.style.fontFamily = font;
    option.textContent = font;
    option.onpointerenter = () => previewFontResult(index);
    option.onpointerdown = (event) => event.preventDefault();
    option.onclick = () => commitFont(font);
    option.onkeydown = handleFontResultKeydown;
    els.fontResults.append(option);
  }
  syncFontActiveResult();
}

function isFontInputInvalid() {
  const value = normalizedFontQuery(els.fontControl.value);
  return Boolean(value) && !exactFontOption(value);
}

function syncFontValidation() {
  const invalid = isFontInputInvalid();
  if (invalid) {
    const typedFont = els.fontControl.value.trim();
    const currentFont = selected(current())?.font || TEXT_DEFAULT.font;
    els.fontControl.setAttribute('aria-invalid', 'true');
    els.fontWarning.textContent = `“${typedFont}” is not available. The text element is still using ${currentFont}.`;
  } else {
    els.fontControl.removeAttribute('aria-invalid');
  }
  els.fontWarning.hidden = !invalid;
}

function syncFontActiveResult() {
  els.fontResults.querySelectorAll('.font-result').forEach((option, index) => {
    const active = index === fontResultIndex;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function previewFontResult(index) {
  const results = fontResults();
  if (!results[index]) return;
  fontResultIndex = index;
  syncFontActiveResult();
  previewSelectedFont(results[index]);
}

function previewSelectedFont(font) {
  const element = selected(current());
  if (!element || element.type !== 'text') return;
  const text: any = els.canvas.querySelector(`[data-id="${CSS.escape(element.id)}"] .text-content`);
  if (text) applyTextStyle(text, { ...element, font });
}

function commitFont(font) {
  if (!FONT_OPTIONS.includes(font as any)) return;
  els.fontControl.value = font;
  closeFontResults();
  patchSelected((el) => { if (el.type === 'text') el.font = font; });
  requestAnimationFrame(() => els.fontControl.focus({ preventScroll: true }));
}

function handleFontInputKeydown(event) {
  const results = fontResults();
  if (event.key === 'ArrowDown' && results.length) {
    event.preventDefault();
    if (els.fontResults.hidden) renderFontResults();
    previewFontResult(0);
    (els.fontResults.querySelector(`#${fontOptionId(0)}`) as HTMLElement)?.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Enter') {
    const font = exactFontOption(els.fontControl.value) || (fontResultIndex >= 0 ? results[fontResultIndex] : null);
    if (font) { event.preventDefault(); commitFont(font); }
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    const font = selected(current())?.font || TEXT_DEFAULT.font;
    els.fontControl.value = font;
    previewSelectedFont(font);
    syncFontValidation();
    closeFontResults();
  }
}

function handleFontResultKeydown(event) {
  const results = fontResults();
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    previewFontResult(Math.min(results.length - 1, fontResultIndex + 1));
    (els.fontResults.querySelector(`#${fontOptionId(fontResultIndex)}`) as HTMLElement)?.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (fontResultIndex <= 0) {
      fontResultIndex = -1;
      syncFontActiveResult();
      previewSelectedFont(exactFontOption(els.fontControl.value) || selected(current())?.font || TEXT_DEFAULT.font);
      els.fontControl.focus({ preventScroll: true });
      return;
    }
    previewFontResult(fontResultIndex - 1);
    (els.fontResults.querySelector(`#${fontOptionId(fontResultIndex)}`) as HTMLElement)?.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const font = results[fontResultIndex];
    if (font) commitFont(font);
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    const font = selected(current())?.font || TEXT_DEFAULT.font;
    els.fontControl.value = font;
    previewSelectedFont(font);
    syncFontValidation();
    els.fontControl.focus({ preventScroll: true });
    closeFontResults();
  }
}

function wire() {
  els.launcherProjectName.addEventListener('input', renderLauncher);
  els.launcherProjectName.addEventListener('keydown', handleLauncherProjectNameKeydown);
  els.launcherCreateProjectBtn.onclick = () => startTemplateChoice(els.launcherProjectName.value);
  els.launcherRecentProjects.addEventListener('keydown', handleLauncherRecentKeydown);
  els.launcherImportProjectInput.onchange = importHtml;
  els.templateModal.addEventListener('click', (event) => { if (event.target === els.templateModal) closeTemplateDialog(); });
  els.templateModal.addEventListener('keydown', handleTemplateDialogKeydown);
  const commandPaletteBtn = $('commandPaletteBtn');
  commandPaletteBtn.textContent = `Commands ${commandPaletteShortcutLabel()}`;
  commandPaletteBtn.title = `Command palette ${commandPaletteShortcutLabel()}`;
  commandPaletteBtn.onclick = openCommandPalette;
  els.statusCommandShortcut.textContent = commandPaletteShortcutLabel();
  els.statusHelpShortcut.textContent = 'Ctrl+H';
  els.statusSettingsShortcut.textContent = shortcutLabel(',');
  els.helpCommandShortcut.textContent = commandPaletteShortcutLabel();
  els.helpSettingsShortcut.textContent = shortcutLabel(',');
  els.settingsCommandShortcut.textContent = commandPaletteShortcutLabel();
  els.settingsMenuBtn.title = `Settings ${shortcutLabel(',')}`;
  els.settingsMenuBtn.onclick = toggleSettingsMenu;
  els.settingsMenu.addEventListener('keydown', handleSettingsMenuKeydown);
  els.settingsMenu.addEventListener('click', handleSettingsMenuClick);
  els.inspectorResizeHandle.addEventListener('pointerdown', startInspectorResize);
  els.inspectorResizeHandle.addEventListener('mousedown', startInspectorResize);
  els.inspectorResizeHandle.addEventListener('keydown', handleInspectorResizeKeydown);
  document.addEventListener('pointerdown', closeSettingsMenuOnOutsidePointer);
  els.commandPalette.addEventListener('click', (event) => { if (event.target === els.commandPalette) closeCommandPalette(); });
  els.commandPalette.addEventListener('keydown', (event) => handleDialogTabTrap(event, els.commandDialog));
  els.commandSearch.addEventListener('input', handleCommandSearchInput);
  els.commandSearch.addEventListener('keydown', handleCommandSearchKeydown);
  els.projectNameModal.addEventListener('click', (event) => { if (event.target === els.projectNameModal) closeProjectNameDialog(); });
  els.projectNameModal.addEventListener('keydown', (event) => handleProjectNameDialogKeydown(event));
  els.projectNameDialog.addEventListener('submit', submitProjectNameDialog);
  els.projectNameDialogInput.addEventListener('input', validateProjectNameDialog);
  els.projectNameCancelBtn.onclick = () => closeProjectNameDialog();
  els.shortcutHelp.addEventListener('click', (event) => { if (event.target === els.shortcutHelp) closeShortcutHelp(); });
  els.shortcutHelp.addEventListener('keydown', (event) => handleDialogTabTrap(event, els.shortcutHelpDialog));
  els.closeShortcutHelpBtn.onclick = closeShortcutHelp;
  els.zoomOutBtn.onclick = () => setCanvasZoom(canvasZoom - ZOOM_STEP);
  els.zoomInBtn.onclick = () => setCanvasZoom(canvasZoom + ZOOM_STEP);
  els.statusZoomInput.onchange = commitStatusZoomInput;
  els.statusZoomInput.addEventListener('blur', commitStatusZoomInput);
  els.statusZoomInput.addEventListener('keydown', handleStatusZoomInputKeydown);
  $('addPageBtn').onclick = () => mutate((project) => { project.pages.push(createProjectPage(project, `Page ${project.pages.length + 1}`)); project.activePageId = project.pages.at(-1).id; selectedId = null; saveUiState('addPage'); });
  $('addTextBtn').onclick = () => addElement({ ...TEXT_DEFAULT });
  $('addShapeBtn').onclick = () => addElement({ ...SHAPE_DEFAULT });
  els.imageInput.onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await addImageFile(file);
    event.target.value = '';
  };
  els.backgroundImageInput.onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await setBackgroundImageFile(file);
    event.target.value = '';
  };
  els.closeBackgroundSettingsBtn.onclick = closeBackgroundSettings;
  els.chooseBackgroundImageBtn.onclick = () => els.backgroundImageInput.click();
  els.resetBackgroundImageBtn.onclick = () => mutate((project) => fitBackgroundImageToCanvas(activePage(project), pageSize(activePage(project), project)));
  els.clearBackgroundImageBtn.onclick = () => mutate((project) => { delete activePage(project).backgroundImage; });
  ['x', 'y'].forEach((name) => {
    const control = $(`background${capitalize(name)}Control`);
    control.oninput = () => patchBackgroundImage((background) => { background[name] = Number(control.value); });
  });
  ['w', 'h'].forEach((name) => {
    const control = $(`background${capitalize(name)}Control`);
    control.oninput = () => patchBackgroundImage((background) => setElementSize(background, { [name]: Number(control.value), source: name, max: 300 }));
  });
  els.backgroundAspectLockControl.onchange = () => patchBackgroundImage((background) => {
    background.aspectLocked = els.backgroundAspectLockControl.checked;
    if (background.aspectLocked) lockImageRatioToCurrentSize(background);
  });
  els.stageWrap.addEventListener('wheel', handleCanvasWheelZoom, { passive: false, capture: true });
  els.canvas.addEventListener('dragenter', handleCanvasDrag);
  els.canvas.addEventListener('dragover', handleCanvasDrag);
  els.canvas.addEventListener('dragleave', handleCanvasDragLeave);
  els.canvas.addEventListener('drop', handleCanvasDrop);
  els.canvas.addEventListener('pointerdown', (event) => { if (event.target === els.canvas) clearElementSelection(); });
  els.stageWrap.addEventListener('pointerdown', (event) => { if (event.target === els.stageWrap) clearElementSelection(); });
  els.appShell.addEventListener('pointerdown', (event) => {
    const target = event.target as Element;
    if (target.closest('.inspector, .inspector-resize-handle, .canvas-element, .selection-toolbar, .canvas, .background-settings-panel')) return;
    clearElementSelection();
  });
  $('deleteBtn').onclick = confirmDeleteSelectedElement;
  $('backmostBtn').onclick = () => patchSelected((el) => el.z = 0);
  $('backBtn').onclick = () => patchSelected((el) => el.z = Math.max(0, (el.z || 1) - 1));
  $('frontBtn').onclick = () => patchSelected((el) => el.z = (el.z || 1) + 1);
  $('frontmostBtn').onclick = () => patchSelected((el) => el.z = topElementZ() + 1);
  $('exportHtmlBtn').onclick = () => current() && download(current().fileName || savedProjectFileName(current()), projectToHtml(current()), 'text/html');
  $('exportJsonBtn').onclick = () => current() && download((current().fileName || savedProjectFileName(current())).replace(/\.html$/, '.json'), projectToJson(current()), 'application/json');
  $('exportCssBtn').onclick = () => current() && download((current().fileName || savedProjectFileName(current())).replace(/\.html$/, '.css'), projectToCss(), 'text/css');
  $('exportPngBtn').onclick = exportPng;
  els.undoBtn.onclick = undo;
  els.redoBtn.onclick = redo;
  els.projectName.onchange = () => renameCurrentProject(els.projectName.value);
  els.textControl.addEventListener('pointerdown', () => textInspectorAutoFocused = false);
  els.textControl.addEventListener('keydown', (event) => { if (event.key !== 'Delete' && event.key !== 'Del') textInspectorAutoFocused = false; });
  ['text', 'x', 'y', 'rotation', 'fontSize', 'color'].forEach((name) => {
    const control = $(`${name}Control`);
    control.oninput = () => patchSelected((el) => {
      const value = name === 'fontSize' ? integerFontSize(control.value) : control.type === 'number' || control.type === 'range' ? Number(control.value) : control.value;
      el[name] = value;
      if (name === 'rotation') els.rotationNumberControl.value = value;
      if (name === 'fontSize') syncFontSizeControls(value);
    });
  });
  els.fontControl.onfocus = () => openFontResults();
  els.fontControl.oninput = () => handleFontInput();
  els.fontControl.onkeydown = handleFontInputKeydown;
  els.fontControl.onblur = () => setTimeout(() => { if (document.activeElement !== els.fontControl && !els.fontResults.contains(document.activeElement)) closeFontResults(); }, 0);
  els.rotationNumberControl.oninput = () => patchSelected((el) => { el.rotation = clamp(Number(els.rotationNumberControl.value), -180, 180, 0); els.rotationControl.value = el.rotation; });
  els.fontSizeSliderControl.oninput = () => patchSelected((el) => { el.fontSize = integerFontSize(els.fontSizeSliderControl.value); syncFontSizeControls(el.fontSize); });
  document.querySelectorAll('[data-color]').forEach((button: any) => button.addEventListener('click', () => patchSelected((el) => { el.color = button.dataset.color; els.colorControl.value = el.color; })));
  ['cropTop', 'cropBottom'].forEach((name) => {
    const control = $(`${name}Control`);
    control.oninput = () => patchSelected((el) => setImageCropControl(el, name, Number(control.value)));
  });
  els.wControl.oninput = () => patchSelected((el) => setElementSize(el, { w: Number(els.wControl.value), source: 'w' }));
  els.hControl.oninput = () => patchSelected((el) => setElementSize(el, { h: Number(els.hControl.value), source: 'h' }));
  addEventListener('keydown', (event) => {
    if (!els.templateModal.hidden && event.key === 'Escape') { event.preventDefault(); closeTemplateDialog(); return; }
    if (!els.commandPalette.hidden && event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); return; }
    if (!els.projectNameModal.hidden && event.key === 'Escape') { event.preventDefault(); closeProjectNameDialog(); return; }
    if (!els.shortcutHelp.hidden && event.key === 'Escape') { event.preventDefault(); closeShortcutHelp(); return; }
    if (!els.backgroundSettingsPanel.hidden && event.key === 'Escape') { event.preventDefault(); closeBackgroundSettings(); return; }
    if (!els.settingsMenu.hidden && event.key === 'Escape') { event.preventDefault(); closeSettingsMenu(); return; }
    if (!els.commandPalette.hidden || !els.projectNameModal.hidden || !els.shortcutHelp.hidden || !els.settingsMenu.hidden || !els.templateModal.hidden) return;
    if (isTextEntryTarget(event.target) && !shouldDeleteSelectedElement(event)) return;
    if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); toggleSettingsMenu(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); openCommandPalette(); return; }
    if (event.ctrlKey && event.key.toLowerCase() === 'h') { event.preventDefault(); openShortcutHelp(); return; }
    if (handleProjectPageNavigationKeydown(event)) return;
    if (shouldDeleteSelectedElement(event)) { event.preventDefault(); $('deleteBtn').click(); return; }
    if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) { event.preventDefault(); setCanvasZoom(canvasZoom + ZOOM_STEP); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === '-') { event.preventDefault(); setCanvasZoom(canvasZoom - ZOOM_STEP); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === '0') { event.preventDefault(); setCanvasZoom(1); return; }
    const alignmentAction = alignmentActionFromEvent(event);
    if (alignmentAction) { event.preventDefault(); alignSelectedElement(alignmentAction); return; }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === '/') { event.preventDefault(); openCommandPalette({ query: '/' }); return; }
    if (!current()) return;
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 't' && !selectedId) { event.preventDefault(); $('addTextBtn').click(); return; }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'i') { event.preventDefault(); els.imageInput.click(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
  });
}

const COMMANDS = [
  { id: 'add-text', title: 'Add text', detail: 'Create a Markdown text box on the current page', shortcut: 'text', keywords: 'text copy headline title', run: (query) => addTextCommand(query) },
  { id: 'add-shape', title: 'Add shape', detail: 'Create a simple colored shape', shortcut: 'shape', keywords: 'shape rectangle box', run: () => addElement({ ...SHAPE_DEFAULT }) },
  { id: 'add-page', title: 'Add page', detail: 'Append a page to this deck', shortcut: 'page', keywords: 'page slide new', run: () => $('addPageBtn').click() },
  { id: 'new-project', title: 'New Project', detail: 'Type “project linkedin-post”, “project carousel”, or “project youtube-thumbnail”', shortcut: 'project linkedin-post', keywords: 'new project blank deck template linkedin post carousel caroussel youtube thumbnail square', opensSurface: true, run: (query) => newProjectCommand(query) },
  { id: 'rename-project', title: 'Rename project', detail: 'Rename the current project with duplicate-name validation', shortcut: 'rename-project', keywords: 'rename project name title current', opensSurface: true, run: renameProjectCommand },
  { id: 'recent-project', title: 'RecentProject', detail: 'Open a recent project picker', shortcut: 'RecentProject', keywords: 'recent project open reopen select library', opensSurface: true, run: () => openRecentProjectPicker() },
  { id: 'duplicate-project', title: 'Duplicate project', detail: 'Copy the current project', shortcut: 'duplicate', keywords: 'copy clone project duplicate', run: duplicateCurrentProject },
  { id: 'set-guide-grid', title: 'Set canvas guide grid', detail: 'Type “/grid”, “/grid 3”, “/grid 0”, or “/grid off” for 0–5 split lines', shortcut: 'grid 2', keywords: 'grid guide guides lines thirds rule layout canvas show hide', run: (query) => setGuideGridCommand(query) },
  { id: 'choose-background', title: 'Choose page background', detail: 'Type “/background blank” or “/background aurora-grid”; omit the argument for a live preview picker', shortcut: 'background aurora-grid', keywords: 'background bg page blank aurora grid theme canvas', run: (query) => chooseBackgroundCommand(query) },
  { id: 'background-settings', title: 'Background settings', detail: 'Open the right panel to move and resize the background image', shortcut: 'background-settings', keywords: 'background bg settings image move resize zoom fill canvas panel', opensSurface: true, run: openBackgroundSettings },
  { id: 'set-width', title: 'Set selected width', detail: 'Type “/width 50” or pick this action', shortcut: 'width 50', keywords: 'width w resize size', needsSelection: true, run: (query) => setSelectedDimension('w', query, 'Width') },
  { id: 'set-height', title: 'Set selected height', detail: 'Type “/height 20” or pick this action', shortcut: 'height 20', keywords: 'height h resize size', needsSelection: true, run: (query) => setSelectedDimension('h', query, 'Height') },
  { id: 'set-size', title: 'Set selected size', detail: 'Type “/size 40 20” for width and height', shortcut: 'size 40 20', keywords: 'size resize dimensions width height', needsSelection: true, run: (query) => setSelectedSize(query) },
  { id: 'set-x', title: 'Set selected X position', detail: 'Type “/x 50” to move horizontally', shortcut: 'x 50', keywords: 'x horizontal left right position move', needsSelection: true, run: (query) => setSelectedNumber('x', query, 'X position', 0, 100) },
  { id: 'set-y', title: 'Set selected Y position', detail: 'Type “/y 50” to move vertically', shortcut: 'y 50', keywords: 'y vertical top bottom position move', needsSelection: true, run: (query) => setSelectedNumber('y', query, 'Y position', 0, 100) },
  { id: 'set-rotation', title: 'Rotate selected element', detail: 'Type “/rotate 15” to set degrees', shortcut: 'rotate 15', keywords: 'rotate rotation angle degrees', needsSelection: true, run: (query) => setSelectedNumber('rotation', query, 'Rotation degrees', -180, 180) },
  { id: 'set-font-size', title: 'Set selected font size', detail: 'Type “/font 64” for selected text', shortcut: 'font 64', keywords: 'font size text typography', needsSelection: true, run: (query) => setSelectedNumber('fontSize', query, 'Font size', TEXT_FONT_SIZE_MIN, TEXT_FONT_SIZE_MAX, (el) => el.type === 'text') },
  { id: 'set-color', title: 'Set selected color', detail: 'Type “/color #74a6ff”', shortcut: 'color #74a6ff', keywords: 'color fill text shape', needsSelection: true, run: (query) => setSelectedColor(query) },
  { id: 'send-back', title: 'Send selected backward', detail: 'Move the selected element behind others', shortcut: 'back', keywords: 'back backward behind layer z index', needsSelection: true, run: () => $('backBtn').click() },
  { id: 'bring-front', title: 'Bring selected forward', detail: 'Move the selected element in front of others', shortcut: 'front', keywords: 'front forward ahead layer z index', needsSelection: true, run: () => $('frontBtn').click() },
  ...ALIGNMENT_ACTIONS.map((action) => ({ ...action, shortcut: action.id, needsSelection: true, run: () => alignSelectedElement(action) })),
  { id: 'delete', title: 'Delete selected element', detail: 'Remove the selected canvas element', shortcut: 'delete', keywords: 'delete remove selected element', needsSelection: true, run: () => $('deleteBtn').click() },
  { id: 'add-image', title: 'Add image', detail: 'Open the image picker', shortcut: 'image', keywords: 'image picture photo upload add', opensSurface: true, run: () => els.imageInput.click() },
  { id: 'import-html', title: 'Import Project', detail: 'Open the HTML/JSON import picker', shortcut: 'import', keywords: 'import html json project file open', opensSurface: true, run: () => els.launcherImportProjectInput.click() },
  { id: 'undo', title: 'Undo', detail: 'Revert the last edit', shortcut: 'undo', keywords: 'undo revert back', run: undo },
  { id: 'redo', title: 'Redo', detail: 'Restore the next edit', shortcut: 'redo', keywords: 'redo restore forward', run: redo },
  { id: 'zoom-in', title: 'Zoom in', detail: 'Increase the editor canvas zoom', shortcut: 'zoom-in', keywords: 'zoom in enlarge closer', run: () => setCanvasZoom(canvasZoom + ZOOM_STEP) },
  { id: 'zoom-out', title: 'Zoom out', detail: 'Decrease the editor canvas zoom', shortcut: 'zoom-out', keywords: 'zoom out shrink dezoom smaller', run: () => setCanvasZoom(canvasZoom - ZOOM_STEP) },
  { id: 'zoom-reset', title: 'Reset zoom', detail: 'Return the editor canvas zoom to 100%', shortcut: 'zoom-reset', keywords: 'zoom reset actual size 100', run: () => setCanvasZoom(1) },
  { id: 'export-png', title: 'Export PNG', detail: 'Download the active page as PNG', shortcut: 'png', keywords: 'export download png image', run: exportPng },
  { id: 'export-html', title: 'Export HTML', detail: 'Download portable HTML', shortcut: 'html', keywords: 'export download html', run: () => $('exportHtmlBtn').click() },
  { id: 'export-json', title: 'Export JSON', detail: 'Download editable project JSON', shortcut: 'json', keywords: 'export download json project', run: () => $('exportJsonBtn').click() },
  { id: 'export-css', title: 'Export CSS', detail: 'Download CSS for the project', shortcut: 'css', keywords: 'export download css style', run: () => $('exportCssBtn').click() },
] satisfies readonly Command[];
