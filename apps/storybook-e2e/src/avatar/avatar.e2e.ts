import { Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-avatar--default';
const SQUARE_STORY_ID = 'components-data-display-avatar--square';
const LARGE_STORY_ID = 'components-data-display-avatar--large';
const ALL_SHOWN_STORY_ID = 'components-data-display-avatar--all-avatars-shown';

const AVATAR = '.et-avatar';
const STANDALONE_AVATAR = 'et-avatar:not(et-avatar-group et-avatar)';
const GROUP = '.et-avatar-group';
const OVERFLOW = '.et-avatar-group-overflow';
const IMAGE = '.et-avatar-image';
const INITIALS = '.et-avatar-initials';

const LINK_NAMES = ['Jane Doe', 'John Smith', 'Cara Lee'];

const REMOTE_IMAGE_GLOB = '**/i.pravatar.cc/**';
const STUB_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#888"/></svg>';

/** The story's only image points at a real host; stub it so the image path does not depend on the network. */
async function stubRemoteImage(page: Page): Promise<void> {
  await page.route(REMOTE_IMAGE_GLOB, (route) => route.fulfill({ contentType: 'image/svg+xml', body: STUB_IMAGE }));
}

interface AvatarBox {
  width: number;
  height: number;
  fontSize: string;
  fontWeight: string;
  borderRadius: string;
  fontSizeToken: string;
  fontWeightToken: string;
  borderRadiusToken: string;
}

function readBox(avatar: Locator): Promise<AvatarBox> {
  return avatar.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const token = (name: string) => style.getPropertyValue(name).trim();

    return {
      width: rect.width,
      height: rect.height,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      borderRadius: style.borderRadius,
      fontSizeToken: token('--et-avatar-font-size'),
      fontWeightToken: token('--et-avatar-font-weight'),
      borderRadiusToken: token('--et-avatar-border-radius'),
    };
  });
}

function groupContents(group: Locator): Promise<{ text: string; hidden: boolean; overflow: boolean }[]> {
  return group.locator(AVATAR).evaluateAll((els) =>
    els.map((el) => ({
      text: el.textContent?.trim() ?? '',
      hidden: (el as HTMLElement).hidden,
      overflow: el.classList.contains('et-avatar-group-overflow'),
    })),
  );
}

test.describe('avatar / structure', () => {
  test('an avatar with a name and no image renders its initials, uppercased from first and last word', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).first();

    await expect(avatar.locator(INITIALS)).toHaveText('JD');
    await expect(avatar.locator(IMAGE)).toHaveCount(0);
  });

  test('an avatar with a src renders the image, and its alt is the name', async ({ page }) => {
    await stubRemoteImage(page);

    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).nth(2);
    const image = avatar.locator(IMAGE);

    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('alt', 'John Smith');
    await expect(avatar.locator(INITIALS)).toHaveCount(0);
  });

  test('an image that fails to load falls back to the initials derived from the same name', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).nth(3);

    await expect(avatar.locator(INITIALS)).toHaveText('FF');
    await expect(avatar.locator(IMAGE)).toHaveCount(0);
  });

  test('an avatar with neither src nor name renders projected content only - no image, no initials', async ({
    page,
  }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).nth(4);

    await expect(avatar.locator(IMAGE)).toHaveCount(0);
    await expect(avatar.locator(INITIALS)).toHaveCount(0);
    await expect(avatar).toHaveText('');
  });

  test('the size and shape inputs land on the host as data attributes', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).first();

    await expect(avatar).toHaveAttribute('data-size', 'md');
    await expect(avatar).toHaveAttribute('data-shape', 'circle');
  });

  test('the public tokens resolve, and md is the documented default diameter', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const box = await readBox(root.locator(STANDALONE_AVATAR).first());

    expect(box).toMatchObject({
      width: 40,
      height: 40,
      fontSize: '14px',
      fontWeight: '600',
      fontSizeToken: '14px',
      fontWeightToken: '600',
      borderRadiusToken: '999px',
    });
  });

  test('every documented size scales the diameter and the font size together', async ({ page }) => {
    const sizes: [size: string, diameter: number, fontSize: string][] = [
      ['xs', 24, '10px'],
      ['sm', 32, '12px'],
      ['md', 40, '14px'],
      ['lg', 48, '16px'],
      ['xl', 64, '20px'],
    ];

    for (const [size, diameter, fontSize] of sizes) {
      const root = await openStory(page, DEFAULT_STORY_ID, { args: { size } });
      const box = await readBox(root.locator(STANDALONE_AVATAR).first());

      expect(box.width, size).toBe(diameter);
      expect(box.height, size).toBe(diameter);
      expect(box.fontSizeToken, size).toBe(fontSize);
    }
  });

  test('shape=square swaps the pill radius for a rounded-square one', async ({ page }) => {
    const root = await openStory(page, SQUARE_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).first();

    await expect(avatar).toHaveAttribute('data-shape', 'square');

    const box = await readBox(avatar);

    expect(box.borderRadiusToken).toBe('8px');
    expect(box.borderRadius).toBe('8px');
    expect(box.width).toBe(40);
  });

  test('the initials background comes from the ambient colour theme unless color names one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatars = root.locator(STANDALONE_AVATAR);

    await expect(avatars.first()).toHaveClass(/et-color--inherited/);
    await expect(avatars.nth(4)).toHaveClass(/et-color--success/);

    const themed = await avatars.evaluateAll((els) =>
      els.map((el) => {
        const style = getComputedStyle(el);

        return { background: style.backgroundColor, color: style.color };
      }),
    );

    expect(themed[0]?.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(themed[4]?.background).not.toBe(themed[0]?.background);
    expect(themed[4]?.color).not.toBe(themed[0]?.color);
  });

  test('the fallback background is fully opaque, so initials never sit on what is behind them', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const backgrounds = await root
      .locator(STANDALONE_AVATAR)
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));

    expect(backgrounds.every((background) => !background.includes('rgba'))).toBe(true);
  });

  test('a group overlaps its avatars and rings each one in the surface it sits on', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP).first();

    const ring = await group.evaluate((el) => {
      const style = getComputedStyle(el);
      const avatars = Array.from(el.querySelectorAll('.et-avatar')) as HTMLElement[];
      const visible = avatars.filter((avatar) => !avatar.hidden);

      return {
        overlap: style.getPropertyValue('--et-avatar-group-overlap').trim(),
        ringWidth: style.getPropertyValue('--et-avatar-group-ring-width').trim(),
        surface: style.getPropertyValue('--et-surface-background-solid').trim(),
        firstMargin: getComputedStyle(visible[0] as HTMLElement).marginInlineStart,
        secondMargin: getComputedStyle(visible[1] as HTMLElement).marginInlineStart,
        shadow: getComputedStyle(visible[1] as HTMLElement).boxShadow,
      };
    });

    expect(ring.overlap).toBe('8px');
    expect(ring.ringWidth).toBe('2px');
    expect(ring.firstMargin).toBe('0px');
    expect(ring.secondMargin).toBe('-8px');
    expect(ring.shadow).toContain('0px 0px 0px 2px');
    expect(ring.surface).not.toBe('');
  });

  test('maxVisible counts the projected avatars and appends a +N of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    expect(await groupContents(root.locator(GROUP).first())).toEqual([
      { text: 'JD', hidden: false, overflow: false },
      { text: 'JS', hidden: false, overflow: false },
      { text: 'CL', hidden: false, overflow: false },
      { text: 'AB', hidden: true, overflow: false },
      { text: 'GH', hidden: true, overflow: false },
      { text: '+2', hidden: false, overflow: true },
    ]);
  });

  test('an avatar over the limit leaves the row entirely instead of holding its overlap slot', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const displays = await root
      .locator(GROUP)
      .first()
      .locator(`${AVATAR}[hidden]`)
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).display));

    expect(displays).toEqual(['none', 'none']);
  });

  test('maxVisible=1 counts the other four into the overflow avatar', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { maxVisible: 1 } });
    const group = root.locator(GROUP).first();

    await expect(group.locator(OVERFLOW)).toHaveText('+4');
    await expect(group.locator(`${AVATAR}:not([hidden])`)).toHaveCount(2);
  });

  test('a maxVisible that covers every avatar appends no +N', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID, { args: { maxVisible: 5 } });
    const group = root.locator(GROUP).first();

    await expect(group.locator(OVERFLOW)).toHaveCount(0);
    await expect(group.locator(`${AVATAR}[hidden]`)).toHaveCount(0);
  });

  test('without maxVisible every projected avatar is shown and nothing is counted', async ({ page }) => {
    const root = await openStory(page, ALL_SHOWN_STORY_ID);

    expect(await groupContents(root.locator(GROUP).first())).toEqual([
      { text: 'JD', hidden: false, overflow: false },
      { text: 'JS', hidden: false, overflow: false },
      { text: 'CL', hidden: false, overflow: false },
      { text: 'AB', hidden: false, overflow: false },
      { text: 'GH', hidden: false, overflow: false },
    ]);
  });

  test('the overflow avatar copies the first projected avatar size, so nothing has to be kept in sync', async ({
    page,
  }) => {
    const root = await openStory(page, LARGE_STORY_ID);
    const overflow = root.locator(OVERFLOW).first();

    await expect(overflow).toHaveAttribute('data-size', 'lg');
    await expect(overflow).toHaveAttribute('data-shape', 'circle');
    expect((await readBox(overflow)).width).toBe(48);
  });

  test('the overflow avatar copies the first projected avatar shape too', async ({ page }) => {
    const root = await openStory(page, SQUARE_STORY_ID);
    const overflow = root.locator(OVERFLOW).first();

    await expect(overflow).toHaveAttribute('data-shape', 'square');
    expect((await readBox(overflow)).borderRadius).toBe('8px');
  });

  test('an avatar is presentational: no role, no tabindex, no label of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatars = root.locator(STANDALONE_AVATAR);

    await expect(avatars).toHaveCount(5);

    const attributes = await avatars.evaluateAll((els) =>
      els.map((el) => [el.getAttribute('role'), el.getAttribute('tabindex'), el.getAttribute('aria-label')]),
    );

    expect(attributes).toEqual([
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
  });

  test('only the avatars written as links are tab stops', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, LINK_NAMES.length + 1);

    expect(sequence.slice(0, LINK_NAMES.length).map((entry) => [entry.tag, entry.name])).toEqual(
      LINK_NAMES.map((name) => ['A', name]),
    );
    expect(sequence[LINK_NAMES.length]?.tag).toBe('BODY');
  });

  test('an avatar written as a link keeps its own href and accessible name', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const links = root.locator(`a${AVATAR}`);

    await expect(links).toHaveCount(LINK_NAMES.length);

    for (const [index, name] of LINK_NAMES.entries()) {
      await expect(links.nth(index)).toHaveAttribute('aria-label', name);
      await expect(links.nth(index)).toHaveAttribute('href', `#${name}`);
      await expect(links.nth(index)).toHaveAttribute('data-size', 'md');
    }
  });
});

test.describe('avatar / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on a plain avatar moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const avatar = root.locator(STANDALONE_AVATAR).first();

    await tap(avatar);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(avatar.locator(INITIALS)).toHaveText('JD');
  });

  test('the documented diameter survives a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const box = await readBox(root.locator(STANDALONE_AVATAR).first());

    expect(box.width).toBe(40);
    expect(box.height).toBe(40);
  });

  test('the group keeps its overlap and its +N on a phone', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const group = root.locator(GROUP).first();

    await expect(group.locator(OVERFLOW)).toHaveText('+2');
    await expect(group.locator(`${AVATAR}:not([hidden])`)).toHaveCount(4);

    const boxes = await group
      .locator(`${AVATAR}:not([hidden])`)
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));

    expect(boxes.every((width) => width === 40)).toBe(true);
  });
});
