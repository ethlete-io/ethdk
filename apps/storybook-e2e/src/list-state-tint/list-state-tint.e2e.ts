import { Locator, Page, expect, test } from '@playwright/test';
import { openStory } from '../support';

type Rgb = [number, number, number];

const NO_TRANSITIONS = '*, *::before, *::after { transition: none !important; animation: none !important; }';

const RED_TINT = '* { --et-surface-tint: rgb(255 0 0) !important; }';

const LIGHT_WITHOUT_TINT = `* {
  --et-surface-tint: initial !important;
  --et-surface-background: rgb(255 255 255) !important;
  --et-surface-text: rgb(23 23 23) !important;
}`;

interface ListTarget {
  name: string;
  story: string;
  open: (page: Page, root: Locator) => Promise<Locator>;
}

const TARGETS: ListTarget[] = [
  {
    name: 'menu item',
    story: 'components-overlays-menu--default',
    open: async (page, root) => {
      await root.getByRole('button', { name: 'File' }).click();
      await expect(page.getByRole('menu')).toBeVisible();

      return page.getByRole('menuitem', { name: 'New file' });
    },
  },
  {
    name: 'select option',
    story: 'components-forms-select--default',
    open: async (page, root) => {
      await root.getByRole('combobox').click();
      await expect(page.locator('.et-select-panel')).toBeVisible();

      return page.getByRole('option', { name: 'Cherry' });
    },
  },
  {
    name: 'command palette item',
    story: 'components-overlays-command-palette--default',
    open: async (page, root) => {
      await root.getByRole('button', { name: 'Open the palette' }).click();
      await expect(page.getByRole('combobox')).toBeFocused();

      return page.locator('.et-command-palette-item').nth(1);
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

const measure = async (page: Page, target: ListTarget, style: string) => {
  const root = await openStory(page, target.story);

  await page.addStyleTag({ content: NO_TRANSITIONS + style });

  const item = await target.open(page, root);
  const rest = await paintOf(item);

  await item.hover();
  await expect(item).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  const hover = await paintOf(item);

  await page.mouse.down();
  const pressed = await paintOf(item);

  await page.mouse.up();

  return { rest, hover, pressed };
};

test.describe('list items / state tint', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover and pressed');

  for (const target of TARGETS) {
    test(`a ${target.name} tints hover and pressed with the theme tint`, async ({ page }) => {
      const { hover, pressed } = await measure(page, target, RED_TINT);

      expect(hover[0] - hover[1], `hover ${hover}`).toBeGreaterThan(8);
      expect(pressed[0] - pressed[1], `pressed ${pressed}`).toBeGreaterThan(8);
    });

    test(`a ${target.name} on a light surface without a tint shows hover and pressed`, async ({ page }) => {
      const { rest, hover, pressed } = await measure(page, target, LIGHT_WITHOUT_TINT);

      expect(distance(hover, rest), `rest ${rest}, hover ${hover}`).toBeGreaterThanOrEqual(8);
      expect(distance(pressed, rest), `rest ${rest}, pressed ${pressed}`).toBeGreaterThanOrEqual(8);
    });
  }
});
