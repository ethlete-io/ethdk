import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, expectFocusVisible, openStory, pressKey, tap } from '../support';

const DEFAULT_STORY_ID = 'components-forms-cascader--default';
const DEEP_STORY_ID = 'components-forms-cascader--deep-nesting';
const COLUMN_WIDTH = 220;

async function openWithKeyboard(page: Page) {
  await pressKey(page, 'Tab');
  await pressKey(page, 'Enter');
  await expect(page.getByRole('tree')).toBeVisible();
}

async function drillWithArrowRight(page: Page, levels: number, lastLabel: string) {
  for (let i = 0; i < levels; i++) {
    await pressKey(page, 'ArrowRight');
  }

  await expect(page.getByRole('treeitem', { name: lastLabel, exact: true })).toBeFocused();
}

function columnWindow(page: Page) {
  return page.locator('.et-cascader-columns:not([data-sheet])');
}

async function inlineOffsetsInWindow(page: Page, columns: Locator) {
  const windowLeft = (await boxOf(columnWindow(page))).x;

  return columns.evaluateAll(
    (elements, left) => elements.map((el) => Math.round(el.getBoundingClientRect().left - left)),
    windowLeft,
  );
}

async function expectNodeFocusVisible(node: Locator, unfocused: Locator) {
  await expectFocusVisible(node);

  const background = (el: Element) => getComputedStyle(el).backgroundColor;

  expect(await node.evaluate(background)).not.toBe(await unfocused.evaluate(background));
}

test.describe('cascader panel / anchored', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: the anchored panel');

  test('opens right under the field, start edges aligned, and is not a sheet', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const frame = root.locator('.et-form-field-control-frame');

    await root.getByRole('combobox').click();

    const panel = page.locator('.et-cascader-panel');

    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute('data-sheet');

    const field = await boxOf(frame);
    const box = await boxOf(panel);

    expect(Math.abs(box.x - field.x)).toBeLessThanOrEqual(1);
    expect(box.y).toBeGreaterThanOrEqual(field.y + field.height);
    expect(box.y - (field.y + field.height)).toBeLessThanOrEqual(12);
  });

  test('a mouse pick closes the panel and hands focus back to the trigger', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await trigger.click();
    await page.getByRole('treeitem', { name: 'UEFA Euro' }).click();
    await page.getByRole('treeitem', { name: 'Group stage' }).click();
    await page.getByRole('treeitem', { name: 'Group A' }).click();

    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toContainText('UEFA Euro / Group stage / Group A');
  });

  test('a click outside closes the panel without pulling focus back', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const trigger = root.getByRole('combobox');

    await trigger.click();
    await expect(page.getByRole('tree')).toBeVisible();

    await page.mouse.click(1200, 650);

    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(trigger).not.toBeFocused();
  });

  test('a node reached with the arrow keys shows the focus ring and its own background', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await openWithKeyboard(page);
    await pressKey(page, 'ArrowDown');

    await expectNodeFocusVisible(
      page.getByRole('treeitem', { name: 'World Cup' }),
      page.getByRole('treeitem', { name: 'UEFA Euro' }),
    );
  });
});

test.describe('cascader panel / column window', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: Miller columns are the desktop presentation');

  test('the window grows a column per level up to three, then holds its width', async ({ page }) => {
    await openStory(page, DEEP_STORY_ID);
    const window = columnWindow(page);

    await openWithKeyboard(page);
    await expect.poll(async () => (await boxOf(window)).width).toBe(COLUMN_WIDTH);

    await drillWithArrowRight(page, 2, 'League 1');
    await expect.poll(async () => (await boxOf(window)).width).toBe(COLUMN_WIDTH * 3);

    await drillWithArrowRight(page, 2, 'Team 1');
    await expect.poll(async () => (await boxOf(window)).width).toBe(COLUMN_WIDTH * 3);
  });

  test('a drill past the window slides the oldest level out to the left and shows the trail below', async ({
    page,
  }) => {
    await openStory(page, DEEP_STORY_ID);
    const columns = page.locator('.et-cascader-column');

    await openWithKeyboard(page);
    await drillWithArrowRight(page, 3, 'Club 1');

    await expect(columns).toHaveCount(4);
    await expect.poll(() => inlineOffsetsInWindow(page, columns)).toEqual([-COLUMN_WIDTH, 0, COLUMN_WIDTH, 440]);
    await expect(columns.first()).toHaveClass(/et-cascader-column--offstage/);

    const crumbs = page.locator('.et-cascader-breadcrumb');

    await expect(crumbs.first()).toHaveText('Region 1');
    expect((await boxOf(crumbs.first())).y).toBeGreaterThan((await boxOf(columnWindow(page))).y);
  });

  test('a crumb anchors the window at its level and keeps the deeper levels drilled', async ({ page }) => {
    await openStory(page, DEEP_STORY_ID);
    const columns = page.locator('.et-cascader-column');

    await openWithKeyboard(page);
    await drillWithArrowRight(page, 4, 'Team 1');

    await page.locator('.et-cascader-breadcrumb', { hasText: 'Region 1' }).click();

    await expect(page.getByRole('treeitem', { name: 'Region 1', exact: true })).toBeFocused();
    await expect.poll(async () => (await inlineOffsetsInWindow(page, columns))[0]).toBe(0);
    await expect(columns).toHaveCount(5);
  });

  test('ArrowLeft past the window edge slides the hidden level back in', async ({ page }) => {
    await openStory(page, DEEP_STORY_ID);
    const columns = page.locator('.et-cascader-column');

    await openWithKeyboard(page);
    await drillWithArrowRight(page, 3, 'Club 1');
    await expect.poll(async () => (await inlineOffsetsInWindow(page, columns))[0]).toBe(-COLUMN_WIDTH);

    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowLeft');

    await expect(page.getByRole('treeitem', { name: 'Region 1', exact: true })).toBeFocused();
    await expect.poll(async () => (await inlineOffsetsInWindow(page, columns))[0]).toBe(0);
  });
});

test.describe('cascader panel / sheet header', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: the bottom sheet');

  test('the title names the branch drilled into and moves clear of the back control', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const header = page.locator('.et-cascader-sheet-header');
    const title = header.locator('.et-cascader-sheet-title:not(.et-cascader-sheet-title--leave)');

    await tap(root.getByRole('combobox'));
    await expect(header).not.toHaveAttribute('data-back');
    await expect(header.locator('.et-cascader-back')).toBeDisabled();

    await tap(page.getByRole('treeitem', { name: 'UEFA Euro' }));

    await expect(header).toHaveAttribute('data-back', 'true');
    await expect(title).toHaveText('UEFA Euro');
    await expect(header.locator('.et-cascader-sheet-title')).toHaveCount(1);

    const back = await boxOf(header.getByRole('button', { name: 'Back' }));

    await expect
      .poll(async () => (await boxOf(header.locator('.et-cascader-sheet-title-shift'))).x)
      .toBeGreaterThanOrEqual(back.x + back.width - 1);
  });

  test('two levels down, Back walks up one level at a time and the title follows', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const header = page.locator('.et-cascader-sheet-header');
    const title = header.locator('.et-cascader-sheet-title:not(.et-cascader-sheet-title--leave)');
    const back = header.getByRole('button', { name: 'Back' });

    await tap(root.getByRole('combobox'));
    await tap(page.getByRole('treeitem', { name: 'UEFA Euro' }));
    await tap(page.getByRole('treeitem', { name: 'Group stage' }));
    await expect(title).toHaveText('Group stage');

    await tap(back);

    await expect(title).toHaveText('UEFA Euro');
    await expect(page.getByRole('treeitem', { name: 'Group stage' })).toBeFocused();

    await tap(back);

    await expect(header.locator('.et-cascader-sheet-title')).toHaveCount(1);
    await expect(header).not.toHaveAttribute('data-back');
    await expect(page.getByRole('treeitem', { name: 'UEFA Euro' })).toBeFocused();
  });
});
