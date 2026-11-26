import { Locator, Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * The locator's bounding box. Throws when the element has none, so a gesture never runs on
 * `NaN` coordinates and silently passes.
 */
export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();

  if (!box) throw new Error(`${locator} has no bounding box`);

  return box;
}

/** The page viewport size. Throws when the run has no fixed viewport. */
export function viewportOf(page: Page): ViewportSize {
  const viewport = page.viewportSize();

  if (!viewport) throw new Error('the page has no viewport size');

  return viewport;
}

export interface Span {
  start: number;
  end: number;
}

/**
 * The on-screen horizontal span of every absolutely positioned `::after` drawn inside `scope`,
 * the scope's own included. A pseudo-element has no box of its own, so it is derived from its
 * host's box and computed `left`/`width`, minus the host's scroll offset when the host scrolls.
 */
export function afterSpansIn(scope: Locator): Promise<Span[]> {
  return scope.evaluate((root) =>
    [root, ...root.querySelectorAll('*')].flatMap((el) => {
      const after = getComputedStyle(el, '::after');

      if (after.content === 'none' || after.display === 'none' || after.position !== 'absolute') {
        return [];
      }

      const scrolls = getComputedStyle(el).overflowX !== 'visible';
      const start =
        el.getBoundingClientRect().left + el.clientLeft + parseFloat(after.left) - (scrolls ? el.scrollLeft : 0);

      return [{ start: Math.round(start), end: Math.round(start + parseFloat(after.width)) }];
    }),
  );
}
