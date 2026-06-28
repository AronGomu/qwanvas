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
  assert.match(app, /if \(isTextEntryTarget\(event\.target\) && !shouldDeleteSelectedElement\(event\)\) return;[\s\S]*?if \(handleProjectPageNavigationKeydown\(event\)\) return;[\s\S]*?if \(shouldDeleteSelectedElement\(event\)\)/, 'text-entry targets should block global shortcuts, including Ctrl+Arrow page navigation, while preserving the delete fallback');
  assert.match(app, /function shouldDeleteSelectedElement\(event\)[\s\S]*?event\.target === els\.textControl && textInspectorAutoFocused/, 'Del should only override hidden backing text control focus if it ever occurs');
  assert.match(app, /els\.textControl\.addEventListener\('pointerdown', \(\) => textInspectorAutoFocused = false\)/, 'hidden backing text control should preserve normal text editing Delete behavior if focused programmatically');
  assert.match(app, /if \(isTextEntryTarget\(event\.target\) && !shouldDeleteSelectedElement\(event\)\) return;[\s\S]*?const alignmentAction = alignmentActionFromEvent\(event\);[\s\S]*?alignSelectedElement\(alignmentAction\)/, 'alignment shortcuts should run only after text-entry targets are excluded');
  assert.match(app, /id: 'align-left'[\s\S]*?shortcut: 'Alt\+\['[\s\S]*?id: 'align-bottom'[\s\S]*?shortcut: 'Shift\+Alt\+\]'/, 'all selected-element alignment shortcuts should be registered');
  assert.doesNotMatch(app, /startStagePan|stagePan|is-panning/, 'canvas viewport should use native scrollbars instead of drag-to-pan');
  assert.match(app, /if \(isTextEntryTarget\(event\.target\) && !shouldDeleteSelectedElement\(event\)\) return;[\s\S]*?event\.key\.toLowerCase\(\) === 't' && !selectedId[\s\S]*?\$\('addTextBtn'\)\.click\(\)/, 'T should stay blocked while typing and add text only when nothing is selected');
  assert.match(readme, /Press \*\*Ctrl\+P\*\*/, 'README should document Ctrl+P command palette access');
  assert.match(readme, /or \*\*\/\*\* to open the command palette with `\/` already inserted/, 'README should document slash command palette access');
  assert.match(readme, /slash is locked in place/, 'README should document the locked slash prefix');
  assert.match(readme, /press \*\*T\*\* to add text when nothing is selected/);
  assert.match(readme, /\*\*Del\*\* to delete the selected element/);
});

test('pwa canvas: clicking text enters direct visible edit mode', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.doesNotMatch(app, /addEventListener\('dblclick'/, 'text editing should no longer require double-click');
  assert.match(app, /if \(base\.type === 'text' && addedElementId\) requestAnimationFrame\(\(\) => startCanvasTextEdit\(addedElementId\)\)/, 'new text elements should immediately enter text edit mode');
  assert.match(app, /const textBodyClick = element\?\.type === 'text'[\s\S]*?pendingTextDrag = \{[\s\S]*?endPendingTextDrag[\s\S]*?startCanvasTextEdit\(pending\.id\)/, 'text pointerdown should defer between click-to-edit and drag-to-move');
  assert.match(app, /text\.contentEditable = isEditingText \? 'true' : 'false'/);
  assert.match(app, /text\.focus\(\{ preventScroll: true \}\)/, 'text edits should focus the canvas text directly by default');
  assert.match(app, /target\.isContentEditable/, 'global shortcuts should not steal canvas text keystrokes');
  assert.match(css, /caret-color: currentColor/, 'contenteditable canvas text should show a visible caret');
});

test('pwa canvas: text renders as escaped plain text on canvas and export HTML', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(app, /text\.textContent = element\.text \|\| ''/, 'canvas text should render as plain escaped text');
  assert.match(app, /\$\{plainTextToHtml\(element\.text \|\| ''\)\}/, 'exported HTML should preserve plain text line breaks');
  assert.match(app, /wrapText\(ctx, element\.text \|\| ''/, 'PNG export should use raw text without markdown transforms');
  assert.doesNotMatch(app, /markdownToHtml|markdownInlineToHtml|markdownToPlainText|safeLinkUrl/, 'markdown handling should be removed from text rendering');
  assert.match(app, /aria-multiline', 'true'/, 'canvas editor should expose multiline textbox semantics');
  assert.doesNotMatch(css, /\.text-content h1|\.text-content code|markdown-link/, 'canvas markdown preview styles should be removed');
});

test('pwa canvas: text resize changes the box independently from font size', () => {
  const app = appSource();

  assert.match(app, /const TEXT_FONT_SIZE_MIN = 8;/, 'font-size controls should keep a readable lower bound');
  assert.match(app, /const TEXT_FONT_SIZE_MAX = 600;/, 'font-size controls should allow very large canvas type');
  assert.match(app, /if \(element\.type === 'text'\) \{[\s\S]*?element\.w = clamp\(w, 3, max\);[\s\S]*?element\.h = clamp\(h, 3, max\);[\s\S]*?return;[\s\S]*?\}/, 'text resize should update width and height without touching fontSize');
  assert.doesNotMatch(app, /scaleTextFontForSize|resizeTextFont|pointerDistanceFromElementCenter/, 'text resize should not scale font size implicitly');
  assert.match(app, /function resizeElementSide\(element, side, deltaW, deltaH\)/, 'side and corner handles should share anchored resize logic');
  assert.match(app, /side === 'top-left'[\s\S]*?side === 'bottom-right'/, 'corner handles should support diagonal anchored resize directions');
  assert.match(app, /element\.x = start\.x \+ \(element\.w - start\.w\) \/ 2[\s\S]*?element\.x = start\.x - \(element\.w - start\.w\) \/ 2[\s\S]*?element\.y = start\.y \+ \(element\.h - start\.h\) \/ 2[\s\S]*?element\.y = start\.y - \(element\.h - start\.h\) \/ 2/, 'resize should shift center so the opposite edge stays anchored');
  assert.match(app, /updateSelectionToolbars\(\)/, 'floating toolbars should follow live drags');
  assert.match(app, /applyTextStyle\(node\.querySelector\('\.text-content'\), element\)/, 'live drag styling should keep rendered text synced before pointerup');
});

test('pwa canvas: clicking elements selects them and reveals the inspector', () => {
  const app = appSource();
  const css = file('src/styles.css');

  assert.match(app, /function selectElement\(id, options = \{\}\) \{[\s\S]*?selectedId = id;[\s\S]*?renderInspector\(current\(\)\);[\s\S]*?\}/, 'selection should have one shared inspector-rendering path');
  assert.match(app, /if \(element\.type === 'text'\) startCanvasTextEdit\(element\.id\);[\s\S]*?else selectElement\(element\.id\);/, 'text element clicks should enter canvas edit mode while other elements select');
  assert.doesNotMatch(app, /focusInspectorForDragMode\(mode\)/, 'pointer drag actions should not focus inspector controls');
  assert.match(app, /if \(changed\) \{[\s\S]*?render\(\);[\s\S]*?\}/, 'plain clicks should not re-render and break double-click targeting');
  assert.match(app, /selectedId \|\| ''/, 'pointer completion should target the selected canvas element');
  assert.match(app, /focus\(\{ preventScroll: true \}\)/, 'pointer completion should keep focus on canvas rather than inspector controls');
  assert.match(app, /node\.addEventListener\('focus', \(\) => selectElement\(element\.id, \{ renderCanvasToo: false \}\)\)/, 'keyboard focus should select the element');
  assert.match(app, /function endPendingTextDrag\(event\) \{[\s\S]*?startCanvasTextEdit\(pending\.id\)/, 'clicking a text element body should focus text editing after pointer release');
  assert.match(app, /function focusTextInspector\(\) \{[\s\S]*?startCanvasTextEdit\(element\.id\);[\s\S]*?\}/, 'legacy text focus helper should route to direct canvas text editing');
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
  assert.match(app, /els\.wControl\.closest\('\.field'\)\.hidden = false/, 'text selection should show width controls for text box sizing');
  assert.match(app, /els\.hControl\.closest\('\.field'\)\.hidden = false/, 'text selection should show height controls for text box sizing');
  assert.match(app, /els\.textControl\.hidden = true/, 'hidden backing text control should never become visible in the inspector');
  assert.match(app, /els\.fontSizeControl\.closest\('\.field'\)\.hidden = !isText/, 'font size should remain the text-specific type size control');
  assert.match(app, /els\.fontControl\.oninput = \(\) => handleFontInput\(\);/, 'font control should use custom draft input handling instead of saving every keystroke');
  assert.match(app, /function isFontInputInvalid\(\) \{[\s\S]*?return Boolean\(value\) && !exactFontOption\(value\);[\s\S]*?\}/, 'font control should allow incorrect draft input and show validation state');
  assert.match(app, /if \(document\.activeElement !== els\.fontControl\) els\.fontControl\.value = element\.font \|\| TEXT_DEFAULT\.font;/, 'rendering should not overwrite the active font input while typing');
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
