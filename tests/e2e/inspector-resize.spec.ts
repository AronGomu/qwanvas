import { expect, test } from '@playwright/test';

async function seedProject(page) {
  const now = Date.now();
  await page.goto('/');
  await page.evaluate((createdAt) => localStorage.setItem('qwanvas.projects.v1', JSON.stringify([{
    id: 'resize-test',
    name: 'Resize Test',
    templateId: 'blank',
    kind: 'deck',
    width: 1080,
    height: 1350,
    createdAt,
    updatedAt: createdAt,
    activePageId: 'page-1',
    pages: [{ id: 'page-1', name: 'Page 1', width: 1080, height: 1350, backgroundId: 'blank', guideGrid: { visible: false, lines: 2 }, elements: [] }],
  }])), now);
  await page.goto('/resize-test');
}

test.afterEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('inspector resize handle changes the inspector width by drag and keyboard', async ({ page }) => {
  await seedProject(page);
  const handle = page.getByRole('separator', { name: 'Resize inspector panel' });
  await expect(handle).toBeVisible();

  const inspector = page.getByLabel('Selected element inspector');
  const initialWidth = await inspector.evaluate((node) => Math.round(node.getBoundingClientRect().width));
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('Inspector resize handle is not measurable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 80, handleBox.y + handleBox.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => inspector.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBeGreaterThan(initialWidth + 40);

  const widenedWidth = await inspector.evaluate((node) => Math.round(node.getBoundingClientRect().width));
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => inspector.evaluate((node) => Math.round(node.getBoundingClientRect().width))).toBeLessThan(widenedWidth);
});
