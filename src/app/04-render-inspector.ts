function render() {
  const project = current();
  renderLauncher();
  const hasProject = Boolean(project);
  els.projectLauncher.hidden = hasProject;
  els.projectLauncher.inert = hasProject;
  (document.querySelector('.workspace') as any).inert = !hasProject;
  (document.querySelector('.inspector') as any).inert = !hasProject;
  els.stageWrap.hidden = !hasProject;
  els.pageStrip.hidden = !hasProject;
  els.projectName.disabled = !hasProject;
  for (const id of ['addPageBtn', 'exportPngBtn', 'exportHtmlBtn', 'exportJsonBtn', 'exportCssBtn', 'addTextBtn', 'addShapeBtn']) $(id).disabled = !hasProject;
  els.imageInput.disabled = !hasProject;
  els.undoBtn.disabled = !hasProject || !undoHistory.length;
  els.redoBtn.disabled = !hasProject || !future.length;
  if (!project) {
    els.projectName.value = '';
    els.statusProjectName.textContent = 'No project';
    els.statusResolution.textContent = '—';
    els.statusPageCount.textContent = 'Page 0/0';
    els.canvas.innerHTML = '';
    selectedId = null;
    els.emptyInspector.hidden = false;
    els.elementInspector.hidden = true;
    requestAnimationFrame(() => els.launcherProjectName.focus({ preventScroll: true }));
    return;
  }
  els.projectName.value = project.name;
  els.statusProjectName.textContent = project.name;
  renderStatusBar(project);
  renderPages(project);
  renderCanvas(project);
  renderBackgroundSettings(project);
  renderInspector(project);
}

function renameCurrentProject(name) {
  const error = projectNameError(name, current().id);
  if (error) { showProjectError(error); render(); return false; }
  mutate((project) => {
    project.name = normalizedProjectName(name);
    syncProjectFileMetadata(project);
    updateProjectUrl(project);
  }, true, 'renameProject');
  return true;
}

function renderStatusBar(project = current()) {
  if (!project) return;
  const page = activePage(project);
  const size = pageSize(page, project);
  const pageIndex = Math.max(0, project.pages.findIndex((candidate) => candidate.id === page.id)) + 1;
  els.statusResolution.textContent = `${size.width}×${size.height}`;
  els.statusPageCount.textContent = `Page ${pageIndex}/${project.pages.length}`;
  els.statusZoomInput.value = String(Math.round(canvasZoom * 100));
  els.zoomOutBtn.disabled = canvasZoom <= ZOOM_MIN;
  els.zoomInBtn.disabled = canvasZoom >= ZOOM_MAX;
  els.canvas.style.setProperty('--canvas-zoom', canvasZoom.toFixed(2));
}

function commitStatusZoomInput() {
  const percent = Number(els.statusZoomInput.value);
  if (!Number.isFinite(percent)) { renderStatusBar(); return; }
  setCanvasZoom(percent / 100);
}

function handleStatusZoomInputKeydown(event) {
  if (event.key === 'Enter') { event.preventDefault(); commitStatusZoomInput(); els.statusZoomInput.blur(); }
  if (event.key === 'Escape') { event.preventDefault(); renderStatusBar(); els.statusZoomInput.blur(); }
}

function setCanvasZoom(value, anchor = null) {
  const nextZoom = Math.round(clamp(value, ZOOM_MIN, ZOOM_MAX, 1) * 100) / 100;
  if (nextZoom === canvasZoom) { renderStatusBar(); return; }
  const beforeRect = anchor ? els.canvas.getBoundingClientRect() : null;
  const anchorX = beforeRect ? (anchor.clientX - beforeRect.left) / beforeRect.width : 0.5;
  const anchorY = beforeRect ? (anchor.clientY - beforeRect.top) / beforeRect.height : 0.5;
  canvasZoom = nextZoom;
  renderStatusBar();
  if (!beforeRect) return;
  requestAnimationFrame(() => {
    const afterRect = els.canvas.getBoundingClientRect();
    els.stageWrap.scrollLeft += afterRect.left + (anchorX * afterRect.width) - anchor.clientX;
    els.stageWrap.scrollTop += afterRect.top + (anchorY * afterRect.height) - anchor.clientY;
  });
}

function handleCanvasWheelZoom(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  event.stopPropagation();
  const direction = event.deltaY > 0 ? -1 : 1;
  setCanvasZoom(canvasZoom + (direction * ZOOM_STEP), event);
}

function currentInspectorPanelWidth() {
  const raw = getComputedStyle(els.appShell).getPropertyValue('--inspector-panel-width');
  return clamp(parseFloat(raw), INSPECTOR_PANEL_MIN_WIDTH, INSPECTOR_PANEL_MAX_WIDTH, 420);
}

function setInspectorPanelWidth(width) {
  const nextWidth = Math.round(clamp(width, INSPECTOR_PANEL_MIN_WIDTH, INSPECTOR_PANEL_MAX_WIDTH, 420));
  els.appShell.style.setProperty('--inspector-panel-width', `${nextWidth}px`);
  els.inspectorResizeHandle.setAttribute('aria-valuenow', String(nextWidth));
}

function startInspectorResize(event) {
  if (inspectorResize || event.button !== 0) return;
  event.preventDefault();
  inspectorResize = { startX: event.clientX, startWidth: currentInspectorPanelWidth() };
  els.inspectorResizeHandle.classList.add('dragging');
  els.appShell.classList.add('is-resizing-inspector');
  if ('pointerId' in event) els.inspectorResizeHandle.setPointerCapture?.(event.pointerId);
  addEventListener('pointermove', dragInspectorResize);
  addEventListener('mousemove', dragInspectorResize);
  addEventListener('pointerup', stopInspectorResize, { once: true });
  addEventListener('mouseup', stopInspectorResize, { once: true });
}

function dragInspectorResize(event) {
  if (!inspectorResize) return;
  setInspectorPanelWidth(inspectorResize.startWidth - (event.clientX - inspectorResize.startX));
}

function stopInspectorResize() {
  inspectorResize = null;
  els.inspectorResizeHandle.classList.remove('dragging');
  els.appShell.classList.remove('is-resizing-inspector');
  removeEventListener('pointermove', dragInspectorResize);
  removeEventListener('mousemove', dragInspectorResize);
}

function handleInspectorResizeKeydown(event) {
  const direction = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
  if (!direction) return;
  event.preventDefault();
  setInspectorPanelWidth(currentInspectorPanelWidth() + (direction * INSPECTOR_PANEL_WIDTH_STEP));
}

function applyCanvasBackground(background) {
  els.canvas.style.background = background.css;
  els.canvas.classList.toggle('background-grid', background.overlay === 'grid');
}

function renderLauncher() {
  const name = normalizedProjectName(els.launcherProjectName.value);
  const error = name ? projectNameError(name) : '';
  els.launcherProjectNameError.textContent = error;
  els.launcherProjectName.toggleAttribute('aria-invalid', Boolean(error));
  els.launcherCreateProjectBtn.disabled = !name || Boolean(error);
  const sorted = sortedProjects();
  launcherActiveProjectIndex = clamp(launcherActiveProjectIndex, 0, Math.max(0, sorted.length - 1), 0);
  els.launcherRecentProjects.innerHTML = '';
  if (!sorted.length) {
    renderEmptyLauncherRecents();
    return;
  }
  for (const [index, project] of sorted.entries()) {
    const button = projectCard(project);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === launcherActiveProjectIndex ? 'true' : 'false');
    button.classList.toggle('active', index === launcherActiveProjectIndex);
    button.tabIndex = index === launcherActiveProjectIndex ? 0 : -1;
    button.onpointerenter = () => previewLauncherProjectOption(index);
    els.launcherRecentProjects.append(button);
  }
}

function renderEmptyLauncherRecents() {
  const empty = document.createElement('p');
  empty.className = 'muted launcher-empty';
  empty.textContent = 'No recent projects yet.';
  els.launcherRecentProjects.append(empty);
}

function previewLauncherProjectOption(index) {
  const sorted = sortedProjects();
  launcherActiveProjectIndex = clamp(index, 0, Math.max(0, sorted.length - 1), 0);
  els.launcherRecentProjects.querySelectorAll('.project-card').forEach((button, buttonIndex) => {
    const isActive = buttonIndex === launcherActiveProjectIndex;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    (button as HTMLButtonElement).tabIndex = isActive ? 0 : -1;
  });
}

function sortedProjects() {
  return projects.toSorted((a, b) => b.updatedAt - a.updatedAt);
}

function projectCard(project) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `project-card ${project.id === currentId ? 'active' : ''}`;
  const size = pageSize(activePage(project), project);
  button.innerHTML = `<strong>${escapeHtml(project.name)}</strong><small>${project.pages.length} page${project.pages.length > 1 ? 's' : ''} · ${size.width}×${size.height} · ${new Date(project.updatedAt).toLocaleString()}</small>`;
  button.onclick = () => openProject(project.id);
  return button;
}

function renderPages(project) {
  if (!project) return;
  els.pageStrip.innerHTML = '';
  project.pages.forEach((page, index) => {
    const button = document.createElement('button');
    button.className = `page-thumb ${page.id === project.activePageId ? 'active' : ''}`;
    button.textContent = `${index + 1}. ${page.name}`;
    button.onclick = () => mutate((p) => { p.activePageId = page.id; selectedId = null; editingId = null; editBefore = null; saveUiState('selectPage'); }, false);
    els.pageStrip.append(button);
  });
}

function renderCanvas(project) {
  if (!project) return;
  const page = activePage(project);
  const background = pageBackground(page);
  const size = pageSize(page, project);
  els.canvas.style.setProperty('--canvas-ratio', size.width / size.height);
  els.canvas.style.setProperty('--canvas-aspect-ratio', `${size.width} / ${size.height}`);
  els.canvas.style.setProperty('--page-width', size.width);
  applyCanvasBackground(background);
  const guideGrid = pageGuideGrid(page);
  els.canvas.classList.toggle('guide-grid', guideGrid.visible);
  els.canvas.style.setProperty('--guide-grid-lines', guideGrid.lines);
  els.canvas.innerHTML = '';
  const backgroundImage = pageBackgroundImage(page);
  if (backgroundImage) els.canvas.append(renderBackgroundImageLayer(backgroundImage));
  for (const element of page.elements.toSorted((a, b) => (a.z || 1) - (b.z || 1))) {
    const node = document.createElement('div');
    node.className = `canvas-element ${element.type} ${element.id === selectedId ? 'selected' : ''} ${element.id === editingId ? 'editing' : ''}`;
    node.style.cssText = elementStyle(element);
    node.dataset.id = element.id;
    node.tabIndex = 0;
    node.role = 'button';
    node.ariaLabel = `${element.type} element. Arrow keys move; Shift plus arrow resizes.`;
    node.ariaPressed = element.id === selectedId ? 'true' : 'false';
    if (element.type === 'text') {
      node.innerHTML = `<div class="text-selection-frame"><div class="text-content"></div><span class="handle rotate"></span><span class="handle resize"></span></div>`;
      const text: any = node.querySelector('.text-content');
      text.contentEditable = element.id === editingId ? 'true' : 'false';
      if (element.id === editingId) {
        text.textContent = element.text;
        text.setAttribute('role', 'textbox');
        text.setAttribute('aria-multiline', 'true');
      } else {
        text.innerHTML = markdownToHtml(element.text, { interactiveLinks: false });
      }
      text.setAttribute('aria-label', 'Edit markdown text on canvas');
      applyTextStyle(text, element);
      text.addEventListener('input', () => updateCanvasText(element.id, text.textContent));
      text.addEventListener('keydown', stopEditingOnEscape);
      text.addEventListener('blur', finishCanvasTextEdit);
    } else if (element.type === 'image') {
      const img = document.createElement('img');
      img.alt = '';
      img.src = safeImageSrc(element.src);
      node.append(img, canvasHandle('rotate'), canvasHandle('resize'), canvasHandle('crop crop-left'), canvasHandle('crop crop-right'), canvasHandle('crop crop-top'), canvasHandle('crop crop-bottom'));
    } else {
      node.innerHTML = `<span class="handle rotate"></span><span class="handle resize"></span>`;
    }
    node.addEventListener('pointerdown', startDrag);
    node.addEventListener('click', () => selectElement(element.id));
    node.addEventListener('focus', () => selectElement(element.id, { renderCanvasToo: false }));
    node.addEventListener('keydown', handleElementKeydown);
    node.addEventListener('dblclick', () => { if (element.type === 'text') startCanvasTextEdit(element.id); });
    els.canvas.append(node);
  }
  renderSelectionToolbar(page);
}

function renderSelectionToolbar(page) {
  const element = page.elements.find((candidate) => candidate.id === selectedId);
  if (!element || editingId === element.id) return;
  const toolbar = document.createElement('div');
  const placement = selectionToolbarPlacement(element);
  toolbar.className = `selection-toolbar ${placement.showAbove ? 'above' : ''}`;
  toolbar.style.setProperty('--toolbar-x', `${placement.x}%`);
  toolbar.style.setProperty('--toolbar-y', `${placement.y}%`);
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Align selected element');
  toolbar.addEventListener('pointerdown', (event) => event.stopPropagation());
  for (const action of ALIGNMENT_ACTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `selection-align-btn ${action.axis === 'y' ? 'vertical' : 'horizontal'}`;
    button.title = `${action.title} ${action.shortcut}`;
    button.setAttribute('aria-label', `${action.title} (${action.shortcut})`);
    button.dataset.alignAction = action.id;
    button.innerHTML = `<span aria-hidden="true">${action.icon}</span>`;
    button.onclick = (event) => { event.stopPropagation(); alignSelectedElement(action, { restoreToolbarFocus: true }); };
    toolbar.append(button);
  }
  els.canvas.append(toolbar);
}

function selectionToolbarPlacement(element) {
  const canvasRect = els.canvas.getBoundingClientRect();
  const selectedNode = els.canvas.querySelector(`[data-id="${CSS.escape(element.id)}"]`);
  const targetNode = element.type === 'text' ? selectedNode?.querySelector('.text-selection-frame') : selectedNode;
  const targetRect = targetNode?.getBoundingClientRect?.();
  if (!targetRect || !canvasRect.width || !canvasRect.height) {
    const showAboveFallback = element.y + element.h / 2 > SELECTION_TOOLBAR_EDGE_THRESHOLD;
    return {
      x: element.x,
      y: showAboveFallback ? element.y - element.h / 2 - SELECTION_TOOLBAR_OFFSET : element.y + element.h / 2 + SELECTION_TOOLBAR_OFFSET,
      showAbove: showAboveFallback,
    };
  }
  const left = ((targetRect.left - canvasRect.left) / canvasRect.width) * 100;
  const right = ((targetRect.right - canvasRect.left) / canvasRect.width) * 100;
  const top = ((targetRect.top - canvasRect.top) / canvasRect.height) * 100;
  const bottom = ((targetRect.bottom - canvasRect.top) / canvasRect.height) * 100;
  const showAbove = bottom > SELECTION_TOOLBAR_EDGE_THRESHOLD;
  return {
    x: clamp((left + right) / 2, 0, 100, element.x),
    y: showAbove ? top - SELECTION_TOOLBAR_OFFSET : bottom + SELECTION_TOOLBAR_OFFSET,
    showAbove,
  };
}

function renderBackgroundImageLayer(backgroundImage) {
  const layer = document.createElement('div');
  layer.className = 'canvas-background-image';
  layer.style.cssText = elementStyle(backgroundImage);
  const img = document.createElement('img');
  img.alt = '';
  img.src = safeImageSrc(backgroundImage.src);
  layer.append(img);
  return layer;
}

function renderBackgroundSettings(project) {
  if (!project) return;
  const backgroundImage = pageBackgroundImage(activePage(project));
  const hasBackgroundImage = Boolean(backgroundImage);
  els.backgroundSettingsEmpty.hidden = hasBackgroundImage;
  els.backgroundSettingsControls.hidden = !hasBackgroundImage;
  els.resetBackgroundImageBtn.disabled = !hasBackgroundImage;
  els.clearBackgroundImageBtn.disabled = !hasBackgroundImage;
  if (!backgroundImage) return;
  els.backgroundXControl.value = Math.round(backgroundImage.x);
  els.backgroundYControl.value = Math.round(backgroundImage.y);
  els.backgroundWControl.value = Math.round(backgroundImage.w);
  els.backgroundHControl.value = Math.round(backgroundImage.h);
  els.backgroundAspectLockControl.checked = imageAspectLocked(backgroundImage);
  els.backgroundAspectLinkIndicator.hidden = !imageAspectLocked(backgroundImage);
}

function canvasHandle(kind) {
  const span = document.createElement('span');
  span.className = `handle ${kind}`;
  return span;
}

function handleElementKeydown(event) {
  if (isTextEntryTarget(event.target)) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) return;
  selectElement(event.currentTarget.dataset.id, { renderCanvasToo: false });
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const element = selected(current());
    if (element?.type === 'text') startCanvasTextEdit(element.id);
    else render();
    return;
  }
  const delta = event.shiftKey ? 2 : 1;
  const changes = {
    ArrowLeft: event.shiftKey ? ['w', -delta] : ['x', -delta],
    ArrowRight: event.shiftKey ? ['w', delta] : ['x', delta],
    ArrowUp: event.shiftKey ? ['h', -delta] : ['y', -delta],
    ArrowDown: event.shiftKey ? ['h', delta] : ['y', delta],
  };
  const [field, amount] = changes[event.key];
  event.preventDefault();
  mutate((project) => {
    const element = selected(project);
    if (!element) return;
    const value = clamp(element[field] + amount, field === 'x' || field === 'y' ? 0 : 3, 100);
    if (field === 'w' || field === 'h') setElementSize(element, { [field]: value, source: field });
    else element[field] = value;
  });
}

function selectElement(id, options = {}) {
  selectedId = id;
  saveUiState('selectElement');
  // @ts-ignore options is a tiny local bag kept untyped for call-site simplicity.
  if (options.renderCanvasToo) {
    render();
    return;
  }
  els.canvas.querySelectorAll('.canvas-element').forEach((node) => {
    node.classList.toggle('selected', node.dataset.id === id);
    node.ariaPressed = node.dataset.id === id ? 'true' : 'false';
  });
  els.canvas.querySelector('.selection-toolbar')?.remove();
  renderSelectionToolbar(activePage(current()));
  renderInspector(current());
}

function focusTextInspector() {
  textInspectorAutoFocused = true;
  els.textControl.focus({ preventScroll: true });
}

function shouldDeleteSelectedElement(event) {
  if (event.key !== 'Delete' && event.key !== 'Del') return false;
  if (!selectedId) return false;
  if (!isTextEntryTarget(event.target)) return true;
  return event.target === els.textControl && textInspectorAutoFocused;
}

function alignmentActionFromEvent(event) {
  if (!selectedId || !event.altKey || event.ctrlKey || event.metaKey) return null;
  const key = event.key;
  if (key !== '[' && key !== ']' && key !== '\\') return null;
  const position = key === '[' ? 'start' : key === ']' ? 'end' : 'center';
  const axis = event.shiftKey ? 'y' : 'x';
  return ALIGNMENT_ACTIONS.find((action) => action.axis === axis && action.position === position);
}

function alignSelectedElement(action, options = {}) {
  if (!action || !selectedId) return;
  const idToFocus = selectedId;
  patchSelected((element) => {
    const size = action.axis === 'x' ? element.w : element.h;
    const next = action.position === 'start' ? size / 2 : action.position === 'end' ? 100 - size / 2 : 50;
    element[action.axis] = clamp(next, 0, 100, 50);
  });
  requestAnimationFrame(() => {
    // @ts-ignore options is a tiny local bag kept untyped for call-site simplicity.
    const focusTarget = options.restoreToolbarFocus
      ? els.canvas.querySelector(`[data-align-action="${CSS.escape(action.id)}"]`)
      : els.canvas.querySelector(`[data-id="${CSS.escape(idToFocus)}"]`);
    focusTarget?.focus({ preventScroll: true });
  });
}

function renderInspector(project) {
  if (!project) return;
  const element = selected(project);
  els.emptyInspector.hidden = Boolean(element);
  els.elementInspector.hidden = !element;
  if (!element) return;
  const isText = element.type === 'text';
  const isImage = element.type === 'image';
  els.textControl.closest('.field').hidden = !isText;
  els.wControl.closest('.field').hidden = isText;
  els.hControl.closest('.field').hidden = isText;
  els.fontSizeControl.closest('.field').hidden = !isText;
  els.fontControl.closest('.field').hidden = !isText;
  if (isImage) element.aspectLocked = true;
  els.cropFields.hidden = !isImage;
  els.textControl.value = element.text || '';
  syncGeometryControls(element);
  if (isImage) {
    els.cropTopControl.value = imageCrop(element, 'cropTop');
    els.cropBottomControl.value = imageCrop(element, 'cropBottom');
  }
  els.fontSizeControl.value = element.fontSize || 42;
  els.colorControl.value = element.color || '#ffffff';
  els.fontControl.value = element.font || 'Inter';
}

function startCanvasTextEdit(id) {
  const project = current();
  const element = activePage(project).elements.find((el) => el.id === id && el.type === 'text');
  if (!element) return;
  selectedId = id;
  editingId = id;
  editBefore = clone(project);
  render();
  const text: any = els.canvas.querySelector(`[data-id="${CSS.escape(id)}"] .text-content`);
  if (!text) return;
  text.focus({ preventScroll: true });
  const selection = getSelection();
  const range = document.createRange();
  range.selectNodeContents(text);
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateCanvasText(id, value) {
  const project = current();
  const element = activePage(project).elements.find((el) => el.id === id && el.type === 'text');
  if (!element) return;
  element.text = value;
  project.updatedAt = Date.now();
  saveProjects('updateCanvasText');
  saveUiState('updateCanvasText');
  if (selectedId === id) els.textControl.value = value;
}

function stopEditingOnEscape(event) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.currentTarget.blur();
}

function finishCanvasTextEdit() {
  if (!editingId) return;
  const before = editBefore;
  const after = current();
  const changed = before && JSON.stringify(before) !== JSON.stringify(after);
  if (changed) { undoHistory.push(before); future = []; }
  editingId = null;
  editBefore = null;
  render();
}

function isTextEntryTarget(target) {
  if (!target || target.closest?.('[hidden]')) return false;
  return target.matches?.('input,textarea,select') || target.isContentEditable;
}
