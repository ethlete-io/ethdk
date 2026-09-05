import { Locator, Page, expect, test } from '@playwright/test';
import { expectFieldFocusVisible, expectTouchMode, focusedDescriptor, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-counter--default';
const WITH_HINT_ID = 'components-forms-counter--with-hint';
const OVER_LIMIT_ID = 'components-forms-counter--over-limit';

const BIO_MAX = 180;
const TAGLINE_MAX = 40;

function field(root: Locator, label: RegExp): Locator {
  return root.locator('et-form-field').filter({ has: root.page().locator('et-label').filter({ hasText: label }) });
}

/** The visible `x / N`; the sibling live region is excluded so its announcements don't leak in. */
function count(root: Locator, label: RegExp): Locator {
  return field(root, label).locator('et-counter span[aria-hidden="true"]');
}

function announcement(root: Locator, label: RegExp): Locator {
  return field(root, label).locator('.et-counter-announcement');
}

function counter(root: Locator, label: RegExp): Locator {
  return field(root, label).locator('et-counter');
}

async function fillBio(root: Locator, length: number): Promise<void> {
  await field(root, /^Bio$/).locator('textarea').fill('x'.repeat(length));
}

async function tabFocusTags(page: Page, times: number): Promise<string[]> {
  const tags: string[] = [];

  for (let i = 0; i < times; i++) {
    await pressKey(page, 'Tab');
    tags.push((await focusedDescriptor(page)).tag);
  }

  return tags;
}

test.describe('counter / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the counted textarea and the field shows its focus ring', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(field(root, /^Bio$/).locator('textarea'));
  });

  test('the counter is not a tab stop - Tab walks the controls only', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    const tags = await tabFocusTags(page, 5);

    expect(tags).toEqual(['TEXTAREA', 'INPUT', 'INPUT', 'INPUT', 'INPUT']);
    await expect(root.locator('et-counter:focus, et-counter :focus')).toHaveCount(0);
  });

  test('the counter sits in the support row, not in the control frame', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await expect(
      field(root, /^Bio$/).locator('.et-form-field-support .et-form-field-support-counter et-counter'),
    ).toHaveCount(1);
    await expect(field(root, /^Bio$/).locator('.et-form-field-control-frame et-counter')).toHaveCount(0);
  });
});

test.describe('counter / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: typing behavior');

  test('the limit comes from the schema maxLength without a [max] on the counter', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await expect(count(root, /^Bio$/)).toHaveText(`0 / ${BIO_MAX}`);
  });

  test('an explicit [max] counts a field the schema does not length-validate', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await expect(count(root, /^Tagline$/)).toHaveText(`0 / ${TAGLINE_MAX}`);
  });

  test('typing updates the count on every keystroke', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await page.keyboard.type('hello');

    await expect(count(root, /^Bio$/)).toHaveText(`5 / ${BIO_MAX}`);

    await pressKey(page, 'Backspace');

    await expect(count(root, /^Bio$/)).toHaveText(`4 / ${BIO_MAX}`);
  });

  test('caret keys move the caret and leave the count alone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await page.keyboard.type('hello');

    for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      await pressKey(page, key);
    }

    await expect(count(root, /^Bio$/)).toHaveText(`5 / ${BIO_MAX}`);
    await expect(counter(root, /^Bio$/)).not.toHaveAttribute('data-over-limit');
  });

  test('the limit is not forwarded to the native maxlength, so the value can exceed it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const textarea = field(root, /^Bio$/).locator('textarea');

    await expect(textarea).not.toHaveAttribute('maxlength');

    await fillBio(root, BIO_MAX + 20);

    await expect(textarea).toHaveJSProperty('value.length', BIO_MAX + 20);
    await expect(count(root, /^Bio$/)).toHaveText(`${BIO_MAX + 20} / ${BIO_MAX}`);
  });

  test('the count turns over-limit only once the field is invalid', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await fillBio(root, BIO_MAX);
    await expect(count(root, /^Bio$/)).toHaveText(`${BIO_MAX} / ${BIO_MAX}`);
    await expect(counter(root, /^Bio$/)).not.toHaveAttribute('data-over-limit');

    await fillBio(root, BIO_MAX + 1);
    await expect(counter(root, /^Bio$/)).toHaveAttribute('data-over-limit', 'true');
  });

  test('an explicit [max] has no validator behind it and is compared directly', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const tagline = field(root, /^Tagline$/);

    await tagline.locator('input').fill('x'.repeat(TAGLINE_MAX + 1));
    await pressKey(page, 'Tab');

    await expect(counter(root, /^Tagline$/)).toHaveAttribute('data-over-limit', 'true');
    await expect(tagline.locator('.et-form-field-errors')).toHaveCount(0);
  });

  test('the over-limit story loads red before the field is ever touched', async ({ page }) => {
    const root = await openStory(page, OVER_LIMIT_ID);
    const bioCounter = counter(root, /^Bio$/);

    await expect(bioCounter).toHaveAttribute('data-over-limit', 'true');
    await expect(field(root, /^Bio$/)).not.toHaveAttribute('data-error');

    const colors = await root.evaluate((el) => {
      const counters = [...el.querySelectorAll('et-counter')];

      return counters.map((node) => getComputedStyle(node).color);
    });

    expect(colors[0]).not.toBe(colors[1]);
  });

  test('the counter is persistent - it stays while the error message shows', async ({ page }) => {
    const root = await openStory(page, OVER_LIMIT_ID);
    const bio = field(root, /^Bio$/);

    await bio.locator('textarea').click();
    await pressKey(page, 'Tab');

    await expect(bio.locator('.et-form-field-errors')).toContainText('Keep the bio under 180 characters');
    await expect(counter(root, /^Bio$/)).toBeVisible();
    await expect(count(root, /^Bio$/)).toContainText(`/ ${BIO_MAX}`);
  });

  test('the counter and the hint coexist in the support row', async ({ page }) => {
    const root = await openStory(page, WITH_HINT_ID);
    const bio = field(root, /^Bio$/);

    await expect(bio.locator('et-hint')).toBeVisible();
    await expect(counter(root, /^Bio$/)).toBeVisible();

    const hintBox = await bio.locator('et-hint').boundingBox();
    const counterBox = await counter(root, /^Bio$/).boundingBox();

    expect(counterBox?.x ?? 0).toBeGreaterThan(hintBox?.x ?? 0);
  });

  test('the default measure counts array elements, so tags are counted too', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const tagField = field(root, /^Tags$/).locator('.et-tag-input-field');

    await expect(count(root, /^Tags$/)).toHaveText('0 / 5');

    await tagField.click();
    await tagField.pressSequentially('angular');
    await pressKey(page, 'Enter');

    await expect(count(root, /^Tags$/)).toHaveText('1 / 5');
  });

  test('the visible count is hidden from assistive tech', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await expect(count(root, /^Bio$/)).toHaveAttribute('aria-hidden', 'true');
  });

  test('the live region stays silent until the value nears the limit', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const tagline = field(root, /^Tagline$/).locator('input');

    await tagline.fill('x'.repeat(20));
    await expect(announcement(root, /^Tagline$/)).toHaveText('');
    await expect(announcement(root, /^Tagline$/)).not.toHaveAttribute('aria-live');

    await tagline.fill('x'.repeat(36));
    await expect(announcement(root, /^Tagline$/)).toHaveText('4 characters remaining');
    await expect(announcement(root, /^Tagline$/)).toHaveAttribute('aria-live', 'polite');
  });

  test('the live region reports the limit being reached and then crossed', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const tagline = field(root, /^Tagline$/).locator('input');

    await tagline.fill('x'.repeat(TAGLINE_MAX));
    await expect(announcement(root, /^Tagline$/)).toHaveText(`Character limit of ${TAGLINE_MAX} reached`);

    await tagline.fill('x'.repeat(TAGLINE_MAX + 3));
    await expect(announcement(root, /^Tagline$/)).toHaveText(`3 characters over the limit of ${TAGLINE_MAX}`);
  });
});

test.describe('counter / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_ID);

    await expectTouchMode(page);
  });

  test('a tap focuses the control and typing updates the count', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const textarea = field(root, /^Bio$/).locator('textarea');

    await tap(textarea);
    await expect(textarea).toBeFocused();

    await page.keyboard.type('touch');

    await expect(count(root, /^Bio$/)).toHaveText(`5 / ${BIO_MAX}`);
  });

  test('the counter stays visible on a narrow viewport, over the limit included', async ({ page }) => {
    const root = await openStory(page, OVER_LIMIT_ID);

    await expect(counter(root, /^Bio$/)).toBeVisible();
    await expect(counter(root, /^Bio$/)).toHaveAttribute('data-over-limit', 'true');
    await expect(count(root, /^Bio$/)).toContainText(`/ ${BIO_MAX}`);
  });
});
