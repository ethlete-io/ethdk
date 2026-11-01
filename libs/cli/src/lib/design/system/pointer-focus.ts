import { Browser } from '../thumb';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;
type Locator = ReturnType<Page['locator']>;

/** The computed style of an element that draws a focus ring. */
export type RingStyle = { outlineStyle: string; outlineWidth: string; outlineColor: string; boxShadow: string };

/**
 * What a probe reads from an element: its ring style, whether it holds focus, whether it takes text input, and whether
 * it is a control (a native interactive element or one with an ARIA widget role).
 */
export type RingProbe = { style: RingStyle; focused: boolean; textEntry: boolean; control: boolean };

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

const ringAfter = (probe: RingProbe | null | undefined): probe is RingProbe =>
  !!probe && !probe.textEntry && probe.focused && ringVisibleOf(probe.style);

const outlineOf = (style: RingStyle) => `outline ${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;

/**
 * The verdict of a pointer-focus check. A pointer click must leave no ring (text entry is exempt: browsers always match
 * `:focus-visible` there). A focus target that is no control - neither a `control` probe nor `activatable`, an element
 * the design declares an action for - must also stay without ring after a following key press that moves no focus;
 * on a control, browsers match `:focus-visible` after any key. Keyboard focus without a ring is a warning, not a
 * failure: another indicator, such as a focus-within wrapper, may draw it.
 */
export const pointerFocusVerdictOf = (options: {
  click: RingProbe | null;
  clickThenKey?: RingProbe | null;
  keyboard: { before: RingStyle; probe: RingProbe } | null;
  activatable?: boolean;
}): { failure: string | null; warning: string | null } => {
  const { click, clickThenKey, keyboard } = options;
  const failure = ringAfter(click)
    ? `shows a focus ring after a pointer click (${outlineOf(click.style)})`
    : !options.activatable && !clickThenKey?.control && ringAfter(clickThenKey)
      ? `shows a focus ring after a pointer click and a Shift press (${outlineOf(clickThenKey.style)})`
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

const TEXT_FREE_INPUTS = ['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'];

const CONTROL_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  ...[
    'button',
    'link',
    'checkbox',
    'radio',
    'switch',
    'tab',
    'option',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'treeitem',
    'gridcell',
    'combobox',
    'textbox',
    'searchbox',
    'slider',
    'spinbutton',
  ].map((role) => `[role="${role}"]`),
].join(', ');

/** Reads the ring probe of the element a locator names; `null` when it is not one the check visits. */
export const readRingProbe = async (locator: Locator) =>
  locator.evaluate(
    (element, { selector, textFree, control }) => {
      if (!element.matches(selector)) return null;

      const style = getComputedStyle(element);
      const type = element instanceof HTMLInputElement ? element.type : '';

      return {
        style: {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
        },
        focused: element.ownerDocument.activeElement === element,
        textEntry:
          element instanceof HTMLTextAreaElement ||
          (element instanceof HTMLElement && element.isContentEditable) ||
          (element instanceof HTMLInputElement && !textFree.includes(type)),
        control: element.matches(control),
      };
    },
    { selector: POINTER_FOCUS_SELECTOR, textFree: TEXT_FREE_INPUTS, control: CONTROL_SELECTOR },
  ) as Promise<RingProbe | null>;

/** Presses Tab so the last input is a key and the element itself does not hold focus. */
export const tabAwayFrom = async (page: Page, locator: Locator) => {
  await page.keyboard.press('Tab');

  if (await locator.evaluate((element) => element.ownerDocument.activeElement === element))
    await page.keyboard.press('Tab');
};

/** Presses Shift, which moves no focus but makes the browser treat the last input as a key, and reads the probe again. */
export const readRingAfterKey = async (options: {
  page: Page;
  locator: Locator;
  settle: (page: Page) => Promise<void>;
}) => {
  await options.page.keyboard.press('Shift');
  await options.settle(options.page);

  return readRingProbe(options.locator).catch(() => null);
};

/** The ring probes of one element: after a pointer click, after a Shift press that follows it, and after keyboard focus. */
export type PointerFocusProbes = {
  click: RingProbe | null;
  clickThenKey?: RingProbe | null;
  keyboard: { before: RingStyle; probe: RingProbe } | null;
};

/**
 * Probes an element in two fresh pages: `open` returns the locator of the element on a freshly loaded page. The click
 * is a real mouse click at its centre after Tab presses that leave focus elsewhere, because a script focus after a pointer press paints the ring only when the last input was a key; keyboard focus follows a Shift press so the browser treats it as keyboard
 * focus.
 */
export const probePointerFocus = async (options: {
  open: () => Promise<{ page: Page; locator: Locator; close: () => Promise<void> }>;
  settle: (page: Page) => Promise<void>;
}): Promise<PointerFocusProbes | null> => {
  const clicked = await options.open();
  let click: RingProbe | null;
  let clickThenKey: RingProbe | null = null;

  try {
    await tabAwayFrom(clicked.page, clicked.locator);
    await clicked.locator.click();
    await options.settle(clicked.page);
    click = await readRingProbe(clicked.locator).catch(() => null);
    if (click) clickThenKey = await readRingAfterKey({ ...clicked, settle: options.settle });
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

    return { click, clickThenKey, keyboard: before && probe ? { before, probe } : null };
  } finally {
    await focused.close();
  }
};
