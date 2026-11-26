import { CDPSession, Locator, Page, expect } from '@playwright/test';

const SETTLE_MS = 50;

export async function expectTouchMode(page: Page): Promise<void> {
  const isCoarsePointer = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

  expect(isCoarsePointer).toBe(true);
}

export async function tap(locator: Locator, settleMs = SETTLE_MS): Promise<void> {
  await locator.tap();
  await locator.page().waitForTimeout(settleMs);
}

export interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchDragOptions {
  /** Time the finger rests on `from` before it moves, for long-press gestures. */
  holdMs?: number;
  /**
   * Pace the hold and the moves by advancing an installed `page.clock` instead of waiting. A clock in
   * its natural mode can fire a page timer late, so a long press under `clock.install` may move
   * before it arms. Under a paused clock, page code that reads `Date.now()` sees the gesture's own
   * pace however slowly a loaded machine delivers it.
   */
  clock?: boolean;
  steps?: number;
  /**
   * Stamp every event `stepMs` after the previous one, and send the next move only once the page has
   * seen the last. The browser derives a native fling from the timestamps of the moves it did not
   * coalesce, so a paced swipe flings the same distance however slowly a loaded machine delivers it.
   */
  stepMs?: number;
}

const DEFAULT_STEP_MS = 16;

function nextFrame(page: Page): Promise<void> {
  return page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** Drags one finger from `from` to `to` through CDP, so the page sees real touch events, not synthesized pointer events. */
export async function touchDrag(
  page: Page,
  from: TouchPoint,
  to: TouchPoint,
  opts: TouchDragOptions = {},
): Promise<void> {
  const { holdMs = 0, clock = false, steps = 12, stepMs } = opts;
  const client: CDPSession = await page.context().newCDPSession(page);
  const pause = (ms: number) => (clock ? page.clock.runFor(ms) : page.waitForTimeout(ms));
  const startedAt = Date.now() / 1000;
  const stampAt = (ms: number) => (stepMs === undefined ? {} : { timestamp: startedAt + ms / 1000 });
  const step = stepMs ?? DEFAULT_STEP_MS;
  const advance = () => (stepMs === undefined ? pause(step) : nextFrame(page));

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
    ...stampAt(0),
  });
  if (stepMs !== undefined) await nextFrame(page);

  if (holdMs > 0) await pause(holdMs);

  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
      ...stampAt(holdMs + (i - 1) * step),
    });
    await advance();
  }

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
    ...stampAt(holdMs + steps * step),
  });
}

export async function touchSwipe(page: Page, from: TouchPoint, to: TouchPoint, steps = 12): Promise<void> {
  await touchDrag(page, from, to, { steps });
}
