if (location.protocol.startsWith('http')) {
  document.querySelectorAll('img[src^="file:///"]').forEach((img) => {
    img.src = '/__asset?src=' + encodeURIComponent(img.getAttribute('src'));
  });
}

const slides = [...document.querySelectorAll('.slide')];
let i = 0;
let selected;

function show(n) {
  i = (n + slides.length) % slides.length;
  slides.forEach((slide, k) => slide.classList.toggle('active', k === i));
}
document.querySelector('[data-prev]').onclick = () => show(i - 1);
document.querySelector('[data-next]').onclick = () => show(i + 1);
onkeydown = (event) => {
  if (event.target?.isContentEditable) return;
  if (event.key === 'ArrowLeft') show(i - 1);
  if (event.key === 'ArrowRight') show(i + 1);
};
if (location.search.includes('live')) new EventSource('/events').onmessage = () => location.reload();

if (location.protocol.startsWith('http')) setupCanvasEditor();

function setupCanvasEditor() {
  const bar = document.createElement('div');
  bar.className = 'editor-bar';
  bar.innerHTML = `
    <button type="button" data-add-text>Text</button>
    <button type="button" data-add-code>Code</button>
    <label class="upload-button">Image<input data-add-image type="file" accept="image/*"></label>
    <label>Size <input data-font-size type="number" min="8" max="120" value="32"></label>
    <input data-color type="color" value="#f2f4f8" aria-label="Text color">
    <button type="button" data-bold><b>B</b></button>
    <button type="button" data-italic><i>I</i></button>
    <button type="button" data-back>Back</button>
    <button type="button" data-front>Front</button>
    <button type="button" data-save-layout>Save</button>
    <span class="editor-help">edit text directly · drag ⠿ · resize ◢</span>
    <output></output>`;
  document.body.append(bar);

  const status = bar.querySelector('output');
  document.querySelectorAll('.image-slot, .editable-text, .canvas-element').forEach(prepareElement);

  bar.querySelector('[data-add-text]').onclick = () => selectBox(addElement('text'));
  bar.querySelector('[data-add-code]').onclick = () => selectBox(addElement('code'));
  bar.querySelector('[data-add-image]').onchange = (event) => uploadImage(event, status);
  bar.querySelector('[data-font-size]').oninput = (event) => applySelected({ fontSize: `${event.target.value}px` });
  bar.querySelector('[data-color]').oninput = (event) => applySelected({ color: event.target.value });
  bar.querySelector('[data-bold]').onclick = () => toggleSelected('bold');
  bar.querySelector('[data-italic]').onclick = () => toggleSelected('italic');
  bar.querySelector('[data-back]').onclick = () => bumpZ(-1);
  bar.querySelector('[data-front]').onclick = () => bumpZ(1);
  bar.querySelector('[data-save-layout]').onclick = async () => {
    status.textContent = 'Saving…';
    const response = await fetch('/__save-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-carousel-save-token': window.__CAROUSEL_SAVE_TOKEN__ || '' },
      body: JSON.stringify({ slides: readSlides() }),
    });
    status.textContent = response.ok ? 'Saved to spec.md' : 'Save failed';
  };
}

function prepareElement(box) {
  box.classList.add('canvas-element', 'editable-box');
  box.dataset.elementId ||= box.dataset.kind ? `${box.dataset.kind}-${box.dataset.slide}` : crypto.randomUUID();
  box.dataset.type ||= box.classList.contains('image-slot') ? 'image' : box.tagName === 'PRE' ? 'code' : 'text';
  if (box.dataset.type !== 'image') {
    box.contentEditable = 'true';
    box.spellcheck = false;
  }
  if (!box.querySelector(':scope > .move-handle')) {
    const move = document.createElement('button');
    move.className = 'move-handle';
    move.type = 'button';
    move.textContent = '⠿';
    move.ariaLabel = 'Move element';
    box.prepend(move);
  }
  if (!box.querySelector(':scope > .resize-handle')) {
    const resize = document.createElement('button');
    resize.className = 'resize-handle';
    resize.type = 'button';
    resize.ariaLabel = 'Resize element';
    box.append(resize);
  }
  box.tabIndex = 0;
  box.role = 'button';
  box.ariaLabel = `${box.dataset.type} element. Arrow keys move; Shift plus arrow resizes.`;
  box.addEventListener('pointerdown', startPointerEdit);
  box.addEventListener('click', () => selectBox(box));
  box.addEventListener('focus', () => selectBox(box));
  box.addEventListener('keydown', handleElementKeydown);
}

function addElement(type, data = {}) {
  const slide = document.querySelector('.slide.active');
  const isImage = type === 'image';
  const tag = isImage ? 'div' : type === 'code' ? 'pre' : 'div';
  const box = document.createElement(tag);
  box.className = `canvas-element editable-box ${isImage ? 'image-slot' : 'editable-text is-positioned'} ${type === 'code' ? 'code-element' : ''}`;
  box.dataset.elementId = crypto.randomUUID();
  box.dataset.type = type;
  box.dataset.slide = slide.dataset.slide;
  Object.assign(box.style, {
    left: data.x || '50%', top: data.y || '50%', width: data.width || (isImage ? '55%' : '70%'), height: data.height || (isImage ? '35%' : '12%'),
    zIndex: data.zIndex || nextZ(slide), fontSize: data.fontSize || (type === 'code' ? '22px' : '32px'), color: data.color || 'var(--text)',
  });
  if (isImage) box.innerHTML = `<img src="${data.src || ''}" alt="">`;
  else box.textContent = type === 'code' ? '{\n  "edit": "me"\n}' : 'Double-click and edit me';
  slide.append(box);
  prepareElement(box);
  return box;
}

function uploadImage(event, status) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    selectBox(addElement('image', { src: reader.result }));
    status.textContent = 'Image added — save to keep';
    event.target.value = '';
  };
  reader.readAsDataURL(file);
}

function startPointerEdit(event) {
  const box = event.currentTarget;
  const isHandle = event.target.classList.contains('resize-handle') || event.target.classList.contains('move-handle');
  const isImageMove = box.dataset.type === 'image' && event.target.tagName === 'IMG';
  if (!isHandle && !isImageMove) return;
  const resize = event.target.classList.contains('resize-handle');
  const slide = box.closest('.slide');
  const slideRect = slide.getBoundingClientRect();
  const start = readGeometry(box);
  selectBox(box);
  box.setPointerCapture(event.pointerId);
  event.preventDefault();

  box.onpointermove = (move) => {
    const dx = ((move.clientX - event.clientX) / slideRect.width) * 100;
    const dy = ((move.clientY - event.clientY) / slideRect.height) * 100;
    const next = resize
      ? clampGeometry({ ...start, width: start.width + dx, height: start.height + dy })
      : clampGeometry({ ...start, x: start.x + dx, y: start.y + dy });
    applyGeometry(box, next);
  };
  box.onpointerup = box.onpointercancel = () => {
    box.onpointermove = box.onpointerup = box.onpointercancel = null;
  };
}

function handleElementKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const box = event.currentTarget;
  const start = readGeometry(box);
  const delta = event.shiftKey ? 2 : 1;
  const changes = {
    ArrowLeft: event.shiftKey ? { width: start.width - delta } : { x: start.x - delta },
    ArrowRight: event.shiftKey ? { width: start.width + delta } : { x: start.x + delta },
    ArrowUp: event.shiftKey ? { height: start.height - delta } : { y: start.y - delta },
    ArrowDown: event.shiftKey ? { height: start.height + delta } : { y: start.y + delta },
  };
  event.preventDefault();
  selectBox(box);
  applyGeometry(box, clampGeometry({ ...start, ...changes[event.key] }));
}

function selectBox(box) {
  document.querySelectorAll('.editable-box.selected').forEach((item) => item.classList.remove('selected'));
  selected = box;
  box.classList.add('selected');
  syncToolbar(box);
}

function syncToolbar(box) {
  const bar = document.querySelector('.editor-bar');
  if (!bar || box.dataset.type === 'image') return;
  const style = getComputedStyle(box);
  bar.querySelector('[data-font-size]').value = Math.round(parseFloat(style.fontSize));
  const color = rgbToHex(style.color);
  if (color) bar.querySelector('[data-color]').value = color;
}

function applySelected(style) {
  if (!selected || selected.dataset.type === 'image') return;
  Object.assign(selected.style, style);
}

function toggleSelected(kind) {
  if (!selected || selected.dataset.type === 'image') return;
  if (kind === 'bold') selected.style.fontWeight = Number(getComputedStyle(selected).fontWeight) >= 700 ? '400' : '800';
  if (kind === 'italic') selected.style.fontStyle = getComputedStyle(selected).fontStyle === 'italic' ? 'normal' : 'italic';
}

function bumpZ(delta) {
  if (!selected) return;
  selected.style.zIndex = String(Math.max(0, Math.min(99, (Number.parseInt(getComputedStyle(selected).zIndex) || 3) + delta)));
}

function readSlides() {
  return slides.map((slide) => ({
    slide: Number(slide.dataset.slide),
    elements: [...slide.querySelectorAll('.canvas-element')].filter((el) => !el.classList.contains('move-handle') && !el.classList.contains('resize-handle')).map(readElement),
  }));
}

function readElement(box) {
  const geometry = readGeometry(box);
  const style = getComputedStyle(box);
  const type = box.dataset.type || 'text';
  return {
    id: box.dataset.elementId,
    type,
    x: pct(geometry.x), y: pct(geometry.y), width: pct(geometry.width), height: pct(geometry.height),
    zIndex: Number.parseInt(style.zIndex) || 3,
    text: type === 'image' ? '' : cleanEditorText(box.innerText),
    src: type === 'image' ? box.querySelector('img')?.getAttribute('src') || '' : '',
    lang: box.dataset.lang || 'json',
    fontSize: style.fontSize,
    color: rgbToHex(style.color) || 'var(--text)',
    bold: Number(style.fontWeight) >= 700,
    italic: style.fontStyle === 'italic',
  };
}

function readGeometry(box) {
  const slideRect = box.closest('.slide').getBoundingClientRect();
  const rect = box.getBoundingClientRect();
  return {
    x: ((rect.left + rect.width / 2 - slideRect.left) / slideRect.width) * 100,
    y: ((rect.top + rect.height / 2 - slideRect.top) / slideRect.height) * 100,
    width: (rect.width / slideRect.width) * 100,
    height: (rect.height / slideRect.height) * 100,
  };
}

function applyGeometry(box, geometry) {
  box.style.left = pct(geometry.x);
  box.style.top = pct(geometry.y);
  box.style.width = pct(geometry.width);
  box.style.height = pct(geometry.height);
}

function clampGeometry(g) {
  const width = clamp(g.width, 8, 95);
  const height = clamp(g.height, 4, 95);
  return { width, height, x: clamp(g.x, width / 2, 100 - width / 2), y: clamp(g.y, height / 2, 100 - height / 2) };
}

function nextZ(slide) {
  return Math.max(3, ...[...slide.querySelectorAll('.canvas-element')].map((el) => Number.parseInt(getComputedStyle(el).zIndex) || 3)) + 1;
}

function cleanEditorText(text = '') {
  return text.replace(/^⠿\n?/, '').trim();
}
function rgbToHex(rgb = '') {
  const nums = rgb.match(/\d+/g)?.slice(0, 3).map(Number);
  return nums?.length === 3 ? `#${nums.map((n) => n.toString(16).padStart(2, '0')).join('')}` : '';
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function pct(value) { return `${Number(value).toFixed(1)}%`; }
