import { Locator, Page, expect, test } from '@playwright/test';
import { openStory } from '../support';

type Rgb = [number, number, number];

const NO_TRANSITIONS = '*, *::before, *::after { transition: none !important; animation: none !important; }';

const RED_TINT = '* { --et-surface-tint: rgb(255 0 0) !important; }';

const LIGHT_WITHOUT_TINT = `* {
  --et-surface-tint: initial !important;
  --et-surface-background: rgb(255 255 255) !important;
  --et-surface-text: rgb(23 23 23) !important;
}
html { background: rgb(255 255 255) !important; }`;

interface FormTarget {
  name: string;
  story: string;
  find: (root: Locator) => Locator;
  painted?: (target: Locator) => Locator;
}

const TARGETS: FormTarget[] = [
  {
    name: 'multi-language editor language trigger',
    story: 'components-forms-rich-text-editor-multi-language--default',
    find: (root) => root.locator('.et-ml-rte-lang-trigger').first(),
  },
  {
    name: 'number input stepper',
    story: 'components-forms-number-input--stepper',
    find: (root) => root.locator('.et-number-input-stepper-button:not(:disabled)').first(),
  },
  {
    name: 'segmented button',
    story: 'components-forms-selection-list-segmented-button-group--default',
    find: (root) => root.locator('et-segmented-button:not([aria-checked="true"])').first(),
  },
  {
    name: 'checkbox option',
    story: 'components-forms-selection-list-checkbox-group--default',
    find: (root) => root.locator('et-checkbox-option:not([aria-checked="true"])').first(),
    painted: (target) => target.locator('.et-checkbox-option-box'),
  },
];

const paintOf = (target: Locator): Promise<Rgb> =>
  target.evaluate((element) => {
    const canvas = document.createElement('canvas');

    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) throw new Error('No 2d canvas context');

    const chain: Element[] = [];

    for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node);

    context.fillStyle = 'rgb(255 255 255)';
    context.fillRect(0, 0, 1, 1);

    for (const node of chain) {
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
    }

    const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

    return [red, green, blue];
  });

const distance = (a: Rgb, b: Rgb) => Math.max(...a.map((channel, index) => Math.abs(channel - (b[index] ?? 0))));

const measure = async (page: Page, target: FormTarget, style: string) => {
  const root = await openStory(page, target.story);

  await page.addStyleTag({ content: NO_TRANSITIONS + style });

  const control = target.find(root);
  const painted = target.painted?.(control) ?? control;

  await expect(control).toBeVisible();

  const rest = await paintOf(painted);

  await control.hover();
  const hover = await paintOf(painted);

  return { rest, hover };
};

test.describe('form controls / state tint', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  for (const target of TARGETS) {
    test(`a ${target.name} tints hover with the theme tint`, async ({ page }) => {
      const { hover } = await measure(page, target, RED_TINT);

      expect(hover[0] - hover[1], `hover ${hover}`).toBeGreaterThan(8);
    });

    test(`a ${target.name} on a light surface without a tint shows hover`, async ({ page }) => {
      const { rest, hover } = await measure(page, target, LIGHT_WITHOUT_TINT);

      expect(distance(hover, rest), `rest ${rest}, hover ${hover}`).toBeGreaterThanOrEqual(8);
    });
  }
});
