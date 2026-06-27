import {
  appSource,
  assert,
  existsSync,
  file,
  join,
  mkdirSync,
  mkdtempSync,
  parseSpec,
  readFileSync,
  rmSync,
  root,
  spawnSync,
  test,
  tmpdir,
  writeFileSync,
} from './helpers.mjs';

test('pwa canvas: status bar zoom input edits canvas zoom without mutating text font sizes', () => {
  const html = file('index.html');
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(html, /id="statusZoomInput"[^>]*type="number"/, 'status zoom should be an editable number input');
  assert.match(html, /min="25" max="300" step="1"/, 'manual zoom should advertise the same clamped range as app zoom');
  assert.match(html, /id="stageWrap"[^>]*tabindex="0"[^>]*aria-label="Scrollable canvas viewport"/, 'zoomed canvas viewport should be keyboard-scrollable and named');
  assert.match(app, /els\.statusZoomInput\.value = String\(Math\.round\(canvasZoom \* 100\)\)/, 'zoom buttons and shortcuts should keep the input synchronized');
  assert.match(app, /function commitStatusZoomInput\(\)[\s\S]*?setCanvasZoom\(percent \/ 100\)/, 'manual percentages should commit through the shared zoom path');
  assert.match(app, /if \(event\.key === 'Escape'\)[\s\S]*?renderStatusBar\(\)/, 'Escape should revert an uncommitted manual zoom edit');
  assert.match(app, /els\.canvas\.style\.setProperty\('--page-width', size\.width\)/, 'canvas should expose design width for zoom-scaled text rendering');
  assert.match(app, /fontSize: `calc\(\$\{element\.fontSize \|\| TEXT_DEFAULT\.fontSize\} \/ var\(--page-width, \$\{CANVAS_SIZE_DEFAULT\.width\}\) \* 100cqw\)`/, 'screen text size should derive from design font size and rendered canvas width');
  assert.match(css, /\.stage-wrap \{[^}]*overflow: auto;/, 'zoomed canvas should navigate with native stage scrollbars');
  assert.match(css, /\.stage-wrap:focus-visible/, 'keyboard-scrollable canvas viewport should expose a visible focus state');
  assert.doesNotMatch(css, /\.stage-wrap[^}]*cursor: grab|\.stage-wrap\.is-panning/, 'canvas viewport should not advertise drag-to-pan');
  assert.match(css, /\.status-zoom-input/, 'status zoom input should have status-bar styling');
});

test('pwa canvas: global editing shortcuts respect selection and text entry', () => {
  const app = appSource();
  const readme = file('README.md');

  assert.match(app, /!els\.commandPalette\.hidden \|\| !els\.projectNameModal\.hidden \|\| !els\.shortcutHelp\.hidden \|\| !els\.settingsMenu\.hidden \|\| !els\.templateModal\.hidden/, 'global editor shortcuts should not fire while modal dialogs or menus are open');
  assert.doesNotMatch(app, /firstRunHelper|closeFirstRunHelper|maybeOpenFirstRunHelper|FIRST_RUN_HELPER_KEY/, 'introduction dialog state and wiring should be removed');
  assert.match(app, /event\.key === '\/'\)[\s\S]*?openCommandPalette\(\)/, 'slash should open the command palette with the locked slash prefix');
  assert.match(app, /function commandPaletteShortcutLabel\(\)[\s\S]*?shortcutLabel\('P'\)[\s\S]*?or \/`/, 'visible command palette shortcut labels should say or slash');
  assert.match(app, /if \(shouldDeleteSelectedElement\(event\)\)[\s\S]*?\$\('deleteBtn'\)\.click\(\)[\s\S]*?if \(isTextEntryTarget\(event\.target\)\) return;/, 'Del should delete the selected element before text-entry targets block it');
  assert.match(app, /function shouldDeleteSelectedElement\(event\)[\s\S]*?event\.target === els\.textControl && textInspectorAutoFocused/, 'Del should only override text-entry focus when inspector focus was explicitly marked as selection-driven');
  assert.match(app, /els\.textControl\.addEventListener\('pointerdown', \(\) => textInspectorAutoFocused = false\)/, 'clicking into the inspector should preserve normal text editing Delete behavior');
  assert.match(app, /if \(isTextEntryTarget\(event\.target\)\) return;[\s\S]*?const alignmentAction = alignmentActionFromEvent\(event\);[\s\S]*?alignSelectedElement\(alignmentAction\)/, 'alignment shortcuts should run only after text-entry targets are excluded');
  assert.match(app, /id: 'align-left'[\s\S]*?shortcut: 'Alt\+\['[\s\S]*?id: 'align-bottom'[\s\S]*?shortcut: 'Shift\+Alt\+\]'/, 'all selected-element alignment shortcuts should be registered');
  assert.doesNotMatch(app, /startStagePan|stagePan|is-panning/, 'canvas viewport should use native scrollbars instead of drag-to-pan');
  assert.match(app, /if \(isTextEntryTarget\(event\.target\)\) return;[\s\S]*?event\.key\.toLowerCase\(\) === 't' && !selectedId[\s\S]*?\$\('addTextBtn'\)\.click\(\)/, 'T should stay blocked while typing and add text only when nothing is selected');
  assert.match(readme, /Press \*\*Ctrl\+P\*\*/, 'README should document Ctrl+P command palette access');
  assert.match(readme, /or \*\*\/\*\* to open the command palette with `\/` already inserted/, 'README should document slash command palette access');
  assert.match(readme, /slash is locked in place/, 'README should document the locked slash prefix');
  assert.match(readme, /press \*\*T\*\* to add text when nothing is selected/);
  assert.match(readme, /\*\*Del\*\* to delete the selected element/);
});

test('pwa canvas: double-clicking text enters direct visible edit mode', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(app, /node\.addEventListener\('dblclick', \(\) => \{ if \(element\.type === 'text'\) startCanvasTextEdit\(element\.id\); \}\)/);
  assert.match(app, /if \(base\.type === 'text' && addedElementId\) requestAnimationFrame\(\(\) => startCanvasTextEdit\(addedElementId\)\)/, 'new text elements should immediately enter canvas text edit mode');
  assert.match(app, /if \(event\.detail > 1 && element\?\.type === 'text'\) \{[\s\S]*?startCanvasTextEdit\(id\);[\s\S]*?return;[\s\S]*?\}/, 'double-click should enter text edit before drag setup can suppress it');
  assert.match(app, /text\.contentEditable = element\.id === editingId \? 'true' : 'false'/);
  assert.match(app, /range\.selectNodeContents\(text\)/, 'canvas text should be selected for immediate replacement typing');
  assert.match(app, /target\.isContentEditable/, 'global shortcuts should not steal canvas text keystrokes');
  assert.match(css, /caret-color: currentColor/, 'contenteditable canvas text should show a visible caret');
});

test('pwa canvas: markdown text renders as styled, escaped canvas and export HTML', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(app, /text\.innerHTML = markdownToHtml\(element\.text, \{ interactiveLinks: false \}\)/, 'canvas preview should render markdown as styled inert HTML');
  assert.match(app, /text\.textContent = element\.text/, 'canvas edit mode should keep the raw markdown source editable');
  assert.match(app, /\$\{markdownToHtml\(element\.text \|\| ''\)\}/, 'exported HTML should render markdown styling');
  assert.match(app, /wrapText\(ctx, markdownToPlainText\(element\.text \|\| ''\)/, 'PNG export should strip markdown markers for readable text');
  assert.match(app, /replace\(\/\\\*\\\*\(\[\^\*\]\+\)\\\*\\\*\/g, '<strong>\$1<\/strong>'\)/, 'bold markdown should become strong text');
  assert.match(app, /<code>\$\{escapeHtml\(code\)\}<\/code>/, 'inline code markdown should become code text');
  assert.match(app, /escapeHtml\(code\)/, 'code spans should be escaped before rendering');
  assert.match(app, /safeLinkUrl\(url\)/, 'links should be protocol-filtered before rendering');
  assert.match(app, /class="markdown-link"/, 'canvas preview links should be inert inside draggable elements');
  assert.match(app, /aria-multiline', 'true'/, 'raw markdown canvas editor should expose multiline textbox semantics');
  assert.match(css, /\.text-content h1/, 'canvas markdown blocks should have preview styles');
  assert.match(css, /\.text-content code/, 'inline code should be visually distinct on canvas');
});

test('pwa canvas: text resize keeps selection geometry and text scale coherent', () => {
  const app = appSource();

  assert.match(app, /const TEXT_FONT_SIZE_MIN = 8;/, 'text resize should have a readable lower font-size bound');
  assert.match(app, /const TEXT_FONT_SIZE_MAX = 600;/, 'text resize should allow very large canvas type');
  assert.match(app, /if \(element\.type !== 'image'\) \{[\s\S]*?setElementSize\(element, \{ w: nextW, h: nextH, from: drag\.element \}\);[\s\S]*?return;[\s\S]*?\}/, 'dragging a text resize handle should resize through the shared font-size scaling path');
  assert.match(app, /if \(element\.type === 'text'\) \{[\s\S]*?scaleTextFontForSize\(element, resizeFrom, source, \{ w, h, max \}\);[\s\S]*?return;[\s\S]*?\}/, 'text resize should persist dimensions through the text scaling path');
  assert.match(app, /function scaleTextFontForSize\(element, from = element, source, target = element\) \{[\s\S]*?const requestedScale = source === 'w' \? widthScale : source === 'h' \? heightScale : Math\.max\(widthScale, heightScale\);[\s\S]*?element\.w = clamp\(startW \* scale, 3, max\);[\s\S]*?element\.h = clamp\(startH \* scale, 3, max\);[\s\S]*?element\.fontSize = Math\.round\(clamp\(startFontSize \* scale, TEXT_FONT_SIZE_MIN, TEXT_FONT_SIZE_MAX, startFontSize\)\);[\s\S]*?\}/, 'text resize should scale width, height, and font size together so selection borders match rendered text');
  assert.doesNotMatch(app, /function resizeTextFont|pointerDistanceFromElementCenter/, 'text resize should not use a font-only special case');
  assert.match(app, /source === 'w' \? widthScale : source === 'h' \? heightScale : Math\.max\(widthScale, heightScale\)/, 'text resize should not preserve a width-height ratio when deriving font size');
  assert.match(app, /applyTextStyle\(node\.querySelector\('\.text-content'\), element\)/, 'live drag styling should update rendered text size before pointerup');
});

test('pwa canvas: clicking elements selects them and reveals the inspector', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(app, /function selectElement\(id, options = \{\}\) \{[\s\S]*?selectedId = id;[\s\S]*?renderInspector\(current\(\)\);[\s\S]*?\}/, 'selection should have one shared inspector-rendering path');
  assert.match(app, /node\.addEventListener\('click', \(\) => selectElement\(element\.id\)\)/, 'canvas element clicks should select the element');
  assert.match(app, /node\.focus\(\{ preventScroll: true \}\)/, 'pointer selection should immediately focus the canvas element');
  assert.match(app, /if \(changed\) \{[\s\S]*?render\(\);[\s\S]*?\}/, 'plain clicks should not re-render and break double-click targeting');
  assert.match(app, /requestAnimationFrame\(\(\) => els\.canvas\.querySelector\(`\[data-id="\$\{CSS\.escape\(idToFocus\)\}"\]`\)\?\.focus\(\{ preventScroll: true \}\)\)/, 'pointer selection should restore focus after pointer completion');
  assert.match(app, /node\.addEventListener\('focus', \(\) => selectElement\(element\.id, \{ renderCanvasToo: false \}\)\)/, 'keyboard focus should select the element');
  assert.doesNotMatch(app, /if \(mode === 'move' && element\?\.type === 'text'\) focusTextInspector\(\)/, 'clicking a text element body should keep focus on the canvas selection');
  assert.match(app, /function focusTextInspector\(\) \{[\s\S]*?els\.textControl\.focus\(\{ preventScroll: true \}\);[\s\S]*?\}/, 'text inspector focus helper should remain available for explicit inspector flows');
  assert.match(app, /els\.canvas\.querySelectorAll\('\.canvas-element'\)\.forEach\(\(node\) => \{[\s\S]*?node\.classList\.toggle\('selected', node\.dataset\.id === id\)/, 'shared selection should immediately mark newly clicked elements as selected');
  assert.match(css, /\.selected \.handle \{ display: block; \}/, 'selected text elements should reveal draggable handles as soon as the selected class is applied');
  assert.match(css, /--selectable-hover-outline: 2px dashed var\(--brand\)/, 'hovered canvas elements should reuse the brand selectable border token');
  assert.match(css, /\.canvas-element:not\(\.selected\):not\(\.editing\):hover, \.canvas-element:not\(\.selected\):not\(\.editing\):focus-visible \{[^}]*outline: var\(--selectable-hover-outline\)/, 'hovered canvas elements should show a selectable border before click selection');
  assert.match(css, /\.canvas-element:not\(\.editing\) \{ cursor: pointer; \}/, 'hovered canvas elements should use a selectable pointer cursor');
  assert.match(css, /\.canvas-element\.selected:focus-visible \{ box-shadow: var\(--selectable-hover-glow\); \}/, 'keyboard focus on selected elements should stay visually distinguishable from persistent selection');
  assert.match(css, /\.canvas-element\.text\.selected, \.canvas-element\.text:not\(\.selected\):not\(\.editing\):hover, \.canvas-element\.text:not\(\.selected\):not\(\.editing\):focus-visible \{ outline: 0; box-shadow: none; \}/, 'selected and hovered text should not outline the full text box');
  assert.match(css, /\.canvas-element\.text \.text-selection-frame \{[^}]*display: grid;[^}]*width: 100%;[^}]*height: 100%;[^}]*outline-offset: 3px;/, 'selected and hovered text should keep the same layout box while painting state affordances');
  assert.doesNotMatch(css, /\.canvas-element\.text\.(?:selected|editing)[^{]*\.text-selection-frame[^}]*fit-content|\.canvas-element\.text:not\(\.selected\):not\(\.editing\):hover \.text-selection-frame[^}]*fit-content|\.canvas-element\.text\.(?:selected|editing)[^{]*\.text-content[^}]*fit-content|\.canvas-element\.text:not\(\.selected\):not\(\.editing\):hover \.text-content[^}]*fit-content/, 'text hover, selection, and edit states must not change text layout size');
  assert.match(css, /\.canvas-element\.text\.selected:focus-visible \.text-selection-frame, \.canvas-element\.text:not\(\.selected\):not\(\.editing\):hover \.text-selection-frame, \.canvas-element\.text:not\(\.selected\):not\(\.editing\):focus-visible \.text-selection-frame \{ box-shadow: var\(--selectable-hover-glow\); \}/, 'keyboard-focused selected text should get the same visible focus glow as other selected elements');
  assert.match(app, /els\.elementInspector\.hidden = !element/, 'selected elements should reveal inspector controls');
  assert.match(css, /\.app-shell \{[^}]*grid-template-columns: minmax\(0, 1fr\) 6px var\(--inspector-panel-width\)/, 'app layout should remove the left column and reserve a wider right inspector');
  assert.doesNotMatch(file('index.html'), /class="sidebar"/, 'left panel should be removed from source markup');
  assert.match(file('index.html'), /id="inspectorResizeHandle"[^>]*role="separator"[^>]*aria-label="Resize inspector panel"[^>]*tabindex="0"/, 'inspector splitter should be keyboard-focusable and expose separator semantics');
  assert.match(app, /els\.inspectorResizeHandle\.addEventListener\('pointerdown', startInspectorResize\)/, 'splitter should start pointer resizing');
  assert.match(app, /els\.inspectorResizeHandle\.addEventListener\('keydown', handleInspectorResizeKeydown\)/, 'splitter should support keyboard resizing');
  assert.match(css, /\.workspace \{[^}]*grid-column: 1;/, 'canvas workspace should move into the leftmost layout column');
  assert.match(css, /\.inspector \{[^}]*grid-column: 4;[^}]*display: flex;/, 'right inspector panel should occupy the widened inspector column');
  assert.match(css, /\.inspector:has\(#elementInspector\[hidden\]\) > \* \{ display: none; \}/, 'right panel should be visually empty when no element is selected');
  assert.doesNotMatch(css, /\.app-shell:has\(#elementInspector:not\(\[hidden\]\)\) \.stage-wrap/, 'selection should not resize or repad the canvas viewport');
  assert.doesNotMatch(file('index.html'), /class="page-inspector"|id="backgroundControl"|id="applyBackgroundAllBtn"/, 'dead page-background inspector controls should be removed from the selected-element panel');
});

test('pwa canvas: image picker creates a visible safe image element', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(app, /await addImageFile\(file\);/, 'image picker should delegate to the shared image add helper');
  assert.match(app, /const IMAGE_DEFAULT = \{[^}]*aspectLocked: true[^}]*naturalRatio: 1[^}]*aspectRatio: 1[^}]*cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0[^}]*\}/, 'images should default to locked ratio with no crop');
  assert.match(app, /async function addImageFile\(file, position = IMAGE_DEFAULT\)/, 'shared image helper should preserve picker defaults');
  assert.match(app, /const ratio = await imageSourceRatio\(src\)/, 'new image elements should capture their natural ratio');
  assert.match(app, /addElement\(\{ type: 'image', src, \.\.\.IMAGE_DEFAULT, naturalRatio: ratio, aspectRatio: ratio, \.\.\.position \}\)/, 'dropped images should create the same element shape as picker images');
  assert.match(app, /img\.src = safeImageSrc\(element\.src\)/, 'rendered image elements should receive a sanitized visible src');
  assert.match(app, /\^data:image\\\/\[\^;,\]\+\[;,\]/, 'data URLs for browser-supported image MIME types should stay allowed');
  assert.match(app, /els\.canvas\.addEventListener\('dragover', handleCanvasDrag\)/);
  assert.match(app, /els\.canvas\.addEventListener\('drop', handleCanvasDrop\)/);
  assert.match(app, /event\.dataTransfer\.dropEffect = 'copy'/, 'dragging an image should advertise copy semantics');
  assert.match(app, /await addImageFile\(file, canvasPoint\(event\)\)/, 'drop should place the new image at the canvas drop point');
  assert.match(app, /function hasImageFile\(dataTransfer\)/, 'non-image drops should be ignored');
  assert.match(css, /\.canvas\.drag-over/, 'canvas should expose a visible image-drop affordance');
});

test('pwa canvas: image ratio lock and crop controls persist through render and export', () => {
  const html = file('index.html');
  const app = appSource();
  const css = file('src/styles.css');

  assert.doesNotMatch(html, /id="aspectLockControl"|id="aspectLockField"|id="aspectLinkIndicator"/, 'selected-element inspector should not expose an image ratio lock toggle');
  assert.doesNotMatch(html, /id="cropLeftControl"|id="cropRightControl"/, 'selected-element inspector should not expose left or right crop controls');
  assert.match(html, /id="cropTopControl" type="range" min="0" max="90"/, 'inspector should expose top crop control');
  assert.match(html, /id="cropBottomControl" type="range" min="0" max="90"/, 'inspector should expose bottom crop control');
  assert.match(app, /els\.wControl\.closest\('\.field'\)\.hidden = isText/, 'text selection should hide width controls in favor of font size');
  assert.match(app, /els\.hControl\.closest\('\.field'\)\.hidden = isText/, 'text selection should hide height controls in favor of font size');
  assert.match(app, /els\.fontSizeControl\.closest\('\.field'\)\.hidden = !isText/, 'font size should be the text-specific sizing control');
  assert.match(app, /els\.cropFields\.hidden = !isImage/, 'crop controls should only appear for image selections');
  assert.match(app, /if \(isImage\) \{[\s\S]*?els\.cropTopControl\.value = imageCrop\(element, 'cropTop'\);[\s\S]*?els\.cropBottomControl\.value = imageCrop\(element, 'cropBottom'\);[\s\S]*?\}/, 'text selection should not read or sync crop controls');
  assert.match(app, /if \(isImage\) element\.aspectLocked = true;/, 'selected images should always be locked to their current ratio');
  assert.doesNotMatch(app, /aspectLockControl|aspectLockField|aspectLinkIndicator/, 'removed image ratio lock controls should have no JS bindings');
  assert.match(app, /function resizeElement\(element, event\) \{[\s\S]*?if \(element\.type !== 'image'\)[\s\S]*?lockedDragSize\(element, nextW, nextH, drag\.element, drag\.rect\)[\s\S]*?\}/, 'selected image resize should always preserve ratio');
  assert.match(app, /function normalizeImageSettings\(element, fallback = IMAGE_DEFAULT\)/, 'stored and imported images should normalize image settings');
  assert.match(app, /const cropVars = element\.type === 'image' \? cropStyleVars\(element\) : ''/, 'text and shape elements should not render crop CSS vars');
  assert.match(app, /function cropStyleVars\(element\)/, 'crop settings should be emitted as render/export CSS vars');
  assert.match(app, /--crop-img-w:\$\{imageW\}%/, 'crop CSS should precompute browser-safe crop widths');
  assert.match(app, /function cropImageSide\(element, event\)/, 'canvas should support side-specific crop handles');
  assert.match(app, /lockImageRatioToCurrentSize\(element, rect\)/, 'cropping should promote cropped dimensions to the locked image ratio');
  assert.match(app, /drawImageElement\(ctx, element, w, h\)/, 'PNG export should use crop-aware image drawing');
  assert.match(css, /\.canvas-element\.image \{ overflow: hidden; \}/, 'canvas crop should clip the enlarged image');
  assert.match(css, /width: var\(--crop-img-w, 100%\)/, 'side crop should scale image horizontally inside clipped frame');
});
