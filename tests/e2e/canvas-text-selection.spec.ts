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
  await page.mouse.move(beforeDrag.x + 1, beforeDrag.y + 10);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 71, beforeDrag.y + 40, { steps: 4 });
  await page.mouse.up();
  const afterDrag = await page.locator('.canvas-element.text').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 20);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 10);
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
  await expect(page.locator('.canvas-element.text.selected.editing .handle.resize-bottom-right')).toBeVisible();
  await expect(page.locator('.canvas-element.text.selected.editing .handle.resize-right')).toBeVisible();
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
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 80, before.y + before.height / 2 + 40, { steps: 5 });
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

  const fontSizeBefore = await page.locator('#fontSizeControl').inputValue();
  const resizeBefore = await page.locator('.canvas-element.text').boundingBox();
  if (!resizeBefore) throw new Error('Missing text element bounds before resize');
  const rightHandle = await page.locator('.handle.resize-right').boundingBox();
  if (!rightHandle) throw new Error('Missing right resize handle');
  const handleTargetClass = await page.evaluate(([x, y]) => {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    return `${element?.tagName || ''}:${element?.className || ''}:${element?.getAttribute('aria-label') || ''}`;
  }, [rightHandle.x + rightHandle.width / 2, rightHandle.y + rightHandle.height / 2]);
  expect(String(handleTargetClass)).toContain('resize-right');
  await page.mouse.move(rightHandle.x + rightHandle.width / 2, rightHandle.y + rightHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(rightHandle.x + rightHandle.width / 2 + 70, rightHandle.y + rightHandle.height / 2, { steps: 5 });
  await page.mouse.up();
  const resizeAfter = await page.locator('.canvas-element.text').boundingBox();
  if (!resizeAfter) throw new Error('Missing text element bounds after resize');
  expect(resizeAfter.width).toBeGreaterThan(resizeBefore.width + 20);
  expect(Math.abs(resizeAfter.x - resizeBefore.x)).toBeLessThan(20);
  await expect(page.locator('#fontSizeControl')).toHaveValue(fontSizeBefore);
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
