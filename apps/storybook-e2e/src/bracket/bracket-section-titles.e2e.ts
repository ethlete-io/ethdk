import { Locator, Page, expect, test } from '@playwright/test';
import { openStory } from '../support';

const SECTION_TITLES_ID = 'components-sports-bracket--double-elimination-section-titles';
const CUSTOM_SECTION_TITLES_ID = 'components-sports-bracket--double-elimination-custom-section-titles';

const UPPER_TITLE = '[data-section="upper"] .et-bracket-section-title-sticky';
const FINALS_SECTION = '[data-section="finals"]';

function leftEdges(container: Locator, title: Locator) {
  return Promise.all([
    container.evaluate(
      (el) =>
        el.getBoundingClientRect().left +
        (parseFloat(getComputedStyle(el).getPropertyValue('--et-scrollable-start-fade')) || 0),
    ),
    title.evaluate((el) => el.getBoundingClientRect().left),
  ]);
}

async function expectTitleStaysAtStart(container: Locator, title: Locator) {
  const scrolled = await container.evaluate((el) => {
    el.scrollLeft = el.scrollWidth / 2;

    return el.scrollLeft;
  });

  expect(scrolled).toBeGreaterThan(200);

  await expect
    .poll(async () => {
      const [containerLeft, titleLeft] = await leftEdges(container, title);

      return Math.abs(titleLeft - containerLeft);
    })
    .toBeLessThanOrEqual(1);
  await expect(title).toBeInViewport();
}

test.describe('bracket / section titles', () => {
  test('the upper section title stays at the scroll container start while scrolling sideways', async ({ page }) => {
    await openStory(page, SECTION_TITLES_ID);

    const container = page.locator('.et-scrollable-container').first();
    const title = page.locator(UPPER_TITLE);

    await expect(title).toHaveText(/upper bracket/i);
    await expectTitleStaysAtStart(container, title);
  });

  test('a section further right keeps its title at its own start, or at the scroll start once that passes it', async ({
    page,
  }) => {
    await openStory(page, SECTION_TITLES_ID);

    const container = page.locator('.et-scrollable-container').first();
    const section = page.locator(FINALS_SECTION);
    const title = section.locator('.et-bracket-section-title-sticky');

    await container.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });

    await expect
      .poll(async () => {
        const [containerLeft, titleLeft] = await leftEdges(container, title);
        const sectionLeft = await section.evaluate((el) => el.getBoundingClientRect().left);

        return Math.abs(titleLeft - Math.max(sectionLeft, containerLeft));
      })
      .toBeLessThanOrEqual(1);
    await expect(title).toBeInViewport();
  });

  test('a custom section title sticks the same way', async ({ page }) => {
    await openStory(page, CUSTOM_SECTION_TITLES_ID);

    const container = page.locator('.et-scrollable-container').first();
    const title = page.locator(UPPER_TITLE);

    await expect(title.locator('et-sb-section-title')).toBeVisible();
    await expectTitleStaysAtStart(container, title);
  });

  test('a stuck title sits past the start fade, so it is drawn at full contrast', async ({ page }) => {
    await openStory(page, SECTION_TITLES_ID);

    const container = page.locator('.et-scrollable-container').first();
    const title = page.locator(UPPER_TITLE);

    await container.evaluate((el) => {
      el.scrollLeft = 400;
    });
    await expect(page.locator('.et-scrollable--is-at-start')).toHaveCount(0);
    await expect
      .poll(() => container.evaluate((el) => getComputedStyle(el).getPropertyValue('--et-scrollable-start-fade')))
      .toBe('25px');

    await expect.poll(() => titleContrastAtStart(page, title)).toBeGreaterThan(0.9);
  });
});

async function titleContrastAtStart(page: Page, title: Locator) {
  const shot = (await title.screenshot({ scale: 'css' })).toString('base64');

  return page.evaluate(async (base64) => {
    const image = new Image();

    image.src = `data:image/png;base64,${base64}`;
    await image.decode();

    const canvas = document.createElement('canvas');

    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext('2d');

    if (!context) return 0;

    context.drawImage(image, 0, 0);

    const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
    const luminance = (x: number, y: number) => {
      const i = (width * y + x) * 4;

      return 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    };
    const lums: number[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) lums.push(luminance(x, y));
    }

    const background = [...lums].sort((a, b) => a - b)[Math.floor(lums.length / 2)] ?? 0;
    const startWidth = Math.min(20, width);
    let start = 0;
    let all = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const contrast = Math.abs(luminance(x, y) - background);

        all = Math.max(all, contrast);
        if (x < startWidth) start = Math.max(start, contrast);
      }
    }

    return all ? start / all : 0;
  }, shot);
}
