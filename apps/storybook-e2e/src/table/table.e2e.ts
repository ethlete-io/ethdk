import { Locator, Page, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const KEYBOARD_NAV_STORY_ID = 'components-data-display-table--keyboard-navigation';
const SELECTABLE_STORY_ID = 'components-data-display-table--selectable';
const ROW_INTERACTIVE_STORY_ID = 'components-data-display-table--row-interactive';
const EXPANDABLE_STORY_ID = 'components-data-display-table--expandable';
const MULTI_SORT_STORY_ID = 'components-data-display-table--multi-sort';

function cell(root: Locator, rowIndex: number, colKey: string): Locator {
  return root.locator('.et-table-row').nth(rowIndex).locator(`[data-col-key="${colKey}"]`);
}

function headerCell(root: Locator, colKey: string): Locator {
  return root.locator(`.et-table-header-cell[data-col-key="${colKey}"]`);
}

function rowCheckbox(root: Locator, rowIndex = 0): Locator {
  return root.locator('.et-table-cell.et-table-select-cell').nth(rowIndex).locator('et-checkbox');
}

async function tabUntilFocused(page: Page, locator: Locator, maxTabs = 10): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    await pressKey(page, 'Tab');

    if (await locator.evaluate((el) => el === document.activeElement)) return;
  }

  await expect(locator).toBeFocused();
}

test.describe('table / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard grid navigation');

  test('the table body is a single tab stop and the focus ring is visible on the focused cell', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, { args: { columnMenu: false } });
    const nameCell = cell(root, 0, 'name');

    await tabUntilFocused(page, nameCell);
    await expectFocusVisible(nameCell);

    await pressKey(page, 'Tab');

    await expect(nameCell).not.toBeFocused();

    const insideBody = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'gridcell');
    expect(insideBody).toBe(false);
  });

  test('arrow keys move focus between cells and clamp at the edges', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, { args: { columnMenu: false } });

    await tabUntilFocused(page, cell(root, 0, 'name'));

    await pressKey(page, 'ArrowRight');
    await expect(cell(root, 0, 'email')).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(cell(root, 0, 'role')).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(cell(root, 0, 'joined')).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(cell(root, 0, 'joined')).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(cell(root, 1, 'joined')).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(cell(root, 1, 'role')).toBeFocused();

    await pressKey(page, 'ArrowUp');
    await expect(cell(root, 0, 'role')).toBeFocused();
  });

  test('Home and End move focus to the first and last cell of the row', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, { args: { columnMenu: false } });

    await tabUntilFocused(page, cell(root, 0, 'name'));
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowRight');
    await expect(cell(root, 1, 'email')).toBeFocused();

    await pressKey(page, 'End');
    await expect(cell(root, 1, 'joined')).toBeFocused();

    await pressKey(page, 'Home');
    await expect(cell(root, 1, 'name')).toBeFocused();
  });

  test('Ctrl+Home and Ctrl+End move focus to the first and last cell of the grid', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, { args: { columnMenu: false } });

    await tabUntilFocused(page, cell(root, 0, 'name'));
    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'ArrowRight');

    await pressKey(page, 'Control+End');
    await expect(cell(root, 11, 'joined')).toBeFocused();

    await pressKey(page, 'Control+Home');
    await expect(cell(root, 0, 'name')).toBeFocused();
  });

  test('Enter drills into a cell holding a control, and Escape moves back to the cell', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, { args: { columnMenu: false } });
    const joinedCell = cell(root, 0, 'joined');

    await tabUntilFocused(page, cell(root, 0, 'name'));
    await pressKey(page, 'End');
    await expect(joinedCell).toBeFocused();

    await pressKey(page, 'Enter');
    await expect(joinedCell.locator('button')).toBeFocused();

    await pressKey(page, 'Escape');
    await expect(joinedCell).toBeFocused();
  });

  test('Enter on a cell holding a control drills in without firing rowClick', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, {
      args: { columnMenu: false, rowInteractive: true },
    });
    const joinedCell = cell(root, 0, 'joined');
    const readout = root.getByText(/^Last clicked:/);

    await tabUntilFocused(page, cell(root, 0, 'name'));
    await pressKey(page, 'End');
    await pressKey(page, 'Enter');

    await expect(joinedCell.locator('button')).toBeFocused();
    await expect(readout).toHaveText('Last clicked: -');
  });

  test('Enter on a cell with nothing to open activates an interactive row', async ({ page }) => {
    const root = await openStory(page, KEYBOARD_NAV_STORY_ID, {
      args: { columnMenu: false, rowInteractive: true },
    });
    const nameCell = cell(root, 0, 'name');
    const readout = root.getByText(/^Last clicked:/);
    const name = (await nameCell.textContent())?.trim();

    await tabUntilFocused(page, nameCell);
    await pressKey(page, 'Enter');

    await expect(nameCell).toBeFocused();
    await expect(readout).toHaveText(`Last clicked: ${name}`);
  });

  test('Space toggles a selectable row checkbox', async ({ page }) => {
    const root = await openStory(page, SELECTABLE_STORY_ID);
    const checkbox = rowCheckbox(root, 0);

    await tabUntilFocused(page, checkbox);
    await expectFocusVisible(checkbox);
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, 'Space');
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'Space');
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  test('a selection checkbox has an accessible name from the table label set', async ({ page }) => {
    const root = await openStory(page, SELECTABLE_STORY_ID);

    await expect(rowCheckbox(root, 0)).toHaveAccessibleName('Select row');
  });

  test('a sortable header toggles aria-sort through the cycle with Enter', async ({ page }) => {
    const root = await openStory(page, MULTI_SORT_STORY_ID);
    const nameHeader = headerCell(root, 'name');
    const nameSortButton = nameHeader.locator('button');

    await tabUntilFocused(page, nameSortButton);
    await expectFocusVisible(nameSortButton);
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');

    await pressKey(page, 'Enter');
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    await pressKey(page, 'Enter');
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');

    await pressKey(page, 'Enter');
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');
  });

  test('the expander button toggles aria-expanded', async ({ page }) => {
    const root = await openStory(page, EXPANDABLE_STORY_ID);
    const expanderButton = root.locator('.et-table-row').first().locator('.et-table-expander');

    await tabUntilFocused(page, expanderButton);
    await expectFocusVisible(expanderButton);
    await expect(expanderButton).toHaveAttribute('aria-expanded', 'false');
    await expect(expanderButton).toHaveAccessibleName('Expand row');

    await pressKey(page, 'Enter');
    await expect(expanderButton).toHaveAttribute('aria-expanded', 'true');
    await expect(expanderButton).toHaveAccessibleName('Collapse row');
  });
});

test.describe('table / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('a tap on an interactive row activates it', async ({ page }) => {
    const root = await openStory(page, ROW_INTERACTIVE_STORY_ID);
    const secondRow = root.locator('.et-table-row').nth(1);
    const name = (await secondRow.locator('[data-col-key="name"]').textContent())?.trim();

    await tap(secondRow);

    await expect(root.getByText(`Last clicked: ${name}`)).toBeVisible();
  });

  test('a tap on the expander expands the row', async ({ page }) => {
    const root = await openStory(page, EXPANDABLE_STORY_ID);
    const expanderButton = root.locator('.et-table-row').first().locator('.et-table-expander');

    await tap(expanderButton);

    await expect(expanderButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('a tap on a selection checkbox toggles it', async ({ page }) => {
    const root = await openStory(page, SELECTABLE_STORY_ID);
    const checkbox = rowCheckbox(root, 0);

    await tap(checkbox);

    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });
});
