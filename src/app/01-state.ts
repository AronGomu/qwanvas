const STORE_KEY = 'qwanvas.projects.v1';
const UI_STATE_KEY = 'qwanvas.uiState.v1';
const LEGACY_STORE_KEY = 'lightslidesai.projects.v1';
const LEGACY_UI_STATE_KEY = 'lightslidesai.uiState.v1';
const PROJECT_FILE_EXTENSION = 'html';
const BLANK_BACKGROUND_ID = 'blank';
const LEGACY_BACKGROUND_ID = 'aurora-grid';
const LEGACY_BACKGROUND = 'linear-gradient(145deg, #16213e, #0f172a)';
const BACKGROUNDS = [
  { id: BLANK_BACKGROUND_ID, name: 'Blank page', css: '#ffffff', overlay: '' },
  { id: LEGACY_BACKGROUND_ID, name: 'Aurora grid', css: LEGACY_BACKGROUND, overlay: 'grid' },
] satisfies readonly BackgroundOption[];
const CANVAS_SIZE_DEFAULT = { width: 1080, height: 1350 } satisfies CanvasSize;
const COMMAND_PREFIX = '/';
const PROJECT_TEMPLATES = [
  { id: 'blank', name: 'Blank project', kind: 'deck', width: CANVAS_SIZE_DEFAULT.width, height: CANVAS_SIZE_DEFAULT.height, aliases: ['blank', 'deck'] },
  { id: 'linkedin-post', name: 'LinkedIn post', kind: 'image', width: 1200, height: 1200, aliases: ['linkedin post', 'linkedin square', 'post', 'square'] },
  { id: 'linkedin-carousel', name: 'LinkedIn carousel', kind: 'deck', width: 1200, height: 1500, aliases: ['linkedin carousel', 'linkedin caroussel', 'carousel', 'caroussel', 'linkedin deck', 'deck'] },
  { id: 'youtube-thumbnail', name: 'YouTube thumbnail', kind: 'image', width: 1280, height: 720, aliases: ['youtube thumbnail', 'youtube', 'thumbnail', 'yt thumbnail'] },
] satisfies readonly ProjectTemplate[];
const TEXT_DEFAULT = { type: 'text', text: '**Double-click** to edit', x: 50, y: 42, w: 62, h: 12, fontSize: 48, color: '#111827', font: 'Inter', bold: false, italic: false, rotation: 0 } as any;
const TEXT_FONT_SIZE_MIN = 8;
const TEXT_FONT_SIZE_MAX = 600;
const SHAPE_DEFAULT = { type: 'shape', x: 50, y: 62, w: 42, h: 18, color: '#74a6ff', rotation: 0 } as any;
const IMAGE_DEFAULT = { x: 50, y: 58, w: 52, h: 30, rotation: 0, aspectLocked: true, naturalRatio: 1, aspectRatio: 1, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 } as any;
const BACKGROUND_IMAGE_DEFAULT = { type: 'image', x: 50, y: 50, w: 100, h: 100, rotation: 0, aspectLocked: true, naturalRatio: 1, aspectRatio: 1, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 } as any;
const GUIDE_GRID_MIN_LINES = 0;
const GUIDE_GRID_MAX_LINES = 5;
const GUIDE_GRID_DEFAULT = { visible: false, lines: 2 };
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const SELECTION_TOOLBAR_EDGE_THRESHOLD = 88;
const SELECTION_TOOLBAR_OFFSET = 0.8;
const INSPECTOR_PANEL_MIN_WIDTH = 280;
const INSPECTOR_PANEL_MAX_WIDTH = 720;
const INSPECTOR_PANEL_WIDTH_STEP = 24;
const ALIGNMENT_ACTIONS = [
  { id: 'align-left', title: 'Align selected left', detail: 'Move the selected element to the left edge of the canvas', shortcut: 'Alt+[', keywords: 'align left edge horizontal', axis: 'x', position: 'start', icon: '⇤' },
  { id: 'align-center', title: 'Align selected center', detail: 'Center the selected element horizontally on the canvas', shortcut: 'Alt+\\', keywords: 'align center horizontal middle', axis: 'x', position: 'center', icon: '↔' },
  { id: 'align-right', title: 'Align selected right', detail: 'Move the selected element to the right edge of the canvas', shortcut: 'Alt+]', keywords: 'align right edge horizontal', axis: 'x', position: 'end', icon: '⇥' },
  { id: 'align-top', title: 'Align selected top', detail: 'Move the selected element to the top edge of the canvas', shortcut: 'Shift+Alt+[', keywords: 'align top edge vertical', axis: 'y', position: 'start', icon: '⤒' },
  { id: 'align-middle', title: 'Align selected middle', detail: 'Center the selected element vertically on the canvas', shortcut: 'Shift+Alt+\\', keywords: 'align middle vertical center', axis: 'y', position: 'center', icon: '↕' },
  { id: 'align-bottom', title: 'Align selected bottom', detail: 'Move the selected element to the bottom edge of the canvas', shortcut: 'Shift+Alt+]', keywords: 'align bottom edge vertical', axis: 'y', position: 'end', icon: '⤓' },
] satisfies readonly AlignmentAction[];
const uid = (): Id => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (value: unknown, min: number, max: number, fallback = min): number => {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
};
const $ = (id: string): DomElement => document.getElementById(id) as DomElement;

const loadedProjects = loadProjects();
let uiState = loadUiState();
const storageRecoveryNeeded = loadedProjects === null;
let projects: Project[] = loadedProjects || [];
let currentId: Id | undefined = initialProjectIdFromLocation() || restoredCurrentProjectId(uiState);
let selectedId: Id | null = restoredSelectedElementId(uiState, currentId);
let editingId: Id | null = null;
let editBefore: Project | null = null;
let undoHistory: Project[] = [];
let future: Project[] = [];
let drag: DragState | null = null;
let activeCommandIndex = 0;
let commandPaletteMode: CommandPaletteMode = null;
let commandPaletteReturnFocus: HTMLElement | null = null;
let shortcutHelpReturnFocus: HTMLElement | null = null;
let settingsMenuReturnFocus: HTMLElement | null = null;
let projectNameDialogReturnFocus: HTMLElement | null = null;
let projectNameDialogSubmit: ((name: string) => void) | null = null;
let projectNameDialogExcludeId: Id | null = null;
let backgroundSettingsReturnFocus: HTMLElement | null = null;
let templateDialogReturnFocus: HTMLElement | null = null;
let pendingTemplateProjectName = '';
let activeTemplateIndex = 0;
let launcherActiveProjectIndex = 0;
let textInspectorAutoFocused = false;
let canvasZoom = 1;
let inspectorResize: { startX: number; startWidth: number } | null = null;

const els = {
  appShell: $('appShell'), projectLauncher: $('projectLauncher'), launcherProjectName: $('launcherProjectName'), launcherProjectNameError: $('launcherProjectNameError'), launcherCreateProjectBtn: $('launcherCreateProjectBtn'), launcherRecentProjects: $('launcherRecentProjects'), launcherImportProjectInput: $('launcherImportProjectInput'), stageWrap: $('stageWrap'), canvas: $('canvas'), pageStrip: $('pageStrip'), projectName: $('projectName'),
  inspectorResizeHandle: $('inspectorResizeHandle'), emptyInspector: $('emptyInspector'), elementInspector: $('elementInspector'),
  textControl: $('textControl'), xControl: $('xControl'), yControl: $('yControl'), wControl: $('wControl'), hControl: $('hControl'),
  rotationControl: $('rotationControl'),
  cropFields: $('cropFields'), cropTopControl: $('cropTopControl'), cropBottomControl: $('cropBottomControl'),
  fontSizeControl: $('fontSizeControl'), colorControl: $('colorControl'), fontControl: $('fontControl'),
  undoBtn: $('undoBtn'), redoBtn: $('redoBtn'), imageInput: $('imageInput'), backgroundImageInput: $('backgroundImageInput'),
  backgroundSettingsPanel: $('backgroundSettingsPanel'), closeBackgroundSettingsBtn: $('closeBackgroundSettingsBtn'), chooseBackgroundImageBtn: $('chooseBackgroundImageBtn'), backgroundSettingsEmpty: $('backgroundSettingsEmpty'), backgroundSettingsControls: $('backgroundSettingsControls'),
  backgroundXControl: $('backgroundXControl'), backgroundYControl: $('backgroundYControl'), backgroundWControl: $('backgroundWControl'), backgroundHControl: $('backgroundHControl'), backgroundAspectLinkIndicator: $('backgroundAspectLinkIndicator'), backgroundAspectLockControl: $('backgroundAspectLockControl'), resetBackgroundImageBtn: $('resetBackgroundImageBtn'), clearBackgroundImageBtn: $('clearBackgroundImageBtn'),
  commandPalette: $('commandPalette'), commandDialog: $('commandDialog'), commandSearch: $('commandSearch'), commandList: $('commandList'), commandStatus: $('commandStatus'),
  templateModal: $('templateModal'), templateDialog: $('templateDialog'), templateList: $('templateList'), templateDialogHint: $('templateDialogHint'),
  projectNameModal: $('projectNameModal'), projectNameDialog: $('projectNameDialog'), projectNameDialogTitle: $('projectNameDialogTitle'), projectNameDialogHint: $('projectNameDialogHint'), projectNameDialogInput: $('projectNameDialogInput'), projectNameDialogError: $('projectNameDialogError'), projectNameCancelBtn: $('projectNameCancelBtn'), projectNameSubmitBtn: $('projectNameSubmitBtn'),
  shortcutHelp: $('shortcutHelp'), shortcutHelpDialog: $('shortcutHelpDialog'), closeShortcutHelpBtn: $('closeShortcutHelpBtn'),
  settingsMenu: $('settingsMenu'), settingsMenuBtn: $('settingsMenuBtn'),
  statusProjectName: $('statusProjectName'), statusResolution: $('statusResolution'), statusPageCount: $('statusPageCount'), statusZoomInput: $('statusZoomInput'), zoomOutBtn: $('zoomOutBtn'), zoomInBtn: $('zoomInBtn'),
  statusCommandShortcut: $('statusCommandShortcut'), statusHelpShortcut: $('statusHelpShortcut'), statusSettingsShortcut: $('statusSettingsShortcut'), helpCommandShortcut: $('helpCommandShortcut'), helpSettingsShortcut: $('helpSettingsShortcut'), settingsCommandShortcut: $('settingsCommandShortcut'),
};

wire();
render();
registerServiceWorker();
