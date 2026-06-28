type Id = string;

type ProjectTemplateKind = 'deck' | 'image';

type Axis = 'x' | 'y';
type AlignmentPosition = 'start' | 'center' | 'end';
type ElementType = 'text' | 'shape' | 'image';
type CommandPaletteMode = any;

type DomElement = any;

interface CanvasSize {
  width: number;
  height: number;
}

interface BackgroundOption {
  id: string;
  name: string;
  css: string;
  overlay: '' | 'grid';
}

interface ProjectTemplate extends CanvasSize {
  id: string;
  name: string;
  kind: ProjectTemplateKind;
  aliases: readonly string[];
}

interface GuideGrid {
  visible: boolean;
  lines: number;
}

interface BaseElement {
  id: Id;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z?: number;
}

interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  font: string;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  backgroundOpacity?: number;
  border?: string;
  borderColor?: string;
  borderRadius?: number;
  borderPadding?: number;
}

interface ShapeElement extends BaseElement {
  type: 'shape';
  color: string;
}

interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  aspectLocked: boolean;
  naturalRatio: number;
  aspectRatio: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
}

type ProjectElement = TextElement | ShapeElement | ImageElement;
type ElementDraft = Partial<ProjectElement> & { type: ElementType };
type BackgroundImage = ImageElement;

interface Page extends CanvasSize {
  id: Id;
  name: string;
  backgroundId: string;
  background?: string;
  backgroundImage?: BackgroundImage;
  elements: ProjectElement[];
  guideGrid?: GuideGrid;
}

interface Project extends CanvasSize {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
  activePageId: Id;
  pages: Page[];
  fileName?: string;
  sourceFileName?: string;
}

interface AlignmentAction {
  id: string;
  title: string;
  detail: string;
  shortcut: string;
  keywords: string;
  axis: Axis;
  position: AlignmentPosition;
  icon: string;
}

interface Command {
  id: string;
  title: string;
  detail: string;
  shortcut: string | (() => string);
  keywords: string;
  needsSelection?: boolean;
  canApply?: (element: ProjectElement | undefined | null) => boolean;
  opensSurface?: boolean;
  axis?: Axis;
  position?: AlignmentPosition;
  icon?: string;
  run: (...args: any[]) => any;
}

type DragState = any;
