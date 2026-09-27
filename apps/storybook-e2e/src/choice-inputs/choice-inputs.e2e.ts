import { Locator, expect, test } from '@playwright/test';
import { expectFocusVisible, openStory, pressKey, tap } from '../support';

const CHECKBOX_DEFAULT = 'components-forms-checkbox--default';
const CHECKBOX_READONLY = 'components-forms-checkbox--readonly';
const SWITCH_DEFAULT = 'components-forms-switch--default';
const SWITCH_DISABLED = 'components-forms-switch--disabled';
const RADIO_GROUP_DEFAULT = 'components-forms-selection-list-radio-group--default';
const RADIO_GROUP_HORIZONTAL = 'components-forms-selection-list-radio-group--horizontal';
const CHECKBOX_GROUP_DEFAULT = 'components-forms-selection-list-checkbox-group--default';
const SEGMENTED_BUTTON_GROUP_DEFAULT = 'components-forms-selection-list-segmented-button-group--default';
const SEGMENTED_BUTTON_GROUP_TABS = 'components-forms-selection-list-segmented-button-group--tabs';

interface SegmentBackground {
  opacity: number;
  height: number;
  hostHeight: number;
  bottomGap: number;
}

function segmentBackground(segment: Locator): Promise<SegmentBackground> {
  return segment.evaluate((host) => {
    const background = host.querySelector('.et-segmented-button-bg');
    const rect = background?.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();

    return {
      opacity: Number(background ? getComputedStyle(background).opacity : 0),
      height: Math.round(rect?.height ?? 0),
      hostHeight: Math.round(hostRect.height),
      bottomGap: Math.round(hostRect.bottom - (rect?.bottom ?? 0)),
    };
  });
}

/**
 * Presses the key and reads the checked background's first FLIP keyframe before the 250ms slide ends.
 * The slide starts in the change detection after the key press, so it is polled for per frame.
 */
async function pressAndReadSlideStart(segment: Locator, key: string): Promise<number | null> {
  await segment.page().keyboard.press(key);

  return segment.evaluate(
    (host) =>
      new Promise<number | null>((resolve) => {
        const deadline = performance.now() + 1000;

        const read = () => {
          const [animation] = host.querySelector('.et-segmented-button-bg')?.getAnimations() ?? [];
          const first = (animation?.effect as KeyframeEffect | null)?.getKeyframes()[0];

          if (typeof first?.['transform'] === 'string') {
            resolve(new DOMMatrixReadOnly(first['transform']).m41);
          } else if (performance.now() > deadline) {
            resolve(null);
          } else {
            requestAnimationFrame(read);
          }
        };

        read();
      }),
  );
}

/** The switch and radio family draw the focus ring on a child, not on the focused host. */
async function expectChildFocusVisible(control: Locator, childSelector: string): Promise<void> {
  await expect(control).toBeFocused();

  const state = await control.evaluate((el, selector) => {
    const ring = el.querySelector(selector);
    const style = ring ? getComputedStyle(ring) : null;

    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: style?.outlineStyle ?? 'none',
      outlineColor: style?.outlineColor ?? 'transparent',
    };
  }, childSelector);

  expect(state.matchesFocusVisible).toBe(true);
  expect(state.outlineStyle).not.toBe('none');
  expect(state.outlineColor).not.toBe('transparent');
}

test.describe('choice-inputs / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the checkbox and the focus ring is visible', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_DEFAULT);
    const checkbox = root.getByRole('checkbox').first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(checkbox);
  });

  test('Tab reaches the switch and its track shows the focus ring', async ({ page }) => {
    const root = await openStory(page, SWITCH_DEFAULT);
    const toggle = root.getByRole('switch').first();

    await pressKey(page, 'Tab');

    await expectChildFocusVisible(toggle, '.et-switch-track');
  });

  test('Tab reaches the radio group as a single stop, with the ring on the active option', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const radios = root.getByRole('radio');

    await pressKey(page, 'Tab');

    await expectChildFocusVisible(radios.first(), '.et-radio-circle');

    await pressKey(page, 'Tab');
    await expect(radios.nth(1)).not.toBeFocused();
  });

  test('a disabled control is skipped in the tab order', async ({ page }) => {
    await openStory(page, SWITCH_DISABLED);

    await pressKey(page, 'Tab');

    const active = await page.evaluate(() => document.activeElement?.tagName ?? null);
    expect(active === 'BODY' || active === null).toBe(true);
  });
});

test.describe('choice-inputs / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard activation');

  test('Space toggles the checkbox', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_DEFAULT);
    const checkbox = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await pressKey(page, 'Tab');
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, ' ');

    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('Space toggles the switch', async ({ page }) => {
    const root = await openStory(page, SWITCH_DEFAULT);
    const toggle = root.getByRole('switch', { name: 'Enable notifications' });

    await pressKey(page, 'Tab');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, ' ');

    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('a readonly checkbox stays focusable but does not toggle', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_READONLY);
    const checkbox = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await pressKey(page, 'Tab');
    await expect(checkbox).toBeFocused();
    await expect(checkbox).toHaveAttribute('aria-readonly', 'true');

    await pressKey(page, ' ');

    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  test('a disabled switch does not toggle on Space even when focused', async ({ page }) => {
    const root = await openStory(page, SWITCH_DISABLED);
    const toggle = root.getByRole('switch').first();

    await toggle.evaluate((el) => (el as HTMLElement).focus());
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, ' ');

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('radio group arrow keys select while roving, wrapping at both ends', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const red = root.getByRole('radio', { name: 'Red' });
    const green = root.getByRole('radio', { name: 'Green' });
    const blue = root.getByRole('radio', { name: 'Blue' });

    await pressKey(page, 'Tab');
    await expect(red).toBeFocused();

    await pressKey(page, 'ArrowDown');
    await expect(green).toBeFocused();
    await expect(green).toHaveAttribute('aria-checked', 'true');
    await expect(red).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, 'ArrowDown');
    await expect(blue).toBeFocused();
    await expect(blue).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowDown');
    await expect(red).toBeFocused();
    await expect(red).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowUp');
    await expect(blue).toBeFocused();
    await expect(blue).toHaveAttribute('aria-checked', 'true');
  });

  test('all four arrow keys move a horizontal radio group', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_HORIZONTAL);
    const red = root.getByRole('radio', { name: 'Red' });
    const green = root.getByRole('radio', { name: 'Green' });

    await pressKey(page, 'Tab');
    await expect(red).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(green).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(red).toBeFocused();
  });

  test('checkbox group arrow keys move focus only, without changing selection', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_DEFAULT);
    const cheese = root.getByRole('checkbox', { name: 'Cheese' });
    const pepperoni = root.getByRole('checkbox', { name: 'Pepperoni' });

    await pressKey(page, 'Tab');
    await expect(cheese).toBeFocused();

    await pressKey(page, 'ArrowDown');

    await expect(pepperoni).toBeFocused();
    await expect(pepperoni).toHaveAttribute('aria-checked', 'false');
    await expect(cheese).toHaveAttribute('aria-checked', 'false');
  });

  test('segmented button group follows the same roving-selection pattern as radio', async ({ page }) => {
    const root = await openStory(page, SEGMENTED_BUTTON_GROUP_DEFAULT);
    const list = root.getByRole('radio', { name: 'List' });
    const grid = root.getByRole('radio', { name: 'Grid' });
    const table = root.getByRole('radio', { name: 'Table' });

    await pressKey(page, 'Tab');
    await expect(list).toBeFocused();
    await expect(list).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');
    await expect(grid).toBeFocused();
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect(list).toHaveAttribute('aria-checked', 'false');

    await pressKey(page, 'ArrowRight');
    await expect(table).toBeFocused();
    await expect(table).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'ArrowRight');
    await expect(list).toBeFocused();
    await expect(list).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('choice-inputs / segmented presentation', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard selection');

  test('the pill variant fills the checked segment and slides the fill in from the previous one', async ({ page }) => {
    const root = await openStory(page, SEGMENTED_BUTTON_GROUP_DEFAULT);
    const list = root.getByRole('radio', { name: 'List' });
    const grid = root.getByRole('radio', { name: 'Grid' });

    await expect(grid).toHaveAttribute('data-can-animate', 'true');
    expect(await segmentBackground(list)).toMatchObject({ opacity: 1 });
    expect((await segmentBackground(list)).height).toBe((await segmentBackground(list)).hostHeight);

    await pressKey(page, 'Tab');
    await expect(list).toBeFocused();

    expect(await pressAndReadSlideStart(grid, 'ArrowRight')).toBeLessThan(0);
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await segmentBackground(grid)).opacity).toBe(1);
    await expect.poll(async () => (await segmentBackground(list)).opacity).toBe(0);
  });

  test('the fill slides back towards the start when the selection moves left', async ({ page }) => {
    const root = await openStory(page, SEGMENTED_BUTTON_GROUP_DEFAULT);
    const list = root.getByRole('radio', { name: 'List' });
    const grid = root.getByRole('radio', { name: 'Grid' });
    const table = root.getByRole('radio', { name: 'Table' });

    await expect(grid).toHaveAttribute('data-can-animate', 'true');
    await pressKey(page, 'Tab');
    await expect(list).toBeFocused();
    await pressKey(page, 'End');
    await expect(table).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await segmentBackground(list)).opacity).toBe(0);

    expect(await pressAndReadSlideStart(grid, 'ArrowLeft')).toBeGreaterThan(0);
    await expect(grid).toHaveAttribute('aria-checked', 'true');
  });

  test('the tabs variant underlines the checked segment on a baseline instead of filling it', async ({ page }) => {
    const root = await openStory(page, SEGMENTED_BUTTON_GROUP_TABS);
    const list = root.getByRole('radio', { name: 'List' });
    const grid = root.getByRole('radio', { name: 'Grid' });

    const underline = await segmentBackground(list);
    expect(underline.opacity).toBe(1);
    expect(underline.height).toBeGreaterThan(0);
    expect(underline.height).toBeLessThan(underline.hostHeight / 4);
    expect(underline.bottomGap).toBe(0);
    expect((await segmentBackground(grid)).opacity).toBe(0);

    const baseline = await root
      .locator('.et-segmented-button-group-buttons')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(baseline).toContain('inset');

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');

    await expect.poll(async () => (await segmentBackground(grid)).opacity).toBe(1);
    await expect.poll(async () => (await segmentBackground(list)).opacity).toBe(0);
  });
});

test.describe('choice-inputs / Home, End and typeahead', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard navigation');

  test('a radio group jumps to its ends and to a typed prefix, checking as it moves', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const red = root.getByRole('radio', { name: 'Red' });
    const green = root.getByRole('radio', { name: 'Green' });
    const blue = root.getByRole('radio', { name: 'Blue' });

    await pressKey(page, 'Tab');
    await expect(red).toBeFocused();

    await pressKey(page, 'End');
    await expect(blue).toBeFocused();
    await expect(blue).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'Home');
    await expect(red).toBeFocused();
    await expect(red).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'g');
    await expect(green).toBeFocused();
    await expect(green).toHaveAttribute('aria-checked', 'true');
  });

  test('a checkbox group jumps to its ends and to a typed prefix without toggling', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_GROUP_DEFAULT);
    const cheese = root.getByRole('checkbox', { name: 'Cheese' });
    const pepperoni = root.getByRole('checkbox', { name: 'Pepperoni' });
    const mushrooms = root.getByRole('checkbox', { name: 'Mushrooms' });

    await pressKey(page, 'Tab');
    await expect(cheese).toBeFocused();

    await pressKey(page, 'End');
    await expect(mushrooms).toBeFocused();

    await pressKey(page, 'Home');
    await expect(cheese).toBeFocused();

    await pressKey(page, 'p');
    await expect(pepperoni).toBeFocused();

    await expect(root.getByRole('checkbox', { checked: true })).toHaveCount(0);
  });

  test('a segmented button group jumps to its ends and to a typed prefix', async ({ page }) => {
    const root = await openStory(page, SEGMENTED_BUTTON_GROUP_DEFAULT);
    const list = root.getByRole('radio', { name: 'List' });
    const grid = root.getByRole('radio', { name: 'Grid' });
    const table = root.getByRole('radio', { name: 'Table' });

    await pressKey(page, 'Tab');
    await expect(list).toBeFocused();

    await pressKey(page, 'End');
    await expect(table).toBeFocused();
    await expect(table).toHaveAttribute('aria-checked', 'true');

    await pressKey(page, 'Home');
    await expect(list).toBeFocused();

    await pressKey(page, 'g');
    await expect(grid).toBeFocused();
    await expect(grid).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('choice-inputs / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap toggles the checkbox', async ({ page }) => {
    const root = await openStory(page, CHECKBOX_DEFAULT);
    const checkbox = root.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    await tap(checkbox);

    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('a tap toggles the switch', async ({ page }) => {
    const root = await openStory(page, SWITCH_DEFAULT);
    const toggle = root.getByRole('switch', { name: 'Dark mode' });

    await tap(toggle);

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  test('a tap selects a radio option', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT);
    const green = root.getByRole('radio', { name: 'Green' });

    await tap(green);

    await expect(green).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('choice-inputs / support region', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: the fade does not depend on the input type');

  test('the hint and the error swap with an opacity-only fade, the leaving one out of flow', async ({ page }) => {
    const root = await openStory(page, RADIO_GROUP_DEFAULT, { args: { required: true, hint: 'Pick one' } });

    await page.evaluate(() => {
      const runs: { kind: string; property: string; position: string }[] = [];
      (window as unknown as { __supportRuns: typeof runs }).__supportRuns = runs;

      document.addEventListener('transitionrun', (event) => {
        const target = event.target as HTMLElement;

        if (!target.classList.contains('et-form-support-content')) return;

        runs.push({
          kind: target.classList.contains('et-form-support-hint') ? 'hint' : 'other',
          property: event.propertyName,
          position: getComputedStyle(target).position,
        });
      });
    });

    const option = root.getByRole('radio').first();

    await option.focus();
    await option.blur();

    await expect(root.locator('.et-form-support-errors')).toHaveAttribute('data-active', 'true');

    const readRuns = () =>
      page.evaluate(
        () =>
          (window as unknown as { __supportRuns: { kind: string; property: string; position: string }[] })
            .__supportRuns,
      );

    await expect
      .poll(async () => new Set((await readRuns()).map((run) => run.kind)))
      .toEqual(new Set(['hint', 'other']));

    const runs = await readRuns();

    expect(new Set(runs.map((run) => run.property))).toEqual(new Set(['opacity']));
    expect(runs.filter((run) => run.kind === 'hint').map((run) => run.position)).toContain('absolute');
  });

  test('the fade collapses under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, RADIO_GROUP_DEFAULT, { args: { required: true, hint: 'Pick one' } });
    const hint = root.locator('.et-form-support-hint');

    await expect(hint).toHaveCSS('transition-duration', '0.001s');
  });
});
