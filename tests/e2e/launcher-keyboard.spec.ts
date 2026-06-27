import { expect, test } from '@playwright/test';

test('project launcher keyboard moves between name input and recent projects', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByRole('dialog', { name: /keyboard-first/i })).toHaveCount(0);

  const input = page.getByPlaceholder('new project name');
  await input.fill('Keyboard Recent');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Choose a template' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Current project name')).toHaveText('Keyboard Recent');

  await expect(page).toHaveURL(/\/keyboard-recent$/);
  await page.goto('/');
  await expect(page.getByLabel('Project launcher')).toBeVisible();
  await expect(page.getByRole('option', { name: /Keyboard Recent/ })).toBeVisible();

  await input.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Keyboard Recent/ })).toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(input).toBeFocused();
});
