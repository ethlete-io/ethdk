import { Locator, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-layout-divider--default';
const VERTICAL_STORY_ID = 'components-layout-divider--vertical';
const DECORATIVE_STORY_ID = 'components-layout-divider--decorative';

const DIVIDER = 'et-divider';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

interface DividerBox {
  display: string;
  blockSize: string;
  inlineSize: string;
  marginBlock: string;
  marginInline: string;
  alignSelf: string;
  background: string;
  width: number;
  height: number;
}

function readBox(divider: Locator): Promise<DividerBox> {
  return divider.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return {
      display: style.display,
      blockSize: style.blockSize,
      inlineSize: style.inlineSize,
      marginBlock: `${style.marginBlockStart} ${style.marginBlockEnd}`,
      marginInline: `${style.marginInlineStart} ${style.marginInlineEnd}`,
      alignSelf: style.alignSelf,
      background: style.backgroundColor,
      width: rect.width,
      height: rect.height,
    };
  });
}

function readTokens(divider: Locator): Promise<{ thickness: string; spacing: string; inset: string }> {
  return divider.evaluate((el) => {
    const read = (name: string) => getComputedStyle(el).getPropertyValue(name).trim();

    return {
      thickness: read('--et-divider-thickness'),
      spacing: read('--et-divider-spacing'),
      inset: read('--et-divider-inset'),
    };
  });
}

/** Resolves a custom property to the `rgb(...)` the browser would paint, so it can be compared to a computed colour. */
function resolveTokenColor(divider: Locator, token: string): Promise<string> {
  return divider.evaluate((el, name) => {
    const probe = document.createElement('div');

    probe.style.backgroundColor = getComputedStyle(el).getPropertyValue(name).trim();
    el.parentElement?.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();

    return resolved;
  }, token);
}

test.describe('divider / structure', () => {
  test('a horizontal divider is a separator with a matching aria-orientation', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const dividers = root.locator(DIVIDER);

    await expect(dividers).toHaveCount(2);
    await expect(root.getByRole('separator')).toHaveCount(2);

    for (const divider of await dividers.all()) {
      await expect(divider).toHaveAttribute('role', 'separator');
      await expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
      await expect(divider).toHaveAttribute('data-orientation', 'horizontal');
      await expect(divider).not.toHaveAttribute('aria-hidden', /.*/);
    }
  });

  test('a separator carries no value: it is not the window-splitter variant of the role', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const divider = root.locator(DIVIDER).first();

    await expect(divider).not.toHaveAttribute('aria-valuenow', /.*/);
    await expect(divider).not.toHaveAttribute('aria-valuemin', /.*/);
    await expect(divider).not.toHaveAttribute('aria-valuemax', /.*/);
    await expect(divider).not.toHaveAttribute('tabindex', /.*/);
  });

  test('decorative drops the role and hides the rule from assistive tech', async ({ page }) => {
    const root = await openStory(page, DECORATIVE_STORY_ID);
    const dividers = root.locator(DIVIDER);

    await expect(dividers).toHaveCount(2);
    await expect(root.getByRole('separator')).toHaveCount(0);

    for (const divider of await dividers.all()) {
      await expect(divider).toHaveAttribute('role', 'presentation');
      await expect(divider).toHaveAttribute('aria-hidden', 'true');
      await expect(divider).not.toHaveAttribute('aria-orientation', /.*/);
    }
  });

  test('a decorative rule is still drawn, it only loses its semantics', async ({ page }) => {
    const root = await openStory(page, DECORATIVE_STORY_ID);
    const box = await readBox(root.locator(DIVIDER).first());

    expect(box.blockSize).toBe('1px');
    expect(box.background).not.toBe(TRANSPARENT);
    expect(box.width).toBeGreaterThan(0);
  });

  test('the public tokens resolve to their documented defaults', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    expect(await readTokens(root.locator(DIVIDER).first())).toEqual({
      thickness: '1px',
      spacing: '8px',
      inset: '0px',
    });
  });

  test('a horizontal divider is one thickness tall, spaced along the block axis, and fills its container', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const divider = root.locator(DIVIDER).first();
    const box = await readBox(divider);

    expect(box.display).toBe('block');
    expect(box.blockSize).toBe('1px');
    expect(box.marginBlock).toBe('8px 8px');
    expect(box.marginInline).toBe('0px 0px');

    const available = await divider.evaluate((el) => {
      const parent = el.parentElement as HTMLElement;
      const style = getComputedStyle(parent);

      return parent.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
    });

    expect(box.width).toBeCloseTo(available, 0);
  });

  test('a vertical divider is a separator announced as vertical', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const dividers = root.locator(DIVIDER);

    await expect(dividers).toHaveCount(2);
    await expect(root.getByRole('separator')).toHaveCount(2);

    for (const divider of await dividers.all()) {
      await expect(divider).toHaveAttribute('aria-orientation', 'vertical');
      await expect(divider).toHaveAttribute('data-orientation', 'vertical');
    }
  });

  test('a vertical divider swaps its axes: one thickness wide, spaced inline, stretched by its flex parent', async ({
    page,
  }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const divider = root.locator(DIVIDER).first();
    const box = await readBox(divider);

    expect(box.inlineSize).toBe('1px');
    expect(box.marginInline).toBe('8px 8px');
    expect(box.marginBlock).toBe('0px 0px');
    expect(box.alignSelf).toBe('stretch');

    const buttonHeight = (await root.getByRole('button').first().boundingBox())?.height ?? 0;

    expect(buttonHeight).toBeGreaterThan(0);
    expect(box.height).toBeCloseTo(buttonHeight, 0);
  });

  test('the rule paints the surface border colour, and --et-divider-color overrides it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const divider = root.locator(DIVIDER).first();

    const surfaceBorder = await resolveTokenColor(divider, '--et-surface-border-solid');

    expect(surfaceBorder).not.toBe(TRANSPARENT);
    expect((await readBox(divider)).background).toBe(surfaceBorder);

    const overridden = await divider.evaluate((el) => {
      el.style.setProperty('--et-divider-color', 'rgb(255, 0, 0)');
      const background = getComputedStyle(el).backgroundColor;
      el.style.removeProperty('--et-divider-color');

      return background;
    });

    expect(overridden).toBe('rgb(255, 0, 0)');
  });

  test('a divider adds no tab stop of its own', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('Tab walks the controls a vertical divider separates and never lands on the rule', async ({ page }) => {
    await openStory(page, VERTICAL_STORY_ID);

    const sequence = await tabSequence(page, 3);

    expect(sequence.map(({ tag, text }) => [tag, text])).toEqual([
      ['BUTTON', 'Save'],
      ['BUTTON', 'Duplicate'],
      ['BUTTON', 'Delete'],
    ]);
    expect(sequence.every(({ role }) => role !== 'separator')).toBe(true);
  });
});

test.describe('divider / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('the rule keeps its thickness and spacing on a phone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const box = await readBox(root.locator(DIVIDER).first());

    expect(box.blockSize).toBe('1px');
    expect(box.marginBlock).toBe('8px 8px');
    expect(box.width).toBeGreaterThan(0);
    expect(box.background).not.toBe(TRANSPARENT);
  });

  test('a vertical divider still stretches to its neighbours on a touch viewport', async ({ page }) => {
    const root = await openStory(page, VERTICAL_STORY_ID);
    const box = await readBox(root.locator(DIVIDER).first());
    const buttonHeight = (await root.getByRole('button').first().boundingBox())?.height ?? 0;

    expect(box.inlineSize).toBe('1px');
    expect(box.height).toBeCloseTo(buttonHeight, 0);
  });

  test('a tap on a divider moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const divider = root.locator(DIVIDER).first();

    await tap(divider);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(divider).toBeVisible();
  });
});
