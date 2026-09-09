import { Locator, Page, expect, test } from '@playwright/test';
import { expectTouchMode, focusedDescriptor, openStory, tabSequence, tap } from '../support';

const SPINNER_STORY_ID = 'components-feedback-loader-spinner--default';
const SPINNER_WITHOUT_TRACK_STORY_ID = 'components-feedback-loader-spinner--without-track';
const SPINNER_DETERMINATE_STORY_ID = 'components-feedback-loader-spinner--determinate';
const SPINNER_DETERMINATE_COMPLETE_STORY_ID = 'components-feedback-loader-spinner--determinate-complete';
const SPINNER_THEMED_STORY_ID = 'components-feedback-loader-spinner--themed';
const PROGRESS_BAR_STORY_ID = 'components-feedback-loader-progress-bar--default';
const PROGRESS_BAR_INDETERMINATE_STORY_ID = 'components-feedback-loader-progress-bar--indeterminate';
const PROGRESS_BAR_COMPLETE_STORY_ID = 'components-feedback-loader-progress-bar--complete';
const BRAND_LOADER_STORY_ID = 'components-feedback-loader-brand-loader--default';

const SPINNER = '.et-spinner';
const PROGRESS_BAR = '.et-progress-bar';
const PROGRESS_BAR_TRACK = '.et-progress-bar__track';
const PROGRESS_BAR_PRIMARY = '.et-progress-bar__bar--primary';
const BRAND_LOADER = '.et-brand-loader';
const BRAND_LOADER_OUTLINE = '.et-brand-loader__outline';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

function runningAnimations(locator: Locator): Promise<string[]> {
  return locator.evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running')
      .map((animation) => (animation as CSSAnimation).animationName)
      .filter((name) => !!name),
  );
}

/** The determinate indicator eases into its value over 200ms, so this is polled rather than read once. */
function indicatorScale(locator: Locator): Promise<number> {
  return locator.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
}

function setToken(locator: Locator, token: string, value: string): Promise<void> {
  return locator.evaluate((el, [name, next]) => (el as HTMLElement).style.setProperty(name, next), [token, value] as [
    string,
    string,
  ]);
}

function setParentToken(locator: Locator, token: string, value: string): Promise<void> {
  return locator.evaluate((el, [name, next]) => (el.parentElement as HTMLElement).style.setProperty(name, next), [
    token,
    value,
  ] as [string, string]);
}

async function expectNoAriaValues(locator: Locator): Promise<void> {
  await expect(locator).not.toHaveAttribute('aria-valuenow', /.*/);
  await expect(locator).not.toHaveAttribute('aria-valuemin', /.*/);
  await expect(locator).not.toHaveAttribute('aria-valuemax', /.*/);
}

async function openWithReducedMotion(page: Page, id: string): Promise<Locator> {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const root = await openStory(page, id);

  expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  return root;
}

test.describe('loader / structure', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only: tab order and desktop layout');

  test('an indeterminate spinner is a progressbar without aria values', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner).toHaveAttribute('role', 'progressbar');
    await expectNoAriaValues(spinner);
  });

  test('a determinate spinner exposes valuenow, valuemin and valuemax', async ({ page }) => {
    const root = await openStory(page, SPINNER_DETERMINATE_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner).toHaveAttribute('role', 'progressbar');
    await expect(spinner).toHaveAttribute('aria-valuenow', '65');
    await expect(spinner).toHaveAttribute('aria-valuemin', '0');
    await expect(spinner).toHaveAttribute('aria-valuemax', '100');
  });

  test('a completed determinate spinner reports 100', async ({ page }) => {
    const root = await openStory(page, SPINNER_DETERMINATE_COMPLETE_STORY_ID);

    await expect(root.locator(SPINNER)).toHaveAttribute('aria-valuenow', '100');
  });

  test('a spinner has no accessible name of its own', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner).not.toHaveAttribute('aria-label', /.*/);
    await expect(spinner).not.toHaveAttribute('aria-labelledby', /.*/);
    await expect(spinner).toHaveAccessibleName('');
  });

  test('every spinner graphic is hidden from the accessibility tree', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner.locator('.et-spinner-track-container')).toHaveAttribute('aria-hidden', 'true');
    await expect(spinner.locator('.et-spinner-indeterminate-container')).toHaveAttribute('aria-hidden', 'true');

    const focusable = await spinner.locator('svg').evaluateAll((els) => els.map((el) => el.getAttribute('focusable')));

    expect(focusable.length).toBeGreaterThan(0);
    expect(focusable.every((value) => value === 'false')).toBe(true);
  });

  test('a determinate spinner hides its value graphic from the accessibility tree', async ({ page }) => {
    const root = await openStory(page, SPINNER_DETERMINATE_STORY_ID);

    await expect(root.locator('.et-spinner-determinate-graphic')).toHaveAttribute('aria-hidden', 'true');
  });

  test('a spinner adds no tab stop and carries no tabindex', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);

    await expect(root.locator(SPINNER)).not.toHaveAttribute('tabindex', /.*/);
    expect((await tabSequence(page, 1))[0]?.tag).toBe('BODY');
  });

  test('the diameter and strokeWidth inputs win over the size tokens', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    const box = await spinner.evaluate((el) => {
      const style = getComputedStyle(el);

      return {
        size: style.getPropertyValue('--et-spinner-size').trim(),
        strokeWidth: style.getPropertyValue('--et-spinner-stroke-width').trim(),
        width: style.width,
        height: style.height,
      };
    });

    expect(box.size).toBe('45px');
    expect(box.strokeWidth).toBe('2px');
    expect(box.width).toBe('45px');
    expect(box.height).toBe('45px');
  });

  test('track renders a ring that actually paints', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const track = root.locator('.et-spinner-track-circle');

    await expect(track).toHaveCount(1);
    expect(await track.evaluate((el) => getComputedStyle(el).stroke)).not.toBe(TRANSPARENT);
  });

  test('--et-spinner-track-color repaints the ring', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    await setToken(spinner, '--et-spinner-track-color', 'rgb(1, 2, 3)');

    expect(await root.locator('.et-spinner-track-circle').evaluate((el) => getComputedStyle(el).stroke)).toBe(
      'rgb(1, 2, 3)',
    );
  });

  test('a spinner without track renders no ring', async ({ page }) => {
    const root = await openStory(page, SPINNER_WITHOUT_TRACK_STORY_ID);

    await expect(root.locator(SPINNER)).toHaveCount(1);
    await expect(root.locator('.et-spinner-track-container')).toHaveCount(0);
  });

  test('an uncolored spinner keeps the currentColor of its context', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner).not.toHaveClass(/et-spinner--themed/);

    const { own, ambient } = await spinner.evaluate((el) => ({
      own: getComputedStyle(el).color,
      ambient: getComputedStyle(el.parentElement as HTMLElement).color,
    }));

    expect(own).toBe(ambient);
  });

  test('the color input paints the spinner from its own color scope', async ({ page }) => {
    const root = await openStory(page, SPINNER_THEMED_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner).toHaveClass(/et-spinner--themed/);

    const { own, ambient, token } = await spinner.evaluate((el) => {
      const style = getComputedStyle(el);

      return {
        own: style.color,
        ambient: getComputedStyle(el.parentElement as HTMLElement).color,
        token: style.getPropertyValue('--et-spinner-color').trim(),
      };
    });

    expect(own).not.toBe(ambient);
    expect(own).not.toBe(TRANSPARENT);
    expect(token).toBe(own);
  });

  test('the spinner sweeps at the documented 1333ms', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);

    const duration = await root
      .locator('.et-spinner-circle-left .et-spinner-circle-graphic')
      .evaluate((el) => getComputedStyle(el).animationDuration);

    expect(duration).toBe('1.333s');
  });

  // `--et-spinner-duration` is registered but never read by a rule, so the sweep keeps its hardcoded 1333ms -
  // `et-button` sets it to 700ms for its loading spinner and gets nothing.
  test.fail('--et-spinner-duration retimes the sweep', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);

    await setToken(root.locator(SPINNER), '--et-spinner-duration', '500ms');

    const duration = await root
      .locator('.et-spinner-circle-left .et-spinner-circle-graphic')
      .evaluate((el) => getComputedStyle(el).animationDuration);

    expect(duration).toBe('0.5s');
  });

  test('a spinner keeps animating under prefers-reduced-motion', async ({ page }) => {
    const root = await openWithReducedMotion(page, SPINNER_STORY_ID);

    expect(await runningAnimations(root.locator(SPINNER))).toContain('et-spinner-rotate');
  });

  test('a determinate progress bar exposes valuenow, valuemin and valuemax', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);

    await expect(bar).toHaveAttribute('role', 'progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '42');
    await expect(bar).toHaveAttribute('aria-valuemin', '0');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  test('a completed progress bar reports 100 and fills its track', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_COMPLETE_STORY_ID);

    await expect(root.locator(PROGRESS_BAR)).toHaveAttribute('aria-valuenow', '100');
    await expect.poll(() => indicatorScale(root.locator(PROGRESS_BAR_PRIMARY))).toBeCloseTo(1, 2);
  });

  test('the value drives the determinate indicator', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);

    await expect.poll(() => indicatorScale(root.locator(PROGRESS_BAR_PRIMARY))).toBeCloseTo(0.42, 2);
  });

  test('an indeterminate progress bar is a progressbar without aria values', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_INDETERMINATE_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);

    await expect(bar).toHaveAttribute('role', 'progressbar');
    await expectNoAriaValues(bar);
  });

  test('a progress bar has no accessible name of its own and hides its track', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);

    await expect(bar).not.toHaveAttribute('aria-label', /.*/);
    await expect(bar).toHaveAccessibleName('');
    await expect(bar.locator(PROGRESS_BAR_TRACK)).toHaveAttribute('aria-hidden', 'true');
  });

  test('a progress bar adds no tab stop and carries no tabindex', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);

    await expect(root.locator(PROGRESS_BAR)).not.toHaveAttribute('tabindex', /.*/);
    expect((await tabSequence(page, 1))[0]?.tag).toBe('BODY');
  });

  test('the progress bar track defaults to 4px and a pill radius', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);

    const track = await root.locator(PROGRESS_BAR_TRACK).evaluate((el) => {
      const style = getComputedStyle(el);

      return { height: style.height, radius: style.borderRadius, background: style.backgroundColor };
    });

    expect(track.height).toBe('4px');
    expect(track.radius).toBe('9999px');
    expect(track.background).not.toBe(TRANSPARENT);
  });

  test('the height and radius tokens inherit from above the host', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);

    await setParentToken(bar, '--et-progress-bar-height', '10px');
    await setParentToken(bar, '--et-progress-bar-border-radius', '2px');

    const track = await root.locator(PROGRESS_BAR_TRACK).evaluate((el) => {
      const style = getComputedStyle(el);

      return { height: style.height, radius: style.borderRadius };
    });

    expect(track.height).toBe('10px');
    expect(track.radius).toBe('2px');
  });

  test('the color tokens repaint the track and the indicator', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);

    await setToken(bar, '--et-progress-bar-track-color', 'rgb(1, 2, 3)');
    await setToken(bar, '--et-progress-bar-indicator-color', 'rgb(4, 5, 6)');

    expect(await root.locator(PROGRESS_BAR_TRACK).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(1, 2, 3)',
    );
    expect(
      await root
        .locator('.et-progress-bar__bar-inner')
        .first()
        .evaluate((el) => getComputedStyle(el).borderTopColor),
    ).toBe('rgb(4, 5, 6)');
  });

  test('the indeterminate sweep defaults to 2s and follows its duration token', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_INDETERMINATE_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);
    const primary = root.locator(PROGRESS_BAR_PRIMARY);

    expect(await primary.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('2s');

    await setToken(bar, '--et-progress-bar-duration', '500ms');

    expect(await primary.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('0.5s');
  });

  test('an indeterminate progress bar keeps animating under prefers-reduced-motion', async ({ page }) => {
    const root = await openWithReducedMotion(page, PROGRESS_BAR_INDETERMINATE_STORY_ID);

    expect(await runningAnimations(root.locator(PROGRESS_BAR))).toContain('et-progress-bar-primary-translate');
  });

  test('the brand loader is a progressbar labelled Loading', async ({ page }) => {
    const root = await openStory(page, BRAND_LOADER_STORY_ID);
    const loader = root.locator(BRAND_LOADER);

    await expect(loader).toHaveAttribute('role', 'progressbar');
    await expect(loader).toHaveAttribute('aria-label', 'Loading');
    await expect(loader).toHaveAccessibleName('Loading');
    await expectNoAriaValues(loader);
  });

  test('the brand loader hides its artwork and adds no tab stop', async ({ page }) => {
    const root = await openStory(page, BRAND_LOADER_STORY_ID);
    const loader = root.locator(BRAND_LOADER);

    await expect(loader.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(loader).not.toHaveAttribute('tabindex', /.*/);
    expect((await tabSequence(page, 1))[0]?.tag).toBe('BODY');
  });

  test('the brand loader sizes itself from --et-brand-loader-size at the brand ratio', async ({ page }) => {
    const root = await openStory(page, BRAND_LOADER_STORY_ID);
    const loader = root.locator(BRAND_LOADER);

    const initial = await loader.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
    }));

    expect(initial.width).toBeCloseTo(initial.rootFontSize * 10, 1);
    expect(initial.width / initial.height).toBeCloseTo(26.4369 / 20, 2);

    await setToken(loader, '--et-brand-loader-size', '64px');

    expect(await loader.evaluate((el) => el.getBoundingClientRect().width)).toBeCloseTo(64, 1);
  });

  test('the brand loader paints from its own accent token, not currentColor', async ({ page }) => {
    const root = await openStory(page, BRAND_LOADER_STORY_ID);
    const loader = root.locator(BRAND_LOADER);
    const outline = root.locator(BRAND_LOADER_OUTLINE);

    expect(await outline.evaluate((el) => getComputedStyle(el).stroke)).toBe('rgb(0, 255, 161)');

    await setToken(loader, '--et-brand-loader-accent', 'rgb(1, 2, 3)');

    expect(await outline.evaluate((el) => getComputedStyle(el).stroke)).toBe('rgb(1, 2, 3)');
  });

  test('the brand loader animates at 3200ms and follows its duration token', async ({ page }) => {
    const root = await openStory(page, BRAND_LOADER_STORY_ID);
    const loader = root.locator(BRAND_LOADER);
    const outline = root.locator(BRAND_LOADER_OUTLINE);

    expect(await outline.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('3.2s');

    await setToken(loader, '--et-brand-loader-duration', '1s');

    expect(await outline.evaluate((el) => getComputedStyle(el).animationDuration)).toBe('1s');
  });

  test('the brand loader keeps animating under prefers-reduced-motion', async ({ page }) => {
    const root = await openWithReducedMotion(page, BRAND_LOADER_STORY_ID);

    expect(await runningAnimations(root.locator(BRAND_LOADER))).toContain('et-brand-loader-outline');
  });
});

test.describe('loader / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only: presentation on a coarse pointer');

  test('the story runs in touch mode', async ({ page }) => {
    await openStory(page, SPINNER_STORY_ID);

    await expectTouchMode(page);
  });

  test('a tap on a loader moves no focus', async ({ page }) => {
    const root = await openStory(page, SPINNER_STORY_ID);
    const spinner = root.locator(SPINNER);

    await tap(spinner);

    expect((await focusedDescriptor(page)).tag).toBe('BODY');
    await expect(spinner).toBeVisible();
  });

  test('the spinner keeps its size and aria on a touch viewport', async ({ page }) => {
    const root = await openStory(page, SPINNER_DETERMINATE_STORY_ID);
    const spinner = root.locator(SPINNER);

    await expect(spinner).toHaveAttribute('aria-valuenow', '65');

    const box = await spinner.boundingBox();

    expect(box?.width).toBeCloseTo(45, 0);
    expect(box?.height).toBeCloseTo(45, 0);
  });

  test('the progress bar spans its container without overflowing the viewport', async ({ page }) => {
    const root = await openStory(page, PROGRESS_BAR_STORY_ID);
    const bar = root.locator(PROGRESS_BAR);

    await expect(bar).toBeVisible();

    const { barWidth, parentContentWidth, viewportWidth } = await bar.evaluate((el) => {
      const parent = el.parentElement as HTMLElement;
      const parentStyle = getComputedStyle(parent);

      return {
        barWidth: el.getBoundingClientRect().width,
        parentContentWidth:
          parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight),
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(barWidth).toBeGreaterThan(0);
    expect(barWidth).toBeCloseTo(parentContentWidth, 0);
    expect(barWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('the brand loader stays inside a touch viewport and keeps its label', async ({ page }) => {
    const root = await openStory(page, BRAND_LOADER_STORY_ID);
    const loader = root.locator(BRAND_LOADER);

    await expect(loader).toHaveAccessibleName('Loading');

    const { width, viewportWidth } = await loader.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      viewportWidth: document.documentElement.clientWidth,
    }));

    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(viewportWidth);
  });
});
