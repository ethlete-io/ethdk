import { expect, Locator, Page, test } from '@playwright/test';
import { join } from 'node:path';
import {
  boxOf,
  expectFieldFocusVisible,
  expectFocusVisible,
  openStory,
  pressKey,
  settle,
  tap,
  viewportOf,
} from '../support';

const EDITOR_DEFAULT_ID = 'components-forms-rich-text-editor--default';
const TRIGGERS_DEFAULT_ID = 'components-forms-rich-text-editor-triggers--default';
const ML_WITH_TRANSLATIONS_ID = 'components-forms-rich-text-editor-multi-language--with-existing-translations';
const VIEWER_BESIDE_EDITOR_ID = 'components-forms-rich-text-viewer--beside-editor';

test.describe('rich-text-editor / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('Tab reaches the toolbar on a control and the focus ring is visible', async ({ page }) => {
    await openStory(page, EDITOR_DEFAULT_ID);

    await pressKey(page, 'Tab');

    const focused = page.locator(':focus');
    await expectFocusVisible(focused);
    expect(await focused.evaluate((el) => !!el.closest('[role="toolbar"]'))).toBe(true);
  });

  test('a second Tab moves focus from the toolbar into the editable content', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await pressKey(page, 'Tab');
    await pressKey(page, 'Tab');

    await expectFieldFocusVisible(content);
  });
});

test.describe('rich-text-editor / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard shortcuts');

  test('ArrowRight moves focus to the next toolbar button, ArrowLeft moves it back', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const bold = root.getByRole('button', { name: 'Bold' });
    const italic = root.getByRole('button', { name: 'Italic' });

    await pressKey(page, 'Tab');
    await pressKey(page, 'ArrowRight');
    await expect(bold).toBeFocused();

    await pressKey(page, 'ArrowRight');
    await expect(italic).toBeFocused();

    await pressKey(page, 'ArrowLeft');
    await expect(bold).toBeFocused();
  });

  test('Ctrl/Cmd+B wraps the selected text in bold', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('hello');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');

    await expect(content.locator('strong')).toHaveText('hello');
  });

  test('Ctrl/Cmd+Z undoes the bold that was just applied', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('hello');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(content.locator('strong')).toHaveText('hello');

    await page.keyboard.press('ControlOrMeta+z');

    await expect(content.locator('strong')).toHaveCount(0);
    await expect(content).toContainText('hello');
  });

  test('typing a bulleted list prefix converts the line into a list', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('- ');
    await page.keyboard.type('Item');

    await expect(content.locator('ul li')).toHaveText('Item');
  });
});

test.describe('rich-text-editor / triggers keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: token trigger menu');

  test('typing the trigger character opens the token menu with the configured items', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');

    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(4);
    await expect(page.getByRole('option').first()).toHaveText('First name');
  });

  test('ArrowDown moves the active item in the token menu', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('option').first()).toHaveAttribute('data-active', '');

    await pressKey(page, 'ArrowDown');

    await expect(page.getByRole('option').nth(1)).toHaveAttribute('data-active', '');
    await expect(page.getByRole('option').first()).not.toHaveAttribute('data-active', '');
  });

  test('Escape closes the token menu and leaves the caret usable in the editor', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('listbox')).toBeVisible();

    await pressKey(page, 'Escape');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(content).toBeFocused();

    await page.keyboard.type('x');
    await expect(content).toContainText('#x');
  });

  test('Enter inserts the active item as a token chip and closes the menu', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('listbox')).toBeVisible();

    await pressKey(page, 'Enter');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(content.locator('.et-rte-token')).toHaveCount(1);
    await expect(content.locator('.et-rte-token')).toContainText('First name');
  });
});

test.describe('rich-text-editor / multi-language', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: language switcher menu');

  test('the language switcher shows the active language and lists every configured language', async ({ page }) => {
    const root = await openStory(page, ML_WITH_TRANSLATIONS_ID);

    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('en');

    await root.locator('.et-ml-rte-lang-trigger').click();

    await expect(page.getByRole('menuitemradio', { name: /English/ })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: /Deutsch/ })).toBeVisible();
    await expect(page.getByRole('menuitemradio', { name: /Français/ })).toBeVisible();
  });

  test('picking another language switches the active editor to its content', async ({ page }) => {
    const root = await openStory(page, ML_WITH_TRANSLATIONS_ID);
    const content = root.locator('.et-rte-content');

    await expect(content).toContainText('Welcome');

    await root.locator('.et-ml-rte-lang-trigger').click();
    await page.getByRole('menuitemradio', { name: /Deutsch/ }).click();

    await expect(content).toContainText('Willkommen');
    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('de');
  });
});

test.describe('rich-text-editor / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap interaction');

  test('a tap on the editable region focuses it', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await tap(content);

    await expect(content).toBeFocused();
  });

  test('a tap on a toolbar button activates it', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');
    const headingTrigger = root.getByRole('button', { name: 'Text style: Normal' });

    await tap(content);
    await tap(headingTrigger);

    await expect(headingTrigger).toHaveAttribute('aria-expanded', 'true');
  });
});

const CONTENT_STYLE_PROPS = [
  'font-size',
  'font-weight',
  'font-family',
  'margin-top',
  'padding-left',
  'border-left-width',
  'border-top-width',
  'border-radius',
  'list-style-type',
  'white-space',
  'text-decoration-line',
];

const CONTENT_SELECTORS = ['h1', 'h2', 'ul ul', 'ol', 'blockquote', 'pre', 'p code', 'a', 'th', 'td', 'u'];

const readContentStyles = (scope: Locator) =>
  scope.evaluate(
    (el, { selectors, props }) =>
      selectors.map((selector) => {
        const target = el.querySelector(selector);

        return [selector, target && props.map((prop) => getComputedStyle(target).getPropertyValue(prop))];
      }),
    { selectors: CONTENT_SELECTORS, props: CONTENT_STYLE_PROPS },
  );

test.describe('rich-text-viewer / rendering', () => {
  test('renders every block with the same computed styles as the editor content area', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch floors the editable font size to 16px against iOS zoom');

    const root = await openStory(page, VIEWER_BESIDE_EDITOR_ID);
    const viewer = root.locator('et-rich-text-viewer');
    const editable = root.locator('et-rich-text-editor .et-rte-content');

    await expect(viewer.locator('table')).toBeVisible();
    await expect(editable.locator('table')).toBeVisible();

    const fromViewer = await readContentStyles(viewer);

    expect(fromViewer.filter(([, values]) => !values)).toEqual([]);
    expect(fromViewer).toEqual(await readContentStyles(editable));
  });

  test('keeps raw HTML in the value as text', async ({ page }) => {
    const root = await openStory(page, VIEWER_BESIDE_EDITOR_ID);
    const viewer = root.locator('et-rich-text-viewer');

    await expect(viewer).toContainText('<script>alert(1)</script>');
    await expect(viewer.locator('script')).toHaveCount(0);
  });
});

const EDITOR_TABLE_ID = 'components-forms-rich-text-editor--with-table-and-alignment';
const EDITOR_IMAGES_ID = 'components-forms-rich-text-editor--images';
const ML_DEFAULT_ID = 'components-forms-rich-text-editor-multi-language--default';
const DROPPED_IMAGE_PATH = join(__dirname, '../../../storybook/src/assets/rich-text-editor-image.svg');

const valueReadout = (page: Page) => page.locator('#storybook-root pre');

const expectValue = (page: Page, value: string) => expect.poll(() => valueReadout(page).textContent()).toBe(value);

const expectValueMatching = (page: Page, pattern: RegExp) =>
  expect.poll(() => valueReadout(page).textContent()).toMatch(pattern);

const composeIme = async (page: Page, steps: string[], commit: string) => {
  const client = await page.context().newCDPSession(page);

  for (const text of steps) {
    await client.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  }

  await client.send('Input.insertText', { text: commit });
  await client.detach();
};

const dropFileAt = async (page: Page, point: { x: number; y: number }, path: string) => {
  const client = await page.context().newCDPSession(page);
  const data = { items: [], files: [path], dragOperationsMask: 1 };

  for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
    await client.send('Input.dispatchDragEvent', { type, x: point.x, y: point.y, data });
  }

  await client.detach();
};

const writeHtmlToClipboard = (page: Page, html: string, text: string) =>
  page.evaluate(
    ([markup, plain]) =>
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([markup], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]),
    [html, text] as [string, string],
  );

const rangeOf = (content: Locator, text: string, select: boolean) =>
  content.evaluate(
    (el, [needle, shouldSelect]) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = node.textContent?.indexOf(needle) ?? -1;

        if (index < 0) continue;

        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + needle.length);

        if (shouldSelect) {
          document.getSelection()?.removeAllRanges();
          document.getSelection()?.addRange(range);
        }

        const rect = range.getBoundingClientRect();

        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      }

      throw new Error(`"${needle}" is not in the editor`);
    },
    [text, select] as const,
  );

const selectText = (content: Locator, text: string) => rangeOf(content, text, true);

const textRect = (content: Locator, text: string) => rangeOf(content, text, false);

const typeLines = async (page: Page, lines: string[]) => {
  for (const [index, line] of lines.entries()) {
    if (index > 0) await page.keyboard.press('Enter');
    await page.keyboard.type(line);
  }
};

test.describe('rich-text-editor / caret and line breaks', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hardware keyboard');

  test('Shift+Enter stores a soft line break', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('first');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('second');

    await expect(content.locator('br')).toHaveCount(1);
    await expectValue(page, 'first\nsecond');
  });

  test('Enter after the first line of an empty editor stores a paragraph break', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await typeLines(page, ['first', 'second', 'third']);

    await expectValue(page, 'first\n\nsecond\n\nthird');
  });

  test('Enter at the end of a heading continues in a plain paragraph', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('# Title');
    await page.keyboard.press('Enter');
    await page.keyboard.type('body');

    await expect(content.locator('h1')).toHaveText('Title');
    await expect(content.locator('p')).toHaveText('body');
  });

  test('a closing autoformat delimiter leaves the caret outside the mark', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('**bold** after');

    await expect(content.locator('strong')).toHaveText('bold');
    await expect(content).toHaveText(/^bold\u200b?\s?after$/);
    await expectValueMatching(page, /\*\*bold\*\* after/);
  });

  test('Ctrl/Cmd+B on a collapsed caret formats only what is typed until it is toggled off', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('plain ');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('loud');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type(' quiet');

    await expect(content.locator('strong')).toHaveText('loud');
    await expectValue(page, 'plain **loud** quiet');
  });

  test('undo puts the caret back where it sat, so typing continues there', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('one two');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(content).not.toContainText('two');

    await page.keyboard.type('!');

    await expect(content).toHaveText(/^one\s?!$/);
  });
});

test.describe('rich-text-editor / IME', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: desktop IME');

  test('a committed composition lands once, in the value', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('a ');
    await composeIme(page, ['に', 'にほ', 'にほん'], '日本');

    await expect(content).toHaveText('a 日本');
    await expectValue(page, 'a 日本');
  });

  test('a composition at the line start does not trigger block autoformat', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await composeIme(page, ['-', '- '], '- ');
    await page.keyboard.type('x');

    await expect(content.locator('ul')).toHaveCount(0);
  });

  test('a composition after the trigger character filters the token menu once committed', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await expect(page.getByRole('option')).toHaveCount(4);

    await composeIme(page, ['l', 'la'], 'Last');

    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toHaveText('Last name');
  });

  test('undo takes a committed composition back out', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('a ');
    await composeIme(page, ['に', 'にほ'], '日本');
    await expect(content).toHaveText('a 日本');

    await page.keyboard.press('ControlOrMeta+z');

    await expect(content).not.toContainText('日本');
  });
});

test.describe('rich-text-editor / history input events', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard setup');

  test('a beforeinput historyUndo undoes through the editor history, historyRedo replays it', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('hello');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(content.locator('strong')).toHaveText('hello');

    const prevented = await content.evaluate((el) =>
      el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true })),
    );

    expect(prevented).toBe(false);
    await expect(content.locator('strong')).toHaveCount(0);
    await expectValue(page, 'hello');

    await content.evaluate((el) =>
      el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'historyRedo', bubbles: true, cancelable: true })),
    );

    await expect(content.locator('strong')).toHaveText('hello');
    await expectValue(page, '**hello**');
  });
});

test.describe('rich-text-editor / clipboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard paste');
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('a real HTML paste is normalized into the schema', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await writeHtmlToClipboard(
      page,
      '<p class="x" style="color: red">Hi <b>there</b><script>window.pwned = 1</script> <font face="Comic">you</font></p>',
      'Hi there you',
    );
    await content.focus();
    await page.keyboard.press('ControlOrMeta+v');

    await expect(content.locator('strong')).toHaveText('there');
    await expect(content).toContainText('you');
    await expect(content.locator('script, font, [style], [class="x"]')).toHaveCount(0);
    await expectValue(page, 'Hi **there** you');
  });

  test('copying a token chip and pasting it again keeps it a chip', async ({ page }) => {
    const root = await openStory(page, TRIGGERS_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('#');
    await pressKey(page, 'Enter');
    await expect(content.locator('.et-rte-token')).toHaveCount(1);

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('End');
    await page.keyboard.press('ControlOrMeta+v');

    await expect(content.locator('.et-rte-token')).toHaveCount(2);
    await expect(content.locator('.et-rte-token').nth(1)).toContainText('First name');
  });
});

test.describe('rich-text-editor / table picker', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: hover');

  test('hovering the size grid previews the size and a click inserts that table', async ({ page }) => {
    const root = await openStory(page, EDITOR_TABLE_ID);
    const content = root.locator('.et-rte-content');

    await content.locator('p').last().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await root.getByRole('button', { name: 'Table' }).click();

    const target = page.getByRole('button', { name: '2 by 3' });
    await target.hover();

    await expect(page.locator('.et-rte-table-picker-label')).toHaveText('2 × 3');
    await expect(page.locator('.et-rte-table-picker-cell--active')).toHaveCount(6);

    await target.click();

    await expect(content.locator('table')).toHaveCount(2);
    await expect(content.locator('table').nth(1).locator('tr')).toHaveCount(2);
    await expect(content.locator('table').nth(1).locator('tr').first().locator('th, td')).toHaveCount(3);
  });

  test('leaving the grid resets the preview', async ({ page }) => {
    const root = await openStory(page, EDITOR_TABLE_ID);
    const content = root.locator('.et-rte-content');

    await content.locator('p').last().click();
    await root.getByRole('button', { name: 'Table' }).click();
    await page.getByRole('button', { name: '3 by 3' }).hover();
    await expect(page.locator('.et-rte-table-picker-cell--active')).toHaveCount(9);

    await page.mouse.move(0, 0);

    await expect(page.locator('.et-rte-table-picker-cell--active')).toHaveCount(0);
  });
});

test.describe('rich-text-editor / positioning', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: the selection toolbar and the anchored popover');

  const doubleClickWord = async (page: Page, content: Locator, word: string) => {
    const rect = await textRect(content, word);

    await page.mouse.dblclick((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);

    return rect;
  };

  test('the selection toolbar floats above the selected word', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await typeLines(page, ['one', 'two', 'three', 'four', 'Pick this word please']);
    const word = await doubleClickWord(page, content, 'word');

    const toolbar = page.locator('.et-rte-floating-toolbar-overlay');
    await expect(toolbar).toBeVisible();
    const box = await boxOf(toolbar);

    expect(box.y + box.height).toBeLessThanOrEqual(word.top + 1);
    expect(box.y + box.height).toBeGreaterThan(word.top - 24);
    expect(box.x).toBeLessThan(word.right);
    expect(box.x + box.width).toBeGreaterThan(word.left);
  });

  test('the selection toolbar follows a new selection', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');
    const toolbar = page.locator('.et-rte-floating-toolbar-overlay');

    await content.focus();
    await typeLines(page, ['one', 'two', 'three', 'four', 'Alpha beta', 'Gamma delta', 'Epsilon zeta']);
    await doubleClickWord(page, content, 'Alpha');
    await expect(toolbar).toBeVisible();
    const first = await boxOf(toolbar);

    const next = await doubleClickWord(page, content, 'Epsilon');
    await expect(toolbar).toHaveCount(1);
    const moved = await boxOf(toolbar);

    expect(moved.y).toBeGreaterThan(first.y + 10);
    expect(moved.y + moved.height).toBeLessThanOrEqual(next.top + 1);
  });

  test('the link editor opens anchored to the selection, not to the toolbar', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await typeLines(page, ['Line one', 'Line two', 'Line three', 'Link me here']);
    const selection = await selectText(content, 'Link me');
    await root.getByRole('button', { name: 'Link', exact: true }).click();

    const card = page.locator('et-rich-text-editor-link-editor');
    await expect(card.locator('.et-rte-link-editor-title')).toBeVisible();

    const box = await boxOf(card);
    const toolbar = await boxOf(root.locator('.et-rte-toolbar'));

    expect(Math.abs(box.y - selection.bottom)).toBeLessThan(40);
    expect(box.y).toBeGreaterThan(toolbar.y + toolbar.height);
  });
});

test.describe('rich-text-editor / touch toolbar', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: docked toolbar');

  test('the toolbar is out of view until the editor is tapped, then docks to the bottom edge', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const editor = root.locator('et-rich-text-editor');
    const dock = root.locator('.et-rte-toolbar-dock');

    await expect(dock).toHaveCSS('opacity', '0');
    await expect(dock).toHaveCSS('pointer-events', 'none');

    await tap(root.locator('.et-rte-content'));

    await expect(editor).toHaveClass(/et-rich-text-editor--docked-toolbar/);
    await expect(dock).toHaveCSS('opacity', '1');
    await expect(dock).toHaveCSS('position', 'fixed');
    await expect(dock).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    const box = await boxOf(dock);
    const viewport = viewportOf(page);

    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    expect(Math.round(box.width)).toBe(viewport.width);
  });

  test('the docked toolbar leaves again once focus moves out of the editor', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const editor = root.locator('et-rich-text-editor');

    await tap(root.locator('.et-rte-content'));
    await expect(editor).toHaveClass(/et-rich-text-editor--docked-toolbar/);

    await tap(root.locator('pre'));

    await expect(editor).not.toHaveClass(/et-rich-text-editor--docked-toolbar/);
  });

  test('a toolbar tap keeps the editor focused, so the keyboard stays up', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await tap(content);
    await tap(root.getByRole('button', { name: 'Bold' }));
    await page.keyboard.type('x');

    await expect(content).toBeFocused();
    await expect(content.locator('strong')).toHaveText('x');
  });

  test('a selection on touch does not open the floating toolbar', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID, { args: { value: 'Select these words' } });
    const content = root.locator('.et-rte-content');

    await tap(content);
    await selectText(content, 'these');
    await settle(page, 300);

    await expect(page.locator('.et-rte-floating-toolbar-overlay')).toHaveCount(0);
  });
});

test.describe('rich-text-editor / image drop', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: drag and drop');

  test('a dropped image file uploads into a placeholder at the drop point, then embeds', async ({ page }) => {
    const root = await openStory(page, EDITOR_IMAGES_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await typeLines(page, ['top', 'bottom']);
    await page.keyboard.press('ControlOrMeta+Home');

    const bottom = await textRect(content, 'bottom');
    await dropFileAt(page, { x: bottom.right - 1, y: (bottom.top + bottom.bottom) / 2 }, DROPPED_IMAGE_PATH);

    await expect(content.getByRole('img')).toHaveCount(1);
    await expect(content.locator('img')).toHaveCount(1, { timeout: 5000 });
    await expectValueMatching(page, /^top\s+bottom\s+!\[[^\]]*\]\(\/assets\/rich-text-editor-image\.svg/);
  });

  test('a file dropped on an editor without the image tool is refused', async ({ page }) => {
    const root = await openStory(page, EDITOR_DEFAULT_ID);
    const content = root.locator('.et-rte-content');

    await content.focus();
    await page.keyboard.type('text');

    const box = await boxOf(content);
    await dropFileAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, DROPPED_IMAGE_PATH);
    await settle(page, 300);

    await expect(content.locator('img')).toHaveCount(0);
    await expectValue(page, 'text');
  });
});

test.describe('multi-language rich-text-editor / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard menu');

  test('picking a language with the keyboard hands focus back to the editor', async ({ page }) => {
    const root = await openStory(page, ML_DEFAULT_ID);
    const content = root.locator('.et-rte-content');
    const trigger = root.locator('.et-ml-rte-lang-trigger');

    await content.focus();
    await page.keyboard.type('Hello');
    await trigger.click();
    await expect(page.getByRole('menuitemradio', { name: /Deutsch/ })).toBeVisible();

    await pressKey(page, 'ArrowDown');
    await pressKey(page, 'Enter');

    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('de');
    await expect(content).toBeFocused();

    await page.keyboard.type('Hallo');
    await expect(content).toHaveText('Hallo');
  });

  test('picking a language by click hands focus back to the editor', async ({ page }) => {
    const root = await openStory(page, ML_WITH_TRANSLATIONS_ID);
    const content = root.locator('.et-rte-content');

    await root.locator('.et-ml-rte-lang-trigger').click();
    await page.getByRole('menuitemradio', { name: /Français/ }).click();

    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('fr');
    await expect(content).toBeFocused();
  });
});

test.describe('multi-language rich-text-editor / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: menu without focus theft');

  test('opening the language menu keeps focus in the editor, and a pick keeps the toolbar docked', async ({ page }) => {
    const root = await openStory(page, ML_WITH_TRANSLATIONS_ID);
    const content = root.locator('.et-rte-content');
    const editor = root.locator('et-rich-text-editor');

    await tap(content);
    await expect(editor).toHaveClass(/et-rich-text-editor--docked-toolbar/);

    await tap(root.locator('.et-ml-rte-lang-trigger'));
    const deutsch = page.getByRole('menuitemradio', { name: /Deutsch/ });
    await expect(deutsch).toBeVisible();
    await expect(content).toBeFocused();

    await tap(deutsch);

    await expect(root.locator('.et-ml-rte-lang-trigger-code')).toHaveText('de');
    await expect(content).toBeFocused();
    await expect(content).toContainText('Willkommen');
    await expect(editor).toHaveClass(/et-rich-text-editor--docked-toolbar/);
  });
});

const caretBlockText = (page: Page) =>
  page.evaluate(() => {
    const node = document.getSelection()?.anchorNode ?? null;
    const element = node instanceof Element ? node : (node?.parentElement ?? null);

    return element?.closest('th, td, h2, p')?.textContent ?? null;
  });

const clickEndOf = async (page: Page, content: Locator, text: string) => {
  await content.locator('th, td', { hasText: text }).click();
  await page.keyboard.press('End');
};

test.describe('rich-text-editor / table caret navigation', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: arrow keys');

  test('ArrowUp on the second line of a header cell stays in the cell, the next one leaves the table', async ({
    page,
  }) => {
    const root = await openStory(page, EDITOR_TABLE_ID);
    const content = root.locator('.et-rte-content');

    await clickEndOf(page, content, 'Team');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Club');
    await expect(content.locator('th').first().locator('br')).toHaveCount(1);

    await pressKey(page, 'ArrowUp');
    await expect.poll(() => caretBlockText(page)).toBe('TeamClub');

    await pressKey(page, 'ArrowUp');
    await expect.poll(() => caretBlockText(page)).toBe('Standings');
  });

  test('ArrowDown on the first line of a last-row cell stays in the cell, the next one leaves the table', async ({
    page,
  }) => {
    const root = await openStory(page, EDITOR_TABLE_ID);
    const content = root.locator('.et-rte-content');

    await clickEndOf(page, content, 'Hamburg');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('North');
    await pressKey(page, 'ArrowUp');
    await expect.poll(() => caretBlockText(page)).toBe('HamburgNorth');

    await pressKey(page, 'ArrowDown');
    await expect.poll(() => caretBlockText(page)).toBe('HamburgNorth');

    await pressKey(page, 'ArrowDown');
    await expect.poll(() => caretBlockText(page)).toBe('A right-aligned paragraph after the table.');
  });

  test('Shift+ArrowDown in the last row extends the selection instead of leaving the table', async ({ page }) => {
    const root = await openStory(page, EDITOR_TABLE_ID);
    const content = root.locator('.et-rte-content');

    await clickEndOf(page, content, 'Hamburg');
    await pressKey(page, 'Shift+ArrowDown');

    expect(await page.evaluate(() => document.getSelection()?.isCollapsed)).toBe(false);
  });
});
