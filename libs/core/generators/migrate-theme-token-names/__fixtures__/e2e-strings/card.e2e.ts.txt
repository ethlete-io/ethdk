import { Locator, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-layout-card--default';
const ELEVATED_STORY_ID = 'components-layout-card--elevated';
const FILLED_STORY_ID = 'components-layout-card--filled';

const CARD = '.et-card';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

interface CardChrome {
  borderColor: string;
  borderWidth: string;
  boxShadow: string;
  background: string;
  surfaceBackground: string;
}

function readChrome(card: Locator): Promise<CardChrome> {
  return card.evaluate((el) => {
    const style = getComputedStyle(el);

    return {
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
      boxShadow: style.boxShadow,
      background: style.backgroundColor,
      surfaceBackground: style.getPropertyValue('--et-surface-background-solid').trim(),
    };
  });
}

test.describe('card / focus', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a card adds no tab stop of its own', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('a card carries no role, tabindex or label of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const card = root.locator(CARD).first();

    await expect(card).not.toHaveAttribute('role', /.*/);
    await expect(card).not.toHaveAttribute('tabindex', /.*/);
    await expect(card).not.toHaveAttribute('aria-label', /.*/);
    await expect(root.getByRole('button')).toHaveCount(0);
    await expect(root.getByRole('link')).toHaveCount(0);
  });

  test('a card projects its content as direct children in source order', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const card = root.locator(CARD).first();

    const children = await card.evaluate((el) =>
      Array.from(el.children).map((child) => `${child.tagName}:${child.textContent?.trim()}`),
    );

    expect(children).toEqual(['H3:Revenue', 'P:$12,400 this month']);
  });

  test('the projected headings stay real headings inside the card', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.getByRole('heading', { level: 3 })).toHaveCount(2);
  });

  test('the default variant is outlined and draws a border, not a shadow', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const card = root.locator(CARD).first();

    await expect(card).toHaveAttribute('data-variant', 'outlined');

    const chrome = await readChrome(card);

    expect(chrome.borderWidth).toBe('1px');
    expect(chrome.borderColor).not.toBe(TRANSPARENT);
    expect(chrome.boxShadow).toBe('none');
  });

  test('the elevated variant draws a shadow instead of a border', async ({ page }) => {
    const root = await openStory(page, ELEVATED_STORY_ID);
    const card = root.locator(CARD).first();

    await expect(card).toHaveAttribute('data-variant', 'elevated');

    const chrome = await readChrome(card);

    expect(chrome.boxShadow).not.toBe('none');
    expect(chrome.borderColor).toBe(TRANSPARENT);
  });

  test('the filled variant draws neither a border nor a shadow', async ({ page }) => {
    const root = await openStory(page, FILLED_STORY_ID);
    const card = root.locator(CARD).first();

    await expect(card).toHaveAttribute('data-variant', 'filled');

    const chrome = await readChrome(card);

    expect(chrome.boxShadow).toBe('none');
    expect(chrome.borderColor).toBe(TRANSPARENT);
  });

  test('every variant paints the surface background', async ({ page }) => {
    for (const id of [DEFAULT_STORY_ID, ELEVATED_STORY_ID, FILLED_STORY_ID]) {
      const root = await openStory(page, id);
      const chrome = await readChrome(root.locator(CARD).first());

      expect(chrome.background, id).not.toBe(TRANSPARENT);
      expect(chrome.surfaceBackground, id).not.toBe('');
    }
  });

  test('a card without a surface sits on the surface it is placed on', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const card = root.locator(CARD).first();

    await expect(card).toHaveClass(/et-surface--inherited/);
    await expect(card).not.toHaveAttribute('surface', /.*/);

    const { own, ambient } = await card.evaluate((el) => {
      const read = (node: Element) => getComputedStyle(node).getPropertyValue('--et-surface-background-solid').trim();

      return { own: read(el), ambient: read(el.parentElement as HTMLElement) };
    });

    expect(ambient).not.toBe('');
    expect(own).toBe(ambient);
  });

  test('a card with a surface scopes its own content to that surface', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const plain = root.locator(CARD).first();
    const scoped = root.locator(CARD).nth(1);

    await expect(scoped).toHaveClass(/et-surface--dark-elevated/);

    const plainChrome = await readChrome(plain);
    const scopedChrome = await readChrome(scoped);

    expect(scopedChrome.background).not.toBe(plainChrome.background);
    expect(scopedChrome.surfaceBackground).not.toBe(plainChrome.surfaceBackground);

    const projectedSurface = await scoped
      .locator('h3')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--et-surface-background-solid').trim());

    expect(projectedSurface).toBe(scopedChrome.surfaceBackground);
  });

  test('an inline --et-card-padding wins over the default, and gap and radius keep theirs', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const card = root.locator(CARD).first();

    const box = await card.evaluate((el) => {
      const style = getComputedStyle(el);

      return { padding: style.padding, gap: style.gap, borderRadius: style.borderRadius, display: style.display };
    });

    expect(box.padding).toBe('20px');
    expect(box.gap).toBe('12px');
    expect(box.borderRadius).toBe('8px');
    expect(box.display).toBe('flex');
  });
});

test.describe('card / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on a card moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const card = root.locator(CARD).first();

    await tap(card);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(card).toBeVisible();
  });

  test('both cards stay laid out and readable on a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const cards = root.locator(CARD);

    await expect(cards).toHaveCount(2);

    for (let i = 0; i < 2; i++) {
      const box = await cards.nth(i).boundingBox();

      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect(box?.height ?? 0).toBeGreaterThan(0);
    }
  });

  test('the variant chrome survives a touch viewport', async ({ page }) => {
    const root = await openStory(page, ELEVATED_STORY_ID);
    const chrome = await readChrome(root.locator(CARD).first());

    expect(chrome.boxShadow).not.toBe('none');
    expect(chrome.borderColor).toBe(TRANSPARENT);
  });
});
