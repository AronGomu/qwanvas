function startDrag(event) {
  if (event.target.isContentEditable) return;
  const node = event.currentTarget;
  const id = node.dataset.id;
  const project = current();
  const element = activePage(project).elements.find((el) => el.id === id);
  if (event.detail > 1 && element?.type === 'text') {
    event.preventDefault();
    startCanvasTextEdit(id);
    return;
  }
  const rect = els.canvas.getBoundingClientRect();
  const cropSide = [...event.target.classList].find((className) => className.startsWith('crop-'))?.replace('crop-', '');
  const mode = cropSide ? 'crop' : event.target.classList.contains('resize') ? 'resize' : event.target.classList.contains('rotate') ? 'rotate' : 'move';
  selectElement(id, { renderCanvasToo: false });
  node.focus({ preventScroll: true });
  drag = { mode, cropSide, id, startX: event.clientX, startY: event.clientY, rect, before: clone(project), element: clone(element) };
  node.setPointerCapture(event.pointerId);
  node.onpointermove = onDrag;
  node.onpointerup = node.onpointercancel = endDrag;
  event.preventDefault();
}

function onDrag(event) {
  if (!drag) return;
  const project = current();
  const element = activePage(project).elements.find((el) => el.id === drag.id);
  if (!element) return;
  if (drag.mode === 'move') {
    element.x = clamp(drag.element.x + ((event.clientX - drag.startX) / drag.rect.width) * 100, 0, 100);
    element.y = clamp(drag.element.y + ((event.clientY - drag.startY) / drag.rect.height) * 100, 0, 100);
  } else if (drag.mode === 'resize') {
    resizeElement(element, event);
  } else if (drag.mode === 'crop') {
    cropImageSide(element, event);
  } else {
    const cx = drag.rect.left + (element.x / 100) * drag.rect.width;
    const cy = drag.rect.top + (element.y / 100) * drag.rect.height;
    element.rotation = Math.round(Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI + 90);
  }
  project.updatedAt = Date.now();
  applyElementStyle(element);
  syncGeometryControls(element);
}

function resizeElement(element, event) {
  const nextW = clamp(drag.element.w + ((event.clientX - drag.startX) / drag.rect.width) * 100, 3, 100);
  const nextH = clamp(drag.element.h + ((event.clientY - drag.startY) / drag.rect.height) * 100, 3, 100);
  if (element.type !== 'image') {
    setElementSize(element, { w: nextW, h: nextH, from: drag.element });
    return;
  }
  setElementSize(element, { ...lockedDragSize(element, nextW, nextH, drag.element, drag.rect), from: drag.element, rect: drag.rect });
}

function cropImageSide(element, event) {
  if (element.type !== 'image' || !drag.cropSide) return;
  const start = drag.element;
  const deltaCanvas = drag.cropSide === 'left' || drag.cropSide === 'right'
    ? ((event.clientX - drag.startX) / drag.rect.width) * 100
    : ((event.clientY - drag.startY) / drag.rect.height) * 100;
  const sideSign = drag.cropSide === 'left' || drag.cropSide === 'top' ? 1 : -1;
  setImageCropFromStart(element, drag.cropSide, imageCrop(start, `crop${capitalize(drag.cropSide)}`) + sideSign * cropDeltaFromCanvas(start, drag.cropSide, deltaCanvas), start, drag.rect);
}

function setImageCropControl(element, field, value) {
  if (element.type !== 'image') return;
  const side = field.replace('crop', '').toLowerCase();
  setImageCropFromStart(element, side, value, clone(element), els.canvas.getBoundingClientRect());
}

function setImageCropFromStart(element, side, value, start, rect) {
  const startCrop = imageCropBox(start);
  const horizontal = side === 'left' || side === 'right';
  const opposite = side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'top' ? 'bottom' : 'top';
  const nextCrop = { ...startCrop, [side]: clamp(value, 0, 90 - startCrop[opposite]) };
  const startVisible = horizontal ? imageVisiblePercent(startCrop.left + startCrop.right) : imageVisiblePercent(startCrop.top + startCrop.bottom);
  const nextVisible = horizontal ? imageVisiblePercent(nextCrop.left + nextCrop.right) : imageVisiblePercent(nextCrop.top + nextCrop.bottom);
  const startSize = horizontal ? start.w : start.h;
  const nextSize = clamp(startSize * (nextVisible / startVisible), 3, 100);
  if (horizontal) {
    const leftEdge = start.x - start.w / 2;
    const rightEdge = start.x + start.w / 2;
    element.w = nextSize;
    element.x = side === 'left' ? rightEdge - nextSize / 2 : leftEdge + nextSize / 2;
  } else {
    const topEdge = start.y - start.h / 2;
    const bottomEdge = start.y + start.h / 2;
    element.h = nextSize;
    element.y = side === 'top' ? bottomEdge - nextSize / 2 : topEdge + nextSize / 2;
  }
  element.cropLeft = nextCrop.left;
  element.cropRight = nextCrop.right;
  element.cropTop = nextCrop.top;
  element.cropBottom = nextCrop.bottom;
  lockImageRatioToCurrentSize(element, rect);
}

function cropDeltaFromCanvas(start, side, deltaCanvas) {
  const crop = imageCropBox(start);
  const horizontal = side === 'left' || side === 'right';
  const visible = horizontal ? imageVisiblePercent(crop.left + crop.right) : imageVisiblePercent(crop.top + crop.bottom);
  const size = horizontal ? start.w : start.h;
  return deltaCanvas / size * visible;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function elementStyle(element) {
  const cropVars = element.type === 'image' ? cropStyleVars(element) : '';
  return `--x:${element.x};--y:${element.y};--w:${element.w};--h:${element.h};--r:${element.rotation || 0};--element-color:${element.color || '#fff'};${cropVars}z-index:${element.z || 1}`;
}

function cropStyleVars(element) {
  const crop = imageCropBox(element);
  const visibleX = imageVisiblePercent(crop.left + crop.right);
  const visibleY = imageVisiblePercent(crop.top + crop.bottom);
  const imageW = 10000 / visibleX;
  const imageH = 10000 / visibleY;
  const offsetX = -(crop.left / visibleX) * 100;
  const offsetY = -(crop.top / visibleY) * 100;
  return `--crop-left:${crop.left}%;--crop-right:${crop.right}%;--crop-top:${crop.top}%;--crop-bottom:${crop.bottom}%;--crop-img-w:${imageW}%;--crop-img-h:${imageH}%;--crop-offset-x:${offsetX}%;--crop-offset-y:${offsetY}%;`;
}

function applyElementStyle(element) {
  const node = els.canvas.querySelector(`[data-id="${CSS.escape(element.id)}"]`);
  if (!node) return;
  node.style.cssText = elementStyle(element);
  if (element.type === 'text') applyTextStyle(node.querySelector('.text-content'), element);
}

function applyTextStyle(text, element) {
  if (!text) return;
  Object.assign(text.style, { fontSize: `calc(${element.fontSize || TEXT_DEFAULT.fontSize} / var(--page-width, ${CANVAS_SIZE_DEFAULT.width}) * 100cqw)`, fontFamily: element.font || 'Inter', fontWeight: element.bold ? '800' : '500', fontStyle: element.italic ? 'italic' : 'normal', color: element.color || '#fff' });
}

function syncGeometryControls(element) {
  els.xControl.value = Math.round(element.x);
  els.yControl.value = Math.round(element.y);
  els.wControl.value = Math.round(element.w);
  els.hControl.value = Math.round(element.h);
  els.rotationControl.value = element.rotation || 0;
  if (element.type === 'text') els.fontSizeControl.value = element.fontSize || TEXT_DEFAULT.fontSize;
}

function endDrag(event) {
  event.currentTarget.onpointermove = event.currentTarget.onpointerup = event.currentTarget.onpointercancel = null;
  if (drag) {
    const idToFocus = drag.id;
    const changed = JSON.stringify(drag.before) !== JSON.stringify(current());
    if (changed) { undoHistory.push(drag.before); future = []; }
    drag = null;
    if (changed) {
      if (!saveProjects('endDrag')) showSaveError();
      saveUiState('endDrag');
      render();
    }
    requestAnimationFrame(() => els.canvas.querySelector(`[data-id="${CSS.escape(idToFocus)}"]`)?.focus({ preventScroll: true }));
  }
}

function mutate(fn, record = true, operation = 'mutate') {
  if (!current()) return;
  const beforeProject = clone(current());
  const beforeProjects = clone(projects);
  const beforeHistory = clone(undoHistory);
  const beforeFuture = clone(future);
  fn(current());
  current().updatedAt = Date.now();
  if (record) { undoHistory.push(beforeProject); future = []; }
  if (!saveProjects(operation)) {
    projects = beforeProjects;
    undoHistory = beforeHistory;
    future = beforeFuture;
    showSaveError();
  } else {
    saveUiState(operation);
  }
  render();
}

function patchSelected(fn, live = false) {
  if (!selectedId) return;
  mutate((project) => { const element = selected(project); if (element) fn(element); }, !live);
}

async function addImageFile(file, position = IMAGE_DEFAULT) {
  if (!file?.type?.startsWith('image/')) return;
  const src = await readFile(file);
  const ratio = await imageSourceRatio(src);
  addElement({ type: 'image', src, ...IMAGE_DEFAULT, naturalRatio: ratio, aspectRatio: ratio, ...position });
}

async function imageSourceRatio(src): Promise<number> {
  try {
    const img = await loadImage(src);
    return imageRatioFromSize(img.naturalWidth, img.naturalHeight);
  } catch {
    return IMAGE_DEFAULT.naturalRatio;
  }
}

function imageRatioFromSize(width, height) {
  return clamp(width / height, .05, 20, IMAGE_DEFAULT.naturalRatio);
}

function imageAspectLocked(element) {
  return element.aspectLocked !== false;
}

function imageCrop(element, field) {
  const legacyFallbacks = { cropLeft: element.cropX, cropRight: element.cropX, cropTop: element.cropY, cropBottom: element.cropY };
  return clamp(element[field], 0, 90, legacyFallbacks[field] || 0);
}

function imageCropBox(element) {
  return {
    left: imageCrop(element, 'cropLeft'),
    right: imageCrop(element, 'cropRight'),
    top: imageCrop(element, 'cropTop'),
    bottom: imageCrop(element, 'cropBottom'),
  };
}

function imageVisiblePercent(totalCrop) {
  return clamp(100 - totalCrop, 10, 100, 100);
}

function imageRatio(element, fallback = element, rect = els.canvas.getBoundingClientRect()) {
  return clamp(element.aspectRatio, .05, 20, widthHeightRatio(fallback, rect));
}

function widthHeightRatio(element, rect = CANVAS_SIZE_DEFAULT) {
  return clamp((element.w * rect.width) / (element.h * rect.height), .05, 20, IMAGE_DEFAULT.naturalRatio);
}

function setElementSize(element, { w = element.w, h = element.h, source, from, rect = els.canvas.getBoundingClientRect(), max = 100 }: any = {}) {
  const resizeFrom = from || { w: element.w, h: element.h, fontSize: element.fontSize };
  if (element.type === 'text') {
    scaleTextFontForSize(element, resizeFrom, source, { w, h, max });
    return;
  }
  if (element.type !== 'image' || isUnlockedBackgroundImage(element)) {
    element.w = clamp(w, 3, max);
    element.h = clamp(h, 3, max);
    return;
  }
  const ratio = imageRatio(element, element, rect);
  if (source === 'h') {
    element.h = clamp(h, 3, max);
    element.w = heightToWidth(element.h, ratio, rect);
    if (element.w < 3 || element.w > max) {
      element.w = clamp(element.w, 3, max);
      element.h = clamp(widthToHeight(element.w, ratio, rect), 3, max);
    }
    return;
  }
  element.w = clamp(w, 3, max);
  element.h = widthToHeight(element.w, ratio, rect);
  if (element.h < 3 || element.h > max) {
    element.h = clamp(element.h, 3, max);
    element.w = clamp(heightToWidth(element.h, ratio, rect), 3, max);
  }
}

function isUnlockedBackgroundImage(element) {
  const project = current();
  return Boolean(project && activePage(project)?.backgroundImage === element && !imageAspectLocked(element));
}

function scaleTextFontForSize(element, from = element, source, target = element) {
  const max = target.max || 100;
  const startW = clamp(from.w, 3, max, TEXT_DEFAULT.w);
  const startH = clamp(from.h, 3, max, TEXT_DEFAULT.h);
  const startFontSize = clamp(from.fontSize, TEXT_FONT_SIZE_MIN, TEXT_FONT_SIZE_MAX, TEXT_DEFAULT.fontSize);
  const widthScale = clamp(target.w, 3, max, startW) / startW;
  const heightScale = clamp(target.h, 3, max, startH) / startH;
  const requestedScale = source === 'w' ? widthScale : source === 'h' ? heightScale : Math.max(widthScale, heightScale);
  const scale = clamp(requestedScale, Math.max(3 / startW, 3 / startH), Math.min(max / startW, max / startH), 1);
  element.w = clamp(startW * scale, 3, max);
  element.h = clamp(startH * scale, 3, max);
  element.fontSize = Math.round(clamp(startFontSize * scale, TEXT_FONT_SIZE_MIN, TEXT_FONT_SIZE_MAX, startFontSize));
}

function lockImageRatioToCurrentSize(element, rect = els.canvas.getBoundingClientRect()) {
  element.aspectRatio = widthHeightRatio(element, rect);
}

function lockedDragSize(element, nextW, nextH, start, rect) {
  const ratio = imageRatio(element, start, rect);
  const heightPerWidth = widthToHeight(1, ratio, rect);
  const deltaW = nextW - start.w;
  const deltaH = nextH - start.h;
  const projectedDeltaW = (deltaW + heightPerWidth * deltaH) / (1 + heightPerWidth ** 2);
  return { w: start.w + projectedDeltaW, h: start.h + projectedDeltaW * heightPerWidth };
}

function widthToHeight(width, ratio, rect) {
  return width * (rect.width / rect.height) / ratio;
}

function heightToWidth(height, ratio, rect) {
  return height * ratio * (rect.height / rect.width);
}

function handleCanvasDrag(event) {
  if (!hasImageFile(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  els.canvas.classList.add('drag-over');
}

function handleCanvasDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  els.canvas.classList.remove('drag-over');
}

async function handleCanvasDrop(event) {
  els.canvas.classList.remove('drag-over');
  const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith('image/'));
  if (!file) return;
  event.preventDefault();
  await addImageFile(file, canvasPoint(event));
}

function hasImageFile(dataTransfer) {
  return [...(dataTransfer?.items || [])].some((item) => item.kind === 'file' && item.type.startsWith('image/'))
    || [...(dataTransfer?.files || [])].some((file) => file.type.startsWith('image/'));
}

function canvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100, 50),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100, 58),
  };
}

function addElement(base) {
  if (!current()) return;
  let addedElementId = null;
  mutate((project) => {
    const page = activePage(project);
    const z = Math.max(0, ...page.elements.map((el) => el.z || 1)) + 1;
    const element = { id: uid(), z, ...base };
    page.elements.push(element);
    selectedId = element.id;
    addedElementId = element.id;
  });
  if (base.type === 'text' && addedElementId) requestAnimationFrame(() => startCanvasTextEdit(addedElementId));
}
