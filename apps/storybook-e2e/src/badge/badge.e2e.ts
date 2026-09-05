import { Locator, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-badge--default';
const FILLED_STORY_ID = 'components-data-display-badge--filled';
const OUTLINE_STORY_ID = 'components-data-display-badge--outline';
const LARGE_STORY_ID = 'components-data-display-badge--large';
const TRAILING_ICON_STORY_ID = 'components-data-display-badge--trailing-icon';

const BADGE = '.et-badge';
const ICON_SLOT = '.et-badge-icon';
const ICON = '.et-icon';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

interface BadgeChrome {
  background: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  primaryOpacity: string;
}

interface BadgeMetrics {
  fontSize: string;
  fontWeight: string;
  minBlockSize: string;
  paddingInline: string;
  gap: string;
  borderRadius: string;
  height: number;
  tokens: Record<string, string>;
}

function readChrome(badge: Locator): Promise<BadgeChrome> {
  return badge.evaluate((el) => {
    const style = getComputedStyle(el);

    return {
      background: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      borderWidth: style.borderWidth,
      primaryOpacity: style.getPropertyValue('--et-theme-color-primary-opacity').trim(),
    };
  });
}

function readMetrics(badge: Locator): Promise<BadgeMetrics> {
  return badge.evaluate((el) => {
    const style = getComputedStyle(el);
    const token = (name: string) => style.getPropertyValue(name).trim();

    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      minBlockSize: style.minBlockSize,
      paddingInline: style.paddingInlineStart,
      gap: style.gap,
      borderRadius: style.borderRadius,
      height: el.getBoundingClientRect().height,
      tokens: {
        gap: token('--et-badge-gap'),
        paddingInline: token('--et-badge-padding-inline'),
        minBlockSize: token('--et-badge-min-block-size'),
        borderRadius: token('--et-badge-border-radius'),
        fontSize: token('--et-badge-font-size'),
        fontWeight: token('--et-badge-font-weight'),
      },
    };
  });
}

function explicitlySizedBadges(root: Locator): Locator {
  return root.locator(`${BADGE}[data-size='sm'], ${BADGE}[data-size='lg']`);
}

test.describe('badge / structure', () => {
  test('a badge renders its projected label as its own text content', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(BADGE).first()).toHaveText('Default');
    await expect(root.locator(BADGE).nth(4)).toHaveText('3 errors');
  });

  test('the variant, size and icon alignment land on the host as data attributes', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badge = root.locator(BADGE).first();

    await expect(badge).toHaveAttribute('data-variant', 'tonal');
    await expect(badge).toHaveAttribute('data-size', 'md');
    await expect(badge).toHaveAttribute('data-icon-alignment', 'start');
  });

  test('md resolves every documented token to its default, and the badge is that tall', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const metrics = await readMetrics(root.locator(BADGE).first());

    expect(metrics.tokens).toEqual({
      gap: '4px',
      paddingInline: '8px',
      minBlockSize: '20px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '600',
    });

    expect(metrics.height).toBe(20);
    expect(metrics.fontSize).toBe('11px');
    expect(metrics.fontWeight).toBe('600');
    expect(metrics.borderRadius).toBe('999px');
  });

  test('each size scales padding, minimum height and font size together', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const sizes = await explicitlySizedBadges(root).evaluateAll((els) =>
      els.map((el) => {
        const style = getComputedStyle(el);

        return [el.getAttribute('data-size'), style.fontSize, style.minBlockSize, style.paddingInlineStart, style.gap];
      }),
    );

    expect(sizes).toEqual([
      ['sm', '10px', '16px', '6px', '3px'],
      ['lg', '12px', '24px', '10px', '5px'],
    ]);
  });

  test('md inherits a token set on an ancestor, while sm and lg set their own and win over it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const fontSizes = await root.evaluate((el) => {
      const host = el.querySelector('et-sb-badge') as HTMLElement;

      host.style.setProperty('--et-badge-font-size', '19px');

      const badges = Array.from(el.querySelectorAll('.et-badge')) as HTMLElement[];
      const measured = badges.map((badge) => [badge.getAttribute('data-size'), getComputedStyle(badge).fontSize]);

      host.style.removeProperty('--et-badge-font-size');

      return measured;
    });

    const bySize = (size: string) => fontSizes.filter(([data]) => data === size).map(([, fontSize]) => fontSize);

    expect(bySize('md').every((fontSize) => fontSize === '19px')).toBe(true);
    expect(bySize('sm')).toEqual(['10px']);
    expect(bySize('lg')).toEqual(['12px']);
  });

  test('the default variant is tonal: a tinted fill, no visible border', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const chrome = await readChrome(root.locator(BADGE).first());

    expect(chrome.primaryOpacity).toBe('0.16');
    expect(chrome.background).toContain('rgba');
    expect(chrome.background).not.toBe(TRANSPARENT);
    expect(chrome.borderColor).toBe(TRANSPARENT);
  });

  test('filled is a solid fill with the on-primary ink and no border', async ({ page }) => {
    const root = await openStory(page, FILLED_STORY_ID);
    const badge = root.locator(BADGE).first();

    await expect(badge).toHaveAttribute('data-variant', 'filled');

    const chrome = await readChrome(badge);

    expect(chrome.primaryOpacity).toBe('1');
    expect(chrome.background).not.toContain('rgba');
    expect(chrome.background).not.toBe(TRANSPARENT);
    expect(chrome.borderColor).toBe(TRANSPARENT);
  });

  test('outline is a transparent fill behind a coloured border', async ({ page }) => {
    const root = await openStory(page, OUTLINE_STORY_ID);
    const badge = root.locator(BADGE).first();

    await expect(badge).toHaveAttribute('data-variant', 'outline');

    const chrome = await readChrome(badge);

    expect(chrome.primaryOpacity).toBe('0');
    expect(chrome.background).toMatch(/, 0\)$/);
    expect(chrome.borderColor).not.toBe(TRANSPARENT);
    expect(chrome.borderWidth).toBe('1px');
    expect(chrome.color).toBe(chrome.borderColor);
  });

  test('an unset color picks up the ambient theme, and a named one overrides it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badges = root.locator(BADGE);

    await expect(badges.first()).toHaveClass(/et-color--inherited/);
    await expect(badges.nth(2)).toHaveClass(/et-color--success/);
    await expect(badges.nth(4)).toHaveClass(/et-color--danger/);

    const backgrounds = await badges.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));

    expect(backgrounds[2]).not.toBe(backgrounds[0]);
    expect(backgrounds[4]).not.toBe(backgrounds[2]);
  });

  test('the icon slot collapses when nothing is projected into it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const empty = root.locator(BADGE).first().locator(ICON_SLOT);

    await expect(empty).toHaveCount(1);
    expect(await empty.evaluate((el) => getComputedStyle(el).display)).toBe('none');
  });

  test('a projected icon is sized to 1em, so it tracks the badge font size', async ({ page }) => {
    for (const [id, expected] of [
      [DEFAULT_STORY_ID, 11],
      [LARGE_STORY_ID, 12],
    ] as const) {
      const root = await openStory(page, id);
      const badge = root.locator(BADGE, { has: page.locator(ICON) }).first();

      const sized = await badge.evaluate((el) => {
        const icon = el.querySelector('.et-icon') as HTMLElement;
        const rect = icon.getBoundingClientRect();

        return { width: rect.width, height: rect.height, fontSize: getComputedStyle(el).fontSize };
      });

      expect(sized.fontSize, id).toBe(`${expected}px`);
      expect(Math.round(sized.width), id).toBe(expected);
      expect(Math.round(sized.height), id).toBe(expected);
    }
  });

  test('an icon next to a label is decorative and hidden from assistive tech', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badge = root.locator(BADGE, { has: page.locator(ICON) }).first();

    await expect(badge.locator(ICON)).toHaveAttribute('aria-hidden', 'true');
    await expect(badge).toHaveText('Verified');
  });

  test('iconAlignment=start puts the icon before the label', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badge = root.locator(BADGE, { has: page.locator(ICON) }).first();

    await expect(badge).toHaveAttribute('data-icon-alignment', 'start');

    const sides = await badge.evaluate((el) => {
      const icon = el.querySelector('.et-icon') as HTMLElement;

      return { icon: icon.getBoundingClientRect().left, badge: el.getBoundingClientRect().left, width: el.clientWidth };
    });

    expect(sides.icon - sides.badge).toBeLessThan(sides.width / 2);
  });

  test('iconAlignment=end moves the icon past the label', async ({ page }) => {
    const root = await openStory(page, TRAILING_ICON_STORY_ID);
    const badge = root.locator(BADGE, { has: page.locator(ICON) }).first();

    await expect(badge).toHaveAttribute('data-icon-alignment', 'end');

    const sides = await badge.evaluate((el) => {
      const icon = el.querySelector('.et-icon') as HTMLElement;

      return { icon: icon.getBoundingClientRect().left, badge: el.getBoundingClientRect().left, width: el.clientWidth };
    });

    expect(sides.icon - sides.badge).toBeGreaterThan(sides.width / 2);
  });

  test('a badge is non-interactive: no role, no tabindex, nothing focusable inside', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badge = root.locator(BADGE).first();

    await expect(badge).not.toHaveAttribute('role', /.*/);
    await expect(badge).not.toHaveAttribute('tabindex', /.*/);
    await expect(root.getByRole('button')).toHaveCount(0);
    await expect(root.getByRole('link')).toHaveCount(0);

    const focusable = await root
      .locator(BADGE)
      .evaluateAll((els) =>
        els.reduce((count, el) => count + el.querySelectorAll('a[href], button, input, [tabindex]').length, 0),
      );

    expect(focusable).toBe(0);
  });

  test('a badge adds no tab stop of its own', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('a badge keeps its label on one line', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const layout = await root
      .locator(BADGE)
      .nth(4)
      .evaluate((el) => {
        const style = getComputedStyle(el);

        return { whiteSpace: style.whiteSpace, maxInlineSize: style.maxInlineSize, lines: el.getClientRects().length };
      });

    expect(layout.whiteSpace).toBe('nowrap');
    expect(layout.maxInlineSize).toBe('100%');
    expect(layout.lines).toBe(1);
  });
});

test.describe('badge / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on a badge moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badge = root.locator(BADGE).first();

    await tap(badge);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(badge).toHaveText('Default');
  });

  test('every badge stays laid out and on one line on a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const badges = root.locator(BADGE);

    await expect(badges).toHaveCount(10);

    const boxes = await badges.evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();

        return { width: rect.width, height: rect.height, lines: el.getClientRects().length };
      }),
    );

    expect(boxes.every((box) => box.width > 0 && box.height > 0 && box.lines === 1)).toBe(true);
  });

  test('the variant chrome and the size tokens survive a touch viewport', async ({ page }) => {
    const root = await openStory(page, LARGE_STORY_ID);
    const badge = root.locator(BADGE).first();

    const metrics = await readMetrics(badge);
    const chrome = await readChrome(badge);

    expect(metrics.height).toBe(24);
    expect(metrics.tokens.fontSize).toBe('12px');
    expect(chrome.primaryOpacity).toBe('0.16');
  });
});
