import { expect, test } from '@playwright/test';

test('single-clicking canvas text keeps canvas selection focus and double-click edits inline', async ({ page }) => {
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
  const editor = page.getByRole('textbox', { name: 'Edit markdown text on canvas' });
  await expect(editor).toBeVisible();
  await editor.fill('Click me');
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();

  const textElement = page.getByRole('button', { name: /text element/i });
  await textElement.click();
  await expect(textElement).toBeFocused();
  await expect(page.locator('#textControl')).not.toBeFocused();

  await textElement.dblclick();
  await expect(page.getByRole('textbox', { name: 'Edit markdown text on canvas' })).toBeVisible();
});
