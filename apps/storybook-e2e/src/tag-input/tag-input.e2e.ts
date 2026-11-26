import { CDPSession, Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, openStory, pressKey, tap } from '../support';

const DEFAULT_ID = 'components-forms-tag-input--default';
const PREFILLED_ID = 'components-forms-tag-input--prefilled';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

function field(root: Locator): Locator {
  return root.locator('.et-tag-input-field');
}

function chipLabels(root: Locator): Locator {
  return root.locator('et-chip .et-chip-label');
}

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await pressKey(page, 'ControlOrMeta+V');
}

async function compose(cdp: CDPSession, text: string): Promise<void> {
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
}

/** What Chromium and Safari fire for the Enter that confirms a candidate: `key` stays `Enter`. */
function pressComposingEnter(target: Locator): Promise<boolean> {
  return target.evaluate((el) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 229,
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });

    el.dispatchEvent(event);

    return event.defaultPrevented;
  });
}

test.describe('tag-input / clipboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard paste');

  test('a real paste splits on commas and newlines into one chip each', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await pasteText(page, 'team-a, team-b\nteam-c');

    await expect(chipLabels(root)).toHaveText(['team-a', 'team-b', 'team-c']);
    await expect(field(root)).toHaveValue('');
    await expect(root.getByText('Form value: [ "team-a", "team-b", "team-c" ]')).toBeVisible();
  });

  test('a real paste without a separator stays in the field as text', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await pressKey(page, 'Tab');
    await pasteText(page, 'team-a');

    await expect(field(root)).toHaveValue('team-a');
    await expect(root.locator('et-chip')).toHaveCount(0);
  });

  test('a paste into pending text joins it at the caret before splitting', async ({ page }) => {
    const root = await openStory(page, PREFILLED_ID);

    await pressKey(page, 'Tab');
    await field(root).pressSequentially('team');
    await pasteText(page, '-a,team-b');

    await expect(chipLabels(root)).toHaveText(['angular', 'signals', 'team-a', 'team-b']);
    await expect(field(root)).toHaveValue('');
  });
});

test.describe('tag-input / composition', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: a desktop IME');

  test('the Enter that confirms an IME candidate commits no chip', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);
    const cdp = await page.context().newCDPSession(page);

    await pressKey(page, 'Tab');
    await compose(cdp, 'にほ');
    await compose(cdp, 'にほん');

    expect(await pressComposingEnter(field(root))).toBe(false);
    await cdp.send('Input.insertText', { text: 'にほん' });

    await expect(root.locator('et-chip')).toHaveCount(0);
    await expect(field(root)).toHaveValue('にほん');

    await pressKey(page, 'Enter');

    await expect(chipLabels(root)).toHaveText(['にほん']);
    await expect(field(root)).toHaveValue('');
  });
});

test.describe('tag-input / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: soft keyboard');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_ID);

    await expectTouchMode(page);
  });

  test('text from a soft keyboard commits on its Enter key', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await tap(field(root));
    await expect(field(root)).toBeFocused();

    await page.keyboard.insertText('team-a');
    await pressKey(page, 'Enter');

    await expect(chipLabels(root)).toHaveText(['team-a']);
    await expect(field(root)).toHaveValue('');
  });

  test('a comma from a soft keyboard, which sends no key event, commits the text before it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_ID);

    await tap(field(root));
    await page.keyboard.insertText('team-a');
    await page.keyboard.insertText(',');

    await expect(chipLabels(root)).toHaveText(['team-a']);
    await expect(field(root)).toHaveValue('');
  });

  test('an Enter on the empty field keeps the keyboard on the field', async ({ page }) => {
    const root = await openStory(page, PREFILLED_ID);

    await tap(field(root));
    await pressKey(page, 'Enter');

    await expect(field(root)).toBeFocused();
    await expect(chipLabels(root)).toHaveText(['angular', 'signals']);
  });
});
