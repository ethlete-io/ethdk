import { Locator, expect, test } from '@playwright/test';
import { at, expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-description-list--default';
const STACKED_STORY_ID = 'components-data-display-description-list--stacked';

const LIST = '.et-description-list';

const PAIRS: [term: string, detail: string][] = [
  ['Name', 'Jane Doe'],
  ['Email', 'jane@example.com'],
  ['Role', 'Administrator'],
  ['Notes', 'Joined during the private beta and has opted into every early-access feature flag.'],
];

interface ListTokens {
  rowGap: string;
  columnGap: string;
  stackedTermGap: string;
  termMinWidth: string;
  termFontSize: string;
  detailFontSize: string;
}

function readTokens(list: Locator): Promise<ListTokens> {
  return list.evaluate((el) => {
    const read = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();

    return {
      rowGap: read('--et-description-list-row-gap'),
      columnGap: read('--et-description-list-column-gap'),
      stackedTermGap: read('--et-description-list-stacked-term-gap'),
      termMinWidth: read('--et-description-list-term-min-width'),
      termFontSize: read('--et-description-list-term-font-size'),
      detailFontSize: read('--et-description-list-detail-font-size'),
    };
  });
}

/** Resolves a custom property to the `rgb(...)` the browser would paint, so it can be compared to a computed colour. */
function resolveTokenColor(list: Locator, token: string): Promise<string> {
  return list.evaluate((el, name) => {
    const probe = document.createElement('div');

    probe.style.color = getComputedStyle(el).getPropertyValue(name).trim();
    el.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();

    return resolved;
  }, token);
}

function readRows(list: Locator): Promise<{ tag: string; text: string; top: number; left: number; bottom: number }[]> {
  return list.evaluate((el) =>
    Array.from(el.children).map((child) => {
      const rect = child.getBoundingClientRect();

      return {
        tag: child.tagName,
        text: child.textContent?.trim().replace(/\s+/g, ' ') ?? '',
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
      };
    }),
  );
}

test.describe('description-list / structure', () => {
  test('the host is a real dl whose dt/dd children alternate in source order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    await expect(list).toHaveCount(1);
    expect(await list.evaluate((el) => el.tagName)).toBe('DL');

    const children = await readRows(list);

    expect(children.map(({ tag, text }) => [tag, text])).toEqual(
      PAIRS.flatMap(([term, detail]) => [
        ['DT', term],
        ['DD', detail],
      ]),
    );
  });

  test('the terms and details keep their native term/definition semantics', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.getByRole('term')).toHaveCount(PAIRS.length);
    await expect(root.getByRole('definition')).toHaveCount(PAIRS.length);
    await expect(root.getByRole('term').first()).toHaveText(at(PAIRS, 0)[0]);
    await expect(root.getByRole('definition').first()).toHaveText(at(PAIRS, 0)[1]);
  });

  test('the list carries no role, tabindex or label that would override the native pairing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    await expect(list).not.toHaveAttribute('role', /.*/);
    await expect(list).not.toHaveAttribute('tabindex', /.*/);
    await expect(list).not.toHaveAttribute('aria-label', /.*/);
  });

  test('the default variant is inline: two columns, each term beside its own detail', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    await expect(list).toHaveAttribute('data-variant', 'inline');

    const layout = await list.evaluate((el) => {
      const style = getComputedStyle(el);

      return { display: style.display, columns: style.gridTemplateColumns, rowGap: style.rowGap, gap: style.columnGap };
    });

    expect(layout.display).toBe('grid');
    expect(layout.columns.split(' ')).toHaveLength(2);
    expect(layout.rowGap).toBe('8px');
    expect(layout.gap).toBe('16px');

    const children = await readRows(list);

    for (let i = 0; i < PAIRS.length; i++) {
      const term = at(children, i * 2);
      const detail = at(children, i * 2 + 1);

      expect(detail.top, at(PAIRS, i)[0]).toBeCloseTo(term.top, 0);
      expect(detail.left, at(PAIRS, i)[0]).toBeGreaterThan(term.left);
    }
  });

  test('the term column is never narrower than the documented minimum', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    const [termTrack] = await list.evaluate((el) =>
      getComputedStyle(el)
        .gridTemplateColumns.split(' ')
        .map((track) => Number.parseFloat(track)),
    );

    expect(termTrack).toBeGreaterThanOrEqual(120);
  });

  test('the public tokens resolve to their documented defaults', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    expect(await readTokens(root.locator(LIST))).toEqual({
      rowGap: '8px',
      columnGap: '16px',
      stackedTermGap: '2px',
      termMinWidth: '120px',
      termFontSize: '14px',
      detailFontSize: '14px',
    });
  });

  test('the term reads in the muted surface tone and the detail in the full one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    const colors = await list.evaluate((el) => {
      const term = el.querySelector('dt') as HTMLElement;
      const detail = el.querySelector('dd') as HTMLElement;

      return { term: getComputedStyle(term).color, detail: getComputedStyle(detail).color };
    });

    expect(colors.term).toBe(await resolveTokenColor(list, '--et-surface-color-muted-solid'));
    expect(colors.detail).toBe(await resolveTokenColor(list, '--et-surface-color-solid'));
    expect(colors.term).not.toBe(colors.detail);
  });

  test('both font-size tokens land on the rendered term and detail', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    const sizes = await list.evaluate((el) => ({
      term: getComputedStyle(el.querySelector('dt') as HTMLElement).fontSize,
      detail: getComputedStyle(el.querySelector('dd') as HTMLElement).fontSize,
    }));

    expect(sizes).toEqual({ term: '14px', detail: '14px' });
  });

  test('the stacked variant drops to one column and puts each term above its detail', async ({ page }) => {
    const root = await openStory(page, STACKED_STORY_ID);
    const list = root.locator(LIST);

    await expect(list).toHaveAttribute('data-variant', 'stacked');

    const layout = await list.evaluate((el) => {
      const style = getComputedStyle(el);

      return { columns: style.gridTemplateColumns, rowGap: style.rowGap };
    });

    expect(layout.columns.split(' ')).toHaveLength(1);
    expect(layout.rowGap).toBe('2px');

    const children = await readRows(list);

    for (let i = 0; i < PAIRS.length; i++) {
      const term = at(children, i * 2);
      const detail = at(children, i * 2 + 1);

      expect(detail.top, at(PAIRS, i)[0]).toBeGreaterThan(term.top);
      expect(detail.left, at(PAIRS, i)[0]).toBeCloseTo(term.left, 0);
    }
  });

  test('a stacked pair reads as one unit: the gap inside it is tighter than the gap to the next pair', async ({
    page,
  }) => {
    const root = await openStory(page, STACKED_STORY_ID);
    const children = await readRows(root.locator(LIST));

    const gaps = children.slice(0, -1).map((child, index) => Math.round(at(children, index + 1).top - child.bottom));

    expect(gaps).toEqual([2, 8, 2, 8, 2, 8, 2]);
  });

  test('a description list adds no tab stop and no focusable element of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const focusable = await root
      .locator(LIST)
      .evaluate((el) => el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length);

    expect(focusable).toBe(0);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });
});

test.describe('description-list / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('the inline variant still pairs term and detail on a phone, without scrolling sideways', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const list = root.locator(LIST);

    const children = await readRows(list);

    for (let i = 0; i < PAIRS.length; i++) {
      expect(at(children, i * 2 + 1).top, at(PAIRS, i)[0]).toBeCloseTo(at(children, i * 2).top, 0);
    }

    const overflow = await list.evaluate((el) => el.scrollWidth - el.clientWidth);

    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the stacked variant keeps every detail inside the viewport', async ({ page }) => {
    const root = await openStory(page, STACKED_STORY_ID);
    const list = root.locator(LIST);

    const overflow = await list.evaluate((el) => el.scrollWidth - el.clientWidth);

    expect(overflow).toBeLessThanOrEqual(1);

    const viewportWidth = page.viewportSize()?.width ?? 0;

    for (const child of await readRows(list)) {
      expect(child.left, child.text).toBeGreaterThanOrEqual(0);
      expect(child.left, child.text).toBeLessThan(viewportWidth);
    }
  });

  test('a tap on a term moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const term = root.getByRole('term').first();

    await tap(term);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(term).toBeVisible();
  });
});
