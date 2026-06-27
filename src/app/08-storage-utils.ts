function loadProjects() {
  const raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_STORE_KEY);
  if (!raw) return [];
  try {
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) throw new Error('Stored project list is not an array');
    const normalized = reconcileProjectIdentityConflicts(stored.map(normalizeStoredProject));
    try { localStorage.setItem(STORE_KEY, JSON.stringify(normalized)); } catch (saveError) { console.error('Could not persist reconciled Qwanvas project metadata', saveError); }
    return normalized;
  } catch (error) {
    console.error('Could not read Qwanvas projects; preserving raw storage', error);
    try { localStorage.setItem(`${STORE_KEY}.backup.${Date.now()}`, raw); localStorage.removeItem(STORE_KEY); } catch (backupError) { console.error('Could not back up corrupt Qwanvas project storage', backupError); }
    return null;
  }
}
function reconcileProjectIdentityConflicts(storedProjects) {
  const seenIds = new Set();
  const seenNames = new Set();
  const seenFiles = new Set();
  for (const project of storedProjects) {
    if (!project.id || seenIds.has(project.id)) project.id = uid();
    seenIds.add(project.id);
    const baseName = normalizedProjectName(project.name) || 'New Project';
    let candidate = baseName;
    let index = 2;
    while (seenNames.has(projectNameKey(candidate)) || seenFiles.has(savedProjectFileName({ ...project, name: candidate }))) {
      candidate = `${baseName} ${index}`;
      index += 1;
    }
    project.name = candidate;
    syncProjectFileMetadata(project);
    seenNames.add(projectNameKey(project.name));
    seenFiles.add(project.fileName);
  }
  return storedProjects;
}

function normalizeStoredProject(project) {
  if (!project || typeof project !== 'object' || !Array.isArray(project.pages)) return createRecoveredProject(project);
  const stored = clone(project);
  stored.name = normalizedProjectName(stored.name) || 'New Project';
  stored.createdAt ||= stored.updatedAt || Date.now();
  stored.updatedAt ||= stored.createdAt;
  stored.width = canvasDimension(stored.width, CANVAS_SIZE_DEFAULT.width);
  stored.height = canvasDimension(stored.height, CANVAS_SIZE_DEFAULT.height);
  stored.templateId = projectTemplate(stored.templateId).id;
  stored.kind = stored.kind === 'image' ? 'image' : 'deck';
  stored.pages = stored.pages.map((page, index) => ({
    ...page,
    id: page.id || uid(),
    name: page.name || `Page ${index + 1}`,
    width: canvasDimension(page.width, stored.width),
    height: canvasDimension(page.height, stored.height),
    backgroundId: normalizeBackgroundId(page.backgroundId, page.background),
    backgroundImage: normalizeBackgroundImage(page.backgroundImage, page),
    guideGrid: normalizeGuideGrid(page.guideGrid),
    elements: Array.isArray(page.elements) ? page.elements.map(normalizeStoredElement).filter(Boolean) : [],
  }));
  if (!stored.pages.length) stored.pages = [createPage('Page 1')];
  stored.activePageId = stored.pages.some((page) => page.id === stored.activePageId) ? stored.activePageId : stored.pages[0].id;
  return syncProjectFileMetadata(stored);
}
function normalizeStoredElement(element) {
  if (!element || !['text', 'image', 'shape'].includes(element.type)) return null;
  const defaults = storedElementGeometryDefaults(element.type);
  const stored = {
    ...element,
    x: canvasPercent(element.x, 0, 100, 50),
    y: canvasPercent(element.y, 0, 100, 50),
    w: canvasPercent(element.w ?? element.width, 1, defaults.maxSize, defaults.w),
    h: canvasPercent(element.h ?? element.height, 1, defaults.maxSize, defaults.h),
    rotation: clamp(element.rotation, -360, 360, 0),
  };
  if (stored.type === 'text') {
    stored.text = String(element.text || '');
    stored.fontSize = clamp(element.fontSize, TEXT_FONT_SIZE_MIN, TEXT_FONT_SIZE_MAX, TEXT_DEFAULT.fontSize);
    stored.color = String(element.color || TEXT_DEFAULT.color);
    stored.font = String(element.font || TEXT_DEFAULT.font);
    stored.bold = Boolean(element.bold);
    stored.italic = Boolean(element.italic);
  }
  if (stored.type === 'shape') stored.color = String(element.color || SHAPE_DEFAULT.color);
  if (stored.type === 'image') return { ...stored, src: safeImageSrc(element.src || ''), ...normalizeImageSettings(element, stored) };
  return stored;
}
function storedElementGeometryDefaults(type) {
  if (type === 'image') return { w: IMAGE_DEFAULT.w, h: IMAGE_DEFAULT.h, maxSize: 300 };
  if (type === 'shape') return { w: SHAPE_DEFAULT.w, h: SHAPE_DEFAULT.h, maxSize: 100 };
  return { w: TEXT_DEFAULT.w, h: TEXT_DEFAULT.h, maxSize: 100 };
}
function createRecoveredProject(raw) {
  const page = createPage('Recovered page');
  const createdAt = Date.now();
  return syncProjectFileMetadata({
    id: uid(),
    name: raw && typeof raw === 'object' && raw.name ? `${raw.name} (recovered)` : 'Recovered project',
    createdAt,
    updatedAt: createdAt,
    activePageId: page.id,
    pages: [page],
    recoveryData: raw ?? null,
  });
}
function saveProjects(operation = 'saveProjects') {
  try {
    projects.forEach(syncProjectFileMetadata);
    localStorage.setItem(STORE_KEY, JSON.stringify(projects));
    return true;
  } catch (error) {
    console.error('Could not save Qwanvas projects', { operation, error });
    return false;
  }
}
function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY) || localStorage.getItem(LEGACY_UI_STATE_KEY);
    if (!raw) return { currentProjectId: null, selectedByProject: {}, updatedAt: 0 };
    const state = JSON.parse(raw);
    return {
      currentProjectId: typeof state?.currentProjectId === 'string' ? state.currentProjectId : null,
      selectedByProject: state?.selectedByProject && typeof state.selectedByProject === 'object' ? state.selectedByProject : {},
      updatedAt: Number.isFinite(Number(state?.updatedAt)) ? Number(state.updatedAt) : 0,
    };
  } catch (error) {
    console.error('Could not read Qwanvas UI state', error);
    return { currentProjectId: null, selectedByProject: {}, updatedAt: 0 };
  }
}
function saveUiState(operation = 'saveUiState') {
  try {
    const selectedByProject = { ...(uiState?.selectedByProject || {}) };
    if (currentId) selectedByProject[currentId] = selectedId || null;
    uiState = { currentProjectId: currentId || null, selectedByProject, updatedAt: Date.now() };
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(uiState));
    return true;
  } catch (error) {
    console.error('Could not save Qwanvas UI state', { operation, error });
    return false;
  }
}
function restoredCurrentProjectId(uiState) {
  // Keep stored selection metadata, but start at the launcher unless the URL names a project.
  return undefined;
}
function restoredSelectedElementId(uiState, projectId) {
  const id = projectId ? uiState?.selectedByProject?.[projectId] : null;
  if (!id) return null;
  const project = projects.find((candidate) => candidate.id === projectId);
  return activePage(project)?.elements.some((element) => element.id === id) ? id : null;
}
function showSaveError() {
  if (typeof alert === 'function') alert('Could not save locally. Export the current project as HTML before refreshing.');
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function readTextFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(file); }); }
function loadImage(src): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }); }
function download(name, body, type) { downloadBlob(name, new Blob([body], { type })); }
function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project'; }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function escapeScriptJson(value) { return String(value).replace(/<\//g, '<\\/'); }
function safeImageSrc(value) {
  const src = String(value || '');
  if (/^data:image\/[^;,]+[;,]/i.test(src)) return src;
  if (/^(blob:|https:\/\/|\.\/|\/)/i.test(src)) return src;
  return '';
}
function registerServiceWorker() { if ('serviceWorker' in navigator && !/^127\.0\.0\.1:5173$|^localhost:5173$/.test(location.host)) navigator.serviceWorker.register('/sw.js').catch(() => {}); }
