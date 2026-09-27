import { Locator, Page, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Box, boxOf, expectFocusVisible, openStory, pressKey, tabUntilFocused, tap, touchDrag } from '../support';

const KEYBOARD_NAV_STORY_ID = 'components-data-display-table--keyboard-navigation';
const SELECTABLE_STORY_ID = 'components-data-display-table--selectable';
const ROW_INTERACTIVE_STORY_ID = 'components-data-display-table--row-interactive';
const EXPANDABLE_STORY_ID = 'components-data-display-table--expandable';
const MULTI_SORT_STORY_ID = 'components-data-display-table--multi-sort';
const SHIFT_MULTI_SORT_STORY_ID = 'components-data-display-table--shift-multi-sort';
const QUICK_FILTER_STORY_ID = 'components-data-display-table--quick-filter';
const PIN_COLUMNS_STORY_ID = 'components-data-display-table--pin-columns-at-runtime';
const DEFAULT_STORY_ID = 'components-data-display-table--default';
const VIRTUALIZED_STORY_ID = 'components-data-display-table--virtualized';
const REFETCHING_STORY_ID = 'components-data-display-table--refetching';
const GROUPED_HEADERS_STORY_ID = 'components-data-display-table--grouped-headers';
const PAGE_STICKY_HEADER_STORY_ID = 'components-data-display-table--page-sticky-header';
const STICKY_COLUMNS_STORY_ID = 'components-data-display-table--sticky-columns';
const DRAG_SCROLL_STORY_ID = 'components-data-display-table--drag-scroll';
const REORDERABLE_STORY_ID = 'components-data-display-table--reorderable';
const RESIZABLE_STORY_ID = 'components-data-display-table--resizable-columns';
const CSV_EXPORT_STORY_ID = 'components-data-display-table--csv-export';

const VIRTUAL_ROW_COUNT = 2000;

function cell(root: Locator, rowIndex: number, colKey: string): Locator {
  return root.locator('.et-table-row').nth(rowIndex).locator(`[data-col-key="${colKey}"]`);
}

function headerCell(root: Locator, colKey: string): Locator {
  return root.locator(`.et-table-header-cell[data-col-key="${colKey}"]`);
}

function sortPriority(root: Locator, colKey: string): Locator {
  return headerCell(root, colKey).locator('.et-table-sort-priority');
}

function headerKeys(root: Locator): Promise<(string | null)[]> {
  return root
    .locator('.et-table-header-cell[data-col-key]')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-col-key')));
}

function columnMenuTrigger(root: Locator, header: string): Locator {
  return root.getByRole('button', { name: `Column options for ${header}` });
}

async function arrowDownUntilFocused(page: Page, target: Locator, maxPresses = 12): Promise<void> {
  for (let press = 0; press < maxPresses; press++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;

    await pressKey(page, 'ArrowDown');
  }

  await expect(target).toBeFocused();
}

function rowCheckbox(root: Locator, rowIndex = 0): Locator {
  return root.locator('.et-table-cell.et-table-select-cell').nth(rowIndex).locator('et-checkbox');
}

function resizeGrip(root: Locator, colKey: string): Locator {
  return headerCell(root, colKey).locator('.et-table-resize-grip');
}

function stickyClasses(root: Locator): Promise<string[]> {
  return root
    .locator('.et-table-header-cell[data-col-key]')
    .evaluateAll((cells) =>
      cells.flatMap((cell) =>
        ['et-table-sticky-start', 'et-table-sticky-end']
          .filter((name) => cell.classList.contains(name))
          .map((name) => `${cell.getAttribute('data-col-key')}:${name}`),
      ),
    );
}

async function pressAndMove(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();

  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(from.x + ((to.x - from.x) * step) / 12, from.y + ((to.y - from.y) * step) / 12);
  }
}

function centerOf(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

interface VirtualWindow {
  renderedRows: number;
  rowHeight: number;
  scrollHeight: number;
  headerHeight: number;
  spacerStart: number;
  spacerEnd: number;
  firstRowTop: number;
  lastRowBottom: number;
  bodyTop: number;
  bodyBottom: number;
}

function readVirtualWindow(root: Locator): Promise<VirtualWindow> {
  return root.locator('et-table').evaluate((table) => {
    const rows = Array.from(table.querySelectorAll('.et-table-row'));
    const spacers = Array.from(table.querySelectorAll<HTMLElement>('.et-table-spacer'));
    const cellBox = (row: Element) => (row.querySelector('.et-table-cell') as HTMLElement).getBoundingClientRect();
    const header = (table.querySelector('.et-table-header-cell') as HTMLElement).getBoundingClientRect();
    const host = table.getBoundingClientRect();

    return {
      renderedRows: rows.length,
      rowHeight: cellBox(rows[0] as Element).height,
      scrollHeight: table.scrollHeight,
      headerHeight: header.height,
      spacerStart: spacers[0]?.getBoundingClientRect().height ?? 0,
      spacerEnd: spacers[1]?.getBoundingClientRect().height ?? 0,
      firstRowTop: cellBox(rows[0] as Element).top,
      lastRowBottom: cellBox(rows[rows.length - 1] as Element).bottom,
      bodyTop: header.bottom,
      bodyBottom: host.top + table.clientTop + table.clientHeight,
    };
  });
}

async function scrollTableTo(root: Locator, top: number): Promise<void> {
  const table = root.locator('et-table');

  await table.evaluate((element, to) => element.scrollTo({ top: to }), top);
  await expect.poll(() => table.evaluate((element) => Math.round(element.scrollTop))).toBe(top);
}

function firstCellTop(root: Locator): Promise<number> {
  return root
    .locator('.et-table-row')
    .first()
    .locator('.et-table-cell')
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
}

async function downloadCsv(page: Page, buttonName: string): Promise<{ filename: string; lines: string[] }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  const text = readFileSync(await download.path(), 'utf8').replace(/^\uFEFF/, '');

  return { filename: download.suggestedFilename(), lines: text.trim().split(/\r?\n/) };
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

  test('Shift + Enter adds a header to the sort and plain Enter replaces it', async ({ page }) => {
    const root = await openStory(page, SHIFT_MULTI_SORT_STORY_ID);
    const nameButton = headerCell(root, 'name').locator('button');

    await tabUntilFocused(page, nameButton);
    await pressKey(page, 'Enter');
    await pressKey(page, 'Tab');
    await pressKey(page, 'Shift+Enter');

    await expect(headerCell(root, 'name')).toHaveAttribute('aria-sort', 'ascending');
    await expect(headerCell(root, 'email')).toHaveAttribute('aria-sort', 'ascending');
    await expect(sortPriority(root, 'name')).toHaveText('1');
    await expect(sortPriority(root, 'email')).toHaveText('2');
    await expect(headerCell(root, 'email').locator('button')).toHaveAccessibleDescription('Sort priority 2 of 2');

    await pressKey(page, 'Enter');

    await expect(headerCell(root, 'name')).toHaveAttribute('aria-sort', 'none');
    await expect(headerCell(root, 'email')).toHaveAttribute('aria-sort', 'descending');
    await expect(sortPriority(root, 'email')).toHaveCount(0);
  });

  test('typing into the search field narrows the rows to the quick filter', async ({ page }) => {
    const root = await openStory(page, QUICK_FILTER_STORY_ID);
    const search = root.getByRole('searchbox', { name: 'Search people' });
    const rows = root.locator('.et-table-row');

    await expect(rows).toHaveCount(6);
    await tabUntilFocused(page, search);
    await page.keyboard.type('admin');

    await expect(rows).toHaveCount(2);
    await expect(cell(root, 0, 'name')).toHaveText('Ada Lovelace 1');

    await page.keyboard.type(' kath');

    await expect(rows).toHaveCount(1);
    await expect(cell(root, 0, 'name')).toHaveText('Katherine Johnson 1');

    await pressKey(page, 'ControlOrMeta+a');
    await pressKey(page, 'Backspace');

    await expect(rows).toHaveCount(6);
  });

  test('the column menu pins a column to the start edge from the keyboard', async ({ page }) => {
    const root = await openStory(page, PIN_COLUMNS_STORY_ID);

    await tabUntilFocused(page, columnMenuTrigger(root, 'Email'), 20);
    await pressKey(page, 'Enter');
    await arrowDownUntilFocused(page, page.getByRole('menuitem', { name: 'Pin to start' }));
    await pressKey(page, 'Enter');

    await expect(headerCell(root, 'email')).toHaveClass(/et-table-sticky-start/);
    expect(await headerKeys(root)).toEqual(['email', 'name', 'role', 'joined']);

    await tabUntilFocused(page, columnMenuTrigger(root, 'Email'), 20);
    await pressKey(page, 'Enter');
    await arrowDownUntilFocused(page, page.getByRole('menuitem', { name: 'Unpin' }));
    await pressKey(page, 'Enter');

    await expect(headerCell(root, 'email')).not.toHaveClass(/et-table-sticky-start/);
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

test.describe('table / pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: modifier clicks and mouse input');

  test('Shift + click adds a header to the sort without selecting text', async ({ page }) => {
    const root = await openStory(page, SHIFT_MULTI_SORT_STORY_ID);

    await headerCell(root, 'joined').locator('button').click();
    await cell(root, 2, 'email').click();
    await headerCell(root, 'name')
      .locator('button')
      .click({ modifiers: ['Shift'] });

    await expect(sortPriority(root, 'joined')).toHaveText('1');
    await expect(sortPriority(root, 'name')).toHaveText('2');
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');

    await headerCell(root, 'name')
      .locator('button')
      .click({ modifiers: ['Shift'] });

    await expect(headerCell(root, 'name')).toHaveAttribute('aria-sort', 'descending');
    await expect(sortPriority(root, 'name')).toHaveText('2');
  });

  test('a column pinned from the menu moves to its edge and stays put while the table scrolls', async ({ page }) => {
    const root = await openStory(page, PIN_COLUMNS_STORY_ID);

    await columnMenuTrigger(root, 'Role').click();
    await page.getByRole('menuitem', { name: 'Pin to start' }).click();

    await expect(headerCell(root, 'role')).toHaveClass(/et-table-sticky-start/);
    expect(await headerKeys(root)).toEqual(['role', 'name', 'email', 'joined']);

    const before = await boxOf(headerCell(root, 'role'));
    await root.locator('et-table').evaluate((table) => table.scrollBy({ left: 300 }));
    await expect.poll(() => root.locator('et-table').evaluate((table) => table.scrollLeft)).toBeGreaterThan(0);

    expect((await boxOf(headerCell(root, 'role'))).x).toBeCloseTo(before.x, 0);

    await columnMenuTrigger(root, 'Role').click();
    await page.getByRole('menuitem', { name: 'Unpin' }).click();

    await expect(headerCell(root, 'role')).not.toHaveClass(/et-table-sticky-start/);
    expect(await headerKeys(root)).toEqual(['name', 'email', 'role', 'joined']);
  });

  test('a quick filter that matches nothing shows the empty state', async ({ page }) => {
    const root = await openStory(page, QUICK_FILTER_STORY_ID);

    await root.getByRole('searchbox', { name: 'Search people' }).click();
    await page.keyboard.type('nobody here');

    await expect(root.locator('.et-table-row')).toHaveCount(0);
    await expect(root.getByText('No people found')).toBeVisible();
  });

  test('a sticky end column sits on the trailing edge and stays there while the table scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 720 });
    const root = await openStory(page, STICKY_COLUMNS_STORY_ID);
    const table = root.locator('et-table');
    const tableRight = await table.evaluate(
      (element) => element.getBoundingClientRect().left + element.clientLeft + element.clientWidth,
    );

    await expect.poll(() => stickyClasses(root)).toEqual(['name:et-table-sticky-start', 'joined:et-table-sticky-end']);
    const joined = await boxOf(headerCell(root, 'joined'));
    expect(joined.x + joined.width).toBeCloseTo(tableRight, 0);

    await table.evaluate((element) => element.scrollTo({ left: 120 }));
    await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    expect((await boxOf(headerCell(root, 'joined'))).x).toBeCloseTo(joined.x, 0);
    expect((await boxOf(headerCell(root, 'name'))).x).toBeCloseTo((await boxOf(table)).x + 1, -1);
  });

  test('pinning is suspended on a viewport too narrow for it and resumes when there is room', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 720 });
    const root = await openStory(page, STICKY_COLUMNS_STORY_ID);

    await expect.poll(() => stickyClasses(root)).toEqual(['name:et-table-sticky-start', 'joined:et-table-sticky-end']);

    await page.setViewportSize({ width: 500, height: 720 });
    await expect.poll(() => stickyClasses(root)).toEqual([]);

    await page.setViewportSize({ width: 900, height: 720 });
    await expect.poll(() => stickyClasses(root)).toEqual(['name:et-table-sticky-start', 'joined:et-table-sticky-end']);
  });

  test('dragging the body pans the table sideways without selecting text', async ({ page }) => {
    const root = await openStory(page, DRAG_SCROLL_STORY_ID);
    const table = root.locator('et-table');
    const start = centerOf(await boxOf(cell(root, 0, 'email')));

    await pressAndMove(page, start, { x: start.x - 150, y: start.y });

    await expect(table).toHaveClass(/et-table-host--dragging/);

    await page.mouse.up();

    await expect.poll(() => table.evaluate((element) => Math.round(element.scrollLeft))).toBe(150);
    await expect(table).not.toHaveClass(/et-table-host--dragging/);
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  });

  test('dragging a header previews the new order with a ghost and commits it on release', async ({ page }) => {
    const root = await openStory(page, REORDERABLE_STORY_ID);
    const name = await boxOf(headerCell(root, 'name'));
    const email = await boxOf(headerCell(root, 'email'));

    await pressAndMove(
      page,
      { x: name.x + 40, y: name.y + name.height / 2 },
      { x: email.x + email.width - 20, y: name.y + name.height / 2 },
    );

    await expect(page.locator('.et-table-drag-ghost')).toBeVisible();
    await expect(headerCell(root, 'name')).toHaveClass(/et-table-header-cell--dragging/);
    await expect.poll(async () => (await boxOf(headerCell(root, 'email'))).x).toBeCloseTo(name.x, 0);

    await page.mouse.up();

    await expect.poll(() => headerKeys(root)).toEqual(['email', 'name', 'role', 'joined']);
    await expect(page.locator('.et-table-drag-ghost')).toHaveCount(0);
  });

  test('dragging a resize grip widens its column and a double click resets it', async ({ page }) => {
    const root = await openStory(page, RESIZABLE_STORY_ID);
    const before = await boxOf(headerCell(root, 'name'));
    const grip = centerOf(await boxOf(resizeGrip(root, 'name')));

    await pressAndMove(page, grip, { x: grip.x + 80, y: grip.y });
    await page.mouse.up();

    await expect.poll(async () => (await boxOf(headerCell(root, 'name'))).width).toBeCloseTo(before.width + 80, -1);
    expect(await headerKeys(root)).toEqual(['name', 'email', 'role', 'joined']);

    await resizeGrip(root, 'name').dblclick();

    await expect.poll(async () => (await boxOf(headerCell(root, 'name'))).width).toBeCloseTo(before.width, 0);
  });

  test('the CSV export downloads the visible columns and rows as a file', async ({ page }) => {
    const root = await openStory(page, CSV_EXPORT_STORY_ID);
    const firstName = (await cell(root, 0, 'name').textContent())?.trim();

    const all = await downloadCsv(page, 'Export CSV');

    expect(all.filename).toBe('people.csv');
    expect(all.lines[0]).toBe('Name,Email,Role,Joined');
    expect(all.lines).toHaveLength(7);
    expect(all.lines[1]?.startsWith(`${firstName},`)).toBe(true);

    await rowCheckbox(root, 2).click();
    const thirdName = (await cell(root, 2, 'name').textContent())?.trim();

    const selection = await downloadCsv(page, 'Export selection');

    expect(selection.filename).toBe('people-selection.csv');
    expect(selection.lines).toHaveLength(2);
    expect(selection.lines[1]?.startsWith(`${thirdName},`)).toBe(true);
  });
});

test.describe('table / layout', () => {
  test('a virtualized table renders a window of rows sized from a measured row, not the estimate', async ({ page }) => {
    const root = await openStory(page, VIRTUALIZED_STORY_ID);
    const top = await readVirtualWindow(root);

    expect(top.renderedRows).toBeLessThan(40);
    expect(top.spacerStart).toBe(0);
    expect(top.rowHeight).not.toBeCloseTo(48, 0);
    expect(top.spacerEnd).toBeCloseTo((VIRTUAL_ROW_COUNT - top.renderedRows) * top.rowHeight, -1);
    expect(top.scrollHeight - top.headerHeight).toBeCloseTo(VIRTUAL_ROW_COUNT * top.rowHeight, -2);
  });

  test('a virtualized table keeps the viewport covered with rows after a long scroll', async ({ page }) => {
    const root = await openStory(page, VIRTUALIZED_STORY_ID);

    await scrollTableTo(root, 20_000);

    await expect.poll(async () => (await readVirtualWindow(root)).spacerStart).toBeGreaterThan(19_000);

    const deep = await readVirtualWindow(root);

    expect(deep.renderedRows).toBeLessThan(40);
    expect(deep.firstRowTop).toBeLessThanOrEqual(deep.bodyTop);
    expect(deep.lastRowBottom).toBeGreaterThanOrEqual(deep.bodyBottom);
    expect(deep.spacerStart + deep.spacerEnd + deep.renderedRows * deep.rowHeight).toBeCloseTo(
      VIRTUAL_ROW_COUNT * deep.rowHeight,
      -1,
    );
  });

  test('a refetch over rows on screen runs a 2px busy bar that moves no row', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const restingTop = await firstCellTop(root);

    await openStory(page, REFETCHING_STORY_ID);

    const bar = root.locator('.et-table-busy-bar');

    await expect(bar).toBeVisible();
    await expect(root.locator('et-table')).toHaveAttribute('aria-busy', 'true');
    await expect(root.locator('.et-table-row')).toHaveCount(6);
    expect((await boxOf(bar)).height).toBe(2);
    expect(await firstCellTop(root)).toBeCloseTo(restingTop, 0);
  });

  test('under reduced motion the busy bar is a static accent across the table', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await openStory(page, REFETCHING_STORY_ID);
    const bar = root.locator('.et-table-busy-bar');

    await expect(bar).toBeVisible();

    const sweep = await bar.evaluate((element) => {
      const after = getComputedStyle(element, '::after');

      return { width: parseFloat(after.width), animation: after.animationName, barWidth: element.clientWidth };
    });

    expect(sweep.animation).toBe('none');
    expect(sweep.width).toBeCloseTo(sweep.barWidth, 0);
  });

  test('grouped headers stay stacked at the top of a scrolled table', async ({ page }) => {
    const root = await openStory(page, GROUPED_HEADERS_STORY_ID, { args: { rowCount: 40, constrainHeight: '!true' } });
    const table = root.locator('et-table');
    const groupCell = root.locator('.et-table-group-cell').first();

    await scrollTableTo(root, 400);

    const hostTop = await table.evaluate((element) => element.getBoundingClientRect().top + element.clientTop);
    const group = await boxOf(groupCell);
    const header = await boxOf(headerCell(root, 'email'));

    expect(group.y).toBeCloseTo(hostTop, 0);
    expect(Math.abs(header.y - (group.y + group.height))).toBeLessThanOrEqual(1);
  });

  test('a page-sticky header pins to the viewport, tracks the body sideways and stops at the table end', async ({
    page,
  }) => {
    const root = await openStory(page, PAGE_STICKY_HEADER_STORY_ID);
    await page.addStyleTag({ content: '#storybook-root { padding-block-end: 150vh; }' });
    const strip = root.locator('.et-table-header-strip');
    const bodyEmail = root.locator('.et-table-row').nth(20).locator('[data-col-key="email"]');

    await page.evaluate(() => window.scrollTo({ top: 800 }));
    await expect.poll(async () => (await boxOf(strip)).y).toBeCloseTo(0, 0);

    await root.locator('.et-table-scroller').evaluate((scroller) => scroller.scrollTo({ left: 150 }));
    await expect
      .poll(async () => (await boxOf(headerCell(root, 'email'))).x)
      .toBeCloseTo((await boxOf(bodyEmail)).x, 0);

    const tableBottom = await root
      .locator('et-table')
      .evaluate((element) => element.getBoundingClientRect().bottom + window.scrollY);

    await page.evaluate((to) => window.scrollTo({ top: to }), tableBottom - 20);

    await expect.poll(async () => (await boxOf(strip)).y).toBeLessThan(0);
    const stripBox = await boxOf(strip);
    const tableBox = await boxOf(root.locator('et-table'));
    expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(tableBox.y + tableBox.height + 1);
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

  test('pinning is suspended on a phone viewport', async ({ page }) => {
    const root = await openStory(page, STICKY_COLUMNS_STORY_ID);

    await expect(headerCell(root, 'joined')).toBeVisible();
    await expect.poll(() => stickyClasses(root)).toEqual([]);
  });

  test('a touch pan scrolls the drag-scroll table natively, without the drag feature', async ({ page }) => {
    const root = await openStory(page, DRAG_SCROLL_STORY_ID);
    const table = root.locator('et-table');
    const tableBox = await boxOf(table);
    const start = { x: tableBox.x + tableBox.width - 40, y: centerOf(await boxOf(cell(root, 0, 'name'))).y };

    await touchDrag(page, start, { x: start.x - 150, y: start.y });

    await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(table).not.toHaveClass(/et-table-host--dragging/);
  });

  test('a resize grip widens to a finger-sized hit area and resizes by touch', async ({ page }) => {
    const root = await openStory(page, RESIZABLE_STORY_ID);
    const before = await boxOf(headerCell(root, 'name'));
    const gripBox = await boxOf(resizeGrip(root, 'name'));
    const grip = centerOf(gripBox);

    expect(gripBox.width).toBe(28);

    await touchDrag(page, grip, { x: grip.x + 60, y: grip.y });

    await expect.poll(async () => (await boxOf(headerCell(root, 'name'))).width).toBeCloseTo(before.width + 60, -1);
  });

  test('a touch drag on a header reorders the column', async ({ page }) => {
    test.fail(
      true,
      'reorderable header cells lack touch-action: none, so the browser takes the pan and cancels the drag',
    );
    const root = await openStory(page, REORDERABLE_STORY_ID);
    const name = await boxOf(headerCell(root, 'name'));
    const email = await boxOf(headerCell(root, 'email'));

    await touchDrag(
      page,
      { x: name.x + 30, y: name.y + name.height / 2 },
      { x: email.x + email.width - 10, y: name.y + name.height / 2 },
    );

    await expect.poll(() => headerKeys(root), { timeout: 2000 }).toEqual(['email', 'name', 'role', 'joined']);
  });
});
