import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('single-clicking canvas text enters edit mode and focuses canvas text', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByRole('dialog', { name: /keyboard-first/i })).toHaveCount(0);

  await page.getByPlaceholder('new project name').fill('Canvas Text Selection');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a template' })).toBeVisible();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await expect(page.getByLabel('Editable page canvas')).toBeVisible();

  await page.keyboard.press('t');
  const editor = page.getByRole('textbox', { name: 'Edit text on canvas' });
  await expect(editor).toBeVisible();
  await editor.fill('Click me');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();

  const textElement = page.getByRole('button', { name: /text element/i });
  await textElement.click();
  await expect(page.getByRole('textbox', { name: 'Edit text on canvas' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Edit text on canvas' })).toBeFocused();
  await expect(page.locator('#textControl')).toBeHidden();
  await expect(page.locator('#textControl')).not.toBeFocused();

  const beforeDrag = await page.getByRole('textbox', { name: 'Edit text on canvas' }).evaluate((node) => {
    const rect = node.closest('.canvas-element')!.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const firstDragEdge = await page.locator('.canvas-element.text .text-drag-edge.drag-left').boundingBox();
  if (!firstDragEdge) throw new Error('Missing text drag edge');
  await page.mouse.move(firstDragEdge.x + firstDragEdge.width / 2, firstDragEdge.y + firstDragEdge.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstDragEdge.x + firstDragEdge.width / 2 + 70, firstDragEdge.y + firstDragEdge.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  const afterDrag = await page.locator('.canvas-element.text').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 20);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 10);
});

test('text background inspector controls opacity and color', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Text Background Inspector');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await page.keyboard.press('t');

  const opacity = page.locator('#textBackgroundOpacityControl');
  const opacitySlider = page.locator('#textBackgroundOpacitySliderControl');
  const color = page.locator('#textBackgroundColorControl');
  const text = page.locator('.text-content');

  await expect(opacity).toBeVisible();
  await expect(opacity).toHaveValue('0');
  await expect(opacitySlider).toHaveValue('0');
  await expect(color).toHaveValue('#000000');
  await expect(text).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await opacity.evaluate((input: HTMLInputElement) => {
    input.value = '50';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await color.evaluate((input: HTMLInputElement) => {
    input.value = '#ef4444';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(opacity).toHaveValue('50');
  await expect(opacitySlider).toHaveValue('50');
  await expect(text).toHaveCSS('background-color', 'rgba(239, 68, 68, 0.5)');
});

test('text border inspector toggles radius and color controls', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Text Border Inspector');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await page.keyboard.press('t');

  const border = page.locator('#borderControl');
  const padding = page.locator('#borderPaddingControl');
  const paddingSlider = page.locator('#borderPaddingSliderControl');
  const radius = page.locator('#borderRadiusControl');
  const color = page.locator('#borderColorControl');
  const text = page.locator('.text-content');

  await expect(border).toBeVisible();
  await expect(padding).toBeDisabled();
  await expect(padding).toHaveValue('10');
  await expect(paddingSlider).toHaveValue('10');
  await expect(radius).toBeDisabled();
  await expect(color).toBeDisabled();

  await border.check();
  await expect(padding).toBeEnabled();
  await expect(radius).toBeEnabled();
  await expect(color).toBeEnabled();
  await padding.fill('14');
  await expect(paddingSlider).toHaveValue('14');
  await radius.fill('18');
  await color.evaluate((input: HTMLInputElement) => {
    input.value = '#ef4444';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(text).toHaveCSS('border-top-style', 'solid');
  await expect(text).toHaveCSS('border-top-color', 'rgb(239, 68, 68)');
  await expect(text).toHaveCSS('border-top-left-radius', '18px');
  await expect(text).toHaveCSS('padding-top', '14px');

  await border.uncheck();
  await expect(padding).toBeDisabled();
  await expect(radius).toBeDisabled();
  await expect(color).toBeDisabled();
  await expect(text).toHaveCSS('border-top-style', 'none');
  await expect(text).toHaveCSS('padding-top', '0px');
});

test('text font resizing fits the element box to rendered content', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Text Font Fit');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await page.keyboard.press('t');

  const slider = page.locator('#fontSizeSliderControl');
  await slider.evaluate((input: HTMLInputElement) => {
    input.value = '144';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect.poll(async () => page.locator('.canvas-element.text').evaluate((node) => {
    const text = node.querySelector('.text-content') as HTMLElement;
    const canvas = node.closest('.canvas') as HTMLElement;
    const canvasRect = canvas.getBoundingClientRect();
    const styleW = Number((node as HTMLElement).style.getPropertyValue('--w'));
    const styleH = Number((node as HTMLElement).style.getPropertyValue('--h'));
    const renderedW = Math.round((text.offsetWidth / canvasRect.width) * 10000) / 100;
    const renderedH = Math.round((text.offsetHeight / canvasRect.height) * 10000) / 100;
    return Math.abs(styleW - renderedW) < 0.2 && Math.abs(styleH - renderedH) < 0.2;
  })).toBe(true);

  const fit = await page.locator('.canvas-element.text').evaluate((node) => {
    const text = node.querySelector('.text-content') as HTMLElement;
    const canvas = node.closest('.canvas') as HTMLElement;
    const canvasRect = canvas.getBoundingClientRect();
    const styleW = Number((node as HTMLElement).style.getPropertyValue('--w'));
    const styleH = Number((node as HTMLElement).style.getPropertyValue('--h'));
    const renderedW = Math.round((text.offsetWidth / canvasRect.width) * 10000) / 100;
    const renderedH = Math.round((text.offsetHeight / canvasRect.height) * 10000) / 100;
    return { styleW, styleH, renderedW, renderedH };
  });
  expect(Math.abs(fit.styleW - fit.renderedW)).toBeLessThan(0.2);
  expect(Math.abs(fit.styleH - fit.renderedH)).toBeLessThan(0.2);
});

test('Ctrl+Arrow keeps focus inside canvas text editing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Text Ctrl Arrow');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();

  await page.keyboard.press('t');
  const editor = page.getByRole('textbox', { name: 'Edit text on canvas' });
  await editor.fill('Alpha beta gamma');
  await page.keyboard.press('Control+ArrowLeft');
  await expect(editor).toBeFocused();
  await expect(page.locator('.canvas-element.text.selected.editing')).toBeVisible();
  await expect(editor).toHaveText('Alpha beta gamma');

  await page.keyboard.press('Control+ArrowRight');
  await expect(editor).toBeFocused();
  await expect(page.locator('.canvas-element.text.selected.editing')).toBeVisible();
});

test('text can be dragged while selected or editing and keeps compact handles/toolbars', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Text Drag Toolbar');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await page.keyboard.press('t');

  const editor = page.getByRole('textbox', { name: 'Edit text on canvas' });
  await editor.fill('Drag me');
  await expect(page.locator('.canvas-element.text.selected.editing .handle.resize-bottom-right')).toHaveCount(0);
  await expect(page.locator('.canvas-element.text.selected.editing .handle.resize-right')).toHaveCount(0);
  await expect(page.locator('.canvas-element.text.selected.editing .text-drag-edge.drag-top')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Text style and justification' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Horizontal alignment' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Vertical alignment' })).toBeVisible();

  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(page.locator('.text-content')).toHaveCSS('font-weight', '800');
  await page.getByRole('button', { name: 'Justify text left' }).click();
  await expect(page.locator('.text-content')).toHaveCSS('text-align', 'left');

  await page.keyboard.press('Escape');
  const before = await page.locator('.canvas-element.text').boundingBox();
  const toolbarBefore = await page.getByRole('toolbar', { name: 'Text style and justification' }).boundingBox();
  if (!before || !toolbarBefore) throw new Error('Missing text element bounds before drag');
  const textBox = await page.locator('.text-content').boundingBox();
  const selectionFrame = await page.locator('.text-selection-frame').boundingBox();
  if (!textBox || !selectionFrame) throw new Error('Missing text content bounds before drag');
  expect(Math.abs(selectionFrame.width - textBox.width)).toBeLessThan(4);
  expect(Math.abs(selectionFrame.height - textBox.height)).toBeLessThan(4);

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 80, before.y + before.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const afterBodyDrag = await page.locator('.canvas-element.text').boundingBox();
  if (!afterBodyDrag) throw new Error('Missing text element bounds after body drag');
  expect(Math.abs(afterBodyDrag.x - before.x)).toBeLessThan(4);
  expect(Math.abs(afterBodyDrag.y - before.y)).toBeLessThan(4);

  const dragEdge = await page.locator('.canvas-element.text .text-drag-edge.drag-left').boundingBox();
  if (!dragEdge) throw new Error('Missing text drag edge');
  await page.mouse.move(dragEdge.x + dragEdge.width / 2, dragEdge.y + dragEdge.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragEdge.x + dragEdge.width / 2 + 80, dragEdge.y + dragEdge.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.canvas-element.text')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Text style and justification' })).toBeVisible();
  const after = await page.locator('.canvas-element.text').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await expect(page.getByRole('toolbar', { name: 'Text style and justification' })).toBeVisible();
  expect(after.x).toBeGreaterThan(before.x + 20);
  expect(after.y).toBeGreaterThan(before.y + 10);
  await expect(page.locator('.canvas-element.text .handle.resize-right')).toHaveCount(0);
});

test('font selector fuzzy dropdown previews valid fonts and commits only on selection', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Font Combobox');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await page.keyboard.press('t');

  const editor = page.getByRole('textbox', { name: 'Edit text on canvas' });
  await editor.fill('Font me');
  await page.keyboard.press('Escape');

  const fontInput = page.locator('#fontControl');
  await fontInput.focus();
  await expect(page.locator('#fontResults')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Inter' })).toBeVisible();

  await fontInput.fill('conso');
  await expect(page.getByRole('option', { name: 'Consolas' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Consolas' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.text-content')).toHaveCSS('font-family', /Consolas/);

  await fontInput.fill('geo');
  await page.getByRole('option', { name: 'Georgia' }).hover();
  await expect(page.locator('.text-content')).toHaveCSS('font-family', /Georgia/);

  await fontInput.fill('not a font');
  await expect(fontInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#fontWarning')).toBeVisible();
  await expect(page.locator('#fontWarning')).toContainText('“not a font” is not available. The text element is still using Consolas.');
  await expect(page.locator('.text-content')).toHaveCSS('font-family', /Consolas/);

  await fontInput.fill('geo');
  await page.getByRole('option', { name: 'Georgia' }).click();
  await expect(page.locator('.text-content')).toHaveCSS('font-family', /Georgia/);
});

test('delete button and Delete shortcut confirm before removing an element', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder('new project name').fill('Delete Confirm');
  await page.getByRole('button', { name: 'Create new project' }).click();
  await page.getByRole('option', { name: /Blank project/ }).click();
  await expect(page.getByLabel('Editable page canvas')).toBeVisible();

  await page.keyboard.press('t');
  const editor = page.getByRole('textbox', { name: 'Edit text on canvas' });
  await editor.fill('Delete me');
  await page.keyboard.press('Escape');
  const textElement = page.getByRole('button', { name: /text element/i });
  await expect(textElement).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete this text element?');
    await dialog.dismiss();
  });
  await page.keyboard.press('Delete');
  await expect(textElement).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete this text element?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete element' }).click();
  await expect(textElement).toBeHidden();
});
