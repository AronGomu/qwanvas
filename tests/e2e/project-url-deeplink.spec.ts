import { expect, test } from '@playwright/test';

const STORE_KEY = 'qwanvas.projects.v1';

async function clearLocalStorage(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.afterEach(async ({ page }) => {
  await clearLocalStorage(page);
});

async function seedProject(page, name: string) {
  const now = Date.now();
  const project = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    templateId: 'blank',
    kind: 'deck',
    width: 1080,
    height: 1350,
    createdAt: now,
    updatedAt: now,
    activePageId: 'page-1',
    pages: [{ id: 'page-1', name: 'Page 1', width: 1080, height: 1350, backgroundId: 'blank', guideGrid: { visible: false, lines: 2 }, elements: [] }],
  };
  await clearLocalStorage(page);
  await page.evaluate(({ storeKey, projects }) => localStorage.setItem(storeKey, JSON.stringify(projects)), { storeKey: STORE_KEY, projects: [project] });
  await page.reload();
}

test('project URL path opens the matching project on refresh', async ({ page }) => {
  await seedProject(page, 'Deep Link Project');

  await page.goto('/deep-link-project');
  await expect(page.getByLabel('Project launcher')).toBeHidden();
  await expect(page.getByLabel('Editable page canvas')).toBeVisible();
  await expect(page.getByLabel('Current project name')).toHaveText('Deep Link Project');

  await page.reload();
  await expect(page.getByLabel('Project launcher')).toBeHidden();
  await expect(page.getByLabel('Current project name')).toHaveText('Deep Link Project');
});

test('opening a recent project writes the project name into the URL', async ({ page }) => {
  await seedProject(page, 'URL Selected Project');

  await page.goto('/');
  await page.getByRole('option', { name: /URL Selected Project/ }).click();
  await expect(page).toHaveURL(/\/url-selected-project$/);
  await expect(page.getByLabel('Current project name')).toHaveText('URL Selected Project');

  await page.reload();
  await expect(page.getByLabel('Project launcher')).toBeHidden();
  await expect(page.getByLabel('Current project name')).toHaveText('URL Selected Project');
});

test('unknown project URL path falls back to the launcher', async ({ page }) => {
  await seedProject(page, 'Known Project');

  await page.goto('/missing-project');
  await expect(page.getByLabel('Project launcher')).toBeVisible();
  await expect(page.getByLabel('Editable page canvas')).toBeHidden();
  await expect(page.getByRole('option', { name: /Known Project/ })).toBeVisible();
});
