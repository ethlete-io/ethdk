import { Locator, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-media-picture--default';
const FIT_STORY_ID = 'components-media-picture--fit';
const NO_ASPECT_RATIO_STORY_ID = 'components-media-picture--no-aspect-ratio';

const PICTURE = '.et-picture';
const IMG = '.et-picture-img';

const HERO_ALT = 'A coloured block labelled with its aspect ratio';
const BROKEN_ALT = 'An image that fails to load';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const FIT_MODES = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;

function hero(root: Locator): Locator {
  return root.locator(PICTURE).first();
}

function pending(root: Locator): Locator {
  return root.locator(PICTURE).nth(1);
}

function broken(root: Locator): Locator {
  return root.locator(PICTURE).nth(2);
}

test.describe('picture / structure', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: tab order and a wide viewport');

  test('a picture renders figure > picture > img with the documented classes', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const picture = hero(root);

    const structure = await picture.evaluate((el) => {
      const figure = el.firstElementChild as HTMLElement;
      const inner = figure.firstElementChild as HTMLElement;
      const img = inner.querySelector('img') as HTMLImageElement;

      return {
        figureTag: figure.tagName,
        figureClass: figure.className,
        innerTag: inner.tagName,
        innerClass: inner.className,
        imgClass: img.className,
        imgParent: img.parentElement?.tagName,
      };
    });

    expect(structure.figureTag).toBe('FIGURE');
    expect(structure.figureClass).toContain('et-picture-figure');
    expect(structure.innerTag).toBe('PICTURE');
    expect(structure.innerClass).toContain('et-picture-picture');
    expect(structure.imgClass).toContain('et-picture-img');
    expect(structure.imgParent).toBe('PICTURE');
  });

  test('the img carries the alt text it was given', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(hero(root).locator(IMG)).toHaveAttribute('alt', HERO_ALT);
    await expect(broken(root).locator(IMG)).toHaveAttribute('alt', BROKEN_ALT);
  });

  test('the sources are rendered in order, ahead of the img, with their media queries', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const sources = hero(root).locator('source');

    await expect(sources).toHaveCount(2);

    const rendered = await hero(root).evaluate((el) =>
      Array.from(el.querySelectorAll('picture > *')).map((child) => ({
        tag: child.tagName,
        media: child.getAttribute('media'),
        srcset: child.getAttribute('srcset')?.slice(0, 20) ?? null,
      })),
    );

    expect(rendered.map((entry) => entry.tag)).toEqual(['SOURCE', 'SOURCE', 'IMG']);
    expect(rendered[0]?.media).toBe('(min-width: 700px)');
    expect(rendered[1]?.media).toBeNull();
    expect(rendered[0]?.srcset).toContain('data:image/svg+xml');
    expect(rendered[1]?.srcset).toContain('data:image/svg+xml');
  });

  test('a wide viewport resolves the art-directed source, not the fallback', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const currentSrc = await hero(root)
      .locator(IMG)
      .evaluate((el) => decodeURIComponent((el as HTMLImageElement).currentSrc));

    expect(currentSrc).toContain('wide 16:9');
  });

  test('priority loads the image eagerly at high fetch priority', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const img = hero(root).locator(IMG);

    await expect(img).toHaveAttribute('loading', 'eager');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  test('without priority the image is lazy at auto fetch priority', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const img = broken(root).locator(IMG);

    await expect(img).toHaveAttribute('loading', 'lazy');
    await expect(img).toHaveAttribute('fetchpriority', 'auto');
  });

  test('aspectRatio reserves the box on the img', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const img = hero(root).locator(IMG);

    expect(await img.evaluate((el) => getComputedStyle(el).aspectRatio)).toBe('16 / 9');

    const box = await img.boundingBox();

    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 1);
  });

  test('without aspectRatio the img reserves nothing', async ({ page }) => {
    const root = await openStory(page, NO_ASPECT_RATIO_STORY_ID);

    expect(
      await hero(root)
        .locator(IMG)
        .evaluate((el) => getComputedStyle(el).aspectRatio),
    ).toBe('auto');
  });

  test('the caption is a figcaption inside the figure', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const caption = hero(root).locator('.et-picture-figcaption');

    await expect(caption).toHaveText('A crop that follows the viewport.');
    expect(await caption.evaluate((el) => el.tagName)).toBe('FIGCAPTION');
    expect(await caption.evaluate((el) => el.parentElement?.tagName)).toBe('FIGURE');
  });

  test('the host mirrors the load state as data-state', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(hero(root)).toHaveAttribute('data-state', 'loaded');
    await expect(pending(root)).toHaveAttribute('data-state', 'loading');
    await expect(broken(root)).toHaveAttribute('data-state', 'error');
  });

  test('the loading placeholder is aria-hidden and the error slot is not', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(pending(root).locator('.et-picture-slot')).toHaveAttribute('aria-hidden', 'true');
    await expect(broken(root).locator('.et-picture-slot')).not.toHaveAttribute('aria-hidden', /.*/);
    await expect(broken(root).locator('.et-picture-slot')).toHaveText('This image is unavailable.');
  });

  test('a failed image stays in the DOM behind its error slot', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const img = broken(root).locator(IMG);

    await expect(img).toHaveCount(1);
    expect(await img.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
  });

  test('a picture adds no tab stop and declares no role of its own', async ({ page }) => {
    const root = await openStory(page, FIT_STORY_ID);
    const picture = hero(root);

    await expect(picture).not.toHaveAttribute('role', /.*/);
    await expect(picture).not.toHaveAttribute('tabindex', /.*/);
    await expect(picture.locator(IMG)).not.toHaveAttribute('tabindex', /.*/);
    expect((await tabSequence(page, 1))[0]?.tag).toBe('BODY');
  });

  test('the component paints nothing and drops the figure margin', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const picture = hero(root);

    const chrome = await picture.evaluate((el) => {
      const host = getComputedStyle(el);
      const figure = getComputedStyle(el.querySelector('.et-picture-figure') as HTMLElement);

      return {
        display: host.display,
        background: host.backgroundColor,
        border: host.borderWidth,
        figureMargin: figure.margin,
      };
    });

    expect(chrome.display).toBe('block');
    expect(chrome.background).toBe(TRANSPARENT);
    expect(chrome.border).toBe('0px');
    expect(chrome.figureMargin).toBe('0px');
  });

  test('the image never overflows the box its host was given', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const { imgWidth, hostWidth } = await hero(root).evaluate((el) => ({
      imgWidth: (el.querySelector('img') as HTMLImageElement).getBoundingClientRect().width,
      hostWidth: el.getBoundingClientRect().width,
    }));

    expect(imgWidth).toBeGreaterThan(0);
    expect(imgWidth).toBeLessThanOrEqual(hostWidth + 0.5);
  });

  test('fit marks the host and hands the box to object-fit', async ({ page }) => {
    const root = await openStory(page, FIT_STORY_ID);

    for (const [index, mode] of FIT_MODES.entries()) {
      const picture = root.locator(PICTURE).nth(index);

      await expect(picture).toHaveAttribute('data-fit', mode);
      expect(await picture.locator(IMG).evaluate((el) => getComputedStyle(el).objectFit), mode).toBe(mode);
    }
  });

  test('fit makes every wrapper fill the host box', async ({ page }) => {
    const root = await openStory(page, FIT_STORY_ID);

    const boxes = await root
      .locator(PICTURE)
      .first()
      .evaluate((el) => {
        const read = (node: Element) => {
          const rect = node.getBoundingClientRect();

          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        };

        return {
          host: read(el),
          hostContent: { width: el.clientWidth, height: el.clientHeight },
          figure: read(el.querySelector('.et-picture-figure') as HTMLElement),
          picture: read(el.querySelector('.et-picture-picture') as HTMLElement),
          img: read(el.querySelector('img') as HTMLImageElement),
        };
      });

    expect(boxes.host).toEqual({ width: 180, height: 120 });
    expect(boxes.figure).toEqual(boxes.hostContent);
    expect(boxes.picture).toEqual(boxes.hostContent);
    expect(boxes.img).toEqual(boxes.hostContent);
  });

  test('the decoded natural size is reported back once the image loads', async ({ page }) => {
    const root = await openStory(page, FIT_STORY_ID);

    await expect(root.getByText(/naturalSize:/)).toContainText('state: loaded');
    await expect(root.getByText(/naturalSize:/)).toContainText('naturalSize: 800 × 450');
    await expect(root.getByText(/naturalSize:/)).toContainText('naturalAspectRatio: 1.777');
    await expect(root.getByText(/naturalSize:/)).toContainText('from imgLoad: 1.777');
  });
});

test.describe('picture / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: presentation on a coarse pointer');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a narrow viewport resolves the art-directed portrait source', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const currentSrc = await hero(root)
      .locator(IMG)
      .evaluate((el) => decodeURIComponent((el as HTMLImageElement).currentSrc));

    expect(currentSrc).toContain('tall 3:4');
  });

  test('the image fits the touch viewport without overflowing it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const { imgWidth, viewportWidth, scrollWidth } = await hero(root).evaluate((el) => ({
      imgWidth: (el.querySelector('img') as HTMLImageElement).getBoundingClientRect().width,
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(imgWidth).toBeGreaterThan(0);
    expect(imgWidth).toBeLessThanOrEqual(viewportWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('a tap on the image moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const img = hero(root).locator(IMG);

    await tap(img);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(img).toBeVisible();
  });

  test('alt, caption and load state survive a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(hero(root).locator(IMG)).toHaveAttribute('alt', HERO_ALT);
    await expect(hero(root)).toHaveAttribute('data-state', 'loaded');
    await expect(hero(root).locator('.et-picture-figcaption')).toHaveText('A crop that follows the viewport.');
    await expect(broken(root)).toHaveAttribute('data-state', 'error');
  });
});
