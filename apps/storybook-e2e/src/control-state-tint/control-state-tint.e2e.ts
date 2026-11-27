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

interface StateTarget {
  name: string;
  story: string;
  open: (page: Page, root: Locator) => Promise<{ hover: Locator; paint: Locator }>;
}

const TARGETS: StateTarget[] = [
  {
    name: 'calendar header label',
    story: 'components-date-time-calendar--default',
    open: async (_page, root) => {
      const label = root.locator('button.et-calendar-header-label').first();

      return { hover: label, paint: label };
    },
  },
  {
    name: 'calendar day',
    story: 'components-date-time-calendar--default',
    open: async (_page, root) => {
      const day = root
        .locator('.et-calendar-weeks:not(.et-calendar-weeks--leave) button.et-calendar-cell')
        .filter({ hasNot: root.page().locator('[aria-selected="true"], [aria-current]') })
        .nth(9);

      return { hover: day, paint: day.locator('.et-calendar-cell-content') };
    },
  },
  {
    name: 'breadcrumb overflow item',
    story: 'components-navigation-breadcrumb--collapsed',
    open: async (page, root) => {
      await root.getByRole('button', { name: 'Show hidden levels' }).click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();

      const item = dialog.locator('a.et-breadcrumb-item, button.et-breadcrumb-item').first();

      return { hover: item, paint: item };
    },
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

const measure = async (page: Page, target: StateTarget, style: string) => {
  const root = await openStory(page, target.story);

  await page.addStyleTag({ content: NO_TRANSITIONS + style });

  const { hover: hoverTarget, paint } = await target.open(page, root);
  const rest = await paintOf(paint);

  await hoverTarget.hover();

  const hover = await paintOf(paint);

  await page.mouse.down();
  const pressed = await paintOf(paint);

  await page.mouse.up();

  return { rest, hover, pressed };
};

test.describe('controls / state tint', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and pressed');

  for (const target of TARGETS) {
    test(`a ${target.name} tints hover with the theme tint`, async ({ page }) => {
      const { hover } = await measure(page, target, RED_TINT);

      expect(hover[0] - hover[1], `hover ${hover}`).toBeGreaterThan(8);
    });

    test(`a ${target.name} on a light surface without a tint shows hover and pressed`, async ({ page }) => {
      const { rest, hover, pressed } = await measure(page, target, LIGHT_WITHOUT_TINT);

      expect(distance(hover, rest), `rest ${rest}, hover ${hover}`).toBeGreaterThanOrEqual(8);
      expect(distance(pressed, rest), `rest ${rest}, pressed ${pressed}`).toBeGreaterThanOrEqual(8);
    });
  }
});
