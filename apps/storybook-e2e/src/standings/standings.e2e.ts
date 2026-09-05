import { Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tap } from '../support';

const DEFAULT_STORY_ID = 'components-sports-standings--default';
const COMPACT_STORY_ID = 'components-sports-standings--compact';
const NO_ZONES_STORY_ID = 'components-sports-standings--no-zones';

const HOST = 'et-standings';
const TABLE = '.et-standings-table';
const CAPTION = '.et-standings-caption';
const HEAD_CELL = '.et-standings-head-row .et-standings-cell';
const ROW = '.et-standings-row';
const ZONE_NOTE = '.et-standings-zone-note';
const LEGEND = '.et-standings-legend';
const LEGEND_ITEM = '.et-standings-legend-item';
const FORM_RESULT = '.et-standings-form-result';

const POSITIONS = ['1', '2', '3', '4', '5', '6'];
const PARTICIPANTS = ['FC Berlin', 'Neon Esports', 'Rote Löwen Pankow', 'Hafen United', 'Spree Rangers', 'Alpen Wölfe'];

const ADVANCES_LABEL = 'Advances to the playoffs';
const RELEGATED_LABEL = 'Relegated';
const HIGHLIGHTED_LABEL = 'Your team';

/** Header text, the `abbr` spelling it out, and the scope - in DOM order for the default story. */
const HEADERS: [text: string, abbr: string | null][] = [
  ['#', 'Position'],
  ['Team', null],
  ['P', 'Played'],
  ['W', 'Wins'],
  ['D', 'Draws'],
  ['L', 'Losses'],
  ['Diff', 'Difference'],
  ['Pts', 'Points'],
  ['Form', 'Recent form, oldest first'],
];

const NARROW_HEADERS = ['#', 'Team', 'Pts'];
const MEDIUM_HEADERS = ['#', 'Team', 'P', 'W', 'D', 'L', 'Diff', 'Pts'];

function columnDisplay(root: Locator, column: string): Promise<string> {
  return root
    .locator(`${ROW} .et-standings-cell[data-column="${column}"]`)
    .first()
    .evaluate((el) => getComputedStyle(el).display);
}

/** Header text as authored - `allInnerTexts` would return it uppercased by the header's text-transform. */
function visibleHeaderNames(root: Locator): Promise<string[]> {
  return root.getByRole('columnheader').evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ''));
}

/** How far the host and the table it wraps stick out past the space the host was given. */
function readSidewaysOverflow(root: Locator): Promise<{ host: number; table: number }> {
  return root.locator(HOST).evaluate((el) => {
    const table = el.querySelector('table') as HTMLElement;

    return { host: el.scrollWidth - el.clientWidth, table: table.scrollWidth - el.clientWidth };
  });
}

async function openAtWidth(page: Page, width: number): Promise<Locator> {
  return openStory(page, DEFAULT_STORY_ID, { args: { width } });
}

test.describe('standings / structure', () => {
  test('renders one real table with a caption naming it, kept out of the design but in the a11y tree', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(TABLE)).toHaveCount(1);

    const caption = root.locator(CAPTION);
    await expect(caption).toHaveText('Standings');

    const box = await caption.evaluate((el) => {
      const rect = el.getBoundingClientRect();

      return { width: rect.width, height: rect.height, clipPath: getComputedStyle(el).clipPath };
    });

    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
    expect(box.clipPath).not.toBe('none');
  });

  test('every column header is a th[scope=col] and every abbreviation carries its spelled-out abbr', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const headers = await root
      .locator(HEAD_CELL)
      .evaluateAll((els) =>
        els.map((el) => [el.tagName, el.getAttribute('scope'), el.textContent?.trim() ?? '', el.getAttribute('abbr')]),
      );

    expect(headers).toEqual(HEADERS.map(([text, abbr]) => ['TH', 'col', text, abbr]));
  });

  test('each position is a th[scope=row], and the rows keep the order they were passed in', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const rows = root.locator(ROW);

    await expect(rows).toHaveCount(POSITIONS.length);

    const positions = await rows
      .locator('[data-column="position"]')
      .evaluateAll((els) =>
        els.map((el) => [el.tagName, el.getAttribute('scope'), el.firstChild?.textContent?.trim() ?? '']),
      );

    expect(positions).toEqual(POSITIONS.map((position) => ['TH', 'row', position]));

    const names = await rows
      .locator('.et-match-participant-name')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));

    expect(names).toEqual(PARTICIPANTS);
  });

  test('a banded row carries its zone label as visually hidden text, not colour alone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const rows = root.locator(ROW);

    const zoneNotes = await rows.evaluateAll((els) =>
      els.map((el) => Array.from(el.querySelectorAll('.et-standings-zone-note')).map((note) => note.textContent)),
    );

    expect(zoneNotes).toEqual([[ADVANCES_LABEL], [ADVANCES_LABEL, HIGHLIGHTED_LABEL], [], [], [], [RELEGATED_LABEL]]);

    const note = await rows
      .first()
      .locator(ZONE_NOTE)
      .evaluate((el) => {
        const rect = el.getBoundingClientRect();

        return { width: rect.width, height: rect.height, clipPath: getComputedStyle(el).clipPath };
      });

    expect(note.width).toBeLessThanOrEqual(1);
    expect(note.height).toBeLessThanOrEqual(1);
    expect(note.clipPath).not.toBe('none');
  });

  test('banded rows are scoped to the zone colour theme the consumer named', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const rows = root.locator(ROW);

    await expect(rows.nth(0)).toHaveClass(/et-color--success/);
    await expect(rows.nth(1)).toHaveClass(/et-color--success/);
    await expect(rows.nth(2)).toHaveClass(/et-color--inherited/);
    await expect(rows.nth(5)).toHaveClass(/et-color--danger/);

    await expect(rows.nth(0)).toHaveAttribute('data-zone', '');
    await expect(root.locator(`${ROW}[data-zone]`)).toHaveCount(3);
  });

  test('the highlighted row is aria-current and announces the highlightedRow label', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const highlighted = root.locator(`${ROW}[aria-current="true"]`);

    await expect(highlighted).toHaveCount(1);
    await expect(highlighted.locator('.et-match-participant-name')).toHaveText(PARTICIPANTS[1]);
    await expect(highlighted.locator(ZONE_NOTE, { hasText: HIGHLIGHTED_LABEL })).toHaveCount(1);
  });

  test('every form result is labelled, since the column is a row of coloured squares', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const labels = await root
      .locator(ROW)
      .first()
      .locator(FORM_RESULT)
      .evaluateAll((els) => els.map((el) => [el.getAttribute('data-result'), el.getAttribute('aria-label')]));

    expect(labels).toEqual([
      ['win', 'Win'],
      ['win', 'Win'],
      ['loss', 'Loss'],
      ['win', 'Win'],
      ['win', 'Win'],
    ]);
  });

  test('the legend is a labelled list, one entry per zone, its swatch hidden from assistive tech', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const legend = root.locator(LEGEND);

    await expect(legend).toHaveAttribute('aria-label', 'What the highlighted positions mean');
    await expect(legend).toHaveRole('list');
    await expect(legend.locator(LEGEND_ITEM)).toHaveText([ADVANCES_LABEL, RELEGATED_LABEL]);
    await expect(legend.locator('.et-standings-legend-swatch').first()).toHaveAttribute('aria-hidden', 'true');
  });

  test('showLegend=false bands the rows without explaining them', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { showLegend: false } });

    await expect(root.locator(LEGEND)).toHaveCount(0);
    await expect(root.locator(`${ROW}[data-zone]`)).toHaveCount(3);
  });

  test('without zones there is no banding and no legend', async ({ page }) => {
    const root = await openStory(page, NO_ZONES_STORY_ID);

    await expect(root.locator(ROW)).toHaveCount(POSITIONS.length);
    await expect(root.locator(`${ROW}[data-zone]`)).toHaveCount(0);
    await expect(root.locator(ZONE_NOTE, { hasText: ADVANCES_LABEL })).toHaveCount(0);
    await expect(root.locator(LEGEND)).toHaveCount(0);
  });

  test('the density tokens resolve to their documented defaults, and a row is that tall', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const tokens = await root.locator(HOST).evaluate((el) => {
      const style = getComputedStyle(el);
      const read = (name: string) => style.getPropertyValue(name).trim();

      return {
        rowHeight: read('--et-standings-row-height'),
        cellPadding: read('--et-standings-cell-padding-inline'),
        zoneBarWidth: read('--et-standings-zone-bar-width'),
        fontSize: read('--et-standings-font-size'),
      };
    });

    expect(tokens).toEqual({ rowHeight: '44px', cellPadding: '8px', zoneBarWidth: '3px', fontSize: '13px' });

    const rowBox = await root.locator(ROW).first().boundingBox();
    expect(rowBox?.height).toBe(44);
  });

  test('a column nobody reports is dropped from the DOM entirely', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { withForm: false } });

    await expect(root.locator('[data-column="form"]')).toHaveCount(0);
    await expect(root.locator('[data-column="detail"]').first()).toBeAttached();
  });
});

test.describe('standings / density', () => {
  test.skip(({ isMobile }) => isMobile, 'needs a viewport wider than the widest breakpoint');

  test('at 720px and up the table shows every column, form included', async ({ page }) => {
    const root = await openAtWidth(page, 720);

    expect(await columnDisplay(root, 'detail')).toBe('table-cell');
    expect(await columnDisplay(root, 'form')).toBe('table-cell');
    expect(await visibleHeaderNames(root)).toEqual(HEADERS.map(([text]) => text));
  });

  test('below 720px the form column goes first', async ({ page }) => {
    const root = await openAtWidth(page, 719);

    expect(await columnDisplay(root, 'detail')).toBe('table-cell');
    expect(await columnDisplay(root, 'form')).toBe('none');
    expect(await visibleHeaderNames(root)).toEqual(MEDIUM_HEADERS);
  });

  test('at 560px the played/won/drawn/lost block and the difference are still there', async ({ page }) => {
    const root = await openAtWidth(page, 560);

    expect(await columnDisplay(root, 'detail')).toBe('table-cell');
    expect(await visibleHeaderNames(root)).toEqual(MEDIUM_HEADERS);
  });

  test('below 560px only position, participant and points survive', async ({ page }) => {
    const root = await openAtWidth(page, 559);

    expect(await columnDisplay(root, 'detail')).toBe('none');
    expect(await columnDisplay(root, 'form')).toBe('none');
    expect(await columnDisplay(root, 'position')).not.toBe('none');
    expect(await columnDisplay(root, 'participant')).not.toBe('none');
    expect(await columnDisplay(root, 'points')).not.toBe('none');
    expect(await visibleHeaderNames(root)).toEqual(NARROW_HEADERS);
  });

  test('a dropped column is never announced: the row exposes three cells, not nine', async ({ page }) => {
    const root = await openAtWidth(page, 559);

    await expect(root.getByRole('rowheader')).toHaveCount(POSITIONS.length);
    await expect(root.locator(ROW).first().getByRole('cell')).toHaveCount(NARROW_HEADERS.length - 1);
  });

  test('the compact story keeps the bands and the legend it dropped the columns for', async ({ page }) => {
    const root = await openStory(page, COMPACT_STORY_ID);

    expect(await visibleHeaderNames(root)).toEqual(NARROW_HEADERS);
    await expect(root.locator(`${ROW}[data-zone]`)).toHaveCount(3);
    await expect(root.locator(LEGEND_ITEM)).toHaveCount(2);
  });

  test('the table drops columns rather than scrolling sideways, down to the narrowest story width', async ({
    page,
  }) => {
    for (const width of [900, 719, 559, 280]) {
      const root = await openAtWidth(page, width);
      const overflow = await readSidewaysOverflow(root);

      expect(overflow.host, `host at ${width}px`).toBeLessThanOrEqual(1);
      expect(overflow.table, `table at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('standings / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('the table is presentational - Tab never stops inside it', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await page.keyboard.press('Tab');

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
  });

  test('it contributes no focusable element to the page', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const focusable = await root
      .locator(HOST)
      .evaluate((el) => el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length);

    expect(focusable).toBe(0);
  });
});

test.describe('standings / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('a phone gets the collapsed table, not a horizontal scrollbar', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
    expect(await visibleHeaderNames(root)).toEqual(NARROW_HEADERS);

    const overflow = await readSidewaysOverflow(root);

    expect(overflow.host).toBeLessThanOrEqual(1);
    expect(overflow.table).toBeLessThanOrEqual(1);
  });

  test('the zone bands and their legend survive the collapse', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(`${ROW}[data-zone]`)).toHaveCount(3);
    await expect(root.locator(LEGEND_ITEM)).toHaveText([ADVANCES_LABEL, RELEGATED_LABEL]);
  });

  test('tapping a row does nothing: there is no touch target here', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const row = root.locator(ROW).nth(2);

    await tap(row.locator('[data-column="participant"]'));

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(root.locator(`${ROW}[aria-current="true"]`)).toHaveCount(1);
  });
});
