import { Locator, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const DEFAULT_STORY_ID = 'components-feedback-skeleton--default';
const STATIC_STORY_ID = 'components-feedback-skeleton--static';

const SKELETON = '.et-skeleton';
const ITEM = '.et-skeleton-item';
const TEXT = '.et-skeleton-text';
const ALLY_TEXT = '.et-skeleton-ally-text';

interface Shimmer {
  content: string;
  animationName: string;
  animationDuration: string;
  animationIterationCount: string;
  animationPlayState: string;
}

function readShimmer(item: Locator): Promise<Shimmer> {
  return item.evaluate((el) => {
    const style = getComputedStyle(el, '::after');

    return {
      content: style.content,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
      animationPlayState: style.animationPlayState,
    };
  });
}

test.describe('skeleton / structure', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: keyboard focus order');

  test('a skeleton adds no tab stop of its own', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    const sequence = await tabSequence(page, 1);

    expect(sequence[0]?.tag).toBe('BODY');
  });

  test('the container is the live region that announces the wait', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const skeleton = root.locator(SKELETON);

    await expect(skeleton).toHaveCount(1);
    await expect(skeleton).toHaveAttribute('role', 'status');
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(root.getByRole('status')).toHaveText('Loading…');
  });

  test('the announcement is visually hidden but stays in the a11y tree, ahead of the shapes', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const ally = root.locator(ALLY_TEXT);

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

  test('every bone is hidden from assistive tech', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const bones = await root
      .locator(ITEM)
      .evaluateAll((els) => els.map((el) => ({ ariaHidden: el.getAttribute('aria-hidden'), text: el.textContent })));

    expect(bones.length).toBeGreaterThan(0);
    expect(bones.every((bone) => bone.ariaHidden === 'true')).toBe(true);
    expect(bones.every((bone) => bone.text === '')).toBe(true);
  });

  test('the container says "not yet" with the pointer too', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(SKELETON)).toHaveCSS('cursor', 'progress');
  });

  test('each shape is sized the way its shape says', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const shapes = await root.locator(SKELETON).evaluate((el) => {
      const measure = (selector: string) => {
        const node = el.querySelector(selector) as HTMLElement;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);

        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          borderRadius: style.borderRadius,
          display: style.display,
          fontSize: parseFloat(style.fontSize),
        };
      };

      return {
        circle: measure('[data-shape="circle"]'),
        rect: measure('[data-shape="rect"]'),
        text: measure('[data-shape="text"]'),
      };
    });

    expect(shapes.circle.width).toBe(40);
    expect(shapes.circle.height).toBe(40);
    expect(shapes.circle.borderRadius).toBe('50%');

    expect(shapes.rect.height).toBe(140);
    expect(shapes.rect.borderRadius).toBe('12px');
    expect(shapes.rect.display).toBe('block');

    expect(shapes.text.height).toBeCloseTo(shapes.text.fontSize * 0.85, 0);
  });

  test('a text bone dropped into running copy flows with the words', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const inline = root.locator(`p ${ITEM}`);

    await expect(inline).toHaveAttribute('data-shape', 'text');
    await expect(inline).toHaveCSS('display', 'inline-block');
    await expect(inline).toHaveCSS('vertical-align', 'middle');
  });

  test('et-skeleton-text draws its lines with a short last one', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const lines = await root
      .locator(`${TEXT} ${ITEM}`)
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.inlineSize));

    expect(lines).toEqual(['100%', '60%']);
  });

  test('the documented custom properties carry their documented defaults', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const tokens = await root.locator(SKELETON).evaluate((el) => {
      const style = getComputedStyle(el);
      const read = (name: string) => style.getPropertyValue(name).trim();

      return {
        radius: read('--et-skeleton-radius'),
        gap: read('--et-skeleton-gap'),
        duration: read('--et-skeleton-duration'),
        computedGap: style.gap,
        textGap: getComputedStyle(el.querySelector('.et-skeleton-text') as HTMLElement).gap,
      };
    });

    expect(tokens).toEqual({
      radius: '4px',
      gap: '8px',
      duration: '1.4s',
      computedGap: '8px',
      textGap: '8px',
    });
  });

  test('--et-skeleton-size sizes a circle and falls back to 1em when unset', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const circle = root.locator(`${ITEM}[data-shape='circle']`);

    const sized = await circle.evaluate((el) => {
      const rect = el.getBoundingClientRect();

      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });

    expect(sized).toEqual({ width: 40, height: 40 });

    const unsized = await circle.evaluate((el) => {
      el.removeAttribute('style');
      const rect = el.getBoundingClientRect();

      return {
        width: rect.width,
        height: rect.height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      };
    });

    expect(unsized.width).toBeCloseTo(unsized.fontSize, 1);
    expect(unsized.height).toBeCloseTo(unsized.fontSize, 1);
  });

  test('the bone tint is mixed from the surface it sits on', async ({ page }) => {
    const dark = await openStory(page, DEFAULT_STORY_ID, { args: { surface: 'dark' } });
    const onDark = await dark
      .locator(ITEM)
      .first()
      .evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        interaction: getComputedStyle(el).getPropertyValue('--et-surface-interaction-solid').trim(),
      }));

    const light = await openStory(page, DEFAULT_STORY_ID, { args: { surface: 'light' } });
    const onLight = await light
      .locator(ITEM)
      .first()
      .evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        interaction: getComputedStyle(el).getPropertyValue('--et-surface-interaction-solid').trim(),
      }));

    expect(onDark.interaction).not.toBe('');
    expect(onLight.interaction).not.toBe(onDark.interaction);
    expect(onLight.background).not.toBe(onDark.background);
  });

  test('the shimmer sweeps for as long as the loading lasts', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.locator(SKELETON)).toHaveClass(/et-skeleton--animated/);

    const shimmer = await readShimmer(root.locator(ITEM).first());

    expect(shimmer.content).not.toBe('none');
    expect(shimmer.animationName).toBe('et-skeleton-sweep');
    expect(shimmer.animationDuration).toBe('1.4s');
    expect(shimmer.animationIterationCount).toBe('infinite');
    expect(shimmer.animationPlayState).toBe('running');
  });

  test('a bone outside an animated container never shimmers on its own', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const shimmer = await readShimmer(root.locator(`p ${ITEM}`));

    expect(shimmer.content).toBe('none');
    expect(shimmer.animationName).toBe('none');
  });

  test('animated="false" drops the shimmer and keeps the shapes and the announcement', async ({ page }) => {
    const animated = await openStory(page, DEFAULT_STORY_ID);
    const animatedBones = await animated.locator(ITEM).count();

    const root = await openStory(page, STATIC_STORY_ID);
    const skeleton = root.locator(SKELETON);

    await expect(skeleton).not.toHaveClass(/et-skeleton--animated/);
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(root.getByRole('status')).toHaveText('Loading…');
    await expect(root.locator(ITEM)).toHaveCount(animatedBones);

    const shimmer = await readShimmer(root.locator(ITEM).first());

    expect(shimmer.content).toBe('none');
    expect(shimmer.animationName).toBe('none');
  });

  test('reduced motion omits the shimmer rather than pausing it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const root = await openStory(page, DEFAULT_STORY_ID);
    const skeleton = root.locator(SKELETON);

    await expect(skeleton).toHaveClass(/et-skeleton--animated/);
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');

    const shimmer = await readShimmer(root.locator(ITEM).first());

    expect(shimmer.content).toBe('none');
    expect(shimmer.animationName).toBe('none');

    const running = await root
      .locator(ITEM)
      .first()
      .evaluate((el) => el.getAnimations({ subtree: true }).length);

    expect(running).toBe(0);
  });

  test('reduced motion leaves the same shapes standing', async ({ page }) => {
    const motion = await openStory(page, DEFAULT_STORY_ID);
    const withMotion = await motion.locator(ITEM).evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();

        return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      }),
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });

    const reduced = await openStory(page, DEFAULT_STORY_ID);
    const withoutMotion = await reduced.locator(ITEM).evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();

        return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      }),
    );

    expect(withoutMotion).toEqual(withMotion);
  });
});

test.describe('skeleton / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: tap presentation');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, DEFAULT_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on a bone moves no focus and activates nothing', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);
    const bone = root.locator(ITEM).first();

    await tap(bone);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(bone).toBeVisible();
  });

  test('the placeholder keeps its shapes and its announcement on a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    await expect(root.getByRole('status')).toHaveText('Loading…');

    const shapes = await root.locator(SKELETON).evaluate((el) => {
      const measure = (selector: string) => {
        const rect = (el.querySelector(selector) as HTMLElement).getBoundingClientRect();

        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };

      return { circle: measure('[data-shape="circle"]'), rect: measure('[data-shape="rect"]') };
    });

    expect(shapes.circle).toEqual({ width: 40, height: 40 });
    expect(shapes.rect.height).toBe(140);
    expect(shapes.rect.width).toBeGreaterThan(0);
  });

  test('the shimmer still runs on a touch viewport', async ({ page }) => {
    const root = await openStory(page, DEFAULT_STORY_ID);

    const shimmer = await readShimmer(root.locator(ITEM).first());

    expect(shimmer.animationName).toBe('et-skeleton-sweep');
    expect(shimmer.animationIterationCount).toBe('infinite');
  });
});
