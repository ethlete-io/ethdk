import { Locator, Page, expect } from '@playwright/test';
import { pressKey } from './keyboard';

export interface FocusedDescriptor {
  tag: string;
  role: string | null;
  name: string | null;
  testId: string | null;
  text: string | null;
}

export async function expectFocusVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();

  // The ring fades in through a CSS transition, so a single read right after Tab can still see the
  // transparent start value.
  await expect
    .poll(() =>
      locator.evaluate((el) => {
        const style = getComputedStyle(el);
        const hasVisibleOutline =
          style.outlineStyle !== 'none' &&
          style.outlineColor !== 'transparent' &&
          style.outlineColor !== 'rgba(0, 0, 0, 0)';

        return {
          matchesFocusVisible: el.matches(':focus-visible'),
          hasVisibleRing: hasVisibleOutline || style.boxShadow !== 'none',
        };
      }),
    )
    .toEqual({ matchesFocusVisible: true, hasVisibleRing: true });
}

export async function focusedDescriptor(page: Page): Promise<FocusedDescriptor> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;

    if (!el || el === document.body) {
      return { tag: 'BODY', role: null, name: null, testId: null, text: null };
    }

    return {
      tag: el.tagName,
      role: el.getAttribute('role'),
      name: el.getAttribute('aria-label'),
      testId: el.getAttribute('data-testid'),
      text: el.textContent?.trim().replace(/\s+/g, ' ') ?? null,
    };
  });
}

export async function tabSequence(page: Page, n: number): Promise<FocusedDescriptor[]> {
  const descriptors: FocusedDescriptor[] = [];

  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    descriptors.push(await focusedDescriptor(page));
  }

  return descriptors;
}

/**
 * Form controls draw their focus ring on the surrounding `.et-form-field-control-frame`, not on
 * the focused element. Asserts that the control is `:focus-visible` and that the frame's border,
 * outline or shadow changes when the control loses focus.
 */
export async function expectFieldFocusVisible(control: Locator): Promise<void> {
  await expect(control).toBeFocused();

  const state = await control.evaluate(async (el) => {
    const frame = el.closest('.et-form-field-control-frame');

    if (!frame) return null;

    const read = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(frame.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
      const style = getComputedStyle(frame);
      return `${style.borderColor} ${style.outlineStyle} ${style.outlineColor} ${style.boxShadow}`;
    };

    const matchesFocusVisible = el.matches(':focus-visible');
    const focused = await read();

    (el as HTMLElement).blur();
    const blurred = await read();
    (el as HTMLElement).focus({ preventScroll: true });

    return { matchesFocusVisible, focused, blurred };
  });

  expect(state, 'control is not inside an .et-form-field-control-frame').not.toBeNull();
  expect(state?.matchesFocusVisible).toBe(true);
  expect(state?.focused).not.toBe(state?.blurred);
}

/**
 * Presses Tab up to `maxTabs` times and stops once `target` is the active element. The number of
 * tab stops before a component varies per story, so a test cannot count them.
 */
export async function tabUntilFocused(page: Page, target: Locator, maxTabs = 10): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    await pressKey(page, 'Tab');

    if (await target.evaluate((el) => el === document.activeElement)) return;
  }

  await expect(target).toBeFocused();
}
