import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

const imageFile = (name: string) => ({ name, mimeType: 'image/png', buffer: png1x1 });

async function runCommand(page: Page, command: string) {
  await page.keyboard.press('Control+P');
  const input = page.locator('#commandSearch');
  await expect(input).toBeVisible();
  await input.fill(command.startsWith('/') ? command : `/${command}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('#commandPalette')).toBeHidden();
}

async function addTextWithShortcut(page: Page, text: string) {
  await page.keyboard.press('t');
  const editor = page.getByRole('textbox', { name: 'Edit text on canvas' });
  await expect(editor).toBeVisible();
  await editor.fill(text);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(page.getByRole('button', { name: /text element/i }).last()).toContainText(text.replace(/[*#]/g, '').trim().split('\n')[0]);
}

async function addImageWithShortcut(page: Page, name: string) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 1_000 }).catch(() => null);
  await page.keyboard.press('i');
  const chooser = await chooserPromise;
  if (chooser) await chooser.setFiles(imageFile(name));
  else await page.locator('#imageInput').setInputFiles(imageFile(name));
  await expect(page.getByRole('button', { name: /image element/i }).last()).toBeVisible();
}

async function clickWithMouse(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected locator to have a visible bounding box before mouse click');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test('full offline project journey stays fast and user-clickable', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const started = Date.now();

  try {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page).toHaveTitle(/Qwanvas/);
    await expect(page.getByRole('dialog', { name: /keyboard-first/i })).toHaveCount(0);

    await expect(page.getByLabel('Project launcher')).toBeVisible();
    await expect(page.getByPlaceholder('new project name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create new project' })).toBeDisabled();
    await expect(page.getByLabel('Recent projects').getByText('No recent projects yet.')).toBeVisible();
    await expect(page.getByLabel('Editable page canvas')).toBeHidden();

    await page.getByPlaceholder('new project name').fill('Full Journey Post');
    await expect(page.getByRole('button', { name: 'Create new project' })).toBeEnabled();
    await page.getByRole('button', { name: 'Create new project' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose a template' })).toBeVisible();
    await expect(page.getByRole('option', { name: /Blank project/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /LinkedIn post/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /LinkedIn carousel/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /YouTube thumbnail/ })).toBeVisible();
    await page.getByRole('option', { name: /Blank project/ }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByLabel('Project launcher')).toBeHidden();
    await expect(page.getByLabel('Editable page canvas')).toBeVisible();
    await expect(page.getByLabel('Current project name')).toHaveText('Full Journey Post');
    await expect(page.locator('#statusResolution')).toHaveText('1200×1200');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 1/1');
    await expect(page.getByLabel('Canvas zoom percentage')).toHaveValue('100');
    await expect(page.getByRole('button', { name: /Settings/ })).toBeVisible();
    await expect(page.locator('.status-help')).toContainText('Command palette');

    await addTextWithShortcut(page, 'Journey headline');
    await runCommand(page, 'x 42');
    await runCommand(page, 'y 36');
    await runCommand(page, 'size 48 16');
    await runCommand(page, 'font 72');
    await runCommand(page, 'color #ff3366');
    await runCommand(page, 'rotate 8');
    await expect(page.getByRole('button', { name: /text element/i })).toHaveAttribute('style', /--x:\s*42;\s*--y:\s*36;\s*--w:\s*62;\s*--h:\s*12;\s*--r:\s*8/);
    await expect(page.getByRole('button', { name: /text element/i })).not.toHaveAttribute('style', /--crop-(?:top|bottom):/);
    await expect(page.locator('.canvas-element.text .text-content')).toHaveAttribute('style', /font-size:\s*calc\(72 \/ var\(--page-width, 1080\) \* 100cqw\)/);

    await addImageWithShortcut(page, 'post-image.png');
    await runCommand(page, 'x 64');
    await runCommand(page, 'y 68');
    await runCommand(page, 'size 28 28');
    await runCommand(page, 'rotate -12');
    await expect(page.getByRole('button', { name: /image element/i })).toHaveAttribute('style', /--x:\s*64;\s*--y:\s*68;\s*--w:\s*28;\s*--h:\s*28;\s*--r:\s*-12/);

    await expect(page).toHaveURL(/\/full-journey-post$/);
    await page.reload();
    await expect(page.getByLabel('Project launcher')).toBeHidden();
    await expect(page.getByLabel('Editable page canvas')).toBeVisible();
    await expect(page.getByText('Journey headline')).toBeVisible();

    await page.goto('/');
    await expect(page.getByLabel('Project launcher')).toBeVisible();
    await page.getByPlaceholder('new project name').fill('Full Journey Post');
    await expect(page.getByRole('button', { name: 'Create new project' })).toBeDisabled();
    await expect(page.getByText('A project named “Full Journey Post” already exists.')).toBeVisible();
    await expect(page.getByRole('option', { name: /Full Journey Post/ })).toBeVisible();
    await page.getByRole('option', { name: /Full Journey Post/ }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByLabel('Current project name')).toHaveText('Full Journey Post');
    await expect(page.locator('#statusResolution')).toHaveText('1200×1200');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 1/1');
    await expect(page.getByText('Journey headline')).toBeVisible();
    await expect(page.getByRole('button', { name: /image element/i })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Project launcher')).toBeHidden();
    await expect(page.getByLabel('Current project name')).toHaveText('Full Journey Post');
    await expect(page.getByText('Journey headline')).toBeVisible();
    await expect(page.getByRole('button', { name: /image element/i })).toBeVisible();

    await runCommand(page, 'background aurora-grid');
    await expect(page.locator('#canvas')).toHaveClass(/background-grid/);

    await runCommand(page, 'project');
    await expect(page.getByRole('dialog', { name: 'Choose a template' })).toBeVisible();
    await page.getByRole('option', { name: /Blank project/ }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Current project name')).toHaveText('New Project');
    await expect(page.locator('#statusResolution')).toHaveText('1200×1500');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 1/1');

    await runCommand(page, 'page');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 2/2');
    await runCommand(page, 'page');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 3/3');
    await page.keyboard.press('Control+ArrowUp');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 2/3');
    await page.keyboard.press('Control+ArrowLeft');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 1/3');
    await page.keyboard.press('Control+ArrowDown');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 2/3');
    await page.keyboard.press('Control+ArrowRight');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 3/3');

    await runCommand(page, 'background aurora-grid all');
    await expect(page.locator('#canvas')).toHaveClass(/background-grid/);
    await page.keyboard.press('Control+ArrowUp');
    await expect(page.locator('#canvas')).toHaveClass(/background-grid/);
    await page.keyboard.press('Control+ArrowDown');

    await addTextWithShortcut(page, '# Carousel close');
    await runCommand(page, 'x 38');
    await runCommand(page, 'y 28');
    await runCommand(page, 'size 52 18');
    await runCommand(page, 'font 68');
    await runCommand(page, 'color #2244ff');
    await addImageWithShortcut(page, 'carousel-image.png');
    await runCommand(page, 'x 66');
    await runCommand(page, 'y 66');
    await runCommand(page, 'size 34 34');
    await runCommand(page, 'rotate 14');

    const downloadPromise = page.waitForEvent('download');
    await runCommand(page, 'json');
    const download = await downloadPromise;
    const jsonPath = await download.path();
    if (!jsonPath) throw new Error('Expected local Playwright download path for exported JSON');
    const exported = JSON.parse(await readFile(jsonPath, 'utf8'));
    expect(exported.name).toBe('New Project');
    expect(exported.kind).toBe('deck');
    expect(exported.width).toBe(1200);
    expect(exported.height).toBe(1500);
    expect(exported.pages).toHaveLength(3);
    expect(exported.pages.every((pageData: any) => pageData.backgroundId === 'aurora-grid')).toBe(true);
    expect(exported.pages.at(-1).elements.some((element: any) => element.type === 'text' && element.text.includes('Carousel close'))).toBe(true);
    expect(exported.pages.at(-1).elements.some((element: any) => element.type === 'image' && element.src.startsWith('data:image/'))).toBe(true);

    await page.goto('/');
    await expect(page.getByLabel('Project launcher')).toBeVisible();
    await expect(page.locator('#projectLauncher .file-button')).toContainText('Import Project');
    await page.locator('#launcherImportProjectInput').setInputFiles(jsonPath);

    await expect(page.getByLabel('Editable page canvas')).toBeVisible();
    await expect(page.locator('#statusResolution')).toHaveText('1200×1500');
    await expect(page.locator('#statusPageCount')).toHaveText('Page 3/3');
    await expect(page.locator('#canvas')).toHaveClass(/background-grid/);
    await expect(page.getByText('Carousel close')).toBeVisible();
    await expect(page.getByRole('button', { name: /image element/i })).toBeVisible();
  } finally {
    const durationMs = Date.now() - started;
    testInfo.annotations.push({ type: 'full-journey-duration-ms', description: String(durationMs) });
    console.log(`[e2e baseline] full offline project journey: ${durationMs}ms`);
  }
});
