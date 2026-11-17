import { Locator, expect, test } from '@playwright/test';
import { openStory } from '../support';

const SECTION_TITLES_ID = 'components-sports-bracket--double-elimination-section-titles';
const CUSTOM_SECTION_TITLES_ID = 'components-sports-bracket--double-elimination-custom-section-titles';

const UPPER_TITLE = '[data-section="upper"] .et-bracket-section-title-sticky';
const FINALS_SECTION = '[data-section="finals"]';

function leftEdges(container: Locator, title: Locator) {
  return Promise.all([
    container.evaluate((el) => el.getBoundingClientRect().left),
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
});
