import { Locator, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-data-display-icon--default';

const ICON = '.et-icon';

interface IconBox {
  host: number;
  svg: number;
}

function readBoxes(icons: Locator): Promise<IconBox[]> {
  return icons.evaluateAll((els) =>
    els.map((el) => {
      const svg = el.querySelector('svg') as SVGElement;

      return {
        host: Math.round(el.getBoundingClientRect().width),
        svg: Math.round(svg.getBoundingClientRect().width),
      };
    }),
  );
}

test.describe('icon / structure', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('an icon adds no tab stop of its own', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('an unlabelled icon is decorative and carries no role or name', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const icons = root.locator(ICON);

    const attributes = await icons.evaluateAll((els) =>
      els.map((el) => ({
        ariaHidden: el.getAttribute('aria-hidden'),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        tabIndex: el.getAttribute('tabindex'),
      })),
    );

    expect(attributes.length).toBeGreaterThan(0);
    expect(attributes.every((it) => it.ariaHidden === 'true')).toBe(true);
    expect(attributes.every((it) => it.role === null)).toBe(true);
    expect(attributes.every((it) => it.ariaLabel === null)).toBe(true);
    expect(attributes.every((it) => it.tabIndex === null)).toBe(true);
    await expect(root.getByRole('img')).toHaveCount(0);
  });

  test('the directive names the icon in a class, without a variant', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const classes = await root.locator(ICON).evaluateAll((els) =>
      els.map((el) => {
        const names = Array.from(el.classList).filter((name) => name.startsWith('et-icon'));

        return names.join(' ');
      }),
    );

    expect(classes.every((it) => /^et-icon et-icon--et-(chevron|times)$/.test(it))).toBe(true);
    expect(classes.some((it) => it.endsWith('et-icon--et-chevron'))).toBe(true);
    expect(classes.some((it) => it.endsWith('et-icon--et-times'))).toBe(true);
  });

  test('an icon is an inline SVG, not an image or a font glyph', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const svgs = await root.locator(ICON).evaluateAll((els) =>
      els.map((el) => {
        const svg = el.querySelector('svg');

        return {
          svgCount: el.querySelectorAll('svg').length,
          imgCount: el.querySelectorAll('img').length,
          xmlns: svg?.getAttribute('xmlns') ?? null,
          width: svg?.getAttribute('width') ?? null,
          height: svg?.getAttribute('height') ?? null,
        };
      }),
    );

    expect(svgs.every((it) => it.svgCount === 1 && it.imgCount === 0)).toBe(true);
    expect(svgs.every((it) => it.xmlns === 'http://www.w3.org/2000/svg')).toBe(true);
    expect(svgs.every((it) => it.width === '100%' && it.height === '100%')).toBe(true);
  });

  test('the size comes from CSS on the host and the SVG fills it', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const boxes = await readBoxes(root.locator(ICON));

    expect(boxes.every((box) => box.svg === box.host)).toBe(true);

    const distinct = [...new Set(boxes.map((box) => box.host))].sort((a, b) => a - b);

    expect(distinct).toEqual([16, 24, 32, 48]);
  });

  test('the color comes from the host through currentColor', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const paints = await root.locator(ICON).evaluateAll((els) =>
      els.map((el) => {
        const shape = el.querySelector('svg *') as SVGElement;

        return {
          color: getComputedStyle(el).color,
          fillAttribute: shape.getAttribute('fill'),
          fill: getComputedStyle(shape).fill,
        };
      }),
    );

    expect(paints.every((it) => it.fillAttribute === 'currentColor')).toBe(true);
    expect(paints.every((it) => it.fill === it.color)).toBe(true);
    expect(new Set(paints.map((it) => it.color)).size).toBeGreaterThan(1);
  });

  test('the host carries no width, height or color of its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const inline = await root
      .locator(ICON)
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.cssText.replace(/\s+/g, ' ').trim()));

    expect(inline.every((it) => it === 'display: flex; align-items: center; justify-content: center;')).toBe(true);
  });
});

test.describe('icon / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on an icon moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const icon = root.locator(ICON).first();

    await tap(icon);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(icon).toBeVisible();
  });

  test('the CSS-driven sizes survive a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const boxes = await readBoxes(root.locator(ICON));

    expect(boxes.every((box) => box.svg === box.host)).toBe(true);
    expect([...new Set(boxes.map((box) => box.host))].sort((a, b) => a - b)).toEqual([16, 24, 32, 48]);
  });
});
