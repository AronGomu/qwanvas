function undo() {
  if (liveTextStyleBefore && !commitLiveTextStyleEdit('undo:textStyleEdit')) return;
  if (!undoHistory.length || !current()) return;
  const beforeUndo = clone(undoHistory), beforeFuture = clone(future);
  const target = undoHistory.pop();
  future.push(clone(current()));
  if (!replaceCurrent(target)) { undoHistory = beforeUndo; future = beforeFuture; }
}
function redo() {
  if (liveTextStyleBefore && !commitLiveTextStyleEdit('redo:textStyleEdit')) return;
  if (!future.length || !current()) return;
  const beforeUndo = clone(undoHistory), beforeFuture = clone(future);
  const target = future.pop();
  undoHistory.push(clone(current()));
  if (!replaceCurrent(target)) { undoHistory = beforeUndo; future = beforeFuture; }
}
function replaceCurrent(project) {
  if (!project || !currentId) return false;
  const before = clone(projects);
  syncProjectFileMetadata(project);
  projects = projects.map((p) => p.id === currentId ? project : p);
  if (!saveProjects('replaceCurrent')) { projects = before; showSaveError(); return false; }
  selectedId = selected(current())?.id || null;
  saveUiState('replaceCurrent');
  render();
  return true;
}
function withNewCurrent(project) {
  const error = projectNameError(project.name, project.id);
  if (error) { showProjectError(error); return false; }
  const before = clone(projects);
  const previousState = { currentId, selectedId, editingId, editBefore, undoHistory: clone(undoHistory), future: clone(future) };
  syncProjectFileMetadata(project);
  projects.unshift(project);
  currentId = project.id;
  selectedId = null; editingId = null; editBefore = null; undoHistory = []; future = [];
  if (!saveProjects('createProject')) {
    projects = before;
    currentId = previousState.currentId;
    selectedId = previousState.selectedId;
    editingId = previousState.editingId;
    editBefore = previousState.editBefore;
    undoHistory = previousState.undoHistory;
    future = previousState.future;
    showSaveError();
    return false;
  }
  saveUiState('createProject');
  updateProjectUrl(project);
  els.launcherProjectName.value = '';
  render();
  return true;
}
function current() { return currentId ? projects.find((project) => project.id === currentId) : undefined; }
function activePage(project) { return project?.pages.find((page) => page.id === project.activePageId) || project?.pages[0]; }
function selected(project) { return activePage(project)?.elements.find((element) => element.id === selectedId); }

function openProject(projectId) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) return false;
  project.updatedAt = Date.now();
  currentId = project.id;
  selectedId = restoredSelectedElementId(uiState, project.id); editingId = null; editBefore = null; undoHistory = []; future = [];
  saveProjects('openProject');
  saveUiState('openProject');
  updateProjectUrl(project);
  render();
  return true;
}
function closeProjectToLauncher() {
  currentId = undefined;
  selectedId = null; editingId = null; editBefore = null; undoHistory = []; future = [];
  saveUiState('closeProjectToLauncher');
  updateProjectUrl(null);
  render();
}
function initialProjectIdFromLocation() {
  return projectFromLocationPath()?.id;
}
function projectFromLocationPath() {
  const key = projectLocationKey(location.pathname);
  return key ? projects.find((project) => projectUrlKeys(project).includes(key)) : undefined;
}
function projectLocationKey(pathname) {
  const rawSegment = pathname.split('/').filter(Boolean)[0] || '';
  if (!rawSegment) return '';
  try { return slug(decodeURIComponent(rawSegment)); }
  catch { return slug(rawSegment); }
}
function projectUrlKeys(project) {
  const fileName = project.fileName || savedProjectFileName(project);
  return [project.id, project.name, fileName, fileName.replace(/\.[^.]+$/, '')]
    .filter(Boolean)
    .map((value) => slug(value));
}
function projectUrlPath(project) {
  return `/${slug(project.name || project.id || 'project')}`;
}
function updateProjectUrl(project) {
  if (!history?.pushState) return;
  const nextPath = project ? projectUrlPath(project) : '/';
  if (location.pathname !== nextPath) history.pushState(null, '', nextPath);
}

function pageGuideGrid(page) { return normalizeGuideGrid(page?.guideGrid); }
function pageBackground(page) { return BACKGROUNDS.find((background) => background.id === normalizeBackgroundId(page?.backgroundId, page?.background)) || BACKGROUNDS[0]; }
function normalizeBackgroundId(backgroundId, legacyBackground = '') {
  if (BACKGROUNDS.some((background) => background.id === backgroundId)) return backgroundId;
  return legacyBackground && legacyBackground !== '#ffffff' ? LEGACY_BACKGROUND_ID : BLANK_BACKGROUND_ID;
}
function setPageBackground(page, backgroundId) {
  page.backgroundId = normalizeBackgroundId(backgroundId);
  delete page.background;
}

function pageBackgroundImage(page) {
  return page?.backgroundImage?.type === 'image' && page.backgroundImage.src ? page.backgroundImage : null;
}

async function setBackgroundImageFile(file) {
  if (!file?.type?.startsWith('image/')) return;
  const src = await readFile(file);
  const ratio = await imageSourceRatio(src);
  mutate((project) => {
    const page = activePage(project);
    page.backgroundImage = { ...BACKGROUND_IMAGE_DEFAULT, src, naturalRatio: ratio, aspectRatio: ratio };
    fitBackgroundImageToCanvas(page, pageSize(page, project));
  });
  openBackgroundSettings();
}

function fitBackgroundImageToCanvas(page, size = pageSize(page)) {
  const backgroundImage = pageBackgroundImage(page);
  if (!backgroundImage) return;
  const pageRatio = size.width / size.height;
  const imageRatioValue = imageRatio(backgroundImage, backgroundImage, { width: size.width, height: size.height });
  backgroundImage.x = 50;
  backgroundImage.y = 50;
  backgroundImage.rotation = 0;
  backgroundImage.aspectLocked = true;
  backgroundImage.cropLeft = 0;
  backgroundImage.cropRight = 0;
  backgroundImage.cropTop = 0;
  backgroundImage.cropBottom = 0;
  if (imageRatioValue >= pageRatio) {
    backgroundImage.h = 100;
    backgroundImage.w = clamp((imageRatioValue / pageRatio) * 100, 1, 300, 100);
  } else {
    backgroundImage.w = 100;
    backgroundImage.h = clamp((pageRatio / imageRatioValue) * 100, 1, 300, 100);
  }
  lockImageRatioToCurrentSize(backgroundImage, { width: size.width, height: size.height });
}

function patchBackgroundImage(fn, live = false) {
  mutate((project) => {
    const backgroundImage = pageBackgroundImage(activePage(project));
    if (backgroundImage) fn(backgroundImage);
  }, !live);
}

function normalizeGuideGrid(grid) {
  const lines = Math.trunc(clamp(grid?.lines, GUIDE_GRID_MIN_LINES, GUIDE_GRID_MAX_LINES, GUIDE_GRID_DEFAULT.lines));
  return {
    visible: Boolean(grid?.visible) && lines > 0,
    lines: lines > 0 ? lines : 0,
  };
}

function createProject(name, templateId = 'blank') {
  const template = projectTemplate(templateId);
  const page = createPage('Page 1', template);
  const createdAt = Date.now();
  const project = { id: uid(), name: normalizedProjectName(name) || 'New Project', templateId: template.id, kind: template.kind, width: template.width, height: template.height, createdAt, updatedAt: createdAt, activePageId: page.id, pages: [page] };
  return syncProjectFileMetadata(project);
}
function createPage(name, template = projectTemplate('blank')) { return { id: uid(), name, width: template.width, height: template.height, backgroundId: BLANK_BACKGROUND_ID, guideGrid: { ...GUIDE_GRID_DEFAULT }, elements: [] }; }
function createProjectPage(project, name) { return createPage(name, { width: project.width, height: project.height, id: project.templateId || 'blank', name: project.templateId || 'Project', kind: project.kind || 'deck', aliases: [] }); }
function syncProjectFileMetadata(project) {
  project.createdAt ||= project.updatedAt || Date.now();
  project.name = normalizedProjectName(project.name) || 'New Project';
  project.fileName = savedProjectFileName(project);
  project.config = { ...(project.config || {}), savedFileName: project.fileName, savedAt: new Date(project.updatedAt || Date.now()).toISOString() };
  return project;
}
function savedProjectFileName(project) {
  return `${projectDateStamp(project.createdAt || project.updatedAt)}-${slug(project.name)}.${PROJECT_FILE_EXTENSION}`;
}
function projectDateStamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return projectDateStamp(Date.now());
  return date.toISOString().slice(0, 10);
}
function showProjectError(message) {
  console.error('Qwanvas project error:', message);
  if (typeof alert === 'function') alert(message);
}
function pageSize(page, project = current()) {
  return {
    width: canvasDimension(page?.width ?? project?.width, CANVAS_SIZE_DEFAULT.width),
    height: canvasDimension(page?.height ?? project?.height, CANVAS_SIZE_DEFAULT.height),
  };
}
