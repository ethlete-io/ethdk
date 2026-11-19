import { Locator, Page, expect, test } from '@playwright/test';
import { contrastAgainstPage, expectTouchMode, openStory, pressKey, settle, tabSequence, tap } from '../support';

const FOCUS_WALK_STORY_ID = 'components-forms-control-states--focus-walk';
const READONLY_STORY_ID = 'components-forms-control-states--readonly';
const DISABLED_STORY_ID = 'components-forms-control-states--disabled';
const ALL_STATES_STORY_ID = 'components-forms-control-states--all-states';

const BLOCK_SELECTOR =
  'et-form-field, et-choice-field, et-radio-group, et-checkbox-group, et-segmented-button-group, et-slider, et-range-slider, et-rating, et-otp-input, et-dropzone';

interface WalkStop {
  block: number;
  focusVisible: boolean;
}

/** Tabs until focus leaves the column, recording which control block each stop belongs to. */
async function walkColumn(page: Page, column: Locator, maxStops = 120): Promise<WalkStop[]> {
  const stops: WalkStop[] = [];

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab');

    const stop = await column.evaluate((el, selector) => {
      const active = document.activeElement;

      if (!active || !el.contains(active)) return null;

      const blocks = Array.from(el.querySelectorAll(selector));
      const block = active.closest(selector);

      return { block: block ? blocks.indexOf(block) : -1, focusVisible: active.matches(':focus-visible') };
    }, BLOCK_SELECTOR);

    if (!stop) break;

    stops.push(stop);
  }

  return stops;
}

function blockOrder(stops: readonly WalkStop[]): number[] {
  return stops.map((stop) => stop.block);
}

function distinctBlocks(stops: readonly WalkStop[]): number {
  return new Set(stops.map((stop) => stop.block)).size;
}

async function blockCount(column: Locator): Promise<number> {
  return column.evaluate((el, selector) => el.querySelectorAll(selector).length, BLOCK_SELECTOR);
}

test.describe('control-states / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab walks every control block in DOM order', async ({ page }) => {
    const root = await openStory(page, FOCUS_WALK_STORY_ID);
    const column = root.locator('et-sb-control-states-column');

    await expect(column.locator('et-dropzone')).toBeVisible();

    const stops = await walkColumn(page, column);
    const order = blockOrder(stops);

    expect(order).not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(distinctBlocks(stops)).toBe(await blockCount(column));
  });

  test('every tab stop is :focus-visible', async ({ page }) => {
    const root = await openStory(page, FOCUS_WALK_STORY_ID);
    const column = root.locator('et-sb-control-states-column');

    await expect(column.locator('et-dropzone')).toBeVisible();

    const stops = await walkColumn(page, column);

    expect(stops.length).toBeGreaterThan(0);
    expect(stops.filter((stop) => !stop.focusVisible)).toEqual([]);
  });

  test('the focus readout reports a shown ring for the first stop', async ({ page }) => {
    const root = await openStory(page, FOCUS_WALK_STORY_ID);

    await pressKey(page, 'Tab');

    await expect(root.getByText(/focus ring shown/)).toBeVisible();
    await expect(root.getByText('Input', { exact: true }).first()).toBeVisible();
  });

  test('a disabled column has no tab stops', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);

    await expect(root.locator('et-dropzone')).toBeVisible();

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('a readonly column keeps every control block reachable by Tab', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const column = root.locator('et-sb-control-states-column');

    await expect(column.locator('et-dropzone')).toBeVisible();

    const stops = await walkColumn(page, column);

    expect(stops.length).toBeGreaterThan(0);
    expect(blockOrder(stops)).toEqual([...blockOrder(stops)].sort((a, b) => a - b));
  });

  test('Space on a readonly checkbox does not toggle it', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const checkbox = root.getByRole('checkbox', { name: 'Checkbox', exact: true });

    await expect(checkbox).toBeChecked();

    await checkbox.focus();
    await pressKey(page, 'Space');

    await expect(checkbox).toBeChecked();
  });
});

test.describe('control-states / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, FOCUS_WALK_STORY_ID);

    await expectTouchMode(page);
  });

  test('tapping a readonly switch does not toggle it', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const toggle = root.getByRole('switch');

    await expect(toggle).toBeChecked();

    await tap(toggle);

    await expect(toggle).toBeChecked();
  });

  test('tapping a disabled checkbox does not toggle it', async ({ page }) => {
    const root = await openStory(page, DISABLED_STORY_ID);
    const checkbox = root.getByRole('checkbox', { name: 'Checkbox', exact: true });

    await expect(checkbox).toBeChecked();

    await checkbox.tap({ force: true });
    await settle(page, 150);

    await expect(checkbox).toBeChecked();
  });

  test('tapping a readonly radio leaves the selection where it was', async ({ page }) => {
    const root = await openStory(page, READONLY_STORY_ID);
    const group = root.getByRole('radiogroup').first();
    const radios = group.getByRole('radio');
    const checkedBefore = await radios.evaluateAll((els) => els.findIndex((el) => el.ariaChecked === 'true'));

    expect(checkedBefore).toBeGreaterThan(0);

    await tap(radios.first());

    const checkedAfter = await radios.evaluateAll((els) => els.findIndex((el) => el.ariaChecked === 'true'));

    expect(checkedAfter).toBe(checkedBefore);
  });
});

interface BorderedControl {
  name: string;
  hoverTarget: (column: Locator) => Locator;
  border: string;
  label: string;
  hoverHost?: boolean;
}

const BORDERED_CONTROLS: readonly BorderedControl[] = [
  ...(['et-input', 'et-textarea', 'et-select'] as const).map((tag) => ({
    name: tag,
    hoverTarget: (column: Locator) => column.locator(`et-form-field:has(${tag})`).first(),
    border: '.et-form-field-control-frame',
    label: '.et-form-field-label-area',
  })),
  {
    name: 'checkbox',
    hoverTarget: (column) => column.locator('et-choice-field:not([data-variant="card"]):has(et-checkbox)').first(),
    border: '.et-checkbox-box',
    label: '.et-choice-field-label-area',
  },
  {
    name: 'checkbox card',
    hoverTarget: (column) => column.locator('et-choice-field[data-variant="card"]:has(et-checkbox)').first(),
    border: '.et-selection-card',
    label: '.et-choice-field-label-area',
  },
  {
    name: 'radio',
    hoverTarget: (column) => column.locator('et-radio[aria-checked="false"]:not(.et-selection-card)').first(),
    border: '.et-radio-circle',
    label: '.et-radio-label',
  },
  {
    name: 'radio card',
    hoverTarget: (column) => column.locator('et-radio.et-selection-card[aria-checked="false"]').first(),
    border: ':scope',
    label: '.et-selection-card-label',
  },
  {
    name: 'checkbox group option',
    hoverTarget: (column) => column.locator('et-checkbox-option[aria-checked="false"]').first(),
    border: '.et-checkbox-option-box',
    label: '.et-checkbox-option-label',
  },
  {
    name: 'otp input',
    hoverTarget: (column) => column.locator('et-otp-input').first(),
    border: '.et-otp-input-segment',
    label: ':scope > et-label',
    hoverHost: true,
  },
];

async function renderAllOnSurface(root: Locator, surface: 'light' | 'dark'): Promise<void> {
  await root.evaluate((host, name) => {
    for (const el of [host, ...host.querySelectorAll('[class*="et-surface--"]')]) {
      for (const cls of [...el.classList]) {
        if (cls.startsWith('et-surface--')) el.classList.replace(cls, `et-surface--${name}`);
      }
    }
    document.documentElement.style.colorScheme = name;
    const scope = host.querySelector('et-form-field') ?? host;
    document.documentElement.style.background = getComputedStyle(scope).getPropertyValue(
      '--et-surface-background-solid',
    );
  }, surface);
  await root.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
}

async function colorOf(scope: Locator, selector: string, property: 'borderTopColor' | 'color'): Promise<string> {
  return scope.evaluate(
    (el, { selector, property }) => {
      const target = selector === ':scope' ? el : el.querySelector(selector);
      if (!target) throw new Error(`no ${selector}`);
      return getComputedStyle(target)[property];
    },
    { selector, property },
  );
}

test.describe('control-states / borders', () => {
  for (const surface of ['dark', 'light'] as const) {
    for (const control of BORDERED_CONTROLS) {
      test(`a resting ${control.name} border sits near 3:1 and hovers in its label colour (${surface})`, async ({
        page,
      }) => {
        const root = await openStory(page, ALL_STATES_STORY_ID);
        const target = control.hoverTarget(root.locator('et-sb-control-states-column').first());
        const border = control.border === ':scope' ? target : target.locator(control.border).first();

        const checked = target.locator('[aria-checked="true"]');
        if (await checked.count()) await checked.first().click();
        await renderAllOnSurface(root, surface);
        await page.mouse.move(0, 0);
        await expect
          .poll(async () => {
            const ratio = await contrastAgainstPage(border, 'borderTopColor');
            return ratio >= 3 && ratio <= 4 ? 'near 3:1' : ratio;
          })
          .toBe('near 3:1');

        await (control.hoverHost ? target : border).hover();
        await expect
          .poll(async () => {
            const [edge, label] = [
              await colorOf(target, control.border, 'borderTopColor'),
              await colorOf(target, control.label, 'color'),
            ];
            return edge === label ? 'label colour' : `${edge} vs ${label}`;
          })
          .toBe('label colour');
      });
    }
  }
});
