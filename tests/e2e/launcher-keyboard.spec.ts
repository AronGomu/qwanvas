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
  await page.getByRole('option').first().click();
  await expect(page.getByLabel('Current project name')).toHaveText('Keyboard Recent');

  await expect(page).toHaveURL(/\/keyboard-recent$/);
  await page.goto('/');
  await expect(page.getByLabel('Project launcher')).toBeVisible();
  const recentProject = page.getByRole('option', { name: /Keyboard Recent/ });
  await expect(recentProject).toBeVisible();

  await input.focus();
  await expect(recentProject).toHaveCSS('outline-style', 'none');

  await page.keyboard.press('ArrowDown');
  await expect(recentProject).toBeFocused();
  await expect(recentProject).toHaveCSS('outline-style', 'solid');

  await page.keyboard.press('ArrowUp');
  await expect(input).toBeFocused();
});
