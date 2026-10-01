import { Locator, expect, test } from '@playwright/test';
import { openStory } from '../support';

const STORY_ID = 'core-theming-surface-ink--default';

const DANGER_DARK_INK = 'rgb(248, 113, 113)';
const DANGER_LIGHT_INK = 'rgb(185, 28, 28)';

const colorOf = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).color);

test.describe('core theming / surface-aware ink', () => {
  test('the nearest surface type picks the ink, through every nesting level', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    expect(await colorOf(root.getByTestId('dark'))).toBe(DANGER_DARK_INK);
    expect(await colorOf(root.getByTestId('light-in-dark'))).toBe(DANGER_LIGHT_INK);
    expect(await colorOf(root.getByTestId('dark-in-light'))).toBe(DANGER_DARK_INK);
  });

  test('a color scope inside a light surface resolves its own light ink', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    expect(await colorOf(root.getByTestId('success-light'))).toBe('rgb(22, 101, 52)');
  });

  test('a theme without a light ink keeps its one ink instead of inheriting the outer light ink', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    expect(await colorOf(root.getByTestId('warning-light'))).toBe('rgb(217, 119, 6)');
  });

  test('the Tailwind ink utility and an interactive element follow the surface too', async ({ page }) => {
    const root = await openStory(page, STORY_ID);

    expect(await colorOf(root.getByTestId('utility-light'))).toBe(DANGER_LIGHT_INK);
    expect(await colorOf(root.getByTestId('interactive-light'))).toBe(DANGER_LIGHT_INK);
  });

  test('an interactive element hovered on a light surface takes the light hover ink', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover needs a pointer');

    const root = await openStory(page, STORY_ID);
    const button = root.getByTestId('interactive-light');

    await button.hover();

    await expect.poll(() => colorOf(button)).toBe('rgb(153, 27, 27)');
  });
});
