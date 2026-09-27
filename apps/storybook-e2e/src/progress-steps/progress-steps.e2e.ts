import { Page, expect, test } from '@playwright/test';
import { expectFocusVisible, focusedDescriptor, openStory, pressKey, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-navigation-progress-steps--default';
const AS_LINKS_STORY_ID = 'components-navigation-progress-steps--as-links';
const VERTICAL_STORY_ID = 'components-navigation-progress-steps--vertical';
const OUTCOMES_STORY_ID = 'components-navigation-progress-steps--outcomes';

const LINK_STEP = 'a[et-progress-step]';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StepGeometry {
  state: string;
  step: Rect;
  marker: Rect;
  label: Rect;
  connector: (Rect & { color: string }) | null;
  primary: string;
  border: string;
}

/** The generated counter text of every numbered marker, in DOM order. Only a layout snapshot carries it. */
async function markerNumbers(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { documents, strings } = await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: [] });
  const numbers: string[] = [];

  for (const document of documents) {
    const { nodes, layout } = document;

    layout.nodeIndex.forEach((nodeIndex, layoutIndex) => {
      const text = strings[layout.text[layoutIndex] ?? -1];
      const parent = nodes.parentIndex?.[nodeIndex] ?? -1;
      const attributes = nodes.attributes?.[parent] ?? [];
      const classIndex = attributes.findIndex((name, index) => index % 2 === 0 && strings[name] === 'class');
      const className = strings[attributes[classIndex + 1] ?? -1] ?? '';

      if (text && className.split(' ').includes('et-progress-step-marker-number')) numbers.push(text);
    });
  }

  return numbers;
}

function readSteps(page: Page): Promise<StepGeometry[]> {
  return page.locator('.et-progress-step').evaluateAll((steps) => {
    const rect = (el: Element) => {
      const { x, y, width, height } = el.getBoundingClientRect();

      return { x, y, width, height };
    };
    const resolve = (host: Element, value: string) => {
      const probe = document.createElement('span');
      probe.style.color = value;
      host.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();

      return color;
    };

    return steps.map((step) => {
      const after = getComputedStyle(step, '::after');
      const box = step.getBoundingClientRect();
      const connector =
        after.content === 'none'
          ? null
          : {
              x: box.x + parseFloat(after.left),
              y: box.y + parseFloat(after.top),
              width: parseFloat(after.width),
              height: parseFloat(after.height),
              color: after.backgroundColor,
            };

      return {
        state: step.getAttribute('data-state') ?? '',
        step: rect(step),
        marker: rect(step.querySelector('.et-progress-step-marker') ?? step),
        label: rect(step.querySelector('.et-progress-step-label') ?? step),
        connector,
        primary: resolve(step, 'var(--et-theme-color-primary-solid)'),
        border: resolve(step, 'var(--et-surface-border-solid)'),
      };
    });
  });
}

function stepAt(steps: StepGeometry[], index: number): StepGeometry {
  const step = steps[index];

  if (!step) throw new Error(`no progress step at index ${index}`);

  return step;
}

function centerX(rect: Rect): number {
  return rect.x + rect.width / 2;
}

function centerY(rect: Rect): number {
  return rect.y + rect.height / 2;
}

const NO_CONNECTOR = { x: 0, y: 0, width: 0, height: 0 };

function expectHorizontalConnectors(steps: StepGeometry[]): void {
  for (const [index, step] of steps.slice(0, -1).entries()) {
    const next = stepAt(steps, index + 1);
    const connector = step.connector ?? NO_CONNECTOR;

    expect(connector.x).toBeCloseTo(centerX(step.marker), 0);
    expect(connector.x + connector.width).toBeCloseTo(centerX(next.marker), 0);
    expect(connector.y + connector.height / 2).toBeCloseTo(centerY(step.marker), 0);
  }
}

function expectVerticalColumn(steps: StepGeometry[]): void {
  const first = stepAt(steps, 0);

  for (const [index, step] of steps.entries()) {
    expect(step.marker.x).toBeCloseTo(first.marker.x, 0);
    expect(step.label.x).toBeGreaterThanOrEqual(step.marker.x + step.marker.width);
    expect(centerY(step.label)).toBeCloseTo(centerY(step.marker), 0);

    if (index > 0) expect(step.marker.y).toBeGreaterThan(stepAt(steps, index - 1).marker.y);
  }
}

function expectVerticalConnectors(steps: StepGeometry[]): void {
  for (const [index, step] of steps.slice(0, -1).entries()) {
    const next = stepAt(steps, index + 1);
    const connector = step.connector ?? NO_CONNECTOR;

    expect(connector.width).toBe(2);
    expect(connector.x + connector.width / 2).toBeCloseTo(centerX(step.marker), 0);
    expect(connector.y).toBeCloseTo(step.marker.y + step.marker.height, 0);
    expect(connector.y + connector.height).toBeCloseTo(next.marker.y, 0);
  }
}

test.describe('progress-steps / layout', () => {
  test('each numbered marker shows its position, counting the steps drawn with a checkmark', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    expect(await markerNumbers(page)).toEqual(['3', '4']);
  });

  test('an upcoming step after three outcome icons is numbered 4', async ({ page }) => {
    await openStory(page, OUTCOMES_STORY_ID);

    expect(await markerNumbers(page)).toEqual(['4']);
  });

  test('each connector runs from its marker centre to the next marker centre, and the last step has none', async ({
    page,
  }) => {
    await openStory(page, DEFAULT_STORY_ID);
    const steps = await readSteps(page);

    expectHorizontalConnectors(steps);
    expect(stepAt(steps, steps.length - 1).connector).toBeNull();
  });

  test('a completed step fills its connector with the primary colour, the current one leaves it a border', async ({
    page,
  }) => {
    await openStory(page, DEFAULT_STORY_ID);
    const steps = await readSteps(page);
    const complete = stepAt(steps, 0);
    const current = stepAt(steps, 2);

    expect(complete.state).toBe('complete');
    expect(complete.connector?.color).toBe(complete.primary);
    expect(current.state).toBe('current');
    expect(current.connector?.color).toBe(current.border);
    expect(current.connector?.color).not.toBe(current.primary);
  });

  test('a failed step colours its connector with its own theme', async ({ page }) => {
    await openStory(page, OUTCOMES_STORY_ID);
    const steps = await readSteps(page);
    const success = stepAt(steps, 0);
    const error = stepAt(steps, 2);

    expect(error.connector?.color).toBe(error.primary);
    expect(error.connector?.color).not.toBe(success.connector?.color);
  });

  test('the vertical layout stacks the markers in one column with each label beside its marker', async ({ page }) => {
    await openStory(page, VERTICAL_STORY_ID);
    const steps = await readSteps(page);

    expectVerticalColumn(steps);
  });

  test('a vertical connector hangs from under its marker to the top of the next one', async ({ page }) => {
    await openStory(page, VERTICAL_STORY_ID);
    const steps = await readSteps(page);

    expectVerticalConnectors(steps);
  });
});

test.describe('progress-steps / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a plain step is not a link or a button, so Tab finds nothing to focus', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await pressKey(page, 'Tab');

    const focused = await focusedDescriptor(page);
    expect(focused.tag).toBe('BODY');
  });

  test('Tab reaches the first linked step and its focus ring is visible', async ({ page }) => {
    const root = await openStory(page, AS_LINKS_STORY_ID);
    const firstStep = root.locator(LINK_STEP).first();

    await pressKey(page, 'Tab');

    await expectFocusVisible(firstStep);
  });

  test('Tab visits every linked step in DOM order', async ({ page }) => {
    await openStory(page, AS_LINKS_STORY_ID);

    const descriptors = await tabSequence(page, 4);

    expect(descriptors.map((d) => d.text)).toEqual(['Account', 'Shipping', 'Payment', 'Review']);
  });
});

test.describe('progress-steps / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: state and link contract');

  test('a complete step renders a checkmark marker, current and upcoming render a number', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const steps = root.locator('et-progress-step');

    await expect(steps.nth(0).locator('.et-icon')).toHaveCount(1);
    await expect(steps.nth(2).locator('.et-progress-step-marker-number')).toHaveCount(1);
    await expect(steps.nth(3).locator('.et-progress-step-marker-number')).toHaveCount(1);
  });

  test('the three outcome states render their own icon and keep their state on data-state', async ({ page }) => {
    const root = await openStory(page, OUTCOMES_STORY_ID);
    const steps = root.locator('et-progress-step');

    for (const [index, state] of ['success', 'warning', 'error'].entries()) {
      await expect(steps.nth(index)).toHaveAttribute('data-state', state);
      await expect(steps.nth(index).locator('.et-icon')).toHaveCount(1);
    }

    await expect(steps.nth(3)).toHaveAttribute('data-state', 'upcoming');
    await expect(steps.nth(3).locator('.et-progress-step-marker-number')).toHaveCount(1);
  });

  test('Enter activates the focused step, following its href', async ({ page }) => {
    await openStory(page, AS_LINKS_STORY_ID);

    await pressKey(page, 'Tab');
    await pressKey(page, 'Enter');

    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#account');
  });

  test('the links story renders every step as an anchor with an href', async ({ page }) => {
    const root = await openStory(page, AS_LINKS_STORY_ID);
    const steps = root.locator(LINK_STEP);

    await expect(steps).toHaveCount(4);

    const hrefs = await steps.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual(['#account', '#shipping', '#payment', '#review']);
  });

  test('the vertical story reports its orientation on the host', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);

    await expect(root.locator('et-progress-steps')).toHaveAttribute('data-orientation', 'vertical');
  });
});

test.describe('progress-steps / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on a linked step activates it, following its href', async ({ page }) => {
    const root = await openStory(page, AS_LINKS_STORY_ID);
    const firstStep = root.locator(LINK_STEP).first();

    await tap(firstStep);

    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#account');
  });
});
