import { Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-kbd--default';
const APPLE_STORY_ID = 'components-data-display-kbd--apple';
const OTHER_STORY_ID = 'components-data-display-kbd--other';

const KBD = '.et-kbd';
const KEY = '.et-kbd-key';
const ALLY_TEXT = '.et-kbd-ally-text';

interface Chord {
  spoken: string;
  caps: string[];
}

const APPLE_CHORDS: Chord[] = [
  { spoken: 'Command K', caps: ['⌘', 'K'] },
  { spoken: 'Command K', caps: ['⌘', 'K'] },
  { spoken: 'Escape', caps: ['Esc'] },
  { spoken: 'Command S', caps: ['⌘', 'S'] },
  { spoken: 'Command Z', caps: ['⌘', 'Z'] },
  { spoken: 'Command Shift Z', caps: ['⌘', '⇧', 'Z'] },
  { spoken: 'Option Arrow up', caps: ['⌥', '↑'] },
  { spoken: 'Page down', caps: ['PgDn'] },
  { spoken: 'Command Plus', caps: ['⌘', '+'] },
];

const OTHER_CHORDS: Chord[] = [
  { spoken: 'Control K', caps: ['Ctrl', 'K'] },
  { spoken: 'Control K', caps: ['Ctrl', 'K'] },
  { spoken: 'Escape', caps: ['Esc'] },
  { spoken: 'Control S', caps: ['Ctrl', 'S'] },
  { spoken: 'Control Z', caps: ['Ctrl', 'Z'] },
  { spoken: 'Control Shift Z', caps: ['Ctrl', 'Shift', 'Z'] },
  { spoken: 'Alt Arrow up', caps: ['Alt', '↑'] },
  { spoken: 'Page down', caps: ['PgDn'] },
  { spoken: 'Control Plus', caps: ['Ctrl', '+'] },
];

function readChords(root: Locator): Promise<Chord[]> {
  return root.locator(KBD).evaluateAll((els) =>
    els.map((el) => ({
      spoken: el.querySelector('.et-kbd-ally-text')?.textContent?.trim() ?? '',
      caps: Array.from(el.querySelectorAll('kbd')).map((cap) => cap.textContent?.trim() ?? ''),
    })),
  );
}

function normalizeColor(value: string): string {
  return value.replace(/[\s,]/g, '');
}

function detectedModifierCap(page: Page): Promise<string> {
  return page.evaluate(() => (/mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'));
}

test.describe('kbd / structure', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a kbd adds no tab stop and never takes focus', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');

    const attributes = await root.locator(KBD).evaluateAll((els) =>
      els.map((el) => ({
        tabIndex: el.getAttribute('tabindex'),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
      })),
    );

    expect(attributes.every((it) => it.tabIndex === null && it.role === null && it.ariaLabel === null)).toBe(true);
  });

  test('every cap is a real kbd element nested directly in the host', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);

    const caps = await root.locator(KEY).evaluateAll((els) =>
      els.map((el) => ({
        tag: el.tagName,
        parentTag: el.parentElement?.tagName ?? null,
        ariaHidden: el.getAttribute('aria-hidden'),
      })),
    );

    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((cap) => cap.tag === 'KBD')).toBe(true);
    expect(caps.every((cap) => cap.parentTag === 'ET-KBD')).toBe(true);
    expect(caps.every((cap) => cap.ariaHidden === 'true')).toBe(true);
  });

  test('the host carries the spelled-out chord, visually hidden but in the a11y tree', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);
    const ally = root.locator(ALLY_TEXT).first();

    await expect(ally).toHaveText('Command K');

    const hidden = await ally.evaluate((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        position: style.position,
        clipPath: style.clipPath,
        display: style.display,
        visibility: style.visibility,
        isFirstChild: el.parentElement?.firstElementChild === el,
      };
    });

    expect(hidden.width).toBe(1);
    expect(hidden.height).toBe(1);
    expect(hidden.position).toBe('absolute');
    expect(hidden.clipPath).toBe('inset(50%)');
    expect(hidden.display).not.toBe('none');
    expect(hidden.visibility).toBe('visible');
    expect(hidden.isFirstChild).toBe(true);
  });

  test('platform="apple" prints the Apple glyphs and spells them out', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);

    expect(await readChords(root)).toEqual(APPLE_CHORDS);
  });

  test('platform="other" prints the spelled-out modifiers', async ({ page }) => {
    const root = await openStory(page, OTHER_STORY_ID);

    expect(await readChords(root)).toEqual(OTHER_CHORDS);
  });

  test('with no platform the glyphs follow the browser this runs in', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const expected = await detectedModifierCap(page);

    await expect(root.locator(KEY).first()).toHaveText(expected);
  });

  test('the documented design tokens carry their documented defaults', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);

    const tokens = await root
      .locator(KBD)
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        const read = (name: string) => style.getPropertyValue(name).trim();

        return {
          gap: read('--et-kbd-gap'),
          minInlineSize: read('--et-kbd-key-min-inline-size'),
          paddingInline: read('--et-kbd-key-padding-inline'),
          borderRadius: read('--et-kbd-key-border-radius'),
          fontSize: read('--et-kbd-font-size'),
          fontWeight: read('--et-kbd-font-weight'),
          computedGap: style.gap,
        };
      });

    expect(tokens).toEqual({
      gap: '3px',
      minInlineSize: '18px',
      paddingInline: '5px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500',
      computedGap: '3px',
    });

    const cap = await root
      .locator(KEY)
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);

        return {
          minInlineSize: style.minInlineSize,
          paddingInline: style.paddingInline,
          borderRadius: style.borderRadius,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        };
      });

    expect(cap).toEqual({
      minInlineSize: '18px',
      paddingInline: '5px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500',
    });
  });

  test('the tokens inherit, so one ancestor configures every cap below it', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);

    await root.evaluate((el) => {
      el.setAttribute('style', '--et-kbd-gap: 10px; --et-kbd-font-size: 20px; --et-kbd-key-border-radius: 9px');
    });

    const applied = await root.locator(KBD).evaluateAll((els) =>
      els.map((el) => {
        const cap = el.querySelector('.et-kbd-key') as HTMLElement;
        const capStyle = getComputedStyle(cap);

        return `${getComputedStyle(el).gap}/${capStyle.fontSize}/${capStyle.borderRadius}`;
      }),
    );

    expect(applied.every((it) => it === '10px/20px/9px')).toBe(true);
  });

  test('the cap colors resolve from the surface tokens, not from hardcoded values', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);

    const paint = await root
      .locator(KEY)
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);

        return {
          color: style.color,
          borderColor: style.borderColor,
          borderWidth: style.borderWidth,
          background: style.backgroundColor,
          muted: style.getPropertyValue('--et-surface-color-muted-solid').trim(),
          border: style.getPropertyValue('--et-surface-border-solid').trim(),
          interaction: style.getPropertyValue('--et-surface-interaction-solid').trim(),
        };
      });

    expect(normalizeColor(paint.color)).toBe(normalizeColor(paint.muted));
    expect(normalizeColor(paint.borderColor)).toBe(normalizeColor(paint.border));
    expect(paint.borderWidth).toBe('1px');
    expect(paint.interaction).not.toBe('');
    expect(paint.background).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('kbd / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on a cap moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);
    const cap = root.locator(KEY).first();

    await tap(cap);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(cap).toBeVisible();
  });

  test('a touch device with no platform set gets its own platform glyphs', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const expected = await detectedModifierCap(page);

    await expect(root.locator(KEY).first()).toHaveText(expected);
  });

  test('the caps stay laid out and legible on a touch viewport', async ({ page }) => {
    const root = await openStory(page, APPLE_STORY_ID);
    const caps = root.locator(KEY);

    const boxes = await caps.evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();

        return { width: rect.width, height: rect.height };
      }),
    );

    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((box) => box.width >= 18 && box.height > 0)).toBe(true);
  });
});
