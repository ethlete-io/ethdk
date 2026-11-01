import { Browser } from '../thumb';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;
type Locator = ReturnType<Page['locator']>;

/** The computed style of an element that draws a focus ring. */
export type RingStyle = { outlineStyle: string; outlineWidth: string; outlineColor: string; boxShadow: string };

/** What a probe reads from an element: its ring style, whether it holds focus, and whether it takes text input. */
export type RingProbe = { style: RingStyle; focused: boolean; textEntry: boolean };

const TRANSPARENT = /^transparent$|\/\s*0(\.0+)?\s*\)$|,\s*0(\.0+)?\s*\)$/;

/** Whether a computed outline draws a visible ring: a style other than none, a width above 0 and an opaque-enough colour. */
export const ringVisibleOf = (style: RingStyle) =>
  style.outlineStyle !== 'none' &&
  style.outlineStyle !== 'hidden' &&
  Number.parseFloat(style.outlineWidth) > 0 &&
  !TRANSPARENT.test(style.outlineColor.trim());

/** Whether focusing moved a ring onto the element: a visible outline, or a box-shadow that differs from the unfocused one. */
export const focusMarkedOf = (options: { before: RingStyle; after: RingStyle }) =>
  ringVisibleOf(options.after) ||
  (options.after.boxShadow !== 'none' && options.after.boxShadow !== options.before.boxShadow);

/**
 * The verdict of a pointer-focus check. A pointer click must leave no ring (text entry is exempt: browsers always
 * match `:focus-visible` there). Keyboard focus without a ring is a warning, not a failure: another indicator, such as
 * a focus-within wrapper, may draw it.
 */
export const pointerFocusVerdictOf = (options: {
  click: RingProbe | null;
  keyboard: { before: RingStyle; probe: RingProbe } | null;
}): { failure: string | null; warning: string | null } => {
  const { click, keyboard } = options;
  const failure =
    click && !click.textEntry && click.focused && ringVisibleOf(click.style)
      ? `shows a focus ring after a pointer click (outline ${click.style.outlineStyle} ${click.style.outlineWidth} ${click.style.outlineColor})`
      : null;
  const warning =
    keyboard && (!keyboard.probe.focused || !focusMarkedOf({ before: keyboard.before, after: keyboard.probe.style }))
      ? keyboard.probe.focused
        ? 'shows no focus ring on keyboard focus, so the click check proves nothing about it'
        : 'could not take keyboard focus'
      : null;

  return { failure, warning };
};

/** The elements the pointer-focus check visits. */
export const POINTER_FOCUS_SELECTOR =
  '[tabindex]:not([tabindex="-1"]), button, a[href], input:not([type="hidden"]), select, textarea, [contenteditable]';

const probeFn = `(element) => {
  if (!element.matches(${JSON.stringify(POINTER_FOCUS_SELECTOR)})) return null;
  const style = getComputedStyle(element);
  const type = element.tagName === 'INPUT' ? element.type : '';
  const textEntry =
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable ||
    (element.tagName === 'INPUT' && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(type));
  return {
    style: { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow },
    focused: document.activeElement === element,
    textEntry,
  };
}`;

/** Reads the ring probe of the element a locator names; `null` when it is not one the check visits. */
export const readRingProbe = async (locator: Locator) => (await locator.evaluate(probeFn)) as RingProbe | null;

/** The ring probes of one element: after a pointer click, and after keyboard focus. */
export type PointerFocusProbes = { click: RingProbe | null; keyboard: { before: RingStyle; probe: RingProbe } | null };

/**
 * Probes an element in two fresh pages: `open` returns the locator of the element on a freshly loaded page. The click
 * is a real mouse click at its centre; keyboard focus follows a Shift press so the browser treats it as keyboard
 * focus.
 */
export const probePointerFocus = async (options: {
  open: () => Promise<{ page: Page; locator: Locator; close: () => Promise<void> }>;
  settle: (page: Page) => Promise<void>;
}): Promise<PointerFocusProbes | null> => {
  const clicked = await options.open();
  let click: RingProbe | null;

  try {
    await clicked.locator.click();
    click = await readRingProbe(clicked.locator).catch(() => null);
  } finally {
    await clicked.close();
  }

  if (click === null) return null;

  const focused = await options.open();

  try {
    const before = (await readRingProbe(focused.locator))?.style;

    await focused.page.keyboard.press('Shift');
    await focused.locator.focus();
    await options.settle(focused.page);

    const probe = await readRingProbe(focused.locator);

    return { click, keyboard: before && probe ? { before, probe } : null };
  } finally {
    await focused.close();
  }
};
