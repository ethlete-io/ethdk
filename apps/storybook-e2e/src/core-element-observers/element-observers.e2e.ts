import { Locator, Page, expect, test } from '@playwright/test';
import { boxOf, openStory, viewportOf } from '../support';

const STORY_ID = 'core-signals-element-observers--default';

async function openObservers(page: Page): Promise<Locator> {
  const root = await openStory(page, STORY_ID);

  await expect(root.getByTestId('intersection')).toHaveText('below');

  return root;
}

const scrollTo = (scroller: Locator, top: number) =>
  scroller.evaluate((el, value) => el.scrollTo({ top: value, behavior: 'instant' }), top);

const offsetWidthOf = (locator: Locator) => locator.evaluate((el) => `${(el as HTMLElement).offsetWidth}`);

test.describe('core element observers / intersection', () => {
  test('a scroll inside the root moves the target from below to visible to above', async ({ page }) => {
    const root = await openObservers(page);
    const scroller = root.getByTestId('scroller');
    const intersection = root.getByTestId('intersection');

    await scrollTo(scroller, 300);
    await expect(intersection).toHaveText('visible');

    await scrollTo(scroller, 800);
    await expect(intersection).toHaveText('above');
  });

  test('a taller root brings the target into view without a scroll', async ({ page }) => {
    const root = await openObservers(page);

    await root.getByTestId('scroller').evaluate((el) => (el.style.height = '600px'));

    await expect(root.getByTestId('intersection')).toHaveText('visible');
  });
});

test.describe('core element observers / dimensions', () => {
  test('a width change from a binding reaches the dimensions signal', async ({ page }) => {
    const root = await openObservers(page);
    const measured = root.getByTestId('measured');
    const dimensions = root.getByTestId('dimensions');
    const before = await offsetWidthOf(measured);

    await expect(dimensions).toHaveText(before);

    await root.getByRole('button', { name: 'Toggle width' }).click();

    await expect(dimensions).not.toHaveText(before);
    await expect(dimensions).toHaveText(await offsetWidthOf(measured));
  });

  test('a viewport resize that reflows the element reaches the dimensions signal', async ({ page }) => {
    const root = await openObservers(page);
    const measured = root.getByTestId('measured');
    const dimensions = root.getByTestId('dimensions');
    const before = await boxOf(measured);

    await page.setViewportSize({ width: Math.round(viewportOf(page).width / 2), height: viewportOf(page).height });

    await expect(dimensions).not.toHaveText(`${before.width}`);
    await expect(dimensions).toHaveText(await offsetWidthOf(measured));
  });
});

test.describe('core element observers / mutations', () => {
  test('an attribute written outside Angular reaches the mutations signal', async ({ page }) => {
    const root = await openObservers(page);
    const mutated = root.getByTestId('mutated');

    await expect(root.getByTestId('mutation')).toHaveText('none');

    await mutated.evaluate((el) => el.setAttribute('data-state', 'changed'));

    await expect(root.getByTestId('mutation')).toHaveText('attributes:data-state');
  });

  test('a child appended outside Angular reaches the mutations signal', async ({ page }) => {
    const root = await openObservers(page);
    const mutated = root.getByTestId('mutated');

    await mutated.evaluate((el) => el.append(el.ownerDocument.createElement('span')));

    await expect(root.getByTestId('mutation')).toHaveText('childList:1');
  });
});
