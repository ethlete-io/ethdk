import { Locator, Page, expect } from '@playwright/test';

export interface FocusedDescriptor {
  tag: string;
  role: string | null;
  name: string | null;
  testId: string | null;
  text: string | null;
}

export async function expectFocusVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();

  const state = await locator.evaluate((el) => {
    const style = getComputedStyle(el);

    return {
      matchesFocusVisible: el.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    };
  });

  expect(state.matchesFocusVisible).toBe(true);

  const hasVisibleOutline =
    state.outlineStyle !== 'none' && state.outlineColor !== 'transparent' && state.outlineColor !== 'rgba(0, 0, 0, 0)';
  const hasVisibleBoxShadow = state.boxShadow !== 'none';

  expect(hasVisibleOutline || hasVisibleBoxShadow).toBe(true);
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
