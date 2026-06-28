async function importHtml(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = String(await readTextFile(file));
    const trimmed = text.trim();
    const project = file.name?.toLowerCase().endsWith('.json') || file.type === 'application/json' || trimmed.startsWith('{') || trimmed.startsWith('[')
      ? projectFromJson(text)
      : projectFromHtml(text);
    withNewCurrent(project);
  } catch (error) {
    alert(`Import failed: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

function projectToJson(project) {
  return JSON.stringify(clone(project), null, 2);
}

function projectFromJson(json) {
  return normalizeImportedProject(JSON.parse(json));
}

function projectToHtml(project) {
  const safeProject = clone(project);
  const title = escapeHtml(project.name);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>${projectToCss()}</style>
  </head>
  <body>
    <main class="qwanvas-project" data-qwanvas-project="${escapeAttr(project.name)}">
${project.pages.map((page, index) => renderExportPage(page, index, project)).join('\n')}
    </main>
    <script type="application/json" data-qwanvas-project>${escapeScriptJson(JSON.stringify(safeProject, null, 2))}</script>
  </body>
</html>
`;
}

function projectToCss() {
  return `:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0b1020; color: #f8fafc; }
body { margin: 0; min-height: 100vh; display: grid; gap: 2rem; place-items: center; padding: 2rem; background: radial-gradient(circle at top, #1d2b4f, #0b1020 45%); }
.qwanvas-project { display: grid; gap: 2rem; width: min(92vw, 720px); }
.qwanvas-page { position: relative; width: 100%; aspect-ratio: var(--page-width, 1080) / var(--page-height, 1350); overflow: hidden; background: #fff; box-shadow: 0 24px 80px rgb(0 0 0 / .35); }
.qwanvas-page.background-grid::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgb(255 255 255 / .035) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .035) 1px, transparent 1px); background-size: 6.5% 5.2%; pointer-events: none; }
.qwanvas-background-image { position: absolute; left: calc(var(--x) * 1%); top: calc(var(--y) * 1%); width: calc(var(--w) * 1%); height: calc(var(--h) * 1%); transform: translate(-50%, -50%) rotate(calc(var(--r) * 1deg)); overflow: hidden; z-index: 0; }
.qwanvas-background-image img { width: var(--crop-img-w, 100%); height: var(--crop-img-h, 100%); margin-left: var(--crop-offset-x, 0%); margin-top: var(--crop-offset-y, 0%); object-fit: fill; display: block; }
.qwanvas-element { position: absolute; left: calc(var(--x) * 1%); top: calc(var(--y) * 1%); width: calc(var(--w) * 1%); height: calc(var(--h) * 1%); transform: translate(-50%, -50%) rotate(calc(var(--r) * 1deg)); display: grid; place-items: center; color: var(--element-color, white); z-index: var(--z, 1); }
.qwanvas-element[data-type="text"] { place-items: start stretch; align-items: start; }
.qwanvas-text { width: 100%; align-self: start; justify-self: stretch; white-space: pre-wrap; line-height: 1.05; overflow-wrap: anywhere; text-align: var(--text-align, left); text-decoration: var(--text-decoration, none); font-family: var(--font, Inter, sans-serif); font-size: calc(var(--font-size, 42) * .095vw); font-weight: var(--font-weight, 500); font-style: var(--font-style, normal); }
.qwanvas-text h1, .qwanvas-text h2, .qwanvas-text h3, .qwanvas-text h4, .qwanvas-text h5, .qwanvas-text h6, .qwanvas-text p { margin: 0 0 .25em; }
.qwanvas-text h1 { font-size: 1.55em; } .qwanvas-text h2 { font-size: 1.35em; } .qwanvas-text h3 { font-size: 1.18em; }
.qwanvas-text ul, .qwanvas-text ol { display: inline-block; margin: .15em 0; padding-left: 1.25em; text-align: left; }
.qwanvas-text blockquote { margin: .15em 0; padding-left: .75em; border-left: .12em solid currentColor; opacity: .86; }
.qwanvas-text code { padding: .05em .22em; border-radius: .25em; background: rgb(0 0 0 / .18); font-family: "Courier New", ui-monospace, monospace; font-size: .9em; }
.qwanvas-text a { color: inherit; text-decoration: underline; }
.qwanvas-shape { border-radius: 18px; background: var(--element-color, #74a6ff); box-shadow: 0 16px 40px rgb(0 0 0 / .25); }
.qwanvas-image { overflow: hidden; }
.qwanvas-image img { width: var(--crop-img-w, 100%); height: var(--crop-img-h, 100%); margin-left: var(--crop-offset-x, 0%); margin-top: var(--crop-offset-y, 0%); object-fit: fill; display: block; }
@media print { body { padding: 0; background: #0b1020; } .qwanvas-project { width: 100vw; gap: 0; } .qwanvas-page { border-radius: 0; box-shadow: none; break-after: page; } }
`;
}

function renderExportPage(page, index, project = current()) {
  const background = pageBackground(page);
  const size = pageSize(page, project);
  const backgroundImage = pageBackgroundImage(page);
  const backgroundImageHtml = backgroundImage ? `${renderExportBackgroundImage(backgroundImage)}\n` : '';
  const elements = page.elements.toSorted((a, b) => (a.z || 1) - (b.z || 1)).map(renderExportElement).join('\n');
  const backgroundClass = background.overlay === 'grid' ? ' background-grid' : '';
  return `      <section class="qwanvas-page${backgroundClass}" data-page="${index + 1}" data-page-id="${escapeAttr(page.id)}" data-background="${escapeAttr(background.id)}" style="--page-width:${size.width};--page-height:${size.height};background:${escapeAttr(background.css)}">
${backgroundImageHtml}${elements}
      </section>`;
}

function renderExportBackgroundImage(backgroundImage) {
  const style = `--x:${backgroundImage.x};--y:${backgroundImage.y};--w:${backgroundImage.w};--h:${backgroundImage.h};--r:${backgroundImage.rotation || 0};${cropStyleVars(backgroundImage)}`;
  return `        <div class="qwanvas-background-image" data-type="background-image" style="${escapeAttr(style)}"><img alt="" src="${escapeAttr(safeImageSrc(backgroundImage.src))}"></div>`;
}

function renderExportElement(element) {
  const style = `--x:${element.x};--y:${element.y};--w:${element.w};--h:${element.h};--r:${element.rotation || 0};--z:${element.z || 1};--element-color:${element.color || '#fff'};${cropStyleVars(element)}`;
  if (element.type === 'text') {
    const textStyle = `--font-size:${element.fontSize || 42};--font:${escapeAttr(element.font || 'Inter')};--font-weight:${element.bold ? 800 : 500};--font-style:${element.italic ? 'italic' : 'normal'};--text-decoration:${element.underline ? 'underline' : 'none'};--text-align:${element.textAlign || TEXT_DEFAULT.textAlign}`;
    return `        <div class="qwanvas-element" data-element-id="${escapeAttr(element.id)}" data-type="text" style="${escapeAttr(style)}"><div class="qwanvas-text" style="${textStyle}">${plainTextToHtml(element.text || '')}</div></div>`;
  }
  if (element.type === 'image') {
    return `        <div class="qwanvas-element qwanvas-image" data-element-id="${escapeAttr(element.id)}" data-type="image" style="${escapeAttr(style)}"><img alt="" src="${escapeAttr(safeImageSrc(element.src))}"></div>`;
  }
  return `        <div class="qwanvas-element qwanvas-shape" data-element-id="${escapeAttr(element.id)}" data-type="shape" style="${escapeAttr(style)}"></div>`;
}

function projectFromHtml(html) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const data = document.querySelector('script[type="application/json"][data-qwanvas-project], script[type="application/json"][data-lightslidesai-project]')?.textContent;
  if (!data) throw new Error('Missing Qwanvas project data. Export/import uses HTML with embedded project JSON.');
  return normalizeImportedProject(JSON.parse(data));
}

function normalizeImportedProject(project) {
  if (!project || !Array.isArray(project.pages)) throw new Error('Invalid Qwanvas project data.');
  const imported = clone(project);
  imported.id = uid();
  imported.name = normalizedProjectName(imported.name) || 'Imported project';
  imported.createdAt = Date.now();
  imported.updatedAt = imported.createdAt;
  imported.width = canvasDimension(imported.width, CANVAS_SIZE_DEFAULT.width);
  imported.height = canvasDimension(imported.height, CANVAS_SIZE_DEFAULT.height);
  imported.templateId = projectTemplate(imported.templateId).id;
  imported.kind = imported.kind === 'image' ? 'image' : 'deck';
  const activePageIndex = Math.max(0, imported.pages.findIndex((page) => page.id === imported.activePageId));
  imported.pages = imported.pages.map((page, index) => ({
    id: uid(),
    name: page.name || `Page ${index + 1}`,
    width: canvasDimension(page.width, imported.width),
    height: canvasDimension(page.height, imported.height),
    backgroundId: normalizeBackgroundId(page.backgroundId, page.background),
    backgroundImage: normalizeBackgroundImage(page.backgroundImage, page),
    guideGrid: normalizeGuideGrid(page.guideGrid),
    elements: Array.isArray(page.elements) ? page.elements.map(normalizeImportedElement).filter(Boolean) : [],
  }));
  if (!imported.pages.length) imported.pages = [createPage('Page 1')];
  imported.activePageId = imported.pages[Math.min(activePageIndex, imported.pages.length - 1)].id;
  imported.name = uniqueProjectName(imported.name);
  return syncProjectFileMetadata(imported);
}

function normalizeBackgroundImage(backgroundImage, page) {
  if (!backgroundImage?.src) return undefined;
  const size = { width: canvasDimension(page?.width, CANVAS_SIZE_DEFAULT.width), height: canvasDimension(page?.height, CANVAS_SIZE_DEFAULT.height) };
  const imported = {
    ...BACKGROUND_IMAGE_DEFAULT,
    src: safeImageSrc(backgroundImage.src),
    x: clamp(backgroundImage.x, -100, 200, 50),
    y: clamp(backgroundImage.y, -100, 200, 50),
    w: clamp(backgroundImage.w, 1, 300, 100),
    h: clamp(backgroundImage.h, 1, 300, 100),
    rotation: clamp(backgroundImage.rotation, -360, 360, 0),
  };
  return { ...imported, ...normalizeImageSettings(backgroundImage, imported), aspectRatio: clamp(backgroundImage.aspectRatio, .05, 20, widthHeightRatio(imported, size)) };
}

function normalizeImportedElement(element) {
  if (!element || !['text', 'image', 'shape'].includes(element.type)) return null;
  const imported = {
    id: uid(),
    type: element.type,
    text: String(element.text || ''),
    src: safeImageSrc(element.src || ''),
    x: canvasPercent(element.x, 0, 100, 50),
    y: canvasPercent(element.y, 0, 100, 50),
    w: canvasPercent(element.w ?? element.width, 1, 100, 30),
    h: canvasPercent(element.h ?? element.height, 1, 100, 12),
    rotation: clamp(element.rotation, -360, 360, 0),
    z: Math.trunc(clamp(element.z, 0, 999, 1)),
    fontSize: integerFontSize(element.fontSize),
    color: String(element.color || '#ffffff'),
    font: String(element.font || 'Inter'),
    bold: Boolean(element.bold),
    italic: Boolean(element.italic),
    underline: Boolean(element.underline),
    textAlign: ['left', 'center', 'right'].includes(element.textAlign) ? element.textAlign : TEXT_DEFAULT.textAlign,
  };
  if (imported.type === 'image') Object.assign(imported, normalizeImageSettings(element, imported));
  return imported;
}

function normalizeImageSettings(element, fallback = IMAGE_DEFAULT) {
  return {
    aspectLocked: element.aspectLocked !== false,
    naturalRatio: clamp(element.naturalRatio, .05, 20, widthHeightRatio(fallback)),
    aspectRatio: clamp(element.aspectRatio, .05, 20, widthHeightRatio(fallback)),
    cropLeft: imageCrop(element, 'cropLeft'),
    cropRight: imageCrop(element, 'cropRight'),
    cropTop: imageCrop(element, 'cropTop'),
    cropBottom: imageCrop(element, 'cropBottom'),
  };
}

async function exportPng() {
  const project = current();
  if (!project) return;
  const page = activePage(project);
  const size = pageSize(page, project);
  const canvas = document.createElement('canvas');
  canvas.width = size.width; canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  await drawPageBackground(ctx, page, size);
  for (const element of page.elements.toSorted((a, b) => (a.z || 1) - (b.z || 1))) await drawElement(ctx, element, size);
  canvas.toBlob((blob) => downloadBlob(`${slug(project.name)}-${slug(page.name)}.png`, blob), 'image/png');
}

async function drawPageBackground(ctx, page, size = CANVAS_SIZE_DEFAULT) {
  const background = pageBackground(page);
  if (background.id === LEGACY_BACKGROUND_ID) {
    const gradient = ctx.createLinearGradient(0, 0, size.width, size.height);
    gradient.addColorStop(0, '#16213e'); gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size.width, size.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, .035)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= size.width; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.height); ctx.stroke(); }
    for (let y = 0; y <= size.height; y += 70) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.width, y); ctx.stroke(); }
  } else {
    ctx.fillStyle = background.css;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  const backgroundImage = pageBackgroundImage(page);
  if (backgroundImage) await drawElement(ctx, backgroundImage, size);
}

async function drawElement(ctx, element, size = CANVAS_SIZE_DEFAULT) {
  const x = element.x / 100 * size.width, y = element.y / 100 * size.height, w = element.w / 100 * size.width, h = element.h / 100 * size.height;
  ctx.save(); ctx.translate(x, y); ctx.rotate((element.rotation || 0) * Math.PI / 180);
  if (element.type === 'shape') { ctx.fillStyle = element.color || '#74a6ff'; roundRect(ctx, -w / 2, -h / 2, w, h, 28); ctx.fill(); }
  if (element.type === 'image') await drawImageElement(ctx, element, w, h);
  if (element.type === 'text') {
    const fontScale = size.width / CANVAS_SIZE_DEFAULT.width;
    ctx.fillStyle = element.color || '#fff'; ctx.font = `${element.italic ? 'italic ' : ''}${element.bold ? '800' : '500'} ${element.fontSize * 2.1 * fontScale}px ${element.font || 'Inter'}`;
    const textAlign = element.textAlign || TEXT_DEFAULT.textAlign;
    const textX = textAlign === 'left' ? -w / 2 : textAlign === 'right' ? w / 2 : 0;
    ctx.textAlign = textAlign; ctx.textBaseline = 'middle'; wrapText(ctx, element.text || '', textX, 0, w, element.fontSize * 2.35 * fontScale);
  }
  ctx.restore();
}
async function drawImageElement(ctx, element, w, h) {
  const img: HTMLImageElement = await loadImage(safeImageSrc(element.src));
  const crop = imageCropBox(element);
  const sourceX = crop.left / 100 * img.naturalWidth;
  const sourceY = crop.top / 100 * img.naturalHeight;
  const sourceW = Math.max(1, img.naturalWidth * imageVisiblePercent(crop.left + crop.right) / 100);
  const sourceH = Math.max(1, img.naturalHeight * imageVisiblePercent(crop.top + crop.bottom) / 100);
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, -w / 2, -h / 2, w, h);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect?.(x, y, w, h, r) || ctx.rect(x, y, w, h); }
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = String(text).split('\n').flatMap((line) => {
    const words = line.split(' '), out = []; let cur = '';
    for (const word of words) { const test = cur ? `${cur} ${word}` : word; if (ctx.measureText(test).width > maxWidth && cur) { out.push(cur); cur = word; } else cur = test; }
    out.push(cur); return out;
  });
  const start = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, start + i * lineHeight));
}

function plainTextToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
